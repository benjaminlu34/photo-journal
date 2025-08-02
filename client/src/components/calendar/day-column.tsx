import { useState, useRef, useEffect } from "react";
import { format, isSameDay } from "date-fns";
import { Clock, MapPin } from "lucide-react";
import { CALENDAR_CONFIG } from "@shared/config/calendar-config";
import type { LocalEvent } from "@/types/calendar";
import { applyOpacityToColor } from "@/utils/colorUtils/colorUtils";

interface DayColumnProps {
  date: Date;
  events: LocalEvent[];
  isToday: boolean;
  isWeekend: boolean;
  onEventClick: (event: LocalEvent) => void;
  onTimeSlotClick: (date: Date) => void;
  onEventDragStart: (eventId: string) => void;
  onEventDragEnd: () => void;
}

export function DayColumn({
  date,
  events,
  isToday,
  isWeekend,
  onEventClick,
  onTimeSlotClick,
  onEventDragStart,
  onEventDragEnd
}: DayColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  
  // Handle drag start for events
  const handleEventDragStart = (eventId: string) => {
    setDraggingEventId(eventId);
    onEventDragStart(eventId);
  };
  
  // Handle drag end for events
  const handleEventDragEnd = () => {
    setDraggingEventId(null);
    onEventDragEnd();
  };
  
  // Calculate event positions
  const calculateEventPosition = (event: LocalEvent) => {
    const eventHours = new Date(event.startTime).getHours();
    const eventMinutes = new Date(event.startTime).getMinutes();
    const positionTop = (eventHours + eventMinutes / 60) * CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT;
    
    return {
      top: `${positionTop}px`,
      height: '60px'
    };
  };
  
  return (
    <div
      ref={columnRef}
      className={`relative border-l border-gray-200 ${isWeekend ? 'bg-rose-50' : ''} ${isToday ? 'bg-purple-50' : ''}`}
    >
      {/* Time slots for the day */}
      {Array.from({ length: 24 }, (_, hour) => (
        <div
          key={`slot-${date.toISOString()}-${hour}`}
          className="h-16 border-b border-r border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors"
          onClick={() => {
            const slotDate = new Date(date);
            slotDate.setHours(hour, 0, 0, 0);
            onTimeSlotClick(slotDate);
          }}
        />
      ))}
      
      {/* Events positioned absolutely */}
      {events.map((event) => {
        const position = calculateEventPosition(event);
        
        return (
          <div
            key={event.id}
            onClick={() => onEventClick(event)}
            draggable
            onDragStart={() => handleEventDragStart(event.id)}
            onDragEnd={handleEventDragEnd}
            className="absolute left-1 right-1 p-2 rounded-lg text-sm neu-inset hover:shadow-neu-active transition-all duration-300 cursor-pointer transform hover:scale-[1.02] z-10"
            style={{
              backgroundColor: applyOpacityToColor(event.color, 0.1),
              borderLeft: `4px solid ${event.color}`,
              top: position.top,
              height: position.height,
            }}
            role="button"
            tabIndex={0}
            aria-label={`${event.title} at ${format(new Date(event.startTime), "h:mm a")}`}
          >
            <div className="font-semibold text-gray-800 truncate text-xs">
              {event.title}
            </div>
            <div className="flex items-center text-xs text-gray-600 mt-1">
              <Clock className="w-3 h-3 mr-1" />
              {format(new Date(event.startTime), "h:mm a")}
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
}