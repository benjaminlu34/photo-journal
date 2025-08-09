import { useMemo, useRef, useCallback } from "react";
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
  currentUser,
}: DayColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);

  // Sweep-line algorithm for collision detection and positioning - O(N log N)
  const positioned = useMemo<PositionedEvent[]>(() => {
    if (events.length === 0) return [];

    // Step 1: Sort events by start time, then by duration (longer events first for stable layout)
    const sortedEvents = [...events].sort((a, b) => {
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
      time: number; // in minutes
      type: 'start' | 'end';
      eventIndex: number;
      eventId: string;
    };

    const sweepEvents: SweepEvent[] = [];
    sortedEvents.forEach((event, index) => {
      const startMinutes = event.startTime.getHours() * 60 + event.startTime.getMinutes();
      const endMinutes = event.endTime.getHours() * 60 + event.endTime.getMinutes();
      const actualEndMinutes = Math.max(endMinutes, startMinutes + CALENDAR_CONFIG.EVENTS.MIN_DURATION);
      
      sweepEvents.push({
        time: startMinutes,
        type: 'start',
        eventIndex: index,
        eventId: event.id,
      });
      sweepEvents.push({
        time: actualEndMinutes,
        type: 'end',
        eventIndex: index,
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
    const freeColumns: number[] = []; // Min-heap of available columns
    let maxColumnUsed = -1;

    sweepEvents.forEach(sweep => {
      if (sweep.type === 'start') {
        // Assign the smallest available column
        let column: number;
        if (freeColumns.length > 0) {
          // Reuse a freed column
          freeColumns.sort((a, b) => a - b); // Ensure we get the smallest
          column = freeColumns.shift()!;
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
      const startMinutes = event.startTime.getHours() * 60 + event.startTime.getMinutes();
      const endMinutes = event.endTime.getHours() * 60 + event.endTime.getMinutes();
      const actualDuration = Math.max(endMinutes - startMinutes, CALENDAR_CONFIG.EVENTS.MIN_DURATION);
      
      const top = (startMinutes / 60) * CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT;
      const height = (actualDuration / 60) * CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT;
      const column = eventColumns.get(event.id) || 0;
      
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
  }, [events]);

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

  return (
    <div
      ref={columnRef}
      className={`relative border-l border-gray-200 ${isWeekend ? "bg-rose-50/40" : ""} ${isToday ? "bg-[hsl(var(--accent))/0.18]" : ""
        }`}
      role="gridcell"
      aria-label={`Day column ${format(date, "EEEE MMM d")}${isToday ? " today" : ""}`}
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
    </div>
  );
}