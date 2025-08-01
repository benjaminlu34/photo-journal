import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/contexts/journal-context";
import { ChevronLeft, ChevronRight, Plus, Calendar } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay } from "date-fns";
import { timezoneService } from "@/services/timezone.service";
import { colorPaletteManager } from "@/services/color-palette-manager";
import { useCalendarResponsive } from "@/hooks/useCalendarResponsive";
import { CALENDAR_CONFIG } from "@shared/config/calendar-config";
import type { WeeklyCalendarViewProps } from "@/types/calendar";

export function WeeklyCalendarView({
  initialDate,
  username,
  collaborationEnabled = true,
  feedsEnabled = true,
  syncedFriends = []
}: WeeklyCalendarViewProps) {
  const { currentWeek, setCurrentWeek } = useJournal();
  const [events, setEvents] = useState<any[]>([]);
  
  // Use responsive hook for viewport management
  const {
    viewMode,
    isMobile,
    isTablet,
    isDesktop,
    currentPadIndex,
    navigatePad,
    canNavigatePad,
  } = useCalendarResponsive();

  // Initialize with provided date or current week
  useEffect(() => {
    if (initialDate && initialDate !== currentWeek) {
      setCurrentWeek(initialDate);
    }
  }, [initialDate, currentWeek, setCurrentWeek]);

  const userTimezone = timezoneService.getUserTimezone();
  const startDate = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const endDate = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: startDate, end: endDate });

  // Handle week navigation
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = direction === 'prev' 
      ? subWeeks(currentWeek, 1) 
      : addWeeks(currentWeek, 1);
    setCurrentWeek(newWeek);
  };

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  // Get days for current pad in mobile view
  const getPadDays = () => {
    if (viewMode !== 'pads') return weekDays;
    
    const padSize = CALENDAR_CONFIG.MOBILE.PAD_SIZE;
    const startIndex = currentPadIndex * padSize;
    let endIndex = startIndex + padSize;
    
    // Handle the last pad which might have fewer days
    if (currentPadIndex === 2) {
      endIndex = weekDays.length;
    }
    
    return weekDays.slice(startIndex, endIndex);
  };

  const displayDays = getPadDays();

  const addEventToDay = (day: Date) => {
    const newEvent = {
      id: Math.random().toString(36).substr(2, 9),
      title: "New Event",
      date: day,
      time: "12:00 PM",
      color: colorPaletteManager.getNextDistinctColor()
    };
    setEvents(prev => [...prev, newEvent]);
  };

  const importCalendar = () => {
    // Mock iCal/GCal import functionality with color assignment
    const mockEvents = [
      { 
        id: "1", 
        title: "Team Meeting", 
        date: weekDays[1], 
        time: "10:00 AM", 
        color: colorPaletteManager.getNextDistinctColor()
      },
      { 
        id: "2", 
        title: "Lunch with Sarah", 
        date: weekDays[3], 
        time: "12:30 PM", 
        color: colorPaletteManager.getNextDistinctColor()
      },
      { 
        id: "3", 
        title: "Project Deadline", 
        date: weekDays[5], 
        time: "5:00 PM", 
        color: colorPaletteManager.getNextDistinctColor()
      }
    ];
    setEvents(prev => [...prev, ...mockEvents]);
  };

  // Render week header with navigation
  const renderWeekHeader = () => (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Week of {format(startDate, "MMM d")} - {format(endDate, "d, yyyy")}
          </h2>
          <p className="text-gray-600 mt-1" aria-live="polite">
            Schedule and calendar view • {userTimezone}
          </p>
        </div>
        
        {/* Coming Soon banner for recurrence */}
        {feedsEnabled && !CALENDAR_CONFIG.FEATURES.ENABLE_RECURRENCE_UI && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Calendar className="w-3 h-3 mr-1" />
            Recurring events coming soon!
          </Badge>
        )}
      </div>

      <div className="flex items-center space-x-2">
        {/* Week navigation */}
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateWeek('prev')}
            className="neu-card text-gray-700 hover:shadow-neu-active"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={goToToday}
            className="neu-card text-gray-700 hover:shadow-neu-active px-3"
          >
            Today
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateWeek('next')}
            className="neu-card text-gray-700 hover:shadow-neu-active"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Import calendar button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={importCalendar}
          className="neu-card text-gray-700 hover:shadow-neu-active"
        >
          <Calendar className="w-4 h-4 mr-2" />
          Import Calendar
        </Button>

        {/* Add event FAB */}
        <Button
          size="sm"
          onClick={() => addEventToDay(new Date())}
          className="neu-button bg-purple-500 hover:bg-purple-600 text-white rounded-full w-10 h-10 p-0"
          aria-label="Add new event"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  // Render mobile pad navigation
  const renderPadNavigation = () => {
    if (viewMode !== 'pads') return null;

    return (
      <div className="flex items-center justify-between mb-4 px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigatePad('prev')}
          disabled={!canNavigatePad('prev')}
          className="neu-card text-gray-700 hover:shadow-neu-active transition-all"
          aria-label="Previous 3-day pad"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <div className="flex space-x-1" role="tablist" aria-label="Calendar pads">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              role="tab"
              aria-selected={index === currentPadIndex}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentPadIndex ? 'bg-purple-500' : 'bg-gray-300'
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
          className="neu-card text-gray-700 hover:shadow-neu-active transition-all"
          aria-label="Next 3-day pad"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  // Get responsive grid classes
  const getGridClasses = () => {
    switch (viewMode) {
      case 'full':
        return 'grid grid-cols-7 gap-4 h-full';
      case 'scroll':
        return 'flex gap-4 h-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100';
      case 'pads':
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 h-full';
      default:
        return 'grid grid-cols-7 gap-4 h-full';
    }
  };

  return (
    <div className="flex-1 p-6 bg-surface overflow-auto">
      {renderWeekHeader()}
      {renderPadNavigation()}

      {/* Calendar Grid */}
      <div className={getGridClasses()}>
        {displayDays.map((day) => {
          const isToday = isSameDay(day, new Date());
          const dayEvents = events.filter(event => isSameDay(event.date, day));
          
          return (
            <div
              key={day.toISOString()}
              className={`group neu-card p-4 flex flex-col transition-all hover:shadow-neu-active ${
                viewMode === 'scroll' ? 'min-w-[260px] flex-shrink-0' : ''
              } ${
                viewMode === 'pads' ? 'min-h-[300px]' : 'min-h-[400px]'
              }`}
              role="gridcell"
              aria-label={`${format(day, "EEEE, MMMM d, yyyy")} - ${dayEvents.length} events`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-center">
                  <div className="text-xs text-gray-500 font-medium uppercase">
                    {format(day, "EEE")}
                  </div>
                  <div className={`text-lg font-semibold ${
                    isToday ? "text-purple-600" : "text-gray-800"
                  }`}>
                    {format(day, "d")}
                  </div>
                  {isToday && (
                    <Badge variant="secondary" className="bg-purple-500 text-white text-xs mt-1">
                      Today
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => addEventToDay(day)}
                  className="w-6 h-6 p-0 neu-button text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                  aria-label={`Add event to ${format(day, "EEEE")}`}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>

              {/* Events List */}
              <div className="flex-1 space-y-2">
                {dayEvents.map((event) => (
                  <div 
                    key={event.id} 
                    className="p-2 rounded-lg text-xs neu-inset hover:shadow-neu-active transition-all cursor-pointer"
                    style={{ 
                      backgroundColor: event.color + '20',
                      borderLeft: `3px solid ${event.color}`
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${event.title} at ${event.time}`}
                  >
                    <div className="font-medium text-gray-800">{event.title}</div>
                    <div className="text-gray-600">{event.time}</div>
                  </div>
                ))}
                
                {/* Empty state message */}
                {dayEvents.length === 0 && (
                  <div className="text-center text-gray-400 text-sm mt-8">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No events</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Responsive indicators for overflow content */}
      {viewMode === 'scroll' && (
        <div className="absolute right-8 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <div className="w-8 h-16 bg-gradient-to-l from-white to-transparent opacity-75 rounded-l-lg" />
        </div>
      )}
    </div>
  );
}