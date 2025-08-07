/**
 * Tests for SnapshotService - Debounce and Batching Implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import * as Y from 'yjs';
import { SnapshotServiceImpl } from '../snapshot.service';

// Mock the calendar config
vi.mock('@shared/config/calendar-config', () => ({
  CALENDAR_CONFIG: {
    PERFORMANCE: {
      DEBOUNCE_DELAY: 300,
    },
  },
}));

describe('SnapshotService - Debounce and Batching', () => {
  let service: SnapshotServiceImpl;
  let mockDoc: Y.Doc;
  let mockSendToSupabase: Mock;

  beforeEach(() => {
    // Create fresh service instance
    service = new SnapshotServiceImpl();
    
    // Create mock Yjs document
    mockDoc = new Y.Doc();
    
    // Mock the private sendToSupabase method
    mockSendToSupabase = vi.fn().mockResolvedValue(undefined);
    (service as any).sendToSupabase = mockSendToSupabase;
    
    // Mock console methods to reduce test noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Use fake timers for precise timing control
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Clean up
    service.stopSnapshotBatching();
    mockDoc.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('10 Second Debounce Implementation', () => {
    it('should debounce snapshot calls for 10 seconds', async () => {
      const weekId = 'test-week-1';
      
      // Start batching
      service.startSnapshotBatching(weekId, mockDoc);
      
      // Mark changes multiple times within debounce window
      service.markPendingChanges();
      service.markPendingChanges();
      service.markPendingChanges();
      
      // Should not have called sendToSupabase yet
      expect(mockSendToSupabase).not.toHaveBeenCalled();
      
      // Advance time by 9 seconds (still within debounce window)
      vi.advanceTimersByTime(9000);
      expect(mockSendToSupabase).not.toHaveBeenCalled();
      
      // Advance time by 1 more second (10 seconds total)
      vi.advanceTimersByTime(1000);
      
      // Wait for async operations
      await vi.runAllTimersAsync();
      
      // Should have called sendToSupabase once
      expect(mockSendToSupabase).toHaveBeenCalledTimes(1);
    });

    it('should reset debounce timer on new changes', async () => {
      const weekId = 'test-week-2';
      
      service.startSnapshotBatching(weekId, mockDoc);
      service.markPendingChanges();
      
      // Advance 5 seconds
      vi.advanceTimersByTime(5000);
      
      // Mark new changes (should reset timer)
      service.markPendingChanges();
      
      // Advance another 5 seconds (10 seconds from first change, 5 from second)
      vi.advanceTimersByTime(5000);
      expect(mockSendToSupabase).not.toHaveBeenCalled();
      
      // Advance 5 more seconds (10 seconds from second change)
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();
      
      expect(mockSendToSupabase).toHaveBeenCalledTimes(1);
    });
  });

  describe('~1KB Batch Size Threshold', () => {
    it('should trigger immediate flush when size exceeds 1KB threshold', async () => {
      const weekId = 'test-week-3';
      
      // Mock the performSnapshot method to track size differences
      let capturedSizes: number[] = [];
      const originalPerformSnapshot = (service as any).performSnapshot;
      (service as any).performSnapshot = vi.fn().mockImplementation(async (weekId: string, doc: Y.Doc) => {
        const size = Y.encodeStateAsUpdate(doc).length;
        capturedSizes.push(size);
        return originalPerformSnapshot.call(service, weekId, doc);
      });
      
      // Mock lastSnapshotSize to simulate size difference
      (service as any).lastSnapshotSize = 500; // Start with 500 bytes
      
      service.startSnapshotBatching(weekId, mockDoc);
      
      // Add some data to the document to increase its size
      const map = mockDoc.getMap('test');
      for (let i = 0; i < 200; i++) {
        map.set(`key${i}`, `value${i}`.repeat(10)); // Add substantial data
      }
      
      service.markPendingChanges();
      
      // Wait for async operations
      await vi.runAllTimersAsync();
      
      // Should have triggered flush due to size increase
      expect(mockSendToSupabase).toHaveBeenCalled();
    });

    it('should track size differences correctly', async () => {
      const weekId = 'test-week-4';
      
      service.startSnapshotBatching(weekId, mockDoc);
      
      // First change - small size
      service.markPendingChanges();
      
      // Advance time to trigger first snapshot
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();
      
      expect(mockSendToSupabase).toHaveBeenCalledTimes(1);
      
      // Add significant data to increase size substantially
      const map = mockDoc.getMap('test');
      for (let i = 0; i < 300; i++) {
        map.set(`largeKey${i}`, `largeValue${i}`.repeat(20));
      }
      
      service.markPendingChanges();
      
      await vi.runAllTimersAsync();
      
      // Should have triggered immediate flush due to size difference
      expect(mockSendToSupabase).toHaveBeenCalledTimes(2);
    });
  });

  describe('Buffered Queue System', () => {
    it('should maintain a buffered queue of pending snapshots', () => {
      const weekId = 'test-week-5';
      
      service.startSnapshotBatching(weekId, mockDoc);
      
      // Check initial queue state
      let stats = service.getQueueStats();
      expect(stats.queueSize).toBe(0);
      expect(stats.pendingChanges).toBe(false);
      
      // Add changes to queue
      service.markPendingChanges();
      
      stats = service.getQueueStats();
      expect(stats.queueSize).toBe(1);
      expect(stats.pendingChanges).toBe(true);
    });

    it('should prevent duplicate entries for the same weekId', () => {
      const weekId = 'test-week-6';
      
      service.startSnapshotBatching(weekId, mockDoc);
      
      // Add multiple changes for same week
      service.markPendingChanges();
      service.markPendingChanges();
      service.markPendingChanges();
      
      // Should only have one entry in queue (duplicates removed)
      const stats = service.getQueueStats();
      expect(stats.queueSize).toBe(1);
    });

    it('should limit queue size to prevent memory leaks', () => {
      // Create multiple documents for different weeks
      const docs: Y.Doc[] = [];
      
      // Add more than MAX_QUEUE_SIZE items
      for (let i = 0; i < 15; i++) {
        const doc = new Y.Doc();
        docs.push(doc);
        service.startSnapshotBatching(`week-${i}`, doc);
        service.markPendingChanges();
      }
      
      // Queue should be limited to MAX_QUEUE_SIZE (10)
      const stats = service.getQueueStats();
      expect(stats.queueSize).toBeLessThanOrEqual(10);
      
      // Clean up
      docs.forEach(doc => doc.destroy());
    });

    it('should flush queue on stopSnapshotBatching', async () => {
      const weekId = 'test-week-7';
      
      service.startSnapshotBatching(weekId, mockDoc);
      service.markPendingChanges();
      
      // Stop batching should flush remaining items
      service.stopSnapshotBatching();
      await vi.runAllTimersAsync();
      
      expect(mockSendToSupabase).toHaveBeenCalled();
      
      // Queue should be empty after flush
      const stats = service.getQueueStats();
      expect(stats.queueSize).toBe(0);
      expect(stats.pendingChanges).toBe(false);
    });
  });

  describe('Timer and Flush Logic', () => {
    it('should clear timer when stopping batching', () => {
      const weekId = 'test-week-8';
      
      service.startSnapshotBatching(weekId, mockDoc);
      service.markPendingChanges();
      
      // Stop batching should clear timer
      service.stopSnapshotBatching();
      
      // Advance time - should not trigger any snapshots
      vi.advanceTimersByTime(15000);
      
      expect(mockSendToSupabase).toHaveBeenCalledTimes(1); // Only from stopSnapshotBatching flush
    });

    it('should handle multiple concurrent flush operations', async () => {
      const weekId = 'test-week-9';
      
      service.startSnapshotBatching(weekId, mockDoc);
      
      // Trigger multiple flushes
      service.markPendingChanges();
      service.markPendingChanges();
      
      // Force immediate snapshot
      await service.forceSnapshot(weekId, mockDoc);
      
      // Advance timer to trigger debounced flush
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();
      
      // Should handle concurrent operations gracefully
      expect(mockSendToSupabase).toHaveBeenCalled();
    });

    it('should handle errors during flush gracefully', async () => {
      const weekId = 'test-week-10';
      
      // Mock sendToSupabase to throw error
      mockSendToSupabase.mockRejectedValueOnce(new Error('Network error'));
      
      service.startSnapshotBatching(weekId, mockDoc);
      service.markPendingChanges();
      
      // Trigger flush
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();
      
      // Should have attempted to send despite error
      expect(mockSendToSupabase).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save snapshot'),
        expect.any(Error)
      );
    });
  });

  describe('Force Snapshot Functionality', () => {
    it('should bypass queue and debounce for force snapshot', async () => {
      const weekId = 'test-week-11';
      
      service.startSnapshotBatching(weekId, mockDoc);
      service.markPendingChanges();
      
      // Force immediate snapshot should bypass debounce
      await service.forceSnapshot(weekId, mockDoc);
      
      expect(mockSendToSupabase).toHaveBeenCalledTimes(1);
      
      // Should not trigger additional snapshot after debounce period
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();
      
      // Should still be only 1 call (force snapshot cleared the timer)
      expect(mockSendToSupabase).toHaveBeenCalledTimes(1);
    });

    it('should clear pending timer when forcing snapshot', async () => {
      const weekId = 'test-week-12';
      
      service.startSnapshotBatching(weekId, mockDoc);
      service.markPendingChanges();
      
      // Wait 5 seconds
      vi.advanceTimersByTime(5000);
      
      // Force snapshot should clear the pending timer
      await service.forceSnapshot(weekId, mockDoc);
      
      // Advance past original debounce time
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();
      
      // Should only have the force snapshot call
      expect(mockSendToSupabase).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should track performance metrics', async () => {
      const weekId = 'test-week-13';
      
      service.startSnapshotBatching(weekId, mockDoc);
      service.markPendingChanges();
      
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();
      
      // Check that performance tracking is working
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('total: 1')
      );
    });

    it('should handle rapid successive changes efficiently', async () => {
      const weekId = 'test-week-14';
      
      service.startSnapshotBatching(weekId, mockDoc);
      
      // Simulate rapid changes
      for (let i = 0; i < 100; i++) {
        service.markPendingChanges();
      }
      
      // Should still only have one item in queue (duplicates removed)
      const stats = service.getQueueStats();
      expect(stats.queueSize).toBe(1);
      
      // Flush should handle efficiently
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();
      
      expect(mockSendToSupabase).toHaveBeenCalledTimes(1);
    });
  });
});