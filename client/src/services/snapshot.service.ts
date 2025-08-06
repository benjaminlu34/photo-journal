/**
 * Snapshot service for managing CRDT document snapshots to PostgreSQL
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
}

export class SnapshotServiceImpl implements SnapshotService {
  private batchingTimer: NodeJS.Timeout | null = null;
  private pendingChanges = false;
  private lastSnapshotSize = 0;
  private currentWeekId: string | null = null;
  private currentDoc: Y.Doc | null = null;

  // Start snapshot batching with debounce and batch size limits
  startSnapshotBatching(weekId: string, doc: Y.Doc): void {
    this.currentWeekId = weekId;
    this.currentDoc = doc;
    
    // Clear any existing timer
    if (this.batchingTimer) {
      clearTimeout(this.batchingTimer);
    }
    
    // Set up batching timer with debounce
    this.batchingTimer = setTimeout(() => {
      this.performSnapshot();
    }, CALENDAR_CONFIG.PERFORMANCE.DEBOUNCE_DELAY * 10); // 3 seconds debounce
  }
  
  // Stop snapshot batching
  stopSnapshotBatching(): void {
    if (this.batchingTimer) {
      clearTimeout(this.batchingTimer);
      this.batchingTimer = null;
    }
    
    // Perform final snapshot if there are pending changes
    if (this.pendingChanges && this.currentWeekId && this.currentDoc) {
      this.performSnapshot();
    }
    
    this.currentWeekId = null;
    this.currentDoc = null;
    this.pendingChanges = false;
  }
  
  // Mark pending changes for batching
  markPendingChanges(): void {
    this.pendingChanges = true;
    
    // Check if we should trigger immediate snapshot based on size
    if (this.currentDoc) {
      const currentSize = Y.encodeStateAsUpdate(this.currentDoc).length;
      const sizeDiff = currentSize - this.lastSnapshotSize;
      
      // Trigger immediate snapshot if size difference exceeds 1KB
      if (sizeDiff >= 1024) {
        this.performSnapshot();
      }
    }
  }
  
  // Force immediate snapshot
  async forceSnapshot(weekId: string, doc: Y.Doc): Promise<void> {
    this.currentWeekId = weekId;
    this.currentDoc = doc;
    await this.performSnapshot();
  }
  
  // Private method to perform the actual snapshot
  private async performSnapshot(): Promise<void> {
    if (!this.currentWeekId || !this.currentDoc || !this.pendingChanges) {
      return;
    }
    
    try {
      // Encode the current state
      const state = Y.encodeStateAsUpdate(this.currentDoc);
      this.lastSnapshotSize = state.length;
      
      // Send to Supabase Edge Function (mock implementation)
      await this.sendToSupabase(this.currentWeekId, state);
      
      // Reset pending changes flag
      this.pendingChanges = false;
      
      console.log(`Snapshot saved for week ${this.currentWeekId}, size: ${state.length} bytes`);
    } catch (error) {
      console.error('Failed to save snapshot:', error);
      // Don't reset pending changes on error, will retry on next batch
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