/**
 * Snapshot service for managing CRDT document snapshots to PostgreSQL
 * Implements 10s debounce and ~1KB batching with buffered queue system
 */

import * as Y from 'yjs';
import { CALENDAR_CONFIG } from '@shared/config/calendar-config';

export interface SnapshotService {
  // Start snapshot batching for a document
  startSnapshotBatching(weekId: string, doc: Y.Doc): void;
  
  // Stop snapshot batching
  stopSnapshotBatching(): void;
  
  // Mark pending changes for batching
  markPendingChanges(): void;
  
  // Force immediate snapshot
  forceSnapshot(weekId: string, doc: Y.Doc): Promise<void>;
  
  // Get current queue stats for testing/debugging
  getQueueStats(): { queueSize: number; pendingChanges: boolean; lastSnapshotSize: number };
}

interface QueuedSnapshot {
  weekId: string;
  doc: Y.Doc;
  timestamp: number;
  size: number;
}

export class SnapshotServiceImpl implements SnapshotService {
  // Configuration constants
  private static readonly DEBOUNCE_DELAY_MS = 10000; // 10 seconds as specified
  private static readonly BATCH_SIZE_THRESHOLD = 1024; // ~1KB as specified
  private static readonly MAX_QUEUE_SIZE = 10; // Prevent memory leaks
  
  // Debounce timer
  private batchingTimer: NodeJS.Timeout | null = null;
  
  // Buffered queue system
  private snapshotQueue: QueuedSnapshot[] = [];
  private pendingChanges = false;
  private lastSnapshotSize = 0;
  private currentWeekId: string | null = null;
  private currentDoc: Y.Doc | null = null;
  
  // Performance tracking
  private lastFlushTime = 0;
  private totalSnapshots = 0;

  // Start snapshot batching with 10s debounce and buffered queue
  startSnapshotBatching(weekId: string, doc: Y.Doc): void {
    this.currentWeekId = weekId;
    this.currentDoc = doc;
    
    // Don't start timer immediately - wait for first change
    // Timer will be started when markPendingChanges is called
  }
  
  // Stop snapshot batching and flush any remaining items
  stopSnapshotBatching(): void {
    if (this.batchingTimer) {
      clearTimeout(this.batchingTimer);
      this.batchingTimer = null;
    }
    
    // Flush any remaining items in the queue
    if (this.snapshotQueue.length > 0 || this.pendingChanges) {
      this.flushQueue();
    }
    
    this.currentWeekId = null;
    this.currentDoc = null;
    this.pendingChanges = false;
  }
  
  // Mark pending changes and add to buffered queue
  markPendingChanges(): void {
    this.pendingChanges = true;
    
    // Add current state to buffered queue if we have a document
    if (this.currentDoc && this.currentWeekId) {
      const currentSize = Y.encodeStateAsUpdate(this.currentDoc).length;
      const sizeDiff = currentSize - this.lastSnapshotSize;
      
      // Add to queue
      this.addToQueue(this.currentWeekId, this.currentDoc, currentSize);
      
      // Trigger immediate flush if size difference exceeds ~1KB threshold
      if (sizeDiff >= SnapshotServiceImpl.BATCH_SIZE_THRESHOLD) {
        this.flushQueue();
        return; // Don't restart timer if we're flushing immediately
      }
    }
    
    // Restart the debounce timer
    this.restartDebounceTimer();
  }
  
  // Restart the debounce timer
  private restartDebounceTimer(): void {
    // Clear any existing timer
    if (this.batchingTimer) {
      clearTimeout(this.batchingTimer);
    }
    
    // Set up new batching timer with 10s debounce
    this.batchingTimer = setTimeout(() => {
      this.flushQueue();
    }, SnapshotServiceImpl.DEBOUNCE_DELAY_MS);
  }
  
  // Force immediate snapshot, bypassing queue
  async forceSnapshot(weekId: string, doc: Y.Doc): Promise<void> {
    this.currentWeekId = weekId;
    this.currentDoc = doc;
    
    // Clear any pending timer
    if (this.batchingTimer) {
      clearTimeout(this.batchingTimer);
      this.batchingTimer = null;
    }
    
    // Perform immediate snapshot
    await this.performSnapshot(weekId, doc);
  }
  
  // Get current queue stats for testing/debugging
  getQueueStats(): { queueSize: number; pendingChanges: boolean; lastSnapshotSize: number } {
    return {
      queueSize: this.snapshotQueue.length,
      pendingChanges: this.pendingChanges,
      lastSnapshotSize: this.lastSnapshotSize,
    };
  }
  
  // Add item to buffered queue with size-based management
  private addToQueue(weekId: string, doc: Y.Doc, size: number): void {
    const queueItem: QueuedSnapshot = {
      weekId,
      doc,
      timestamp: Date.now(),
      size,
    };
    
    // Remove old entries for the same weekId to prevent duplicates
    this.snapshotQueue = this.snapshotQueue.filter(item => item.weekId !== weekId);
    
    // Add new item
    this.snapshotQueue.push(queueItem);
    
    // Prevent memory leaks by limiting queue size
    if (this.snapshotQueue.length > SnapshotServiceImpl.MAX_QUEUE_SIZE) {
      this.snapshotQueue.shift(); // Remove oldest item
    }
  }
  
  // Flush the buffered queue and perform snapshots
  private async flushQueue(): Promise<void> {
    if (this.snapshotQueue.length === 0 && !this.pendingChanges) {
      return;
    }
    
    const now = Date.now();
    this.lastFlushTime = now;
    
    try {
      // Process all items in the queue
      const promises = this.snapshotQueue.map(item => 
        this.performSnapshot(item.weekId, item.doc)
      );
      
      // Wait for all snapshots to complete
      await Promise.allSettled(promises);
      
      // Clear the queue after processing
      this.snapshotQueue = [];
      this.pendingChanges = false;
      
      console.log(`Flushed snapshot queue: ${promises.length} snapshots processed`);
    } catch (error) {
      console.error('Failed to flush snapshot queue:', error);
      // Keep items in queue for retry on next flush
    }
  }
  
  // Private method to perform the actual snapshot
  private async performSnapshot(weekId: string, doc: Y.Doc): Promise<void> {
    try {
      // Encode the current state
      const state = Y.encodeStateAsUpdate(doc);
      this.lastSnapshotSize = state.length;
      
      // Send to Supabase Edge Function (mock implementation)
      await this.sendToSupabase(weekId, state);
      
      this.totalSnapshots++;
      
      console.log(`Snapshot saved for week ${weekId}, size: ${state.length} bytes (total: ${this.totalSnapshots})`);
    } catch (error) {
      console.error(`Failed to save snapshot for week ${weekId}:`, error);
      throw error; // Re-throw to be handled by caller
    }
  }
  
  // Mock implementation of sending to Supabase
  private async sendToSupabase(weekId: string, state: Uint8Array): Promise<void> {
    // In real implementation, this would call the Supabase Edge Function
    // For now, we'll just simulate the API call
    
    const payload = {
      weekId,
      state: Array.from(state), // Convert Uint8Array to regular array for JSON
      timestamp: new Date().toISOString()
    };
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Mock successful response
    console.log('Mock snapshot saved to Supabase:', {
      weekId,
      size: state.length,
      timestamp: payload.timestamp
    });
  }
}

// Create singleton instance
export const snapshotService = new SnapshotServiceImpl();