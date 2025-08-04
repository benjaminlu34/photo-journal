import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Plus,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  Home
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isToday } from 'date-fns';
import { useCalendarStore } from '@/lib/calendar-store';
import { CalendarFeedModal } from './calendar-feed-modal';
import { CALENDAR_CONFIG } from '@shared/config/calendar-config';
import { FriendCalendarSyncModal } from './friend-calendar-sync-modal';
import { CreateEventModal } from './create-event-modal';
import { DayColumn } from './day-column';
import { WeekHeader } from './week-header';
import { CalendarErrorBoundary, useCalendarErrorHandler } from './calendar-error-boundary';
import type { WeeklyCalendarViewProps, LocalEvent, CalendarEvent, FriendCalendarEvent } from '@/types/calendar';

type WithEventType =
  | (LocalEvent & { eventType: 'local' })
  | (CalendarEvent & { eventType: 'external' })
  | (FriendCalendarEvent & { eventType: 'friend' }); // kept only if referenced elsewhere

// Helper with fully discriminated union – no unsafe casts
function convertToLocalEventFormat(event: WithEventType) {
  switch (event.eventType) {
    case 'local':
      return {
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        timezone: event.timezone,
        isAllDay: event.isAllDay,
        color: event.color,
        pattern: event.pattern,
        location: event.location,
        attendees: event.attendees || [],
        createdBy: event.createdBy,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        linkedJournalEntryId: event.linkedJournalEntryId,
        reminderMinutes: event.reminderMinutes,
        collaborators: event.collaborators,
        tags: event.tags
      };
    case 'friend':
      return {
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        timezone: event.timezone,
        isAllDay: event.isAllDay,
        color: event.color,
        pattern: event.pattern,
        location: event.location,
        attendees: event.attendees || [],
        createdBy: event.friendUsername,
        createdAt: event.startTime,
        updatedAt: event.startTime,
        linkedJournalEntryId: undefined,
        reminderMinutes: undefined,
        collaborators: [],
        tags: []
      };
    case 'external':
      return {
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        timezone: event.timezone,
        isAllDay: event.isAllDay,
        color: event.color,
        pattern: event.pattern,
        location: event.location,
        attendees: event.attendees || [],
        createdBy: event.feedName,
        createdAt: event.startTime,
        updatedAt: event.startTime,
        linkedJournalEntryId: undefined,
        reminderMinutes: undefined,
        collaborators: [],
        tags: []
      };
    default:
      // Exhaustive check
      const _exhaustive: never = event;
      return _exhaustive;
  }
}

// Debounce utility with cancel method
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout>;
  const debounced = ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T & { cancel: () => void };

  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
}

