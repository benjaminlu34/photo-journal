/**
 * Offline calendar service for caching external calendar data in IndexedDB
 * Implements background sync, network failure handling, and cached data fallback
 */

import type { CalendarEvent, CalendarFeed } from '@/types/calendar';

// IndexedDB interfaces
interface CachedCalendarData {
  feedId: string;
  feedName: string;
  events: CalendarEvent[];
  lastSync: Date;
  syncVersion: number;
  etag?: string;
}

interface SyncStatus {
  feedId: string;
  lastAttempt: Date;
  lastSuccess: Date;
  failureCount: number;
  nextRetry?: Date;
  error?: string;
}

// Database schema
const DB_NAME = 'PhotoJournalCalendar';
const DB_VERSION = 1;
const EVENTS_STORE = 'cachedEvents';
const SYNC_STATUS_STORE = 'syncStatus';

export class OfflineCalendarError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly feedId?: string
  ) {
    super(message);
    this.name = 'OfflineCalendarError';
  }
}

export interface OfflineCalendarService {
  // Core caching operations
  cacheEvents(feedId: string, feedName: string, events: CalendarEvent[]): Promise<void>;
  getCachedEvents(feedId: string): Promise<CalendarEvent[]>;
  
  // Sync management
  syncFeed(feed: CalendarFeed): Promise<CalendarEvent[]>;
  syncAllFeeds(feeds: CalendarFeed[]): Promise<Map<string, CalendarEvent[]>>;
  
  // Background sync
  enableBackgroundSync(): void;
  disableBackgroundSync(): void;
  triggerBackgroundSync(): Promise<void>;
  
  // Network status handling
  handleNetworkFailure(feedId: string, error: Error): Promise<CalendarEvent[]>;
  isOnline(): boolean;
  
  // Cache management
  clearCache(feedId?: string): Promise<void>;
  getCacheStats(): Promise<{ totalEvents: number; totalFeeds: number; lastSync: Date | null }>;
  
  // Utility methods
  isCacheValid(feedId: string, maxAge?: number): Promise<boolean>;
  getFeedSyncStatus(feedId: string): Promise<SyncStatus | null>;
}

export class OfflineCalendarServiceImpl implements OfflineCalendarService {
  private db: IDBDatabase | null = null;
  private backgroundSyncEnabled = false;
  private backgroundSyncInterval: number | null = null;
  private readonly SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_RETRY_ATTEMPTS = 3;
  
  constructor() {
    // FIXED: Remove async call from constructor to avoid unhandled promise rejections
    // Database initialization is handled lazily in getDatabase()
    this.setupVisibilityChangeHandler();
  }
  
  // Core caching operations
  async cacheEvents(feedId: string, feedName: string, events: CalendarEvent[]): Promise<void> {
    const db = await this.getDatabase();
    
    const transaction = db.transaction([EVENTS_STORE], 'readwrite');
    const store = transaction.objectStore(EVENTS_STORE);
    
    const cachedData: CachedCalendarData = {
      feedId,
      feedName,
      events,
      lastSync: new Date(),
      syncVersion: Date.now(),
    };
    
    try {
      await this.promisifyRequest(store.put(cachedData));
      console.log(`Cached ${events.length} events for feed ${feedId}`);
    } catch (error) {
      throw new OfflineCalendarError(
        `Failed to cache events for feed ${feedId}`,
        'CACHE_WRITE_FAILED',
        feedId
      );
    }
  }
  
  async getCachedEvents(feedId: string): Promise<CalendarEvent[]> {
    const db = await this.getDatabase();
    
    const transaction = db.transaction([EVENTS_STORE], 'readonly');
    const store = transaction.objectStore(EVENTS_STORE);
    
    try {
      const cachedData = await this.promisifyRequest<CachedCalendarData>(store.get(feedId));
      
      if (!cachedData) {
        return [];
      }
      
      // Check if cache is still valid
      const isValid = await this.isCacheValid(feedId);
      if (!isValid) {
        console.warn(`Cache expired for feed ${feedId}, returning stale data`);
      }
      
      return cachedData.events;
    } catch (error) {
      console.error(`Failed to get cached events for feed ${feedId}:`, error);
      return [];
    }
  }
  
