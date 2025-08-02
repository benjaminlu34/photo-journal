/**
 * Friend calendar service for handling friend calendar synchronization
 */

import type { FriendCalendarEvent, CalendarFeed, DateRange } from '@/types/calendar';
import type { Friend } from '@/types/journal';

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
      
      // Use cache if recent (within 15 minutes)
      if (cachedEvents && lastSync && (Date.now() - lastSync.getTime()) < 15 * 60 * 1000) {
        return cachedEvents.filter(event => 
          event.startTime >= startDate && event.startTime <= endDate
        );
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
      // In a real implementation, this would:
      // 1. Check friend relationship status
      // 2. Check permission level (viewer+ required)
      // 3. Verify friend hasn't blocked calendar access
      
      // Make API call to check permissions
      const response = await fetch(`/api/friends/${friend.id}/calendar-access`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      return data.hasAccess && ['viewer', 'contributor', 'editor', 'owner'].includes(data.permission);
    } catch (error) {
      console.error('Error validating friend access:', error);
      return false;
    }
  }
  
  // Check if user can view friend's calendar
  async canViewFriendCalendar(friendUserId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/friends/${friendUserId}/calendar-access`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      return data.hasAccess;
    } catch (error) {
      console.error('Error checking calendar access:', error);
      return false;
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
      const response = await fetch('/api/friends/with-calendar-access', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch friends with calendar access');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching friends with calendar access:', error);
      return [];
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
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      
      await this.fetchFriendEvents(friend, twoWeeksAgo, twoWeeksFromNow);
      
      console.log(`Refreshed events for friend: ${friendUserId}`);
    } catch (error) {
      console.error('Error refreshing friend events:', error);
      throw error;
    }
  }
  
  // Private helper methods
  private async fetchFriendEventsFromAPI(friendUserId: string, startDate: Date, endDate: Date): Promise<FriendCalendarEvent[]> {
    const response = await fetch(`/api/friends/${friendUserId}/calendar/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch friend events: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Transform API response to FriendCalendarEvent format
    return data.events.map((event: any): FriendCalendarEvent => ({
      ...event,
      startTime: new Date(event.startTime),
      endTime: new Date(event.endTime),
      friendUserId,
      isFromFriend: true,
      sourceId: friendUserId,
      canonicalEventId: event.id,
      originalEventId: event.id
    }));
  }
  
  private async getFriendById(friendUserId: string): Promise<Friend | null> {
    try {
      const response = await fetch(`/api/friends/${friendUserId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching friend by ID:', error);
      return null;
    }
  }
  
  private async clearIndexedDBCache(friendId: string): Promise<void> {
    try {
      // Open IndexedDB and clear friend-specific data
      const dbName = 'FriendCalendarCache';
      const request = indexedDB.open(dbName, 1);
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['friendEvents'], 'readwrite');
        const store = transaction.objectStore('friendEvents');
        store.delete(friendId);
      };
    } catch (error) {
      console.error('Error clearing IndexedDB cache:', error);
    }
  }
  
  // Generate a consistent color for a friend's calendar
  private generateFriendColor(friendId: string): string {
    // Simple hash-based color generation for consistency
    let hash = 0;
    for (let i = 0; i < friendId.length; i++) {
      hash = friendId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      '#3B82F6', // Blue
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#10B981', // Green
      '#F59E0B', // Amber
      '#EF4444', // Red
      '#06B6D4', // Cyan
      '#84CC16', // Lime
    ];
    
    return colors[Math.abs(hash) % colors.length];
  }
}

// Create a singleton instance
export const friendCalendarService = new FriendCalendarServiceImpl();