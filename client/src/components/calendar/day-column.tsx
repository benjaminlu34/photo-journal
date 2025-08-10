import { MinHeap } from '@/utils/min-heap';
import { useMemo, useRef, useCallback, useState } from "react";
import { format, isSameDay } from "date-fns";
import { CALENDAR_CONFIG } from "@shared/config/calendar-config";
import type { LocalEvent } from "@/types/calendar";
import { EventCard } from "./event-card";

// Helper function to detect DST gaps for a given date
const getDSTGaps = (date: Date): { start: number; end: number }[] => {
  const gaps: { start: number; end: number }[] = [];

  // Check each hour of the day for DST transitions
  for (let hour = 0; hour < 24; hour++) {
    const testDate = new Date(date);
    testDate.setHours(hour, 0, 0, 0);

    const nextHour = new Date(testDate);
    nextHour.setHours(hour + 1, 0, 0, 0);

    // If the difference is not exactly 1 hour, there's a DST transition
    const hourDiff = (nextHour.getTime() - testDate.getTime()) / (1000 * 60 * 60);

    if (hourDiff !== 1) {
      if (hourDiff > 1) {
        // Spring forward - hour is skipped
        gaps.push({ start: hour * 60, end: (hour + 1) * 60 });
      }
      // Fall back is handled by showing the hour twice, which is fine for our grid
    }
  }

  return gaps;
};

interface DayColumnProps {
  date: Date;
  events: LocalEvent[];
  isToday: boolean;
  isWeekend: boolean;
  onEventClick: (event: LocalEvent) => void;
  onTimeSlotClick: (date: Date) => void;
  onEventDragStart: (eventId: string) => void;
  onEventDragEnd: () => void;
  onDragToCreate?: (startTime: Date, endTime: Date) => void; // New prop for drag-to-create
  currentUser?: {
    id: string;
    username?: string;
  } | null;
}

type PositionedEvent = {
  event: LocalEvent;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
  width: number;
  left: number;
};

/**
 * Day column with time grid, event positioning, and collision detection.
 * Implements basic collision detection to prevent overlapping events.
 * Virtualization can be added later if needed for performance.
 */