export function WeeklyCalendarView({
  initialDate = new Date(),
  username,
  collaborationEnabled = true,
  feedsEnabled = true,
  syncedFriends = []
}: WeeklyCalendarViewProps) {
  const {
    localEvents,
    externalEvents,
    friendEvents,
    feeds,
    syncedFriends: storeSyncedFriends,
    currentWeek,
    isLoading,
    error,
    isFriendSyncModalOpen,
    actions
  } = useCalendarStore();

  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isImportCalendarModalOpen, setIsImportCalendarModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const initializationRef = useRef(false);
  const { throwError } = useCalendarErrorHandler();

  // Debounced friend events loading
  const debouncedLoadEvents = useMemo(() => {
    return debounce(actions.loadFriendEventsForWeek, CALENDAR_CONFIG.PERFORMANCE.DEBOUNCE_DELAY);
  }, [actions.loadFriendEventsForWeek]);

  // Initialize calendar store
  useEffect(() => {
    const weekId = format(currentWeek, 'yyyy-\'W\'ww');
    actions.init(weekId, username, username, username);
    initializationRef.current = true;

    return () => {
      // Cleanup on unmount
      if (actions.cleanup) {
        actions.cleanup();
      }
    };
  }, [currentWeek, username, actions]);

  // Load friend events when week changes or synced friends change
  useEffect(() => {
    if (storeSyncedFriends.length > 0 && initializationRef.current) {
      debouncedLoadEvents(currentWeek);
    }

    return () => {
      // Cancel debounced calls on cleanup
      debouncedLoadEvents.cancel?.();
    };
  }, [currentWeek, storeSyncedFriends, debouncedLoadEvents]);

  // Initialize synced friends from props
  useEffect(() => {
    if (syncedFriends.length > 0 && initializationRef.current) {
      const friendsToSync = syncedFriends.filter(
        friendUserId => !storeSyncedFriends.includes(friendUserId)
      );

      if (friendsToSync.length > 0) {
        (async () => {
          const results = await Promise.allSettled(
            friendsToSync.map(friendUserId =>
              actions.syncFriendCalendar(friendUserId)
            )
          );

          const failures = results
            .map((r, i) => ({ r, id: friendsToSync[i] }))
            .filter(x => x.r.status === 'rejected') as Array<{ r: PromiseRejectedResult; id: string }>;

          if (failures.length > 0) {
            const message = `Failed to sync ${failures.length} friend${failures.length !== 1 ? 's' : ''}: ${failures.map(f => f.id).join(', ')}`;
            console.error(message, failures.map(f => f.r.reason));
            actions.setError(message);
          }
        })();
      }
    }
  }, [syncedFriends, storeSyncedFriends, actions]);

  const handlePreviousWeek = useCallback(() => {
    const newWeek = subWeeks(currentWeek, 1);
    actions.setCurrentWeek(newWeek);
  }, [currentWeek, actions.setCurrentWeek]);

  const handleNextWeek = useCallback(() => {
    const newWeek = addWeeks(currentWeek, 1);
    actions.setCurrentWeek(newWeek);
  }, [currentWeek, actions.setCurrentWeek]);

  const handleTodayClick = useCallback(() => {
    actions.setCurrentWeek(new Date());
  }, [actions.setCurrentWeek]);

  const handleToggleFriendSync = useCallback(async (friendUserId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await actions.syncFriendCalendar(friendUserId);
      } else {
        await actions.unsyncFriendCalendar(friendUserId);
      }
    } catch (error) {
      console.error('Error toggling friend sync:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to toggle friend sync';
      actions.setError(errorMessage);
      throwError(new Error(errorMessage));
    }
  }, [actions, throwError]);

  const handleRefreshFriend = useCallback(async (friendUserId: string) => {
    try {
      await actions.refreshFriendEvents(friendUserId);
    } catch (error) {
      console.error('Error refreshing friend events:', error);
      actions.setError(error instanceof Error ? error.message : 'Failed to refresh friend events');
    }
  }, [actions, throwError]);

  // Get all events for the week with proper typing
  const allEvents = useMemo(() => {
    type CombinedEvent =
      | (LocalEvent & { eventType: 'local' })
      | (CalendarEvent & { eventType: 'external' })
      | (FriendCalendarEvent & { eventType: 'friend' });

    const events: CombinedEvent[] = [];

    // Add local events
    for (const event of Object.values(localEvents)) {
      events.push({ ...event, eventType: 'local' as const });
    }

    // Add external events
    for (const extArr of Object.values(externalEvents)) {
      for (const event of extArr) {
        events.push({ ...event, eventType: 'external' as const });
      }
    }

    // Add friend events
    for (const frArr of Object.values(friendEvents)) {
      for (const event of frArr) {
        events.push({ ...event, eventType: 'friend' as const });
      }
    }

    return events;
  }, [localEvents, externalEvents, friendEvents]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays: Date[] = [];

  // Generate array of days for the week
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    weekDays.push(date);
  }

  // Memoize events grouped by day for performance (iterate allEvents once)
  const eventsByDayKey = useMemo(() => {
    // key format: yyyy-MM-dd
    const map = new Map<string, WithEventType[]>();

    // Precompute day boundaries for the current week
    const dayBounds = weekDays.map(d => {
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      const key = format(d, 'yyyy-MM-dd');
      return { key, start, end };
    });

    // For each event, push into all days it overlaps this week
    for (const ev of allEvents as WithEventType[]) {
      const evStart = new Date(ev.startTime);
      const evEnd = new Date(ev.endTime);
      for (const { key, start, end } of dayBounds) {
        if (evStart < end && evEnd > start) {
          const arr = map.get(key);
          if (arr) {
            arr.push(ev);
          } else {
            map.set(key, [ev]);
          }
        }
      }
    }

    return map;
  }, [allEvents, weekDays]);

  const syncedFriendCount = storeSyncedFriends.length;

  // Responsive mode: derive how many days to render per "page"
  const daysPerView = useMemo(() => {
    // Use shared CALENDAR_CONFIG.BREAKPOINTS which reflects modes:
    // FULL_VIEW (>= lg): 7 days, SCROLL_VIEW (>= sm): 5 days, PADS_VIEW (< sm): 1 day (example mapping)
    if (typeof window === 'undefined') return 7;
    const w = window.innerWidth;
    const { BREAKPOINTS } = CALENDAR_CONFIG;
    if (w < BREAKPOINTS.SCROLL_VIEW) return 1;   // phones
    if (w < BREAKPOINTS.FULL_VIEW) return 5;     // tablets
    return 7;                                    // desktops
  }, [currentWeek]);

  // Track the first visible day index within weekDays for paged rendering on small screens
  const [startIndex, setStartIndex] = useState(0);
  useEffect(() => {
    // Reset page when week changes to keep first column aligned to the week's start
    setStartIndex(0);
  }, [weekStart?.toISOString?.()]);

  const canPageLeft = startIndex > 0;
  const canPageRight = startIndex + daysPerView < 7;
  const visibleDays = useMemo(() => weekDays.slice(startIndex, startIndex + daysPerView), [weekDays, startIndex, daysPerView]);

  return (
    <CalendarErrorBoundary>
      <div className="h-full flex flex-col bg-white"
        role="main"
        aria-label="Weekly calendar view">
        {/* Header */}
        <div className="flex-none p-4 border-b border-gray-200/50 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-purple-600" />
                Weekly Calendar
              </h1>

              {/* Week navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePreviousWeek}
                  className="neu-card p-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="text-sm font-medium text-gray-700 min-w-[200px] text-center">
                  {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextWeek}
                  className="neu-card p-2"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTodayClick}
                  className="neu-card text-sm"
                >
                  <Home className="w-4 h-4 mr-1" />
                  Today
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Friend sync indicator */}
              {feedsEnabled && syncedFriendCount > 0 && (
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                  <Users className="w-3 h-3 mr-1" />
                  {syncedFriendCount} friend{syncedFriendCount !== 1 ? 's' : ''} synced
                </Badge>
              )}

              {/* Action buttons */}
              <Button
                onClick={() => setIsCreateEventModalOpen(true)}
                size="sm"
                className="neu-card bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] hover:from-[hsl(var(--primary))] hover:to-[hsl(var(--accent))] text-white shadow-neu hover:shadow-neu-lg transition-all"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Event
              </Button>

              {feedsEnabled && (
                <>
                  <Button
                    onClick={() => actions.setFriendSyncModalOpen(true)}
                    size="sm"
                    variant="ghost"
                    className="neu-card"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Friends
                  </Button>

                  <Button
                    onClick={() => setIsImportCalendarModalOpen(true)}
                    size="sm"
                    variant="ghost"
                    className="neu-card"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Feeds
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Week Header */}
        <div className="sticky top-[64px] z-30 bg-white border-b border-gray-200/50">
          <WeekHeader
            currentWeek={currentWeek}
            onWeekChange={actions.setCurrentWeek}
            onTodayClick={handleTodayClick}
            onCreateEventClick={() => setIsCreateEventModalOpen(true)}
            onSettingsClick={() => {}} // TODO: Implement settings
            onFeedModalClick={() => setIsImportCalendarModalOpen(true)}
            hasJournalEntries={weekDays.map(() => false)} // TODO: Implement journal entry checking
            showRecurrenceBanner={CALENDAR_CONFIG.FEATURES.ENABLE_RECURRENCE_UI}
          />
        </div>

        {/* Calendar Grid - ensure internal scroll within white card container */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-white">
          {/* Paging controls for small/medium views */}
          {daysPerView < 7 && (
            <div className="flex items-center justify-between px-4 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="neu-card"
                disabled={!canPageLeft}
                aria-disabled={!canPageLeft}
                onClick={() => setStartIndex((i) => Math.max(0, i - daysPerView))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-xs text-gray-600" aria-live="polite">
                Showing {startIndex + 1}-{Math.min(7, startIndex + daysPerView)} of 7 days
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="neu-card"
                disabled={!canPageRight}
                aria-disabled={!canPageRight}
                onClick={() => setStartIndex((i) => Math.min(7 - daysPerView, i + daysPerView))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div
            className={
              daysPerView === 7
                ? "grid grid-cols-7 min-h-[600px] bg-white"
                : "grid min-h-[600px] bg-white"
            }
            style={daysPerView === 7 ? undefined : { gridTemplateColumns: `repeat(${daysPerView}, minmax(0, 1fr))` }}
            role="grid"
            aria-label="Weekly calendar grid"
          >
            {visibleDays.map((date) => {
              const dayStart = new Date(date);
              dayStart.setHours(0, 0, 0, 0);
              const dayEnd = new Date(date);
              dayEnd.setHours(23, 59, 59, 999);

              // Fetch pre-grouped events for this day and convert to LocalEvent format
              const key = format(date, 'yyyy-MM-dd');
              const dayEvents = eventsByDayKey.get(key) ?? [];
              const localEventFormat = (dayEvents as WithEventType[]).map(convertToLocalEventFormat);

              return (
                <DayColumn
                  key={date.toISOString()}
                  date={date}
                  events={localEventFormat}
                  isToday={isToday(date)}
                  isWeekend={date.getDay() === 0 || date.getDay() === 6}
                  onEventClick={(event) => {
                    // TODO: Implement event click handling
                    console.log('Event clicked:', event);
                  }}
                  onTimeSlotClick={(clickedDate: Date) => {
                    setSelectedDate(clickedDate);
                    setIsCreateEventModalOpen(true);
                  }}
                  onEventDragStart={(eventId: string) => {
                    // TODO: Implement event drag start handling
                    console.log('Event drag started:', eventId);
                  }}
                  onEventDragEnd={() => {
                    // TODO: Implement event drag end handling
                    console.log('Event drag ended');
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Modals */}
        {isCreateEventModalOpen && (
          <CreateEventModal
            isOpen={isCreateEventModalOpen}
            onClose={() => setIsCreateEventModalOpen(false)}
            onSubmit={async (eventData) => {
              try {
                await actions.createLocalEvent(eventData);
                setIsCreateEventModalOpen(false);
              } catch (error) {
                console.error('Error creating event:', error);
                throwError(new Error('Failed to create event'));
              }
            }}
            initialDate={selectedDate || new Date()}
          />
        )}

        {isImportCalendarModalOpen && (
          <CalendarFeedModal
            isOpen={isImportCalendarModalOpen}
            onClose={() => setIsImportCalendarModalOpen(false)}
          />
        )}

        {isFriendSyncModalOpen && (
          <FriendCalendarSyncModal
            isOpen={isFriendSyncModalOpen}
            onClose={() => actions.setFriendSyncModalOpen(false)}
            syncedFriends={storeSyncedFriends}
            onToggleSync={handleToggleFriendSync}
            onRefreshFriend={handleRefreshFriend}
          />
        )}
      </div>
    </CalendarErrorBoundary>
  );
}
