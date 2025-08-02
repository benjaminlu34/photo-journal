/**
 * Snapshot service for handling automatic snapshot batching to PostgreSQL
 */

import { getCalendarSdk } from '@/lib/calendar-sdk';
import { useCalendarStore } from '@/lib/calendar-store';
import * as Y from 'yjs';

export interface SnapshotService {
  // Start snapshot batching
  startSnapshotBatching(weekId: string, doc: Y.Doc): void;
  
  // Stop snapshot batching
  stopSnapshotBatching(): void;
  
  // Force immediate snapshot
  forceSnapshot(weekId: string, doc: Y.Doc): Promise<void>;
  
  // Mark that there are pending changes that need to be snapshotted
  markPendingChanges(): void;
}

export class SnapshotServiceImpl implements SnapshotService {
  private snapshotInterval: NodeJS.Timeout | null = null;
  private debounceTimeout: NodeJS.Timeout | null = null;
  private lastSnapshotTime: number = 0;
  private pendingChanges: boolean = false;
  private currentDoc: Y.Doc | null = null;
  private currentWeekId: string | null = null;
  private lastSnapshotSize: number = 0;
  private readonly SNAPSHOT_DEBOUNCE_DELAY = 10000; // 10 seconds
  private readonly SNAPSHOT_BATCH_SIZE = 1024; // 1KB in bytes
  private readonly MAX_DEBOUNCE_DELAY = 30000; // Maximum 30 seconds before forced snapshot
  
  // Start snapshot batching
  startSnapshotBatching(weekId: string, doc: Y.Doc): void {
    // Clear any existing interval
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
    }
    
    // Store references
    this.currentDoc = doc;
    this.currentWeekId = weekId;
    
    // Set up periodic snapshot checking
    this.snapshotInterval = setInterval(() => {
      this.checkAndSnapshot();
    }, 1000); // Check every second
  }
  
  // Stop snapshot batching
  stopSnapshotBatching(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
    
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
    
    // Take final snapshot if there are pending changes
    if (this.pendingChanges && this.currentWeekId && this.currentDoc) {
      this.takeSnapshot(this.currentWeekId, this.currentDoc);
    }
    
    this.currentDoc = null;
    this.currentWeekId = null;
    this.pendingChanges = false;
  }
  
  // Force immediate snapshot
  async forceSnapshot(weekId: string, doc: Y.Doc): Promise<void> {
    await this.takeSnapshot(weekId, doc);
  }
  
  // Mark that there are pending changes that need to be snapshotted
  markPendingChanges(): void {
    this.pendingChanges = true;
    
    // Clear existing debounce timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    
    // Set up debounced snapshot
    this.debounceTimeout = setTimeout(() => {
      this.checkAndSnapshot();
    }, this.SNAPSHOT_DEBOUNCE_DELAY);
  }
  
  // Check if a snapshot should be taken and take it if needed
  private async checkAndSnapshot(): Promise<void> {
    if (!this.currentWeekId || !this.currentDoc) {
      return;
    }
    
    const now = Date.now();
    const timeSinceLastSnapshot = now - this.lastSnapshotTime;
    
    // Calculate current document size
    const currentState = Y.encodeStateAsUpdate(this.currentDoc);
    const currentSize = currentState.byteLength;
    const sizeDelta = currentSize - this.lastSnapshotSize;
    
    // Determine if snapshot should be taken based on:
    // 1. Debounce delay has passed AND there are pending changes
    // 2. Batch size threshold exceeded (1KB of changes)
    // 3. Maximum debounce delay exceeded (force snapshot)
    const shouldSnapshot = 
      (timeSinceLastSnapshot >= this.SNAPSHOT_DEBOUNCE_DELAY && this.pendingChanges) ||
      (sizeDelta >= this.SNAPSHOT_BATCH_SIZE) ||
      (timeSinceLastSnapshot >= this.MAX_DEBOUNCE_DELAY);
    
    if (shouldSnapshot) {
      await this.takeSnapshot(this.currentWeekId, this.currentDoc);
    }
  }
  
  // Take a snapshot of the current state
  private async takeSnapshot(weekId: string, doc: Y.Doc): Promise<void> {
    try {
      // Serialize the Yjs document state
      const state = Y.encodeStateAsUpdate(doc);
      
      // Calculate size of the update
      const size = state.byteLength;
      
      console.log(`Taking snapshot for week ${weekId}, size: ${size} bytes, debounce: ${this.SNAPSHOT_DEBOUNCE_DELAY}ms, batch: ${this.SNAPSHOT_BATCH_SIZE} bytes`);
      
      // In a production implementation, this would be:
      /*
      const response = await fetch('/api/calendar/snapshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Week-Id': weekId,
          'X-Snapshot-Size': size.toString(),
        },
        body: state
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save snapshot: ${response.statusText}`);
      }
      */
      
      // Update tracking variables
      this.lastSnapshotTime = Date.now();
      this.lastSnapshotSize = size;
      this.pendingChanges = false;
      
      // Clear debounce timeout since we just took a snapshot
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = null;
      }
      
      console.debug(`Snapshot completed for week ${weekId} at ${new Date().toISOString()}`);
      
    } catch (error) {
      console.error('Failed to take snapshot:', error);
      
      // In a real implementation, we would:
      // 1. Implement exponential backoff retry logic
      // 2. Queue failed snapshots for retry
      // 3. Emit error events for monitoring
      // 4. Fallback to local storage if server is unavailable
      
      // For now, we'll retry after a delay
      setTimeout(() => {
        if (this.currentWeekId && this.currentDoc) {
          this.takeSnapshot(this.currentWeekId, this.currentDoc);
        }
      }, 5000); // Retry after 5 seconds
    }
  }
}

// Create a singleton instance
export const snapshotService = new SnapshotServiceImpl();