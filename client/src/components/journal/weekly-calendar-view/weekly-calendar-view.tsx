import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/contexts/journal-context";
import { useCalendar } from "@/contexts/calendar-context";
import { useUser } from "@/hooks/useUser";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isToday } from "date-fns";
import { useCalendarResponsive } from "@/hooks/useCalendarResponsive";
import type { WeeklyCalendarViewProps, LocalEvent, CalendarEvent, FriendCalendarEvent } from "@/types/calendar";
import { CalendarFeedModal, CalendarSettings, DayColumn, WeekHeader, FriendCalendarSyncModal } from "@/components/calendar";
import { CreateEventModal } from "@/components/calendar/create-event-modal";
import { EditEventModal } from "@/components/calendar/edit-event-modal";
import { CALENDAR_CONFIG } from "@shared/config/calendar-config";

// Unified event type tagging (ported)
type WithEventType =
  | (LocalEvent & { eventType: 'local' })
  | (CalendarEvent & { eventType: 'external' })
  | (FriendCalendarEvent & { eventType: 'friend' });

// Convert any event to LocalEvent shape for DayColumn (ported)
function convertToLocalEventFormat(event: WithEventType): LocalEvent {
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
        createdBy: (event as any).feedName,
        createdAt: event.startTime,
        updatedAt: event.startTime,
        linkedJournalEntryId: undefined,
        reminderMinutes: undefined,
        collaborators: [],
        tags: []
      };
    default:
      const _never: never = event;
      return _never;
  }
}

// Debounce helper (ported)
function debounce<T extends (...args: any[]) => any>(fn: T, wait: number): T & { cancel: () => void } {
  let t: ReturnType<typeof setTimeout>;
  const d = ((...args: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  }) as T & { cancel: () => void };
  d.cancel = () => clearTimeout(t);
  return d;
}

