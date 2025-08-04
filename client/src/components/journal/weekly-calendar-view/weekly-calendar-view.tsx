import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/contexts/journal-context";
import { useCalendar } from "@/contexts/calendar-context";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { useCalendarResponsive } from "@/hooks/useCalendarResponsive";
import type { WeeklyCalendarViewProps, LocalEvent, CalendarEvent, FriendCalendarEvent } from "@/types/calendar";
import { EventModal, CalendarFeedModal, CalendarSettings, DayColumn } from "@/components/calendar";
import { applyOpacityToColor } from "@/utils/colorUtils/colorUtils";
import { CALENDAR_CONFIG } from "@shared/config/calendar-config";



// Helper function to convert external/friend events to LocalEvent format for display
const convertToLocalEventForDisplay = (
  event: CalendarEvent | FriendCalendarEvent,
  type: 'external' | 'friend'
): LocalEvent => {
  // Use a stable date reference to avoid creating new Date objects on every render
  const stableCreatedAt = event.startTime;
  const stableUpdatedAt = event.startTime;
  
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startTime: event.startTime,
    endTime: event.endTime,
    timezone: event.timezone,
    isAllDay: event.isAllDay,
    color: event.color,
    pattern: event.pattern || 'plain',
    location: event.location,
    attendees: event.attendees,
    createdBy: type === 'external' ? 'external' : (event as FriendCalendarEvent).friendUserId,
    createdAt: stableCreatedAt,
    updatedAt: stableUpdatedAt,
    collaborators: [],
    tags: []
  };
};

// Helper function to convert events array to LocalEvent array for a specific day
const convertEventsForDay = (
  eventsArray: CalendarEvent[] | FriendCalendarEvent[],
  type: 'external' | 'friend',
  day: Date
): LocalEvent[] => {
  return eventsArray
    .filter(event => isSameDay(event.startTime, day))
    .map(event => convertToLocalEventForDisplay(event, type));
};

