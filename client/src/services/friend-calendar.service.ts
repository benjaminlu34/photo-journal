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
  private friendCaches: Map<string, FriendCalendarEvent[]> = new Map();
  private friendFeeds: Map<string, CalendarFeed> = new Map();
  private lastSyncTimestamps: Map<string, Date> = new Map();
  private syncErrors: Map<string, string> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

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
      controller.abort();
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
  
  // Fetch events from a friend's calendar
  async fetchFriendEvents(friend: Friend, startDate: Date, endDate: Date): Promise<FriendCalendarEvent[]> {
    try {
      // Check permissions first
      const hasAccess = await this.validateFriendAccess(friend);
      if (!hasAccess) {
        throw new Error(`No permission to access ${friend.firstName || friend.lastName || friend.id}'s calendar`);
      }
      
      // Check if we have cached events for this friend
      const cacheKey = friend.id;
      const cachedEvents = this.friendCaches.get(cacheKey);
      const lastSync = this.lastSyncTimestamps.get(cacheKey);
      
      // Use cache if recent (within configured TTL)
      if (cachedEvents && lastSync && (Date.now() - lastSync.getTime()) < CACHE_TTL_MS) {
        return cachedEvents.filter(event => {
          // Check for event overlap with date range (handles multi-day events)
          const eventStart = new Date(event.startTime);
          const eventEnd = new Date(event.endTime);
          return eventStart < endDate && eventEnd > startDate;
        });
      }
      
      // Fetch fresh events from API
      const events = await this.fetchFriendEventsFromAPI(friend.id, startDate, endDate);
      
      // Cache the events and update timestamp
      this.friendCaches.set(cacheKey, events);
      this.lastSyncTimestamps.set(cacheKey, new Date());
      this.syncErrors.delete(cacheKey); // Clear any previous errors
      
      return events;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.syncErrors.set(friend.id, errorMessage);
      console.error(`Failed to fetch events for friend ${friend.firstName || friend.lastName || friend.id}:`, error);
      throw error;
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
    // Remove cached events for this friend
    this.friendCaches.delete(friendId);
    this.lastSyncTimestamps.delete(friendId);
    this.syncErrors.delete(friendId);
    
    // Clear IndexedDB cache for this friend
    this.clearIndexedDBCache(friendId);
    
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
  
  // Refresh individual friend's events
  async refreshFriendEvents(friendUserId: string): Promise<void> {
    try {
      // Clear cache to force fresh fetch
      this.friendCaches.delete(friendUserId);
      this.lastSyncTimestamps.delete(friendUserId);
      
      const friend = await this.getFriendById(friendUserId);
      if (!friend) {
        throw new Error('Friend not found');
      }
      
      // Fetch fresh events for the current week (±2 weeks window)
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
  private async fetchFriendEventsFromAPI(friendUserId: string, startDate: Date, endDate: Date): Promise<FriendCalendarEvent[]> {
    try {
      const signal = this.createAbortController(friendUserId);

      const response = await fetch(`/api/friends/${friendUserId}/calendar/events`, {
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
      
      // Transform API response to FriendCalendarEvent format
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
        feedId: `friend-${friendUserId}`,
        feedName: `Friend's Calendar`,
        externalId: event.id,
        sequence: 0,
        source: 'ical' as const,
        lastModified: new Date(event.startTime), // Use stable timestamp instead of new Date()
        friendUserId,
        friendUsername: friendUserId, // Should be resolved from friend data
        isFromFriend: true,
        sourceId: friendUserId,
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
      this.abortControllers.delete(friendUserId);
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
  
  private async clearIndexedDBCache(friendId: string): Promise<void> {
    try {
      // Open IndexedDB and clear friend-specific data
      const dbName = 'FriendCalendarCache';
      const request = indexedDB.open(dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('friendEvents')) {
          db.createObjectStore('friendEvents');
        }
      };
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['friendEvents'], 'readwrite');
        const store = transaction.objectStore('friendEvents');
        store.delete(friendId);
      };
      
      request.onerror = (event) => {
        console.error('Error opening IndexedDB for cache clearing:', event);
      };
    } catch (error) {
      console.error('Error clearing IndexedDB cache:', error);
    }
  }
  
  // Generate a consistent color for a friend's calendar
  private generateFriendColor(friendId: string): string {
    return sharedGenerateFriendColor(friendId);
  }
}

// Create a singleton instance
export const friendCalendarService = new FriendCalendarServiceImpl();