export function WeeklyCalendarView({
  initialDate,
  username,
  collaborationEnabled = true,
  feedsEnabled = true,
  syncedFriends = []
}: WeeklyCalendarViewProps) {
  void collaborationEnabled; // reserved for future
  void feedsEnabled; // reserved for future
  void syncedFriends; // reserved for future
  const { data: user } = useUser();
  const { currentWeek, setCurrentWeek } = useJournal();
  const {
    localEvents,
    externalEvents,
    friendEvents,
    currentWeek: calendarCurrentWeek,
    actions,
  } = useCalendar();

  // Local UI state
  const [selectedEvent, setSelectedEvent] = useState<LocalEvent | null>(null);
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedDateForEvent, setSelectedDateForEvent] = useState<Date | null>(null);
  const [selectedEndDateForEvent, setSelectedEndDateForEvent] = useState<Date | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isFriendSyncModalOpen, setIsFriendSyncModalOpen] = useState(false);
  const initializationRef = useRef(false);
  // Note: CalendarContext doesn't expose friend sync APIs yet.
  // We keep the modal UX but wire actions to setError as placeholders.

  // Initialize with provided date or current week
  useEffect(() => {
    if (initialDate && initialDate.getTime() !== currentWeek.getTime()) {
      setCurrentWeek(initialDate);
      actions.setCurrentWeek(initialDate);
    }
  }, [initialDate, currentWeek, setCurrentWeek, actions]);

  // Ensure calendar store is initialized once week is known (ported)
  useEffect(() => {
    const weekId = format(startOfWeek(calendarCurrentWeek, { weekStartsOn: 0 }), "yyyy-'W'II");
    actions.init(weekId, username, username, username);
    initializationRef.current = true;
    return () => {
      actions.cleanup?.();
    };
  }, [calendarCurrentWeek, username, actions]);

  // Sync journal context currentWeek with calendar store
  useEffect(() => {
    const normalized = startOfWeek(new Date(currentWeek), { weekStartsOn: 0 });
    if (calendarCurrentWeek.getTime() !== normalized.getTime()) {
      actions.setCurrentWeek(normalized);
    }
  }, [currentWeek, calendarCurrentWeek, actions]);

  // Friend sync features are not available via CalendarContext actions yet.
  // Placeholder no-ops to preserve UI and avoid type errors.
  const debouncedLoadEvents = useMemo(
    () => debounce((..._args: any[]) => { }, CALENDAR_CONFIG.PERFORMANCE.DEBOUNCE_DELAY),
    []
  );
  useEffect(() => {
    return () => debouncedLoadEvents.cancel?.();
  }, [debouncedLoadEvents]);

  // Navigation handlers (ported) - currently handled by WeekHeader
  // const handlePreviousWeek = useCallback(() => {
  //   const newWeek = subWeeks(calendarCurrentWeek, 1);
  //   setCurrentWeek(newWeek);
  //   actions.setCurrentWeek(newWeek);
  // }, [calendarCurrentWeek, setCurrentWeek, actions]);

  // const handleNextWeek = useCallback(() => {
  //   const newWeek = addWeeks(calendarCurrentWeek, 1);
  //   setCurrentWeek(newWeek);
  //   actions.setCurrentWeek(newWeek);
  // }, [calendarCurrentWeek, setCurrentWeek, actions]);

  // const handleTodayClick = useCallback(() => {
  //   const today = new Date();
  //   setCurrentWeek(today);
  //   actions.setCurrentWeek(today);
  // }, [setCurrentWeek, actions]);

  // Friend sync controls (ported)
  const handleToggleFriendSync = useCallback(async (_friendUserId: string, _enabled: boolean) => {
    actions.setError?.('Friend sync is not available in this build yet.');
  }, [actions]);

  const handleRefreshFriend = useCallback(async (_friendUserId: string) => {
    actions.setError?.('Friend events refresh is not available in this build yet.');
  }, [actions]);

  // Consolidate all events with tags (ported)
  const allEvents = useMemo(() => {
    type CombinedEvent =
      | (LocalEvent & { eventType: 'local' })
      | (CalendarEvent & { eventType: 'external' })
      | (FriendCalendarEvent & { eventType: 'friend' });

    const arr: CombinedEvent[] = [];
    for (const ev of Object.values(localEvents)) arr.push({ ...ev, eventType: 'local' as const });
    for (const ext of Object.values(externalEvents)) for (const ev of ext) arr.push({ ...ev, eventType: 'external' as const });
    for (const fr of Object.values(friendEvents)) for (const ev of fr) arr.push({ ...ev, eventType: 'friend' as const });
    return arr as WithEventType[];
  }, [localEvents, externalEvents, friendEvents]);

  // Compute week days (ported structure compatibility)
  const weekStart = startOfWeek(calendarCurrentWeek, { weekStartsOn: 0 });
  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }

  // Bucket events by overlapping days (handles multi-day/overnight) (ported)
  const eventsByDayKey = useMemo(() => {
    const map = new Map<string, WithEventType[]>();
    const dayBounds = weekDays.map((d) => {
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      const key = format(d, 'yyyy-MM-dd');
      return { key, start, end };
    });

    for (const ev of allEvents) {
      const evStart = new Date(ev.startTime);
      const evEnd = new Date(ev.endTime);
      for (const { key, start, end } of dayBounds) {
        if (evStart < end && evEnd > start) {
          const arr = map.get(key);
          if (arr) arr.push(ev); else map.set(key, [ev]);
        }
      }
    }
    return map;
  }, [allEvents, weekDays]);

  // Responsive days per view (7/5/1) + journal pads integration (merged)
  const { viewMode: responsiveViewMode, currentPadIndex, navigatePad, canNavigatePad } = useCalendarResponsive();
  const daysPerView = useMemo(() => {
    if (typeof window === 'undefined') return 7;
    const w = window.innerWidth;
    const { BREAKPOINTS } = CALENDAR_CONFIG;
    if (w < BREAKPOINTS.SCROLL_VIEW) return 1;
    if (w < BREAKPOINTS.FULL_VIEW) return 5;
    return 7;
  }, [calendarCurrentWeek]);

  const [startIndex, setStartIndex] = useState(0);
  useEffect(() => { setStartIndex(0); }, [weekStart?.toISOString?.()]);

  const canPageLeft = startIndex > 0;
  const canPageRight = startIndex + daysPerView < 7;
  const visibleDays = useMemo(() => {
    if (responsiveViewMode === 'pads') {
      const padSize = CALENDAR_CONFIG.MOBILE.PAD_SIZE;
      const s = currentPadIndex * padSize;
      const e = currentPadIndex === 2 ? weekDays.length : s + padSize;
      return weekDays.slice(s, e);
    }
    return weekDays.slice(startIndex, startIndex + daysPerView);
  }, [weekDays, startIndex, daysPerView, responsiveViewMode, currentPadIndex]);

  // Handlers for DayColumn (merged)
  const handleEventClick = useCallback((ev: LocalEvent) => {
    setSelectedEvent(ev);
    setIsEditOpen(true);
  }, []);
  const handleEventModalClose = useCallback(() => {
    setIsCreateOpen(false);
    setIsEditOpen(false);
    setSelectedEvent(null);
    setSelectedDateForEvent(null);
    setSelectedEndDateForEvent(null);
  }, []);
  const handleTimeSlotClick = useCallback((slotDate: Date) => {
    setSelectedDateForEvent(slotDate);
    setSelectedEndDateForEvent(null); // Clear end date for regular click
    setIsCreateOpen(true);
  }, []);
  const handleEventDragStart = useCallback((_id: string) => { }, []);
  const handleEventDragEnd = useCallback(() => { }, []);
  const handleDragToCreate = useCallback((startTime: Date, endTime: Date) => {
    setSelectedDateForEvent(startTime);
    setSelectedEndDateForEvent(endTime);
    setIsCreateOpen(true);
  }, []);

  return (
    <div className="flex-1 bg-white flex flex-col min-h-0">
      {/* Week Header */}
      <WeekHeader
        currentWeek={calendarCurrentWeek}
        onWeekChange={(d) => { setCurrentWeek(d); actions.setCurrentWeek(d); }}
        onTodayClick={() => {
          const today = new Date();
          setCurrentWeek(today);
          actions.setCurrentWeek(today);
        }}
        onCreateEventClick={() => {
          setSelectedDateForEvent(new Date());
          setSelectedEndDateForEvent(null); // Clear end date for header button
          setIsCreateOpen(true);
        }}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onFeedModalClick={() => setIsFeedModalOpen(true)}
        showRecurrenceBanner={CALENDAR_CONFIG.FEATURES.ENABLE_RECURRENCE_UI}
      />

      {/* Pad navigation (journal feature) */}
      {responsiveViewMode === 'pads' && (
        <div className="flex items-center justify-between mb-4 px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigatePad('prev')}
            disabled={!canNavigatePad('prev')}
            className="neu-card rounded-full shadow-neu hover:shadow-neu-lg transition-all"
            aria-label="Previous 3-day pad"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex space-x-2" role="tablist" aria-label="Calendar pads">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                role="tab"
                aria-selected={index === currentPadIndex}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${index === currentPadIndex
                  ? 'bg-[hsl(var(--accent))] shadow-neu-lg transform scale-125'
                  : 'bg-gray-300 shadow-neu-soft'
                  }`}
                aria-label={`Pad ${index + 1} of 3`}
              />
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigatePad('next')}
            disabled={!canNavigatePad('next')}
            className="neu-card rounded-full shadow-neu hover:shadow-neu-lg transition-all"
            aria-label="Next 3-day pad"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Day Headers */}
        <div
          className="sticky top-0 z-20 border-b border-gray-200 bg-white shadow-sm flex-shrink-0"
          style={{
            display: 'grid',
            gridTemplateColumns: `64px repeat(${visibleDays.length}, 1fr)`,
            paddingRight: '9px',
          }}
        >
          <div className="p-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-r border-gray-200">
            Time
          </div>
          {visibleDays.map((day) => {
            const isTodayDay = isToday(day);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const isJank = {
              scrollPadding: {
                marginRight: day.getDay() === 6 ? "-10px" : "0px"
              }
            }
            return (
              <div
                key={`header-${day.toISOString()}`}
                className={`p-3 text-center ${isWeekend ? 'bg-rose-50' : 'bg-white'} ${day.getDay() === 0 ? 'border-l border-gray-200' : ''}`}
                style={isJank.scrollPadding}
              >
                <div className={`text-xs font-bold uppercase tracking-wider ${isWeekend ? 'text-rose-500' : 'text-gray-500'}`}>
                  {format(day, "EEE")}
                </div>
                <div className={`text-lg font-bold mt-1 ${isTodayDay ? "text-[hsl(var(--accent))]" : isWeekend ? "text-rose-600" : "text-gray-800"}`}>
                  {format(day, "d")}
                </div>
                {isTodayDay && (
                  <Badge variant="secondary" className="mt-1 px-2 py-0.5 rounded-full text-[11px] leading-none bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-neu whitespace-nowrap">
                    Today
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-auto min-h-0" style={{ maxHeight: 'calc(100vh - 260px)', scrollbarGutter: 'stable' }}>
          <div className="relative" style={{ display: 'grid', gridTemplateColumns: `64px repeat(${visibleDays.length}, 1fr)`, height: `${24 * CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT}px` }}>
            <div className="border-r border-gray-200 bg-white sticky left-0 z-10">
              {Array.from({ length: 24 }, (_, i) => (
                <div key={`time-${i}`} className="border-b border-gray-200 flex items-center justify-center bg-white" style={{ height: `${CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT}px` }}>
                  <span className="text-xs text-gray-500">
                    {i === 0 ? '12AM' : i < 12 ? `${i}AM` : i === 12 ? '12PM' : `${i - 12}PM`}
                  </span>
                </div>
              ))}
            </div>

            {visibleDays.map((day) => {
              const isTodayDay = isToday(day);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const key = format(day, 'yyyy-MM-dd');
              const dayEvents = (eventsByDayKey.get(key) ?? []).map(convertToLocalEventFormat);
              return (
                <DayColumn
                  key={`day-${day.toISOString()}`}
                  date={day}
                  events={dayEvents}
                  isToday={isTodayDay}
                  isWeekend={isWeekend}
                  onEventClick={handleEventClick}
                  onTimeSlotClick={handleTimeSlotClick}
                  onEventDragStart={handleEventDragStart}
                  onEventDragEnd={handleEventDragEnd}
                  onDragToCreate={handleDragToCreate}
                  currentUser={user}
                />
              );
            })}
          </div>
        </div>

        {/* Paging controls if not pads and less than 7 days shown */}
        {responsiveViewMode !== 'pads' && daysPerView < 7 && (
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
      </div>

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={isCreateOpen}
        onClose={handleEventModalClose}
        initialDate={selectedDateForEvent || undefined}
        initialEndDate={selectedEndDateForEvent || undefined}
        onSubmit={async (payload) => {
          await actions.createLocalEvent(payload);
        }}
      />

      {/* Edit Event Modal */}
      {selectedEvent && (
        <EditEventModal
          isOpen={isEditOpen}
          onClose={handleEventModalClose}
          event={selectedEvent}
          currentUser={user}
          onSubmit={async (id, updates) => {
            await actions.updateLocalEvent(id, updates);
          }}
          onDelete={(id) => {
            actions.deleteLocalEvent(id);
          }}
        />
      )}

      {/* Calendar Feed Modal */}
      <CalendarFeedModal
        isOpen={isFeedModalOpen}
        onClose={() => setIsFeedModalOpen(false)}
      />

      {/* Friend Sync Modal (ported) */}
      <FriendCalendarSyncModal
        isOpen={isFriendSyncModalOpen}
        onClose={() => setIsFriendSyncModalOpen(false)}
        onToggleSync={async (friendUserId: string, enabled: boolean) => {
          await handleToggleFriendSync(friendUserId, enabled);
        }}
        onRefreshFriend={handleRefreshFriend}
      />

      {/* Calendar Settings */}
      {isSettingsOpen && (
        <div className="bg-white rounded-xl maxh-[90vh] overflow-auto">
          <CalendarSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </div>
      )}
    </div>
  );
}