export function WeeklyCalendarView({
  initialDate,
  username,
  collaborationEnabled = true,
  feedsEnabled = true,
  syncedFriends = []
}: WeeklyCalendarViewProps) {
  // Suppress unused variable warnings for props that will be used in future tasks
  void username;
  void collaborationEnabled;
  void feedsEnabled;
  void syncedFriends;
  const { currentWeek, setCurrentWeek } = useJournal();
  const {
    localEvents,
    externalEvents,
    friendEvents,
    currentWeek: calendarCurrentWeek,
    actions: calendarActions
  } = useCalendar();

  const [selectedEvent, setSelectedEvent] = useState<LocalEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedDateForEvent, setSelectedDateForEvent] = useState<Date | null>(null);

  // Use responsive hook for viewport management
  const {
    viewMode: responsiveViewMode,
    currentPadIndex,
    navigatePad,
    canNavigatePad,
  } = useCalendarResponsive();

  // Initialize with provided date or current week
  useEffect(() => {
    if (initialDate && initialDate.getTime() !== currentWeek.getTime()) {
      setCurrentWeek(initialDate);
      calendarActions.setCurrentWeek(initialDate);
    }
  }, [initialDate, currentWeek, setCurrentWeek, calendarActions]);

  // Memoize week days calculation to prevent unnecessary re-computations
  const weekDays = useMemo(() => {
    const startDate = startOfWeek(calendarCurrentWeek, { weekStartsOn: 0 });
    const endDate = endOfWeek(calendarCurrentWeek, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [calendarCurrentWeek]);

  // Memoize display days calculation for pad view optimization
  const displayDays = useMemo(() => {
    if (responsiveViewMode !== 'pads') return weekDays;

    const padSize = CALENDAR_CONFIG.MOBILE.PAD_SIZE;
    const startIndex = currentPadIndex * padSize;
    let endIndex = startIndex + padSize;

    // Handle the last pad which might have fewer days
    if (currentPadIndex === 2) {
      endIndex = weekDays.length;
    }

    return weekDays.slice(startIndex, endIndex);
  }, [responsiveViewMode, weekDays, currentPadIndex]);

  // Memoize events by day to prevent filtering on every render
  const eventsByDay = useMemo(() => {
    const eventsMap: Record<string, LocalEvent[]> = {};

    displayDays.forEach(day => {
      const dayKey = day.toDateString();

      // Filter local events for the day
      const localEventsForDay = Object.values(localEvents).filter(event =>
        isSameDay(event.startTime, day)
      );

      // Filter and convert external events for the day
      const externalEventsForDay: LocalEvent[] = [];
      Object.values(externalEvents).forEach(eventsArray => {
        externalEventsForDay.push(...convertEventsForDay(eventsArray, 'external', day));
      });

      // Filter and convert friend events for the day
      const friendEventsForDay: LocalEvent[] = [];
      Object.values(friendEvents).forEach(eventsArray => {
        friendEventsForDay.push(...convertEventsForDay(eventsArray, 'friend', day));
      });

      eventsMap[dayKey] = [...localEventsForDay, ...externalEventsForDay, ...friendEventsForDay];
    });

    return eventsMap;
  }, [displayDays, localEvents, externalEvents, friendEvents]);

  // Create responsive grid template based on display days
  // Fluid layout: time column fixed, day columns expand equally
  const gridTemplate = useMemo(() => {
    const dayCount = displayDays.length;
    return `64px repeat(${dayCount}, 1fr)`;
  }, [displayDays.length]);

  const handleEventClick = useCallback((event: LocalEvent) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  }, []);

  const handleEventModalClose = useCallback(() => {
    setIsEventModalOpen(false);
    setSelectedEvent(null);
    setSelectedDateForEvent(null);
  }, []);

  const handleTimeSlotClick = useCallback((slotDate: Date) => {
    setSelectedDateForEvent(slotDate);
    setIsEventModalOpen(true);
  }, []);

  const handleEventDragStart = useCallback((eventId: string) => {
    // TODO: Implement drag start logic
    console.log('Drag started for event:', eventId);
  }, []);

  const handleEventDragEnd = useCallback(() => {
    // TODO: Implement drag end logic
    console.log('Drag ended');
  }, []);

  // Render mobile pad navigation
  const renderPadNavigation = () => {
    if (responsiveViewMode !== 'pads') return null;

    return (
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
    );
  };

  return (
    <div className="flex-1 h-full bg-white flex flex-col">
      {renderPadNavigation()}

      {/* Calendar Container with proper height constraints */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Day Headers Row - Sticky */}
        <div
          className="sticky top-0 z-20 border-b border-gray-200 bg-white shadow-sm flex-shrink-0"
          style={{
            display: 'grid',
            gridTemplateColumns: gridTemplate,
            paddingRight: '9px',
          }}
        >
          {/* Time column header */}
          <div className="p-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-r border-gray-200">
            Time
          </div>
          {displayDays.map((day) => {
            const isToday = isSameDay(day, new Date());
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
                {/* We only draw the first day's left border in header to avoid cumulative width differences */}
                <div className={`text-xs font-bold uppercase tracking-wider ${isWeekend ? 'text-rose-500' : 'text-gray-500'}`}>
                  {format(day, "EEE")}
                </div>
                <div className={`text-lg font-bold mt-1 ${isToday ? "text-[hsl(var(--accent))]" : isWeekend ? "text-rose-600" : "text-gray-800"
                  }`}>
                  {format(day, "d")}
                </div>
                {isToday && (
                  <Badge
                    variant="secondary"
                    className="mt-1 px-2 py-0.5 rounded-full text-[11px] leading-none bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-neu whitespace-nowrap"
                  >
                    Today
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="flex-1 overflow-auto min-h-0"
          style={{
            maxHeight: 'calc(100vh - 200px)',
            scrollbarGutter: 'stable'
          }}
        >
          <div
            className="relative"
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              height: `${24 * CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT}px`, // 24 hours * configured hour height
            }}
          >
            {/* Time column */}
            <div className="border-r border-gray-200 bg-white sticky left-0 z-10">
              {Array.from({ length: 24 }, (_, i) => (
                <div key={`time-${i}`} className="border-b border-gray-200 flex items-center justify-center bg-white" style={{ height: `${CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT}px` }}>
                  <span className="text-xs text-gray-500">
                    {i === 0 ? '12AM' : i < 12 ? `${i}AM` : i === 12 ? '12PM' : `${i - 12}PM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns using DayColumn component */}
            {displayDays.map((day) => {
              const isToday = isSameDay(day, new Date());
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const dayEvents = eventsByDay[day.toDateString()] || [];

              return (
                <DayColumn
                  key={`day-${day.toISOString()}`}
                  date={day}
                  events={dayEvents}
                  isToday={isToday}
                  isWeekend={isWeekend}
                  onEventClick={handleEventClick}
                  onTimeSlotClick={handleTimeSlotClick}
                  onEventDragStart={handleEventDragStart}
                  onEventDragEnd={handleEventDragEnd}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={isEventModalOpen}
        onClose={handleEventModalClose}
        event={selectedEvent || undefined}
        initialDate={selectedDateForEvent || undefined}
      />

      {/* Calendar Feed Modal */}
      <CalendarFeedModal
        isOpen={isFeedModalOpen}
        onClose={() => setIsFeedModalOpen(false)}
      />

      {/* Calendar Settings */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-h-[90vh] overflow-auto neu-card">
            <CalendarSettings onClose={() => setIsSettingsOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}