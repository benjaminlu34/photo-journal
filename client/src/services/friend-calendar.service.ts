/**
 * Friend calendar service for handling friend calendar synchronization
 */

import type { FriendCalendarEvent, CalendarFeed, DateRange } from '@/types/calendar';
import type { Friend } from '@/types/journal';
import { generateFriendColor as sharedGenerateFriendColor } from '@/utils/colorUtils/colorUtils';
import { sub, add } from 'date-fns';

// Configuration constants
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const EVENT_WINDOW_WEEKS = 2; // ±2 weeks for event expansion

// Auth utilities (should be imported from auth service in real implementation)
const getAuthToken = (): string => {
  // In real implementation, get from auth service/context
  return localStorage.getItem('auth_token') || '';
};

const getCsrfToken = (): string => {
  // In real implementation, get from meta tag or auth service
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
};

// API response interfaces
interface FriendCalendarAccessResponse {
  hasAccess: boolean;
  permission: 'viewer' | 'contributor' | 'editor' | 'owner';
}

interface FriendEventsResponse {
  events: Array<{
    id: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    color: string;
    location?: string;
    attendees?: string[];
  }>;
}

export interface FriendCalendarService {
  // Create a friend calendar feed
  createFriendFeed(friend: Friend): CalendarFeed;
  
  // Fetch events from a friend's calendar
  fetchFriendEvents(friend: Friend, startDate: Date, endDate: Date): Promise<FriendCalendarEvent[]>;
  
  // Validate friend calendar access (viewer+ permissions required)
  validateFriendAccess(friend: Friend): Promise<boolean>;
  
  // Check if user can view friend's calendar
  canViewFriendCalendar(friendUserId: string): Promise<boolean>;
  
  // Handle friend permission changes (auto-unsync if permissions revoked)
  handlePermissionChange(friend: Friend, hasAccess: boolean): void;
  
  // Purge friend cache & revoke encrypted IndexedDB blobs on permission loss
  purgeFriendCache(friendId: string): void;
  
  // Sync friend's calendar events (requires viewer permission)
  syncFriendCalendar(friendUserId: string): Promise<CalendarFeed>;
  
  // Get friend's events for date range
  getFriendEvents(friendUserId: string, dateRange: DateRange): Promise<FriendCalendarEvent[]>;
  
  // Remove friend calendar sync
  unsyncFriendCalendar(friendUserId: string): Promise<void>;
  
  // Get list of friends with calendar access
  getFriendsWithCalendarAccess(): Promise<Friend[]>;
  
  // Refresh individual friend's events
  refreshFriendEvents(friendUserId: string): Promise<void>;
}

export class FriendCalendarServiceImpl implements FriendCalendarService {
  // Per friend → per-window cache entries with TTL
  // friendId → (rangeKey → { events, ts })
  private friendCaches: Map<string, Map<string, { events: FriendCalendarEvent[]; ts: number }>> = new Map();
  private friendFeeds: Map<string, CalendarFeed> = new Map();

  // Private sync metadata - use getter methods for access
  private lastSyncTimestamps: Map<string, Date> = new Map();
  private syncErrors: Map<string, string> = new Map();

  private abortControllers: Map<string, AbortController> = new Map();

  // Backoff configuration
  private readonly BASE_BACKOFF_MS = 500;
  private readonly MAX_BACKOFF_MS = 8000;

  // Range key helper (date-only clamped ISO) to produce stable window keys
  private getRangeKey(start: Date, end: Date): string {
    const clamp = (d: Date) => {
      const copy = new Date(d);
      // Normalize to minutes to avoid second-level jitter
      copy.setSeconds(0, 0);
      return copy.toISOString();
    };
    return `${clamp(start)}..${clamp(end)}`;
  }

  private getFriendWindowCache(friendId: string): Map<string, { events: FriendCalendarEvent[]; ts: number }> {
    let map = this.friendCaches.get(friendId);
    if (!map) {
      map = new Map();
      this.friendCaches.set(friendId, map);
    }
    return map;
  }

