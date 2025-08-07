/**
 * Snapshot service for managing CRDT document snapshots to PostgreSQL
 * Implements 10s debounce and ~1KB batching with buffered queue system
 */

import * as Y from 'yjs';
import { CALENDAR_CONFIG } from '@shared/config/calendar-config';

export interface SnapshotService {
  // Start snapshot batching for a document
  startSnapshotBatching(weekId: string, doc: Y.Doc): void;

  // Stop snapshot batching for a specific document
  stopSnapshotBatching(weekId: string): void;

  // Mark pending changes for batching (now stateless)
  markPendingChanges(weekId: string, doc: Y.Doc): void;

  // Force immediate snapshot
  forceSnapshot(weekId: string, doc: Y.Doc): Promise<void>;

  // Get current queue stats for testing/debugging
  getQueueStats(): { queueSize: number; pendingChanges: boolean; lastSnapshotSizes: Record<string, number> };
}

interface QueuedSnapshot {
  weekId: string;
  doc: Y.Doc;
  timestamp: number;
  size: number;
  retryCount?: number;
}

export class SnapshotServiceImpl implements SnapshotService {
  // Configuration constants
  private static readonly DEBOUNCE_DELAY_MS = 10000; // 10 seconds as specified
  private static readonly BATCH_SIZE_THRESHOLD = 1024; // ~1KB as specified
  private static readonly MAX_QUEUE_SIZE = 10; // Prevent memory leaks
  private static readonly MAX_RETRY_ATTEMPTS = 3; // Maximum retry attempts for failed snapshots

  // Debounce timer per document
  private batchingTimers = new Map<string, NodeJS.Timeout>();

  // Buffered queue system
  private snapshotQueue: QueuedSnapshot[] = [];
  private pendingChanges = false;

  // Per-document snapshot size tracking to fix race conditions
  private lastSnapshotSizes = new Map<string, number>();

  // Performance tracking
  private totalSnapshots = 0;

  // Start snapshot batching with 10s debounce and buffered queue
  startSnapshotBatching(weekId: string, doc: Y.Doc): void {
    // Initialize snapshot size tracking for this document
    if (!this.lastSnapshotSizes.has(weekId)) {
      this.lastSnapshotSizes.set(weekId, 0);
    }

    // Don't start timer immediately - wait for first change
    // Timer will be started when markPendingChanges is called
  }

  // Stop snapshot batching for a specific document and flush only its items
  stopSnapshotBatching(weekId: string): void {
    const timer = this.batchingTimers.get(weekId);
    if (timer) {
      clearTimeout(timer);
      this.batchingTimers.delete(weekId);
    }

    // Check if this document has any items in the queue
    const documentItems = this.snapshotQueue.filter(item => item.weekId === weekId);
    if (documentItems.length > 0) {
      // Flush only items for this specific document
      this.flushDocumentItems(weekId);
    }

    // Clean up tracking for this document only
    this.lastSnapshotSizes.delete(weekId);

    // Don't modify global pendingChanges flag - other documents may still have pending changes
  }

  // Mark pending changes and add to buffered queue (now stateless)
  markPendingChanges(weekId: string, doc: Y.Doc): void {
    this.pendingChanges = true;

    const currentSize = Y.encodeStateAsUpdate(doc).length;
    const lastSize = this.lastSnapshotSizes.get(weekId) || 0;
    const sizeDiff = currentSize - lastSize;

    // Add to queue
    this.addToQueue(weekId, doc, currentSize);

    // Trigger immediate flush if size difference exceeds ~1KB threshold
    if (sizeDiff >= SnapshotServiceImpl.BATCH_SIZE_THRESHOLD) {
      this.flushQueue();
      return; // Don't restart timer if we're flushing immediately
    }

    // Restart the debounce timer for this document
    this.restartDebounceTimer(weekId);
  }

