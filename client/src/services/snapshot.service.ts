/**
 * Snapshot service for managing CRDT document snapshots to PostgreSQL
 * Implements 10s debounce and ~1KB batching with buffered queue system
 */

import * as Y from 'yjs';

export interface SnapshotService {
  // Start snapshot batching for a document
  startSnapshotBatching(weekId: string, doc: Y.Doc): void;

  // Stop snapshot batching for a specific document (awaits flush before cleanup)
  stopSnapshotBatching(weekId: string): Promise<void>;

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

  // Debounce timer per document (browser-safe type)
  private batchingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Buffered queue system
  private snapshotQueue: QueuedSnapshot[] = [];

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
  async stopSnapshotBatching(weekId: string): Promise<void> {
    this.clearDebounceTimer(weekId);

    // Flush only items for this specific document before cleanup
    const documentItems = this.snapshotQueue.filter(item => item.weekId === weekId);
    if (documentItems.length > 0) {
      // Remove document items from the main queue (race condition safe)
      this.snapshotQueue = this.snapshotQueue.filter(item => item.weekId !== weekId);
      await this._processItems(documentItems);
    }

    // Clean up tracking for this document only AFTER flush completes
    this.lastSnapshotSizes.delete(weekId);

    // Don't modify global pendingChanges flag - other documents may still have pending changes
  }

  // Mark pending changes and add to buffered queue (now stateless)
  markPendingChanges(weekId: string, doc: Y.Doc): void {
    const currentSize = Y.encodeStateAsUpdate(doc).length;
    const lastSize = this.lastSnapshotSizes.get(weekId) || 0;
    const sizeDiff = currentSize - lastSize;

    // Add to queue
    this.addToQueue(weekId, doc, currentSize);

    // Trigger immediate flush if size difference exceeds ~1KB threshold
    if (sizeDiff >= SnapshotServiceImpl.BATCH_SIZE_THRESHOLD) {
      // Clear any scheduled debounce for this document to avoid duplicate flush later
      this.clearDebounceTimer(weekId);
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

  // Clear debounce timer for a specific document
  private clearDebounceTimer(weekId: string): void {
    const timer = this.batchingTimers.get(weekId);
    if (timer) {
      clearTimeout(timer);
      this.batchingTimers.delete(weekId);
    }
  }

  // Force immediate snapshot, bypassing queue
  async forceSnapshot(weekId: string, doc: Y.Doc): Promise<void> {
    // Clear any pending timer for this document
    this.clearDebounceTimer(weekId);

    // Remove any queued item for this document to avoid duplicate snapshot later
    this.snapshotQueue = this.snapshotQueue.filter(item => item.weekId !== weekId);

    // Perform immediate snapshot
    await this.performSnapshot(weekId, doc);
  }

  // Get current queue stats for testing/debugging
  getQueueStats(): { queueSize: number; pendingChanges: boolean; lastSnapshotSizes: Record<string, number> } {
    return {
      queueSize: this.snapshotQueue.length,
      pendingChanges: this.snapshotQueue.length > 0,
      lastSnapshotSizes: Object.fromEntries(this.lastSnapshotSizes),
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

  // Flush the buffered queue and perform snapshots (race condition safe)
  private async flushQueue(): Promise<void> {
    if (this.snapshotQueue.length === 0) {
      return;
    }

    // CRITICAL FIX: Copy queue and clear immediately to prevent race conditions
    const itemsToProcess = [...this.snapshotQueue];
    this.snapshotQueue = [];

    // Clear timers for all weekIds being processed to avoid duplicate scheduled flushes
    const processedWeekIds = new Set(itemsToProcess.map(item => item.weekId));
    processedWeekIds.forEach(weekId => this.clearDebounceTimer(weekId));

    // Process all items
    await this._processItems(itemsToProcess);
  }

  // Common processing logic shared by flushQueue and flushDocumentItems
  private async _processItems(itemsToProcess: QueuedSnapshot[]): Promise<void> {
    // Process all items from the provided list
    const results = await Promise.allSettled(
      itemsToProcess.map(item => this.performSnapshot(item.weekId, item.doc))
    );

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

    // Prepend failed items to preserve any new items added during processing
    if (failedItems.length > 0) {
      this.snapshotQueue.unshift(...failedItems);
    }

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

  // Cross-environment Uint8Array -> Base64 conversion
  private toBase64(state: Uint8Array): string {
    // Node.js
    if (typeof window === 'undefined') {
      // eslint-disable-next-line no-undef
      return Buffer.from(state).toString('base64');
    }
    // Browser-safe conversion in chunks
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < state.length; i += chunkSize) {
      const chunk = state.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    // eslint-disable-next-line no-undef
    return btoa(binary);
  }

  // Mock implementation of sending to Supabase
  private async sendToSupabase(weekId: string, state: Uint8Array): Promise<void> {
    // In real implementation, this would call the Supabase Edge Function
    // For now, we'll just simulate the API call

    const payload = {
      weekId,
      stateBase64: this.toBase64(state),
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