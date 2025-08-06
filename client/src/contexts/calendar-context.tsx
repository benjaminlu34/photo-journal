'use client';

import React, { createContext, useContext, useCallback } from 'react';
import { useUser } from '@/hooks/useUser';
import { useCalendarStore } from '@/lib/calendar-store';
import { getCalendarSdk } from '@/lib/calendar-sdk';
import type { LocalEvent, CalendarEvent, FriendCalendarEvent, CalendarFeed } from '@/types/calendar';
import { startOfWeek, format } from 'date-fns';

interface CalendarContextValue {
  isConnected: boolean;
  weekId: string | undefined;
  localEvents: Record<string, LocalEvent>;
  externalEvents: Record<string, CalendarEvent[]>;
  friendEvents: Record<string, FriendCalendarEvent[]>;
  feeds: CalendarFeed[];
  currentWeek: Date;
  selectedEventId: string | null;
  isLoading: boolean;
  error: string | null;
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
    updateFeedMeta?: (feedId: string, meta: { lastSyncAt?: Date; syncError?: string | null }) => void;
    cleanup?: () => void;
  };
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export const useCalendar = (): CalendarContextValue => {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
};

interface CalendarProviderProps {
  children: React.ReactNode;
  initialDate?: Date;
}

export const CalendarProvider: React.FC<CalendarProviderProps> = ({
  children,
  initialDate
}) => {
  const { data: user } = useUser();
  const {
    localEvents,
    externalEvents,
    friendEvents,
    feeds,
    currentWeek,
    selectedEventId,
    isLoading,
    error,
    sdk,
    userId,
    actions
  } = useCalendarStore();
  
  const stableActions = actions;
  
  // Get connection status from the SDK
  const [isConnected, setIsConnected] = React.useState(false);
  React.useEffect(() => {
    if (!sdk) {
      setIsConnected(false);
      return;
    }
    
    const awareness = sdk.presence;
    
    const handleConnectivityChange = () => {
      setIsConnected(awareness.getStates().size > 0);
    };
    
    awareness.on('change', handleConnectivityChange);
    handleConnectivityChange(); // Initial check
    
    return () => {
      awareness.off('change', handleConnectivityChange);
    };
  }, [sdk]);
  
  // Initialize calendar store with the SDK only when we have a valid date
  React.useEffect(() => {
    if (!initialDate) {
      return;
    }
    
    // Create week ID from the date (ISO week format)
    const weekStart = startOfWeek(initialDate, { weekStartsOn: 0 });
    const weekId = format(weekStart, 'yyyy-\'W\'II'); // e.g., "2024-W03"
    
    // Initialize CRDT with weekId
    actions.init(weekId, user?.id || 'anonymous', user?.firstName || 'Anonymous', user?.username);
  }, [initialDate, user]);

  // Add cleanup effect
  React.useEffect(() => {
    return () => {
      // Cleanup on unmount
      actions.cleanup?.();
    };
  }, []);

  const value = React.useMemo<CalendarContextValue>(() => ({
    isConnected,
    weekId: sdk ? format(startOfWeek(currentWeek, { weekStartsOn: 0 }), 'yyyy-\'W\'II') : undefined,
    localEvents,
    externalEvents,
    friendEvents,
    feeds,
    currentWeek,
    selectedEventId,
    isLoading,
    error,
    actions: stableActions
  }), [
    isConnected,
    sdk,
    localEvents,
    externalEvents,
    friendEvents,
    feeds,
    currentWeek,
    selectedEventId,
    isLoading,
    error,
    stableActions
  ]);

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
};