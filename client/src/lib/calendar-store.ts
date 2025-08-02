/**
 * Zustand store for managing calendar state with CRDT integration
 */

import { create } from 'zustand';
import type { LocalEvent, CalendarEvent, FriendCalendarEvent, CalendarFeed } from '@/types/calendar';
import { getCalendarSdk } from './calendar-sdk';

interface CalendarState {
  // Data state
  localEvents: Record<string, LocalEvent>;
  externalEvents: Record<string, CalendarEvent[]>;
  friendEvents: Record<string, FriendCalendarEvent[]>;
  feeds: CalendarFeed[];
  
  // UI state
  currentWeek: Date;
  selectedEventId: string | null;
  isLoading: boolean;
  error: string | null;
  
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
    cleanup?: () => void;
  };
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  // Initial state
  localEvents: {},
  externalEvents: {},
  friendEvents: {},
  feeds: [],
  currentWeek: new Date(),
  selectedEventId: null,
  isLoading: false,
  error: null,
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