export function DayColumn({
  date,
  events,
  isToday,
  isWeekend,
  onEventClick,
  onTimeSlotClick,
  onEventDragStart,
  onEventDragEnd,
  onDragToCreate,
  currentUser,
}: DayColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  
  // Drag-to-create state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ y: number; time: Date } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ y: number; time: Date } | null>(null);

  // Sweep-line algorithm for collision detection and positioning - O(N log N)
  const positioned = useMemo<PositionedEvent[]>(() => {
    if (events.length === 0) return [];

    // Filter events that actually occur on this day
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const dayEvents = events.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      // Event overlaps with this day if it starts before day ends and ends after day starts
      return eventStart <= dayEnd && eventEnd > dayStart;
    });

    if (dayEvents.length === 0) return [];

    // Step 1: Sort events by start time, then by duration (longer events first for stable layout)
    const sortedEvents = [...dayEvents].sort((a, b) => {
      const aStart = a.startTime.getTime();
      const bStart = b.startTime.getTime();
      if (aStart !== bStart) return aStart - bStart;

      // If same start time, longer events first for consistent layout
      const aDuration = a.endTime.getTime() - a.startTime.getTime();
      const bDuration = b.endTime.getTime() - b.startTime.getTime();
      return bDuration - aDuration;
    });

    // Step 2: Create sweep events (start and end points)
    type SweepEvent = {
      time: number; // in minutes from start of day
      type: 'start' | 'end';
      eventId: string;
    };

    const sweepEvents: SweepEvent[] = [];
    sortedEvents.forEach((event) => {
      // Clamp event times to the current day boundaries
      const eventStart = new Date(Math.max(event.startTime.getTime(), dayStart.getTime()));
      const eventEnd = new Date(Math.min(event.endTime.getTime(), dayEnd.getTime()));
      
      const startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
      const endMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
      
      // For collision detection, use actual end time but ensure minimum duration for rendering
      const actualEndMinutes = Math.max(endMinutes, startMinutes + CALENDAR_CONFIG.EVENTS.MIN_DURATION);
      
      sweepEvents.push({
        time: startMinutes,
        type: 'start',
        eventId: event.id,
      });
      sweepEvents.push({
        time: actualEndMinutes,
        type: 'end',
        eventId: event.id,
      });
    });

    // Step 3: Sort sweep events by time, then by type (ends before starts for same time)
    sweepEvents.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      // Process 'end' events before 'start' events at the same time
      if (a.type === 'end' && b.type === 'start') return -1;
      if (a.type === 'start' && b.type === 'end') return 1;
      return 0;
    });

    // Step 4: Sweep through events and assign columns
    const eventColumns: Map<string, number> = new Map();
    const freeColumns = new MinHeap<number>((a, b) => a - b);
    let maxColumnUsed = -1;

    sweepEvents.forEach(sweep => {
      if (sweep.type === 'start') {
        // Assign the smallest available column
        let column: number;
        if (!freeColumns.isEmpty()) {
          column = freeColumns.pop()!;
        } else {
          // Need a new column
          column = maxColumnUsed + 1;
          maxColumnUsed = column;
        }
        eventColumns.set(sweep.eventId, column);
      } else {
        // 'end' event - free up the column
        const column = eventColumns.get(sweep.eventId);
        if (column !== undefined) {
          freeColumns.push(column);
        }
      }
    });

    // Step 5: Build positioned events with computed layout
    const totalColumns = maxColumnUsed + 1;
    const positioned: PositionedEvent[] = sortedEvents.map(event => {
      // For positioning, we need to determine what portion of the event appears on this day
      let displayStartMinutes: number;
      let displayEndMinutes: number;
      
      // Check if event starts on this day
      if (event.startTime.toDateString() === date.toDateString()) {
        displayStartMinutes = event.startTime.getHours() * 60 + event.startTime.getMinutes();
      } else {
        // Event started on a previous day, show from start of day
        displayStartMinutes = 0;
      }
      
      // Check if event ends on this day
      if (event.endTime.toDateString() === date.toDateString()) {
        displayEndMinutes = event.endTime.getHours() * 60 + event.endTime.getMinutes();
      } else {
        // Event continues to next day, show until end of day
        displayEndMinutes = 24 * 60; // End of day in minutes
      }
      
      // Calculate the duration to display on this day
      const displayDuration = Math.max(
        displayEndMinutes - displayStartMinutes, 
        CALENDAR_CONFIG.EVENTS.MIN_DURATION
      );
      
      const top = (displayStartMinutes / 60) * CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT;
      const height = (displayDuration / 60) * CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT;
      const column = eventColumns.get(event.id)!;
      
      return {
        event,
        top,
        height,
        column,
        totalColumns: Math.max(totalColumns, 1),
        width: 100 / Math.max(totalColumns, 1),
        left: (column * 100) / Math.max(totalColumns, 1),
      };
    });

    return positioned;
  }, [events, date]);

  const slots = useMemo(() => {
    const minutesPerSlot = CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL; // 30
    const slotsPerDay = (24 * 60) / minutesPerSlot;
    return Array.from({ length: slotsPerDay }, (_, i) => i);
  }, []);

  // Check if we need virtualization (for grids > 12 hours)
  const needsVirtualization = useMemo(() => {
    return slots.length > CALENDAR_CONFIG.TIME_GRID.VIRTUALIZATION_THRESHOLD * 2; // 2 slots per hour
  }, [slots.length]);

  // Get DST gaps for this date
  const dstGaps = useMemo(() => getDSTGaps(date), [date]);

  // Filter out slots that fall within DST gaps
  const visibleSlots = useMemo(() => {
    return slots.filter(slotIndex => {
      const slotMinutes = slotIndex * CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL;
      return !dstGaps.some(gap => slotMinutes >= gap.start && slotMinutes < gap.end);
    });
  }, [slots, dstGaps]);

  const handleTimeSlotClick = useCallback((slotIndex: number) => {
    const minutesOffset = slotIndex * CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL;
    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);
    slotDate.setMinutes(minutesOffset);
    onTimeSlotClick(slotDate);
  }, [date, onTimeSlotClick]);

  const handleEventClick = useCallback((event: LocalEvent) => {
    onEventClick(event);
  }, [onEventClick]);

  // Helper function to convert mouse Y position to time
  const getTimeFromMouseY = useCallback((mouseY: number): Date => {
    if (!columnRef.current) return new Date(date);
    
    const rect = columnRef.current.getBoundingClientRect();
    const relativeY = mouseY - rect.top;
    const totalHeight = rect.height;
    
    // Calculate the time based on position
    const minutesFromStart = (relativeY / totalHeight) * (24 * 60);
    const clampedMinutes = Math.max(0, Math.min(24 * 60 - 1, minutesFromStart));
    
    // Snap to 15-minute intervals
    const snappedMinutes = Math.round(clampedMinutes / 15) * 15;
    
    const resultDate = new Date(date);
    resultDate.setHours(0, 0, 0, 0);
    resultDate.setMinutes(snappedMinutes);
    
    return resultDate;
  }, [date]);

  // Drag-to-create event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag if clicking on empty space (not on an event)
    if ((e.target as HTMLElement).closest('.absolute')) return;
    
    e.preventDefault();
    const startTime = getTimeFromMouseY(e.clientY);
    
    setIsDragging(true);
    setDragStart({ y: e.clientY, time: startTime });
    setDragEnd({ y: e.clientY, time: startTime });
  }, [getTimeFromMouseY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    
    const endTime = getTimeFromMouseY(e.clientY);
    setDragEnd({ y: e.clientY, time: endTime });
  }, [isDragging, dragStart, getTimeFromMouseY]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !dragEnd || !onDragToCreate) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    // Ensure we have a minimum duration and correct order
    const startTime = new Date(Math.min(dragStart.time.getTime(), dragEnd.time.getTime()));
    const endTime = new Date(Math.max(dragStart.time.getTime(), dragEnd.time.getTime()));
    
    // Ensure minimum 30-minute duration
    const minDuration = 30 * 60 * 1000; // 30 minutes in milliseconds
    if (endTime.getTime() - startTime.getTime() < minDuration) {
      endTime.setTime(startTime.getTime() + minDuration);
    }

    onDragToCreate(startTime, endTime);
    
    // Reset drag state
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, onDragToCreate]);

  const handleMouseLeave = useCallback(() => {
    // Cancel drag if mouse leaves the column
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, []);

  // Calculate drag preview position and height
  const dragPreview = useMemo(() => {
    if (!isDragging || !dragStart || !dragEnd) return null;
    
    const startY = Math.min(dragStart.y, dragEnd.y);
    const endY = Math.max(dragStart.y, dragEnd.y);
    const startTime = new Date(Math.min(dragStart.time.getTime(), dragEnd.time.getTime()));
    const endTime = new Date(Math.max(dragStart.time.getTime(), dragEnd.time.getTime()));
    
    // Convert to column-relative positions
    if (!columnRef.current) return null;
    const rect = columnRef.current.getBoundingClientRect();
    
    const relativeStartY = startY - rect.top;
    const relativeEndY = endY - rect.top;
    const height = Math.max(relativeEndY - relativeStartY, 30); // Minimum 30px height
    
    return {
      top: relativeStartY,
      height,
      startTime,
      endTime,
    };
  }, [isDragging, dragStart, dragEnd]);

  return (
    <div
      ref={columnRef}
      className={`relative border-l border-gray-200 ${isWeekend ? "bg-rose-50/40" : ""} ${isToday ? "bg-[hsl(var(--accent))/0.18]" : ""
        } ${isDragging ? "cursor-grabbing" : "cursor-crosshair"}`}
      role="gridcell"
      aria-label={`Day column ${format(date, "EEEE MMM d")}${isToday ? " today" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Time grid with half-hour divisions */}
      {/* TODO: Add react-virtual for virtualization when slots > threshold */}
      {needsVirtualization && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 z-20">
          Large time grid - consider installing react-virtual for better performance
        </div>
      )}
      {dstGaps.length > 0 && (
        <div className="absolute top-0 left-0 right-0 bg-blue-100 text-blue-800 text-xs px-2 py-1 z-20 mt-6">
          DST transition detected - some hours may be skipped
        </div>
      )}
      {visibleSlots.map((slotIndex) => {
        const hour = Math.floor((slotIndex * CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL) / 60);
        const minute = (slotIndex * CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL) % 60;
        const isHourBoundary = (slotIndex % (60 / CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL)) === 0;

        return (
          <div
            key={`slot-${date.toISOString()}-${slotIndex}`}
            className={`border-b border-r transition-colors ${isHourBoundary ? "border-gray-300" : "border-gray-200"
              } hover:bg-gray-100/60 cursor-pointer`}
            style={{ height: `${CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT / 2}px` }}
            onClick={() => handleTimeSlotClick(slotIndex)}
            role="button"
            aria-label={`Add event at ${hour}:${minute.toString().padStart(2, '0')}`}
            tabIndex={-1}
          />
        );
      })}

      {/* Positioned events with collision detection */}
      {positioned.map(({ event, top, height, width, left }) => (
        <div
          key={event.id}
          className="absolute"
          style={{
            top: `${top}px`,
            height: `${height}px`,
            left: `${left}%`,
            width: `${width}%`,
            paddingLeft: '2px',
            paddingRight: '2px',
          }}
        >
          <EventCard
            event={event}
            isLocal={Boolean(event.createdBy && event.createdBy !== 'external')}
            isDragging={false}
            isSelected={false}
            onClick={() => handleEventClick(event)}
            onDragStart={() => onEventDragStart(event.id)}
            onDragEnd={onEventDragEnd}
            onFocus={() => { }}
            onBlur={() => { }}
            currentUser={currentUser}
          />
        </div>
      ))}

      {/* Drag-to-create preview */}
      {dragPreview && (
        <div
          className="absolute left-0 right-0 bg-blue-200/60 border-2 border-blue-400 border-dashed rounded-md pointer-events-none z-10 flex items-center justify-center"
          style={{
            top: `${dragPreview.top}px`,
            height: `${dragPreview.height}px`,
          }}
        >
          <div className="text-blue-700 text-xs font-medium bg-white/80 px-2 py-1 rounded shadow-sm">
            {format(dragPreview.startTime, 'h:mm a')} - {format(dragPreview.endTime, 'h:mm a')}
          </div>
        </div>
      )}
    </div>
  );
}