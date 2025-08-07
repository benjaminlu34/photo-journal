/**
 * Tests for SnapshotService - Debounce and Batching Implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import * as Y from 'yjs';
import { SnapshotServiceImpl } from '../snapshot.service';

describe('SnapshotService - Debounce and Batching', () => {
  let service: SnapshotServiceImpl;
  let mockDoc: Y.Doc;
  let mockSendToSupabase: Mock;
  let createdWeekIds: Set<string>;
  let createdDocs: Y.Doc[];

  beforeEach(() => {
    // Create fresh service instance
    service = new SnapshotServiceImpl();

    // Create mock Yjs document
    mockDoc = new Y.Doc();

    // Track created weekIds and docs for proper cleanup
    createdWeekIds = new Set();
    createdDocs = [mockDoc];

    // Mock the private sendToSupabase method
    mockSendToSupabase = vi.fn().mockResolvedValue(undefined);
    (service as any).sendToSupabase = mockSendToSupabase;

    // Mock console methods to reduce test noise
    vi.spyOn(console, 'log').mockImplementation(() => { });
    vi.spyOn(console, 'error').mockImplementation(() => { });

    // Use fake timers for precise timing control
    vi.useFakeTimers();
  });

  afterEach(async () => {
    // Clean up ALL created weekIds to prevent state leaking between tests
    for (const weekId of createdWeekIds) {
      try {
        await service.stopSnapshotBatching(weekId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Clean up all created documents
    for (const doc of createdDocs) {
      try {
        doc.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // Helper function to track weekIds for cleanup
  const trackWeekId = (weekId: string) => {
    createdWeekIds.add(weekId);
    return weekId;
  };

  // Helper function to create and track documents
  const createTrackedDoc = () => {
    const doc = new Y.Doc();
    createdDocs.push(doc);
    return doc;
  };

  describe('10 Second Debounce Implementation', () => {
    it('should debounce snapshot calls for 10 seconds', async () => {
      const weekId = trackWeekId('test-week-1');

      // Start batching
      service.startSnapshotBatching(weekId, mockDoc);

      // Mark changes multiple times within debounce window
      service.markPendingChanges(weekId, mockDoc);
      service.markPendingChanges(weekId, mockDoc);
      service.markPendingChanges(weekId, mockDoc);

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
      const weekId = trackWeekId('test-week-2');

      service.startSnapshotBatching(weekId, mockDoc);
      service.markPendingChanges(weekId, mockDoc);

      // Advance 5 seconds
      vi.advanceTimersByTime(5000);

      // Mark new changes (should reset timer)
      service.markPendingChanges(weekId, mockDoc);

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
      const weekId = trackWeekId('test-week-3');

      // Mock the lastSnapshotSizes Map to simulate size difference
      const mockSizesMap = new Map<string, number>();
      mockSizesMap.set(weekId, 500); // Start with 500 bytes for this document
      (service as any).lastSnapshotSizes = mockSizesMap;

      service.startSnapshotBatching(weekId, mockDoc);

      // Add some data to the document to increase its size significantly
      const map = mockDoc.getMap('test');
      for (let i = 0; i < 200; i++) {
        map.set(`key${i}`, `value${i}`.repeat(10)); // Add substantial data
      }

      service.markPendingChanges(weekId, mockDoc);

      // Wait for async operations
      await vi.runAllTimersAsync();

      // Should have triggered flush due to size increase
      expect(mockSendToSupabase).toHaveBeenCalled();
    });

    it('should track size differences correctly', async () => {
      const weekId = trackWeekId('test-week-4');

      service.startSnapshotBatching(weekId, mockDoc);

      // First change - small size
      service.markPendingChanges(weekId, mockDoc);

      // Advance time to trigger first snapshot
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();

      expect(mockSendToSupabase).toHaveBeenCalledTimes(1);

      // Add significant data to increase size substantially
      const map = mockDoc.getMap('test');
      for (let i = 0; i < 300; i++) {
        map.set(`largeKey${i}`, `largeValue${i}`.repeat(20));
      }

      service.markPendingChanges(weekId, mockDoc);

      await vi.runAllTimersAsync();

      // Should have triggered immediate flush due to size difference
      expect(mockSendToSupabase).toHaveBeenCalledTimes(2);
    });
  });

  describe('Buffered Queue System', () => {
    it('should maintain a buffered queue of pending snapshots', () => {
      const weekId = trackWeekId('test-week-5');

      service.startSnapshotBatching(weekId, mockDoc);

      // Check initial queue state
      let stats = service.getQueueStats();
      expect(stats.queueSize).toBe(0);
      expect(stats.pendingChanges).toBe(false);

      // Add changes to queue
      service.markPendingChanges(weekId, mockDoc);

      stats = service.getQueueStats();
      expect(stats.queueSize).toBe(1);
      expect(stats.pendingChanges).toBe(true);
    });

    it('should prevent duplicate entries for the same weekId', () => {
      const weekId = trackWeekId('test-week-6');

      service.startSnapshotBatching(weekId, mockDoc);

      // Add multiple changes for same week
      service.markPendingChanges(weekId, mockDoc);
      service.markPendingChanges(weekId, mockDoc);
      service.markPendingChanges(weekId, mockDoc);

      // Should only have one entry in queue (duplicates removed)
      const stats = service.getQueueStats();
      expect(stats.queueSize).toBe(1);
    });

    it('should limit queue size to prevent memory leaks', () => {
      // Create multiple documents for different weeks
      const docs: Y.Doc[] = [];

      // Add more than MAX_QUEUE_SIZE items
      for (let i = 0; i < 15; i++) {
        const doc = createTrackedDoc();
        const weekId = trackWeekId(`week-${i}`);
        docs.push(doc);
        service.startSnapshotBatching(weekId, doc);
        service.markPendingChanges(weekId, doc);
      }

      // Queue should be limited to MAX_QUEUE_SIZE (10)
      const stats = service.getQueueStats();
      expect(stats.queueSize).toBeLessThanOrEqual(10);
    });

    it('should flush queue on stopSnapshotBatching', async () => {
      const weekId = trackWeekId('test-week-7');

      service.startSnapshotBatching(weekId, mockDoc);
      service.markPendingChanges(weekId, mockDoc);

      // Stop batching should flush remaining items
      await service.stopSnapshotBatching(weekId);
      await vi.runAllTimersAsync();

      expect(mockSendToSupabase).toHaveBeenCalled();

      // Queue should be empty after flush
      const stats = service.getQueueStats();
      expect(stats.queueSize).toBe(0);
      expect(stats.pendingChanges).toBe(false);
    });
  });

  describe('Timer and Flush Logic', () => {
    it('should clear timer when stopping batching', async () => {
      const weekId = trackWeekId('test-week-8');

      service.startSnapshotBatching(weekId, mockDoc);
      service.markPendingChanges(weekId, mockDoc);

      // Stop batching should clear timer
      await service.stopSnapshotBatching(weekId);

      // Advance time - should not trigger any snapshots
      vi.advanceTimersByTime(15000);

      expect(mockSendToSupabase).toHaveBeenCalledTimes(1); // Only from stopSnapshotBatching flush
    });

    it('should handle multiple concurrent flush operations', async () => {
      const weekId = trackWeekId('test-week-9');

      service.startSnapshotBatching(weekId, mockDoc);

      // Trigger multiple flushes
      service.markPendingChanges(weekId, mockDoc);
      service.markPendingChanges(weekId, mockDoc);

      // Force immediate snapshot
      await service.forceSnapshot(weekId, mockDoc);

      // Advance timer to trigger debounced flush
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();

      // Should handle concurrent operations gracefully
      expect(mockSendToSupabase).toHaveBeenCalled();
    });

    it('should handle errors during flush gracefully', async () => {
      const weekId = trackWeekId('test-week-10');

      // Mock sendToSupabase to throw error
      mockSendToSupabase.mockRejectedValueOnce(new Error('Network error'));

      service.startSnapshotBatching(weekId, mockDoc);
      service.markPendingChanges(weekId, mockDoc);

      // Trigger flush
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();

      // Should have attempted to send despite error
      expect(mockSendToSupabase).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save snapshot for week'),
        expect.any(Error)
      );
    });
  });

  describe('Force Snapshot Functionality', () => {
    it('should bypass queue and debounce for force snapshot', async () => {
      const weekId = trackWeekId('test-week-11');

      service.startSnapshotBatching(weekId, mockDoc);
      service.markPendingChanges(weekId, mockDoc);

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
      const weekId = trackWeekId('test-week-12');

      service.startSnapshotBatching(weekId, mockDoc);
      service.markPendingChanges(weekId, mockDoc);

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
      const weekId = trackWeekId('test-week-13');

      service.startSnapshotBatching(weekId, mockDoc);
      service.markPendingChanges(weekId, mockDoc);

      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();

      // Check that performance tracking is working
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('total: 1')
      );
    });

    it('should handle rapid successive changes efficiently', async () => {
      const weekId = trackWeekId('test-week-14');

      service.startSnapshotBatching(weekId, mockDoc);

      // Simulate rapid changes
      for (let i = 0; i < 100; i++) {
        service.markPendingChanges(weekId, mockDoc);
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

  describe('Race Condition Prevention', () => {
    it('should preserve queue integrity during concurrent operations', async () => {
      const weekId1 = trackWeekId('test-week-race-1');
      const weekId2 = trackWeekId('test-week-race-2');
      const mockDoc2 = createTrackedDoc();
      
      service.startSnapshotBatching(weekId1, mockDoc);
      service.startSnapshotBatching(weekId2, mockDoc2);
      
      // Add changes to both documents
      service.markPendingChanges(weekId1, mockDoc);
      service.markPendingChanges(weekId2, mockDoc2);
      
      // Verify both items are in queue
      let stats = service.getQueueStats();
      expect(stats.queueSize).toBe(2);
      
      // Trigger flush and verify it processes all items
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();
      
      // Both documents should have been processed
      expect(mockSendToSupabase).toHaveBeenCalledTimes(2);
      
      // Queue should be empty
      stats = service.getQueueStats();
      expect(stats.queueSize).toBe(0);
    });

    it('should handle document-specific operations correctly', async () => {
      const weekId1 = trackWeekId('test-week-stop-1');
      const weekId2 = trackWeekId('test-week-stop-2');
      const mockDoc2 = createTrackedDoc();
      
      service.startSnapshotBatching(weekId1, mockDoc);
      service.startSnapshotBatching(weekId2, mockDoc2);
      
      // Add changes to both documents
      service.markPendingChanges(weekId1, mockDoc);
      service.markPendingChanges(weekId2, mockDoc2);
      
      let stats = service.getQueueStats();
      expect(stats.queueSize).toBe(2);
      
      // Stop batching for first document only
      await service.stopSnapshotBatching(weekId1);
      await vi.runAllTimersAsync();
      
      // Should have processed at least one document
      expect(mockSendToSupabase).toHaveBeenCalled();
      
      // Verify per-document size tracking is maintained
      const sizeStats = service.getQueueStats();
      expect(sizeStats.lastSnapshotSizes).not.toHaveProperty(weekId1);
      expect(sizeStats.lastSnapshotSizes).toHaveProperty(weekId2);
    });
  });
});