import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/contexts/journal-context";
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, MapPin, Settings, Link } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks } from "date-fns";
// Removed colorPaletteManager import to avoid potential re-render issues
import { useCalendarResponsive } from "@/hooks/useCalendarResponsive";
import { CALENDAR_CONFIG } from "@shared/config/calendar-config";
import type { WeeklyCalendarViewProps, LocalEvent } from "@/types/calendar";
import { EventModal, CalendarFeedModal, TimeGrid, CalendarSettings } from "@/components/calendar";

// Local interface for calendar events
interface LocalCalendarEvent {
  id: string;
  title: string;
  date: Date;
  startTime: Date;
  color: string;
  location?: string;
  description?: string;
}

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
  const [events, setEvents] = useState<LocalCalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<LocalCalendarEvent | null>(null);
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
    }
  }, [initialDate, currentWeek, setCurrentWeek]);

  // Memoize week days calculation to prevent unnecessary re-computations
  const weekDays = useMemo(() => {
    const startDate = startOfWeek(currentWeek, { weekStartsOn: 0 });
    const endDate = endOfWeek(currentWeek, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentWeek]);

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
    const eventsMap: Record<string, LocalCalendarEvent[]> = {};
    
    displayDays.forEach(day => {
      const dayKey = day.toDateString();
      eventsMap[dayKey] = events.filter(event => isSameDay(event.date, day));
    });
    
    return eventsMap;
  }, [events, displayDays]);

  // Create responsive grid template based on display days
  const gridTemplate = useMemo(() => {
    const dayCount = displayDays.length;
    return `64px repeat(${dayCount}, 1fr)`;
  }, [displayDays.length]);

  const addEventToDay = (day: Date) => {
    setSelectedDateForEvent(day);
    setIsEventModalOpen(true);
  };
  
  const handleEventClick = (event: LocalCalendarEvent) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };
  
  const handleEventModalClose = () => {
    setIsEventModalOpen(false);
    setSelectedEvent(null);
    setSelectedDateForEvent(null);
  };
  
  const handleCreateEvent = (eventData: any) => {
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newEvent: LocalCalendarEvent = {
      id: crypto.randomUUID(),
      title: eventData.title,
      date: selectedDateForEvent || new Date(),
      startTime: eventData.startTime,
      color: eventData.color || randomColor,
      location: eventData.location,
      description: eventData.description
    };
    setEvents(prev => [...prev, newEvent]);
    handleEventModalClose();
  };

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
                ? 'bg-purple-500 shadow-neu-lg transform scale-125'
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
    <div className="flex-1 h-full bg-surface overflow-hidden">
      {renderPadNavigation()}
      
      {/* Calendar Grid - Weekly Row Layout */}
      <div className="h-full flex flex-col">
        {/* Day Headers Row */}
        <div className="border-b border-gray-200 bg-gray-50" style={{display: 'grid', gridTemplateColumns: gridTemplate}}>
          {/* Time column header */}
          <div className="p-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Time
          </div>
          {displayDays.map((day) => {
            const isToday = isSameDay(day, new Date());
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            
            return (
              <div
                key={`header-${day.toISOString()}`}
                className={`p-3 text-center border-l border-gray-200 ${isWeekend ? 'bg-rose-50' : ''}`}
              >
                <div className={`text-xs font-bold uppercase tracking-wider ${isWeekend ? 'text-rose-500' : 'text-gray-500'}`}>
                  {format(day, "EEE")}
                </div>
                <div className={`text-lg font-bold mt-1 ${isToday ? "text-purple-600" : isWeekend ? "text-rose-600" : "text-gray-800"
                  }`}>
                  {format(day, "d")}
                </div>
                {isToday && (
                  <Badge variant="secondary" className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs mt-1 shadow-neu">
                    Today
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Time Grid Row */}
        <div className="flex-1 overflow-y-auto">
          <div style={{display: 'grid', gridTemplateColumns: gridTemplate, height: '100%'}}>
            {/* Time slots column */}
            <div className="border-r border-gray-200 bg-gray-50">
              {Array.from({ length: 24 }, (_, i) => (
                <div key={`time-${i}`} className="h-16 border-b border-gray-200 flex items-center justify-center">
                  <span className="text-xs text-gray-500">
                    {i === 0 ? '12AM' : i < 12 ? `${i}AM` : i === 12 ? '12PM' : `${i - 12}PM`}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Calendar grid with days */}
            
            {displayDays.map((day) => {
              const isToday = isSameDay(day, new Date());
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const dayEvents = eventsByDay[day.toDateString()] || [];
              
              return (
                <div
                  key={`grid-${day.toISOString()}`}
                  className={`relative border-l border-gray-200 ${isWeekend ? 'bg-rose-50' : ''} ${isToday ? 'bg-purple-50' : ''}`}
                >
                  {/* Time slots for the day */}
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div
                      key={`slot-${day.toISOString()}-${hour}`}
                      className="h-16 border-b border-r border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => {
                        const slotDate = new Date(day);
                        slotDate.setHours(hour, 0, 0, 0);
                        setSelectedDateForEvent(slotDate);
                        setIsEventModalOpen(true);
                      }}
                    />
                  ))}
                  
                  {/* Events positioned absolutely */}
                  {dayEvents.map((event) => {
                    // Calculate position based on startTime Date object
                    const eventHours = event.startTime.getHours();
                    const eventMinutes = event.startTime.getMinutes();
                    const positionTop = (eventHours + eventMinutes / 60) * CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT;
                    
                    return (
                      <div
                        key={event.id}
                        onClick={() => handleEventClick(event)}
                        className="absolute left-1 right-1 p-2 rounded-lg text-sm neu-inset hover:shadow-neu-active transition-all duration-300 cursor-pointer transform hover:scale-[1.02] z-10"
                        style={{
                          backgroundColor: event.color + '15',
                          borderLeft: `4px solid ${event.color}`,
                          top: `${positionTop}px`,
                          height: '60px',
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${event.title} at ${format(event.startTime, "h:mm a")}`}
                      >
                        <div className="font-semibold text-gray-800 truncate text-xs">
                          {event.title}
                        </div>
                        <div className="flex items-center text-xs text-gray-600 mt-1">
                          <Clock className="w-3 h-3 mr-1" />
                          {format(event.startTime, "h:mm a")}
                        </div>
                        {event.location && (
                          <div className="flex items-center text-xs text-gray-600 mt-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={isEventModalOpen}
        onClose={handleEventModalClose}
        event={selectedEvent ? convertToLocalEvent(selectedEvent) : undefined}
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

// Helper function to convert our local event to the LocalEvent type
function convertToLocalEvent(event: LocalCalendarEvent): LocalEvent {
  const startDate = new Date(event.startTime);
  
  const endDate = new Date(event.startTime);
  endDate.setHours(endDate.getHours() + 1);
  
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startTime: startDate,
    endTime: endDate,
    timezone: undefined,
    isAllDay: false,
    color: event.color,
    location: event.location,
    createdBy: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    collaborators: [],
    tags: [],
  };
}