  // Restart the debounce timer for a specific document
  private restartDebounceTimer(weekId: string): void {
    // Clear any existing timer for this document
    const existingTimer = this.batchingTimers.get(weekId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set up new batching timer with 10s debounce
    const timer = setTimeout(() => {
      this.flushQueue();
    }, SnapshotServiceImpl.DEBOUNCE_DELAY_MS);

    this.batchingTimers.set(weekId, timer);
  }

  // Force immediate snapshot, bypassing queue
  async forceSnapshot(weekId: string, doc: Y.Doc): Promise<void> {
    // Clear any pending timer for this document
    const timer = this.batchingTimers.get(weekId);
    if (timer) {
      clearTimeout(timer);
      this.batchingTimers.delete(weekId);
    }

    // Perform immediate snapshot
    await this.performSnapshot(weekId, doc);
  }

  // Get current queue stats for testing/debugging
  getQueueStats(): { queueSize: number; pendingChanges: boolean; lastSnapshotSizes: Record<string, number> } {
    return {
      queueSize: this.snapshotQueue.length,
      pendingChanges: this.pendingChanges,
      lastSnapshotSizes: Object.fromEntries(this.lastSnapshotSizes),
    };
  }

  // Flush items for a specific document only (used by stopSnapshotBatching)
  private async flushDocumentItems(weekId: string): Promise<void> {
    // Find items for this specific document
    const documentItems = this.snapshotQueue.filter(item => item.weekId === weekId);

    if (documentItems.length === 0) {
      return;
    }

    // Remove document items from the main queue (race condition safe)
    this.snapshotQueue = this.snapshotQueue.filter(item => item.weekId !== weekId);

    // Process only the document's items
    const promises = documentItems.map(item =>
      this.performSnapshot(item.weekId, item.doc)
    );

    // Wait for all snapshots to complete
    const results = await Promise.allSettled(promises);

    // Handle failed snapshots for this document
    const failedItems: QueuedSnapshot[] = [];

    results.forEach((result, index) => {
      const item = documentItems[index];

      if (result.status === 'rejected') {
        console.error(`Snapshot failed for week ${item.weekId}:`, result.reason);

        // Increment retry count
        const retryCount = (item.retryCount || 0) + 1;

        // Re-add to queue for retry if under max attempts
        if (retryCount < SnapshotServiceImpl.MAX_RETRY_ATTEMPTS) {
          failedItems.push({
            ...item,
            retryCount,
            timestamp: Date.now(),
          });
        } else {
          console.error(`Max retry attempts reached for week ${item.weekId}, dropping snapshot`);
        }
      }
    });

    // Add failed items back to the main queue
    if (failedItems.length > 0) {
      this.snapshotQueue.unshift(...failedItems);
    }

    // Update pending changes based on current queue state
    this.pendingChanges = this.snapshotQueue.length > 0;

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount = results.filter(r => r.status === 'rejected').length;

    console.log(`Flushed document ${weekId}: ${successCount} succeeded, ${failedCount} failed, ${failedItems.length} queued for retry`);
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

  // Flush the buffered queue and perform snapshots (race condition safe)
  private async flushQueue(): Promise<void> {
    if (this.snapshotQueue.length === 0 && !this.pendingChanges) {
      return;
    }

    // CRITICAL FIX: Copy queue and clear immediately to prevent race conditions
    const itemsToProcess = [...this.snapshotQueue];
    this.snapshotQueue = [];

    if (itemsToProcess.length === 0) {
      return;
    }

    // Process all items from the copied queue
    const promises = itemsToProcess.map(item =>
      this.performSnapshot(item.weekId, item.doc)
    );

    // Wait for all snapshots to complete
    const results = await Promise.allSettled(promises);

    // Handle failed snapshots and implement retry logic
    const failedItems: QueuedSnapshot[] = [];

    results.forEach((result, index) => {
      const item = itemsToProcess[index];

      if (result.status === 'rejected') {
        console.error(`Snapshot failed for week ${item.weekId}:`, result.reason);

        // Increment retry count
        const retryCount = (item.retryCount || 0) + 1;

        // Re-add to queue for retry if under max attempts
        if (retryCount < SnapshotServiceImpl.MAX_RETRY_ATTEMPTS) {
          failedItems.push({
            ...item,
            retryCount,
            timestamp: Date.now(), // Update timestamp for retry
          });
        } else {
          console.error(`Max retry attempts reached for week ${item.weekId}, dropping snapshot`);
        }
      }
    });

    // CRITICAL FIX: Prepend failed items to preserve any new items added during flush
    if (failedItems.length > 0) {
      this.snapshotQueue.unshift(...failedItems);
    }

    // Update pending changes based on current queue state
    this.pendingChanges = this.snapshotQueue.length > 0;

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount = results.filter(r => r.status === 'rejected').length;

    console.log(`Flushed snapshot queue: ${successCount} succeeded, ${failedCount} failed, ${failedItems.length} queued for retry`);
  }

  // Private method to perform the actual snapshot
  private async performSnapshot(weekId: string, doc: Y.Doc): Promise<void> {
    try {
      // Encode the current state
      const state = Y.encodeStateAsUpdate(doc);

      // Update per-document snapshot size tracking
      this.lastSnapshotSizes.set(weekId, state.length);

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