  private isFresh(ts: number): boolean {
    return Date.now() - ts < CACHE_TTL_MS;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private computeBackoff(attempt: number): number {
    const exp = Math.min(this.MAX_BACKOFF_MS, this.BASE_BACKOFF_MS * Math.pow(2, attempt));
    const jitter = Math.random() * (exp * 0.25);
    return Math.min(this.MAX_BACKOFF_MS, exp + jitter);
  }

  // Deduplicate by canonical/external id, prefer latest lastModified; ensure stable friend color
  private dedupeAndColorize(friend: Friend, events: FriendCalendarEvent[]): FriendCalendarEvent[] {
    const map = new Map<string, FriendCalendarEvent>();
    for (const ev of events) {
      const key = ev.canonicalEventId || ev.externalId || ev.id;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          ...ev,
          color: ev.color || this.generateFriendColor(friend.id),
          source: 'friend',
          isFromFriend: true,
          friendUserId: friend.id,
          friendUsername: friend.username ?? friend.id,
          feedId: `friend-${friend.id}`,
          feedName: `${friend.firstName || friend.lastName || 'Friend'}'s Calendar`,
          sourceId: friend.id,
        });
      } else {
        const prevLm = prev.lastModified ? new Date(prev.lastModified).getTime() : 0;
        const curLm = ev.lastModified ? new Date(ev.lastModified).getTime() : 0;
        if (curLm >= prevLm) {
          map.set(key, {
            ...prev,
            ...ev,
            color: ev.color || prev.color || this.generateFriendColor(friend.id),
          });
        }
      }
    }
    return Array.from(map.values());
  }

  // IndexedDB helpers per friend+rangeKey
  private async saveToIndexedDB(friendId: string, rangeKey: string, events: FriendCalendarEvent[]): Promise<void> {
    try {
      const db = await this.openIDB();
      const tx = db.transaction(['friendEvents'], 'readwrite');
      const store = tx.objectStore('friendEvents');
      await new Promise((res, rej) => {
        const req = store.put({ friendId, rangeKey, events, savedAt: Date.now() }, `${friendId}::${rangeKey}`);
        req.onsuccess = () => res(null);
        req.onerror = () => rej(req.error);
      });
      tx.commit?.();
      db.close();
    } catch (e) {
      console.warn('IndexedDB save failed (friend events):', e);
    }
  }

  private async loadFromIndexedDB(friendId: string, rangeKey: string): Promise<FriendCalendarEvent[] | null> {
    try {
      const db = await this.openIDB();
      const tx = db.transaction(['friendEvents'], 'readonly');
      const store = tx.objectStore('friendEvents');
      const record = await new Promise<any>((res, rej) => {
        const req = store.get(`${friendId}::${rangeKey}`);
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => rej(req.error);
      });
      db.close();
      if (record?.events && Array.isArray(record.events)) {
        return record.events as FriendCalendarEvent[];
      }
      return null;
    } catch (e) {
      console.warn('IndexedDB load failed (friend events):', e);
      return null;
    }
  }

  private async deleteAllFriendIDB(friendId: string): Promise<void> {
    try {
      const db = await this.openIDB();
      const tx = db.transaction(['friendEvents'], 'readwrite');
      const store = tx.objectStore('friendEvents');
      // Iterate all keys and delete those matching friendId::
      await new Promise<void>((res, rej) => {
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result as IDBCursorWithValue | null;
          if (!cursor) {
            res();
            return;
          }
          const keyStr = String(cursor.key);
          if (keyStr.startsWith(`${friendId}::`)) {
            const delReq = cursor.delete();
            delReq.onsuccess = () => cursor.continue();
            delReq.onerror = () => rej(delReq.error);
          } else {
            cursor.continue();
          }
        };
        req.onerror = () => rej(req.error);
      });
      tx.commit?.();
      db.close();
    } catch (e) {
      console.warn('IndexedDB purge failed (friend events):', e);
    }
  }

  private openIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FriendCalendarCache', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('friendEvents')) {
          db.createObjectStore('friendEvents');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Create secure headers for API calls
  private getSecureHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
      'X-CSRF-Token': getCsrfToken(),
    };
  }

  // Cancel ongoing requests for a friend
  private cancelFriendRequests(friendId: string): void {
    const controller = this.abortControllers.get(friendId);
    if (controller) {
      try {
        controller.abort();
      } catch (error) {
        console.debug('Error aborting request for friend', friendId, error);
      }
      this.abortControllers.delete(friendId);
    }
  }

  // Create abort controller for request cancellation
  private createAbortController(friendId: string): AbortSignal {
    this.cancelFriendRequests(friendId);
    const controller = new AbortController();
    this.abortControllers.set(friendId, controller);
    return controller.signal;
  }
  
  // Create a friend calendar feed
  createFriendFeed(friend: Friend): CalendarFeed {
    const feedId = `friend-${friend.id}`;
    
    const feed: CalendarFeed = {
      id: feedId,
      name: `${friend.firstName || friend.lastName || 'Friend'}'s Calendar`,
      type: 'friend',
      friendUserId: friend.id,
      color: this.generateFriendColor(friend.id),
      isEnabled: true,
      lastSyncAt: new Date(),
    };
    
    this.friendFeeds.set(friend.id, feed);
    return feed;
  }
  
  // Fetch events from a friend's calendar with per-window TTL + IDB fallback + retry/backoff
  async fetchFriendEvents(friend: Friend, startDate: Date, endDate: Date): Promise<FriendCalendarEvent[]> {
    try {
      // Check permissions first
      const hasAccess = await this.validateFriendAccess(friend);
      if (!hasAccess) {
        throw new Error(`No permission to access ${friend.firstName || friend.lastName || friend.id}'s calendar`);
      }

      const rangeKey = this.getRangeKey(startDate, endDate);
      const windowCache = this.getFriendWindowCache(friend.id);
      const cached = windowCache.get(rangeKey);
      if (cached && this.isFresh(cached.ts)) {
        return cached.events;
      }

      // Attempt IDB when cache is missing/stale
      const idbEvents = await this.loadFromIndexedDB(friend.id, rangeKey);
      if (idbEvents) {
        // serve IDB immediately while attempting background refresh (fire-and-forget)
        queueMicrotask(() => {
          this.fetchAndCacheFriendWindow(friend, startDate, endDate, rangeKey).catch(() => void 0);
        });
        return idbEvents as FriendCalendarEvent[];
      }

      // Otherwise fetch network with retries/backoff
      const fresh = await this.fetchAndCacheFriendWindow(friend, startDate, endDate, rangeKey);
      return fresh;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.syncErrors.set(friend.id, errorMessage);
      console.error(`Failed to fetch events for friend ${friend.firstName || friend.lastName || friend.id}:`, error);
      return [];
    }
  }
  
  // Validate friend calendar access (viewer+ permissions required)
  async validateFriendAccess(friend: Friend): Promise<boolean> {
    try {
      const signal = this.createAbortController(friend.id);

      const response = await fetch(`/api/friends/${friend.id}/calendar-access`, {
        method: 'GET',
        headers: this.getSecureHeaders(),
        credentials: 'include',
        signal
      });
      
      if (!response.ok) {
        throw new Error(`Failed to validate access: ${response.statusText}`);
      }
      
      const data: FriendCalendarAccessResponse = await response.json();
      return data.hasAccess && ['viewer', 'contributor', 'editor', 'owner'].includes(data.permission);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Friend access validation cancelled');
        return false;
      }
      console.error('Error validating friend access:', error);
      return false;
    } finally {
      this.abortControllers.delete(friend.id);
    }
  }
  
  // Check if user can view friend's calendar
  async canViewFriendCalendar(friendUserId: string): Promise<boolean> {
    try {
      const signal = this.createAbortController(friendUserId);

      const response = await fetch(`/api/friends/${friendUserId}/calendar-access`, {
        method: 'GET',
        headers: this.getSecureHeaders(),
        credentials: 'include',
        signal
      });
      
      if (!response.ok) {
        throw new Error(`Failed to check calendar access: ${response.statusText}`);
      }
      
      const data: FriendCalendarAccessResponse = await response.json();
      return data.hasAccess;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Calendar access check cancelled');
        return false;
      }
      console.error('Error checking calendar access:', error);
      return false;
    } finally {
      this.abortControllers.delete(friendUserId);
    }
  }
  
  // Handle friend permission changes (auto-unsync if permissions revoked)
  handlePermissionChange(friend: Friend, hasAccess: boolean): void {
    if (!hasAccess) {
      // Purge cache and remove feed when access is revoked
      this.purgeFriendCache(friend.id);
      this.friendFeeds.delete(friend.id);
    }
  }
  
  // Purge friend cache & revoke encrypted IndexedDB blobs on permission loss
  purgeFriendCache(friendId: string): void {
    // Remove cached events for this friend (all windows)
    this.friendCaches.delete(friendId);
    this.lastSyncTimestamps.delete(friendId);
    this.syncErrors.delete(friendId);

    // Clear IndexedDB cache for this friend (all windows)
    void this.deleteAllFriendIDB(friendId);

    console.log(`Purged cache for friend: ${friendId}`);
  }
  
  // Sync friend's calendar events (requires viewer permission)
  async syncFriendCalendar(friendUserId: string): Promise<CalendarFeed> {
    try {
      // First check if we can access this friend's calendar
      const hasAccess = await this.canViewFriendCalendar(friendUserId);
      if (!hasAccess) {
        throw new Error('No permission to sync this friend\'s calendar');
      }
      
      // Fetch friend data
      const friend = await this.getFriendById(friendUserId);
      if (!friend) {
        throw new Error('Friend not found');
      }
      
      // Create or update the friend feed
      const feed = this.createFriendFeed(friend);
      
      return feed;
    } catch (error) {
      console.error('Error syncing friend calendar:', error);
      throw error;
    }
  }
  
  // Get friend's events for date range
  async getFriendEvents(friendUserId: string, dateRange: DateRange): Promise<FriendCalendarEvent[]> {
    try {
      const friend = await this.getFriendById(friendUserId);
      if (!friend) {
        throw new Error('Friend not found');
      }
      
      return await this.fetchFriendEvents(friend, dateRange.start, dateRange.end);
    } catch (error) {
      console.error('Error getting friend events:', error);
      throw error;
    }
  }
  
  // Remove friend calendar sync
  async unsyncFriendCalendar(friendUserId: string): Promise<void> {
    try {
      // Remove feed
      this.friendFeeds.delete(friendUserId);

      // Purge all cached data
      this.purgeFriendCache(friendUserId);

      console.log(`Unsynced friend calendar: ${friendUserId}`);
    } catch (error) {
      console.error('Error unsyncing friend calendar:', error);
      throw error;
    }
  }
  
  // Get list of friends with calendar access
  async getFriendsWithCalendarAccess(): Promise<Friend[]> {
    try {
      const signal = this.createAbortController('friends-list');

      const response = await fetch('/api/friends/with-calendar-access', {
        method: 'GET',
        headers: this.getSecureHeaders(),
        credentials: 'include',
        signal
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch friends with calendar access: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Friends list fetch cancelled');
        return [];
      }
      console.error('Error fetching friends with calendar access:', error);
      throw error;
    } finally {
      this.abortControllers.delete('friends-list');
    }
  }
  
  // Public getter methods for sync metadata (maintains encapsulation)
  getSyncTimestamps(): ReadonlyMap<string, Date> {
    return new Map(this.lastSyncTimestamps);
  }

  getSyncErrors(): ReadonlyMap<string, string> {
    return new Map(this.syncErrors);
  }

  // Refresh individual friend's events: invalidate all windows, then refetch current window
  async refreshFriendEvents(friendUserId: string): Promise<void> {
    try {
      // Invalidate per-window cache for friend
      const windowCache = this.friendCaches.get(friendUserId);
      if (windowCache) {
        windowCache.clear();
      }
      this.lastSyncTimestamps.delete(friendUserId);

      const friend = await this.getFriendById(friendUserId);
      if (!friend) {
        throw new Error('Friend not found');
      }

      // Fetch fresh events for the current focus window (±2 weeks from now)
      const now = new Date();
      const twoWeeksAgo = sub(now, { days: 14 });
      const twoWeeksFromNow = add(now, { days: 14 });

      await this.fetchFriendEvents(friend, twoWeeksAgo, twoWeeksFromNow);

      console.log(`Refreshed events for friend: ${friendUserId}`);
    } catch (error) {
      console.error('Error refreshing friend events:', error);
      throw error;
    }
  }
  
  // Private helper methods
  private async fetchAndCacheFriendWindow(friend: Friend, startDate: Date, endDate: Date, rangeKey: string): Promise<FriendCalendarEvent[]> {
    let attempt = 0;
    while (attempt < 4) {
      try {
        const raw = await this.fetchFriendEventsFromAPI(friend, startDate, endDate);
        const events = this.dedupeAndColorize(friend, raw);
        const windowCache = this.getFriendWindowCache(friend.id);
        windowCache.set(rangeKey, { events, ts: Date.now() });
        this.lastSyncTimestamps.set(friend.id, new Date());
        this.syncErrors.delete(friend.id);
        // persist to IDB
        this.saveToIndexedDB(friend.id, rangeKey, events).catch(() => void 0);
        return events;
      } catch (e) {
        attempt++;
        if (attempt >= 4) {
          throw e;
        }
        await this.sleep(this.computeBackoff(attempt));
      }
    }
    // This point should never be reached due to the throw in the loop
  }

  private async fetchFriendEventsFromAPI(friend: Friend, startDate: Date, endDate: Date): Promise<FriendCalendarEvent[]> {
    try {
      const signal = this.createAbortController(friend.id);

      const response = await fetch(`/api/friends/${friend.id}/calendar/events`, {
        method: 'POST',
        headers: this.getSecureHeaders(),
        credentials: 'include',
        signal,
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch friend events: ${response.statusText}`);
      }

      const data: FriendEventsResponse = await response.json();

      // Transform API response to FriendCalendarEvent format, preserving friend metadata
      return data.events.map((event): FriendCalendarEvent => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
        isAllDay: event.isAllDay,
        color: event.color,
        location: event.location,
        attendees: event.attendees,
        feedId: `friend-${friend.id}`,
        feedName: `${friend.firstName || friend.lastName || 'Friend'}'s Calendar`,
        externalId: event.id,
        sequence: 0,
        source: 'friend' as const,
        lastModified: new Date(event.startTime),
        friendUserId: friend.id,
        friendUsername: friend.username ?? friend.id,
        isFromFriend: true,
        sourceId: friend.id,
        canonicalEventId: event.id,
        originalEventId: event.id,
        isRecurring: false
      }));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Friend events fetch cancelled');
        return [];
      }
      throw error;
    } finally {
      this.abortControllers.delete(friend.id);
    }
  }
  
  private async getFriendById(friendUserId: string): Promise<Friend | null> {
    try {
      const signal = this.createAbortController(`friend-${friendUserId}`);

      const response = await fetch(`/api/friends/${friendUserId}`, {
        method: 'GET',
        headers: this.getSecureHeaders(),
        credentials: 'include',
        signal
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch friend: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Friend fetch cancelled');
        return null;
      }
      console.error('Error fetching friend by ID:', error);
      throw error;
    } finally {
      this.abortControllers.delete(`friend-${friendUserId}`);
    }
  }
  
  // obsolete: replaced by deleteAllFriendIDB
  private async clearIndexedDBCache(friendId: string): Promise<void> {
    return this.deleteAllFriendIDB(friendId);
  }
  
  // Generate a consistent color for a friend's calendar
  private generateFriendColor(friendId: string): string {
    return sharedGenerateFriendColor(friendId);
  }
}

// Create a singleton instance
export const friendCalendarService = new FriendCalendarServiceImpl();