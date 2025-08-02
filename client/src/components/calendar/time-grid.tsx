import { useState, useCallback } from "react";
import { format, addHours, startOfDay, isSameDay, isWithinInterval } from "date-fns";
import { Clock, MapPin, Plus } from "lucide-react";
import type { CalendarEvent, LocalEvent } from "@/types/calendar";

interface TimeGridProps {
  date: Date;
  events: (CalendarEvent | LocalEvent)[];
  onEventClick?: (event: CalendarEvent | LocalEvent) => void;
  onTimeSlotClick?: (date: Date) => void;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function TimeGrid({ date, events, onEventClick, onTimeSlotClick, className = "" }: TimeGridProps) {
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    startTime: Date | null;
    endTime: Date | null;
  }>({
    isDragging: false,
    startTime: null,
    endTime: null,
  });

  const handleMouseDown = useCallback((hour: number) => {
    const startTime = addHours(startOfDay(date), hour);
    setDragState({
      isDragging: true,
      startTime,
      endTime: addHours(startTime, 1),
    });
  }, [date]);

  const handleMouseEnter = useCallback((hour: number) => {
    if (dragState.isDragging && dragState.startTime) {
      const endTime = addHours(startOfDay(date), hour + 1);
      setDragState(prev => ({ ...prev, endTime }));
    }
  }, [dragState.isDragging, dragState.startTime, date]);

  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging && dragState.startTime && dragState.endTime) {
      if (onTimeSlotClick) {
        onTimeSlotClick(dragState.startTime);
      }
    }
    setDragState({
      isDragging: false,
      startTime: null,
      endTime: null,
    });
  }, [dragState, onTimeSlotClick]);

  const getEventsForHour = useCallback((hour: number) => {
    const hourStart = addHours(startOfDay(date), hour);
    const hourEnd = addHours(hourStart, 1);
    
    return events.filter(event => {
      const eventStart = event.startTime instanceof Date ? event.startTime : new Date(event.startTime);
      const eventEnd = event.endTime instanceof Date ? event.endTime : new Date(event.endTime);
      
      return (
        isSameDay(eventStart, date) &&
        isWithinInterval(eventStart, { start: hourStart, end: hourEnd }) ||
        isWithinInterval(hourStart, { start: eventStart, end: eventEnd }) ||
        (eventStart <= hourStart && eventEnd >= hourEnd)
      );
    });
  }, [date, events]);

  const calculateEventPosition = useCallback((event: CalendarEvent | LocalEvent) => {
    const eventStart = event.startTime instanceof Date ? event.startTime : new Date(event.startTime);
    const eventEnd = event.endTime instanceof Date ? event.endTime : new Date(event.endTime);
    const dayStart = startOfDay(date);
    
    const startMinutes = (eventStart.getTime() - dayStart.getTime()) / (1000 * 60);
    const endMinutes = (eventEnd.getTime() - dayStart.getTime()) / (1000 * 60);
    
    const top = (startMinutes / (24 * 60)) * 100;
    const height = ((endMinutes - startMinutes) / (24 * 60)) * 100;
    
    return { top, height };
  }, [date]);

  const isWithinDragSelection = useCallback((hour: number) => {
    if (!dragState.isDragging || !dragState.startTime || !dragState.endTime) {
      return false;
    }
    
    const hourStart = addHours(startOfDay(date), hour);
    const hourEnd = addHours(hourStart, 1);
    
    const dragStart = dragState.startTime;
    const dragEnd = dragState.endTime;
    
    const selectionStart = dragStart < dragEnd ? dragStart : dragEnd;
    const selectionEnd = dragStart < dragEnd ? dragEnd : dragStart;
    
    return isWithinInterval(hourStart, { start: selectionStart, end: selectionEnd }) ||
           isWithinInterval(hourEnd, { start: selectionStart, end: selectionEnd }) ||
           (hourStart <= selectionStart && hourEnd >= selectionEnd);
  }, [dragState, date]);

  return (
    <div className={`relative ${className}`}>
      {/* Time labels */}
      <div className="absolute left-0 top-0 bottom-0 w-16 border-r border-gray-200 bg-gray-50">
        {HOURS.map(hour => (
          <div
            key={hour}
            className="h-16 border-b border-gray-200 flex items-center justify-center pr-2"
          >
            <span className="text-xs text-gray-600 font-medium">
              {format(addHours(startOfDay(date), hour), "h a")}
            </span>
          </div>
        ))}
      </div>
      
      {/* Time slots */}
      <div 
        className="ml-16 relative"
        onMouseLeave={handleMouseUp}
        onMouseUp={handleMouseUp}
      >
        {HOURS.map(hour => {
          const hourEvents = getEventsForHour(hour);
          const isSelected = isWithinDragSelection(hour);
          
          return (
            <div
              key={hour}
              className={`h-16 border-b border-gray-200 relative cursor-pointer hover:bg-gray-50 transition-colors ${
                isSelected ? "bg-purple-50" : ""
              }`}
              onMouseDown={() => handleMouseDown(hour)}
              onMouseEnter={() => handleMouseEnter(hour)}
              onClick={() => onTimeSlotClick?.(addHours(startOfDay(date), hour))}
            >
              {/* Half-hour mark */}
              <div className="absolute top-1/2 left-0 right-0 border-t border-gray-100" />
              
              {/* Quick add button */}
              <button
                className="absolute top-1/2 left-2 transform -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onTimeSlotClick?.(addHours(startOfDay(date), hour));
                }}
              >
                <Plus className="w-4 h-4 text-gray-400" />
              </button>
              
              {/* Events for this hour */}
              {hourEvents.map(event => {
                const position = calculateEventPosition(event);
                return (
                  <div
                    key={event.id}
                    className="absolute left-2 right-2 rounded-lg p-2 shadow-neu hover:shadow-neu-lg transition-all cursor-pointer overflow-hidden"
                    style={{
                      top: `${position.top}%`,
                      height: `${position.height}%`,
                      backgroundColor: event.color,
                      color: 'white',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event);
                    }}
                  >
                    <div className="font-medium text-sm truncate">{event.title}</div>
                    {event.location && (
                      <div className="text-xs opacity-90 truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </div>
                    )}
                    <div className="text-xs opacity-90 mt-1">
                      {format(event.startTime instanceof Date ? event.startTime : new Date(event.startTime), "h:mm a")} - {format(event.endTime instanceof Date ? event.endTime : new Date(event.endTime), "h:mm a")}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        
        {/* Current time indicator */}
        {isSameDay(date, new Date()) && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-red-500 z-10"
            style={{
              top: `${((new Date().getHours() * 60 + new Date().getMinutes()) / (24 * 60)) * 100}%`,
            }}
          >
            <div className="absolute -left-1 -top-1.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
          </div>
        )}
      </div>
    </div>
  );
}