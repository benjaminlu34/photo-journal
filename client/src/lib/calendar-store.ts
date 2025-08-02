/**
 * Zustand store for managing calendar state with CRDT integration
 */

import { create } from 'zustand';
import type { LocalEvent, CalendarEvent, FriendCalendarEvent, CalendarFeed, DateRange } from '@/types/calendar';
import { getCalendarSdk } from './calendar-sdk';
import { friendCalendarService } from '@/services/friend-calendar.service';

interface CalendarState {
  // Data state
  localEvents: Record<string, LocalEvent>;
  externalEvents: Record<string, CalendarEvent[]>;
  friendEvents: Record<string, FriendCalendarEvent[]>; // friendUserId -> events
  feeds: CalendarFeed[];
  syncedFriends: string[]; // List of synced friend user IDs
  
  // UI state
  currentWeek: Date;
  selectedEventId: string | null;
  isLoading: boolean;
  error: string | null;
  isFriendSyncModalOpen: boolean;
  
  // SDK instance
  sdk?: ReturnType<typeof getCalendarSdk>;
  userId?: string;
  
  // Initialization state
  isInitialized: boolean;
  
  // Actions
  actions: {
    init: (weekId: string, userId?: string, userName?: string, username?: string) => void;
    createLocalEvent: (event: Omit<LocalEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'collaborators'>) => Promise<void>;
    updateLocalEvent: (id: string, updates: Partial<LocalEvent>) => Promise<void>;
    deleteLocalEvent: (id: string) => void;
    setCurrentWeek: (date: Date) => void;
    setSelectedEventId: (id: string | null) => void;
    addFeed: (feed: CalendarFeed) => void;
    removeFeed: (feedId: string) => void;
    addExternalEvents: (feedId: string, events: CalendarEvent[]) => void;
    addFriendEvents: (friendUserId: string, events: FriendCalendarEvent[]) => void;
    setError: (error: string | null) => void;
    setFriendSyncModalOpen: (isOpen: boolean) => void;
    
    // Friend calendar sync actions
    syncFriendCalendar: (friendUserId: string) => Promise<void>;
    unsyncFriendCalendar: (friendUserId: string) => Promise<void>;
    refreshFriendEvents: (friendUserId: string) => Promise<void>;
    loadFriendEventsForWeek: (weekDate: Date) => Promise<void>;
    handleFriendPermissionChange: (friendUserId: string, hasAccess: boolean) => void;
    
    cleanup?: () => void;
  };
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  // Initial state
  localEvents: {},
  externalEvents: {},
  friendEvents: {},
  feeds: [],
  syncedFriends: [],
  currentWeek: new Date(),
  selectedEventId: null,
  isLoading: false,
  error: null,
  isFriendSyncModalOpen: false,
  sdk: undefined,
  userId: undefined,
  isInitialized: false,
  