  // Sync management
  async syncFeed(feed: CalendarFeed): Promise<CalendarEvent[]> {
    try {
      // Try to fetch fresh data
      const freshEvents = await this.fetchFreshEvents(feed);
      
      // Cache the fresh data
      await this.cacheEvents(feed.id, feed.name, freshEvents);
      
      // Update sync status
      await this.updateSyncStatus(feed.id, true);
      
      return freshEvents;
    } catch (error) {
      console.error(`Failed to sync feed ${feed.id}:`, error);
      
      // Update sync status with failure
      await this.updateSyncStatus(feed.id, false, error instanceof Error ? error.message : 'Unknown error');
      
      // Return cached data as fallback
      return this.handleNetworkFailure(feed.id, error instanceof Error ? error : new Error('Sync failed'));
    }
  }
  
  async syncAllFeeds(feeds: CalendarFeed[]): Promise<Map<string, CalendarEvent[]>> {
    const results = new Map<string, CalendarEvent[]>();
    
    // Sync feeds in parallel with limited concurrency
    const concurrencyLimit = 3;
    const chunks = this.chunkArray(feeds, concurrencyLimit);
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (feed) => {
        const events = await this.syncFeed(feed);
        return { feedId: feed.id, events };
      });
      
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.set(result.value.feedId, result.value.events);
        }
      }
    }
    
    return results;
  }
  
  // Background sync
  enableBackgroundSync(): void {
    if (this.backgroundSyncEnabled) {
      return;
    }
    
    this.backgroundSyncEnabled = true;
    
    // Set up periodic sync
    this.backgroundSyncInterval = window.setInterval(() => {
      this.triggerBackgroundSync().catch(error => {
        console.error('Background sync failed:', error);
      });
    }, this.SYNC_INTERVAL);
    
    console.log('Background sync enabled');
  }
  
  disableBackgroundSync(): void {
    if (!this.backgroundSyncEnabled) {
      return;
    }
    
    this.backgroundSyncEnabled = false;
    
    if (this.backgroundSyncInterval) {
      clearInterval(this.backgroundSyncInterval);
      this.backgroundSyncInterval = null;
    }
    
    console.log('Background sync disabled');
  }
  
  async triggerBackgroundSync(): Promise<void> {
    if (!this.isOnline()) {
      console.log('Skipping background sync - offline');
      return;
    }
    
    try {
      // Get all feeds that need syncing
      const feedsToSync = await this.getFeedsNeedingSync();
      
      if (feedsToSync.length === 0) {
        return;
      }
      
      console.log(`Background syncing ${feedsToSync.length} feeds`);
      
      // Sync feeds with limited concurrency
      await this.syncAllFeeds(feedsToSync);
      
      console.log('Background sync completed');
    } catch (error) {
      console.error('Background sync error:', error);
    }
  }
  
  // Network status handling
  async handleNetworkFailure(feedId: string, error: Error): Promise<CalendarEvent[]> {
    console.warn(`Network failure for feed ${feedId}, falling back to cached data:`, error.message);
    
    // Try to get cached data
    const cachedEvents = await this.getCachedEvents(feedId);
    
    if (cachedEvents.length > 0) {
      console.log(`Returning ${cachedEvents.length} cached events for feed ${feedId}`);
      return cachedEvents;
    }
    
    // No cached data available
    throw new OfflineCalendarError(
      `No cached data available for feed ${feedId} and network request failed`,
      'NO_CACHED_DATA',
      feedId
    );
  }
  
  isOnline(): boolean {
    return navigator.onLine;
  }
  
  // Cache management
  async clearCache(feedId?: string): Promise<void> {
    const db = await this.getDatabase();
    
    if (feedId) {
      // Clear specific feed
      const transaction = db.transaction([EVENTS_STORE, SYNC_STATUS_STORE], 'readwrite');
      const eventsStore = transaction.objectStore(EVENTS_STORE);
      const syncStore = transaction.objectStore(SYNC_STATUS_STORE);
      
      await Promise.all([
        this.promisifyRequest(eventsStore.delete(feedId)),
        this.promisifyRequest(syncStore.delete(feedId)),
      ]);
    } else {
      // Clear all cache
      const transaction = db.transaction([EVENTS_STORE, SYNC_STATUS_STORE], 'readwrite');
      const eventsStore = transaction.objectStore(EVENTS_STORE);
      const syncStore = transaction.objectStore(SYNC_STATUS_STORE);
      
      await Promise.all([
        this.promisifyRequest(eventsStore.clear()),
        this.promisifyRequest(syncStore.clear()),
      ]);
    }
  }
  
  async getCacheStats(): Promise<{ totalEvents: number; totalFeeds: number; lastSync: Date | null }> {
    const db = await this.getDatabase();
    
    const transaction = db.transaction([EVENTS_STORE], 'readonly');
    const store = transaction.objectStore(EVENTS_STORE);
    
    let totalEvents = 0;
    let totalFeeds = 0;
    let lastSync: Date | null = null;
    
    return new Promise((resolve, reject) => {
      const cursorRequest = store.openCursor();
      
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          const cachedData = cursor.value as CachedCalendarData;
          totalEvents += cachedData.events.length;
          totalFeeds++;
          
          if (!lastSync || cachedData.lastSync > lastSync) {
            lastSync = cachedData.lastSync;
          }
          
          cursor.continue();
        } else {
          resolve({ totalEvents, totalFeeds, lastSync });
        }
      };
      
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }
  
  // Utility methods
  async isCacheValid(feedId: string, maxAge: number = this.MAX_CACHE_AGE): Promise<boolean> {
    const db = await this.getDatabase();
    
    const transaction = db.transaction([EVENTS_STORE], 'readonly');
    const store = transaction.objectStore(EVENTS_STORE);
    
    try {
      const cachedData = await this.promisifyRequest<CachedCalendarData>(store.get(feedId));
      
      if (!cachedData) {
        return false;
      }
      
      const age = Date.now() - cachedData.lastSync.getTime();
      return age < maxAge;
    } catch {
      return false;
    }
  }
  
  async getFeedSyncStatus(feedId: string): Promise<SyncStatus | null> {
    const db = await this.getDatabase();
    
    const transaction = db.transaction([SYNC_STATUS_STORE], 'readonly');
    const store = transaction.objectStore(SYNC_STATUS_STORE);
    
    try {
      return await this.promisifyRequest<SyncStatus>(store.get(feedId));
    } catch {
      return null;
    }
  }
  
  // Private helper methods
  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(new OfflineCalendarError('Failed to open IndexedDB', 'DB_OPEN_FAILED'));
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create events store
        if (!db.objectStoreNames.contains(EVENTS_STORE)) {
          const eventsStore = db.createObjectStore(EVENTS_STORE, { keyPath: 'feedId' });
          eventsStore.createIndex('lastSync', 'lastSync');
        }
        
        // Create sync status store
        if (!db.objectStoreNames.contains(SYNC_STATUS_STORE)) {
          const syncStore = db.createObjectStore(SYNC_STATUS_STORE, { keyPath: 'feedId' });
          syncStore.createIndex('lastAttempt', 'lastAttempt');
        }
      };
    });
  }
  
  private async getDatabase(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initializeDatabase();
    }
    
    if (!this.db) {
      throw new OfflineCalendarError('Database not available', 'DB_NOT_AVAILABLE');
    }
    
    return this.db;
  }
  
  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  private async fetchFreshEvents(feed: CalendarFeed): Promise<CalendarEvent[]> {
    // FIXED: Use server-side API endpoint to avoid circular dependency
    // The server will handle the actual feed fetching logic
    const response = await fetch(`/api/calendar/feeds/${feed.id}/events`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  private async updateSyncStatus(feedId: string, success: boolean, error?: string): Promise<void> {
    const db = await this.getDatabase();
    
    const transaction = db.transaction([SYNC_STATUS_STORE], 'readwrite');
    const store = transaction.objectStore(SYNC_STATUS_STORE);
    
    const now = new Date();
    const existingStatus = await this.promisifyRequest<SyncStatus>(store.get(feedId));
    
    const syncStatus: SyncStatus = {
      feedId,
      lastAttempt: now,
      lastSuccess: success ? now : (existingStatus?.lastSuccess || now),
      failureCount: success ? 0 : (existingStatus?.failureCount || 0) + 1,
      error: success ? undefined : error,
    };
    
    // Calculate next retry time for failures
    if (!success && syncStatus.failureCount <= this.MAX_RETRY_ATTEMPTS) {
      const backoffDelay = Math.min(
        1000 * Math.pow(2, syncStatus.failureCount), // Exponential backoff
        30 * 60 * 1000 // Max 30 minutes
      );
      syncStatus.nextRetry = new Date(now.getTime() + backoffDelay);
    }
    
    await this.promisifyRequest(store.put(syncStatus));
  }
  
  private async getFeedsNeedingSync(): Promise<CalendarFeed[]> {
    // This would integrate with the main feed management system
    // For now, return an empty array
    return [];
  }
  
  private setupVisibilityChangeHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.backgroundSyncEnabled) {
        // Tab regained focus, trigger sync
        setTimeout(() => {
          this.triggerBackgroundSync().catch(error => {
            console.error('Focus sync failed:', error);
          });
        }, 1000); // Small delay to avoid immediate sync on tab switch
      }
    });
  }
  
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

// Create a singleton instance
export const offlineCalendarService = new OfflineCalendarServiceImpl();