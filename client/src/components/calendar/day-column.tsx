import { MinHeap } from '@/utils/min-heap';
import { useMemo, useRef, useCallback, useState } from "react";
import { format } from "date-fns";
import { useVirtualizer } from '@tanstack/react-virtual';
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

  // Debug: Log when drag-to-create callback is available


  // Drag-to-create state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ y: number; time: Date } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ y: number; time: Date } | null>(null);
  const [hasDragged, setHasDragged] = useState(false);

  // Position timed events only (all-day events are handled in the header)
  const positioned = useMemo(() => {
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

    // Filter to only timed events (all-day events are handled in the header)
    const timedEvents = dayEvents.filter(event => !event.isAllDay);

    // Step 1: Sort timed events by start time, then by duration (longer events first for stable layout)
    const sortedTimedEvents = [...timedEvents].sort((a, b) => {
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
    sortedTimedEvents.forEach((event) => {
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

    // Step 5: Build positioned timed events with computed layout
    const totalColumns = maxColumnUsed + 1;

    const timedPositioned: PositionedEvent[] = sortedTimedEvents.map(event => {
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

      // Position timed events in the time grid (no offset for all-day area)
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

    return timedPositioned;
  }, [events, date]);

  const slots = useMemo(() => {
    const minutesPerSlot = CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL; // 30
    const slotsPerDay = (24 * 60) / minutesPerSlot;
    return Array.from({ length: slotsPerDay }, (_, i) => i);
  }, []);

  // Get DST gaps for this date
  const dstGaps = useMemo(() => getDSTGaps(date), [date]);

  // Filter out slots that fall within DST gaps
  const visibleSlots = useMemo(() => {
    return slots.filter(slotIndex => {
      const slotMinutes = slotIndex * CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL;
      return !dstGaps.some(gap => slotMinutes >= gap.start && slotMinutes < gap.end);
    });
  }, [slots, dstGaps]);

  // Check if we need virtualization (for grids > 12 hours)
  const needsVirtualization = useMemo(() => {
    return visibleSlots.length > CALENDAR_CONFIG.TIME_GRID.VIRTUALIZATION_THRESHOLD * 2; // 2 slots per hour
  }, [visibleSlots.length]);

  // Virtual scrolling setup for large time grids
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: visibleSlots.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT / 2, // 30px per slot (half hour)
    overscan: 5, // Render 5 extra items above and below visible area
    enabled: needsVirtualization,
  });

  // Simplified time slot click handler (no longer used directly, kept for compatibility)
  const handleTimeSlotClick = useCallback((slotIndex: number, e: React.MouseEvent) => {
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

    // Calculate the time based on position in the full time grid area
    const minutesFromStart = (relativeY / rect.height) * (24 * 60);
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
    // Only start drag if clicking on empty space (not on an event card)
    const target = e.target;
    if (target instanceof HTMLElement &&
      (target.closest('[data-event-card]') || target.closest('.event-card'))) {
      return;
    }

    e.preventDefault();
    const startTime = getTimeFromMouseY(e.clientY);

    setIsDragging(true);
    setHasDragged(false);
    setDragStart({ y: e.clientY, time: startTime });
    setDragEnd({ y: e.clientY, time: startTime });
  }, [getTimeFromMouseY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;

    // Check if we've moved enough to consider this a drag
    const DRAG_THRESHOLD_PX = 3;
    const deltaY = Math.abs(e.clientY - dragStart.y);

    if (deltaY > DRAG_THRESHOLD_PX && !hasDragged) {
      setHasDragged(true);
    }

    const endTime = getTimeFromMouseY(e.clientY);
    setDragEnd({ y: e.clientY, time: endTime });
  }, [isDragging, dragStart, getTimeFromMouseY, hasDragged]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const resetDragState = () => {
      setIsDragging(false);
      setHasDragged(false);
      setDragStart(null);
      setDragEnd(null);
    };

    if (!isDragging || !dragStart || !dragEnd) {
      resetDragState();
      return;
    }

    // If we dragged, create an event with drag-to-create
    if (hasDragged && onDragToCreate) {
      const startTime = new Date(Math.min(dragStart.time.getTime(), dragEnd.time.getTime()));
      const endTime = new Date(Math.max(dragStart.time.getTime(), dragEnd.time.getTime()));

      // Ensure minimum duration
      const MIN_EVENT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
      if (endTime.getTime() - startTime.getTime() < MIN_EVENT_DURATION_MS) {
        endTime.setTime(startTime.getTime() + MIN_EVENT_DURATION_MS);
      }

      onDragToCreate(startTime, endTime);
    } else if (!hasDragged) {
      // Treat as click - use the start time
      onTimeSlotClick(dragStart.time);
    }

    resetDragState();
  }, [isDragging, dragStart, dragEnd, hasDragged, onDragToCreate, onTimeSlotClick]);

  const handleMouseLeave = useCallback((_e: React.MouseEvent) => {
    // Cancel drag if mouse leaves the column
    setIsDragging(false);
    setHasDragged(false);
    setDragStart(null);
    setDragEnd(null);
  }, []);

  // Calculate drag preview position and height
  const dragPreview = useMemo(() => {
    if (!isDragging || !dragStart || !dragEnd || !hasDragged) return null;

    const startY = Math.min(dragStart.y, dragEnd.y);
    const endY = Math.max(dragStart.y, dragEnd.y);
    const startTime = new Date(Math.min(dragStart.time.getTime(), dragEnd.time.getTime()));
    const endTime = new Date(Math.max(dragStart.time.getTime(), dragEnd.time.getTime()));

    // Convert to column-relative positions
    if (!columnRef.current) return null;
    const rect = columnRef.current.getBoundingClientRect();

    // Calculate relative positions without all-day area offset
    const relativeStartY = Math.max(0, startY - rect.top);
    const relativeEndY = Math.max(0, endY - rect.top);
    const height = Math.max(relativeEndY - relativeStartY, 30); // Minimum 30px height

    return {
      top: relativeStartY,
      height,
      startTime,
      endTime,
    };
  }, [isDragging, dragStart, dragEnd, hasDragged]);

  // All-day events are now handled in the header, so no area height needed

  // Render time slots - either virtualized or regular
  const renderTimeSlots = () => {
    if (!needsVirtualization) {
      // Regular rendering for smaller grids
      return visibleSlots.map((slotIndex) => {
        const hour = Math.floor((slotIndex * CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL) / 60);
        const minute = (slotIndex * CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL) % 60;
        const isHourBoundary = (slotIndex % (60 / CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL)) === 0;

        return (
          <div
            key={`slot-${date.toISOString()}-${slotIndex}`}
            className={`border-b border-r transition-colors ${isHourBoundary ? "border-gray-300" : "border-gray-200"
              } hover:bg-gray-100/60 cursor-pointer`}
            style={{ height: `${CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT / 2}px` }}
            data-slot-index={slotIndex}
            role="button"
            aria-label={`Add event at ${hour}:${minute.toString().padStart(2, '0')}`}
            tabIndex={-1}
          />
        );
      });
    }

    // Virtualized rendering for large grids
    return (
      <div
        ref={parentRef}
        className="h-full overflow-auto"
        style={{
          height: `${visibleSlots.length * (CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT / 2)}px`,
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const slotIndex = visibleSlots[virtualItem.index];
            const hour = Math.floor((slotIndex * CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL) / 60);
            const minute = (slotIndex * CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL) % 60;
            const isHourBoundary = (slotIndex % (60 / CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL)) === 0;

            return (
              <div
                key={`slot-${date.toISOString()}-${slotIndex}`}
                className={`absolute left-0 right-0 border-b border-r transition-colors ${isHourBoundary ? "border-gray-300" : "border-gray-200"
                  } hover:bg-gray-100/60 cursor-pointer`}
                style={{
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                data-slot-index={slotIndex}
                role="button"
                aria-label={`Add event at ${hour}:${minute.toString().padStart(2, '0')}`}
                tabIndex={-1}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={columnRef}
      className={`relative border-l border-gray-200 ${isWeekend ? "bg-rose-50/40" : ""} ${isToday ? "bg-[hsl(var(--accent))/0.18]" : ""
        } ${isDragging ? "cursor-grabbing bg-blue-50/30" : "cursor-crosshair"}`}
      role="gridcell"
      aria-label={`Day column ${format(date, "EEEE MMM d")}${isToday ? " today" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >


      {/* Time grid with half-hour divisions */}
      {dstGaps.length > 0 && (
        <div className="absolute top-0 left-0 right-0 bg-blue-100 text-blue-800 text-xs px-2 py-1 z-20">
          DST transition detected - some hours may be skipped
        </div>
      )}

      {/* Render time slots - virtualized or regular based on size */}
      {renderTimeSlots()}

      {/* Positioned timed events with collision detection */}
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