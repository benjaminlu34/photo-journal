/**
 * Friend calendar service for handling friend calendar synchronization
 */

import type { FriendCalendarEvent, CalendarFeed } from '@/types/calendar';
import type { Friend } from '@/types/journal';

export interface FriendCalendarService {
  // Create a friend calendar feed
  createFriendFeed(friend: Friend): CalendarFeed;
  
  // Fetch events from a friend's calendar
  fetchFriendEvents(friend: Friend, startDate: Date, endDate: Date): Promise<FriendCalendarEvent[]>;
  
  // Validate friend calendar access (viewer+ permissions required)
  validateFriendAccess(friend: Friend): boolean;
  
  // Handle friend permission changes (auto-unsync if permissions revoked)
  handlePermissionChange(friend: Friend, hasAccess: boolean): void;
  
  // Purge friend cache & revoke encrypted IndexedDB blobs on permission loss
  purgeFriendCache(friendId: string): void;
}

export class FriendCalendarServiceImpl implements FriendCalendarService {
  private friendCaches: Map<string, FriendCalendarEvent[]> = new Map();
  private friendFeeds: Map<string, CalendarFeed> = new Map();
  
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
      // Check if we have cached events for this friend
      const cacheKey = friend.id;
      const cachedEvents = this.friendCaches.get(cacheKey);
      
      // In a real implementation, this would:
      // 1. Check permissions to ensure we still have access
      // 2. Make an API call to fetch friend's events for the date range
      // 3. Convert to FriendCalendarEvent format
      // 4. Cache the results
      
      // For now, we'll return an empty array to demonstrate the structure
      console.log(`Fetching events for friend: ${friend.firstName || friend.lastName || friend.id}`);
      const events: FriendCalendarEvent[] = [];
      
      // Cache the events
      this.friendCaches.set(cacheKey, events);
      
      return events;
    } catch (error) {
      console.error(`Failed to fetch events for friend ${friend.firstName || friend.lastName || friend.id}:`, error);
      throw error;
    }
  }
  
  // Validate friend calendar access (viewer+ permissions required)
  validateFriendAccess(friend: Friend): boolean {
    // In a real implementation, this would check the friend's permission level
    // For now, we'll assume access is valid if the friend exists
    return !!friend && !!friend.id;
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
    
    // In a real implementation, we would also:
    // 1. Remove any encrypted data stored in IndexedDB
    // 2. Revoke any tokens or credentials
    console.log(`Purged cache for friend: ${friendId}`);
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