  actions: {
    // Initialize the calendar store with a specific week
    init: (weekId, userId = 'anonymous', userName = 'Anonymous', username?: string) => {
      const state = get();
      
      // Prevent re-initialization
      if (state.isInitialized && state.userId === userId) {
        return;
      }
      
      // Cleanup existing SDK if any
      if (state.sdk) {
        state.sdk.destroy();
      }
      
      const sdk = getCalendarSdk(weekId, userId, userName, username);
      set({
        userId,
        isInitialized: true,
        localEvents: Object.fromEntries((sdk.getLocalEvents() as LocalEvent[]).map((event: LocalEvent) => [event.id, event])),
        sdk
      });
      
      // Subscribe to changes from the SDK
      sdk.onChange((events: LocalEvent[]) => {
        set({ localEvents: Object.fromEntries(events.map((event: LocalEvent) => [event.id, event])) });
      });
    },
    
    // Create a new local event
    createLocalEvent: async (event) => {
      const { sdk } = get();
      if (sdk) {
        await sdk.createLocalEvent(event);
      }
    },
    
    // Update an existing local event
    updateLocalEvent: async (id, updates) => {
      const { sdk } = get();
      if (sdk) {
        await sdk.updateLocalEvent(id, updates);
      }
    },
    
    // Delete a local event
    deleteLocalEvent: (id) => {
      const { sdk } = get();
      if (sdk) {
        sdk.deleteLocalEvent(id);
      }
    },
    
    // Set the current week
    setCurrentWeek: (date: Date) => {
      set({ currentWeek: date });
    },
    
    // Set the selected event ID
    setSelectedEventId: (id: string | null) => {
      set({ selectedEventId: id });
    },
    
    // Add a calendar feed
    addFeed: (feed: CalendarFeed) => {
      set((state) => ({
        feeds: [...state.feeds, feed]
      }));
    },
    
    // Remove a calendar feed
    removeFeed: (feedId: string) => {
      set((state) => ({
        feeds: state.feeds.filter(feed => feed.id !== feedId)
      }));
    },
    
    // Add external events from a feed
    addExternalEvents: (feedId: string, events: CalendarEvent[]) => {
      set((state) => ({
        externalEvents: {
          ...state.externalEvents,
          [feedId]: events
        }
      }));
    },
    
    // Add friend events
    addFriendEvents: (friendUserId: string, events: FriendCalendarEvent[]) => {
      set((state) => ({
        friendEvents: {
          ...state.friendEvents,
          [friendUserId]: events
        }
      }));
    },
    
    // Set an error message
    setError: (error: string | null) => {
      set({ error });
    },
    
    // Set friend sync modal open state
    setFriendSyncModalOpen: (isOpen: boolean) => {
      set({ isFriendSyncModalOpen: isOpen });
    },
    
    // Sync friend's calendar events (requires viewer permission)
    syncFriendCalendar: async (friendUserId: string) => {
      try {
        set({ isLoading: true, error: null });
        
        // Create friend calendar feed
        const feed = await friendCalendarService.syncFriendCalendar(friendUserId);
        
        // Add to feeds and synced friends
        set((state) => ({
          feeds: [...state.feeds.filter(f => f.friendUserId !== friendUserId), feed],
          syncedFriends: [...state.syncedFriends.filter(id => id !== friendUserId), friendUserId]
        }));
        
        // Load friend events for current week
        await get().actions.loadFriendEventsForWeek(get().currentWeek);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to sync friend calendar';
        set({ error: errorMessage });
        console.error('Error syncing friend calendar:', error);
      } finally {
        set({ isLoading: false });
      }
    },
    
    // Remove friend calendar sync
    unsyncFriendCalendar: async (friendUserId: string) => {
      try {
        set({ isLoading: true, error: null });
        
        // Remove from service
        await friendCalendarService.unsyncFriendCalendar(friendUserId);
        
        // Remove from store
        set((state) => ({
          feeds: state.feeds.filter(f => f.friendUserId !== friendUserId),
          syncedFriends: state.syncedFriends.filter(id => id !== friendUserId),
          friendEvents: Object.fromEntries(
            Object.entries(state.friendEvents).filter(([key]) => key !== friendUserId)
          )
        }));
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to unsync friend calendar';
        set({ error: errorMessage });
        console.error('Error unsyncing friend calendar:', error);
      } finally {
        set({ isLoading: false });
      }
    },
    
    // Refresh individual friend's events
    refreshFriendEvents: async (friendUserId: string) => {
      try {
        set({ isLoading: true, error: null });
        
        // Refresh events from service
        await friendCalendarService.refreshFriendEvents(friendUserId);
        
        // Reload friend events for current week
        await get().actions.loadFriendEventsForWeek(get().currentWeek);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to refresh friend events';
        set({ error: errorMessage });
        console.error('Error refreshing friend events:', error);
      } finally {
        set({ isLoading: false });
      }
    },
    
    // Load friend events for the current week
    loadFriendEventsForWeek: async (weekDate: Date) => {
      try {
        const { syncedFriends } = get();
        
        if (syncedFriends.length === 0) {
          return;
        }
        
        // Calculate week range (±2 weeks for expansion window)
        const weekStart = new Date(weekDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() - 14); // Start of week minus 2 weeks
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 35); // End of week plus 2 weeks
        
        const dateRange: DateRange = {
          start: weekStart,
          end: weekEnd
        };
        
        // Load events for all synced friends
        const friendEventsMap: Record<string, FriendCalendarEvent[]> = {};
        
        await Promise.all(
          syncedFriends.map(async (friendUserId) => {
            try {
              const events = await friendCalendarService.getFriendEvents(friendUserId, dateRange);
              friendEventsMap[friendUserId] = events;
            } catch (error) {
              console.error(`Error loading events for friend ${friendUserId}:`, error);
              friendEventsMap[friendUserId] = [];
            }
          })
        );
        
        // Update store with friend events
        set((state) => ({
          friendEvents: {
            ...state.friendEvents,
            ...friendEventsMap
          }
        }));
        
      } catch (error) {
        console.error('Error loading friend events for week:', error);
      }
    },
    
    // Handle friend permission changes (auto-unsync if permissions revoked)
    handleFriendPermissionChange: (friendUserId: string, hasAccess: boolean) => {
      if (!hasAccess) {
        // Auto-unsync if permissions are revoked
        get().actions.unsyncFriendCalendar(friendUserId);
      }
    },
    
    // Cleanup SDK instance
    cleanup: () => {
      const { sdk } = get();
      if (sdk) {
        sdk.destroy();
        set({ sdk: undefined, isInitialized: false });
      }
    },
  },
}));