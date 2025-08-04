import { useMemo, useRef } from "react";
import { format } from "date-fns";
import { CALENDAR_CONFIG } from "@shared/config/calendar-config";
import type { LocalEvent } from "@/types/calendar";
import { applyOpacityToColor } from "@/utils/colorUtils/colorUtils";
import { EventCard } from "./event-card";

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

type PositionedEvent = {
  event: LocalEvent;
  top: number;
  height: number;
};

/**
 * Basic grid with half-hour divisions and DST-aware rendering.
 * Virtualization note: with fixed 24 hours and 60px per hour, we keep it simple now.
 * The virtualization threshold hook-in can be added later using windowing if needed.
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
}: DayColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);

  const positioned = useMemo<PositionedEvent[]>(() => {
    return events.map((event) => {
      const startTime = new Date(event.startTime);
      const endTime = new Date(event.endTime);
      const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
      const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
      const top = (startMinutes / 60) * CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT;
      const height =
        Math.max((endMinutes - startMinutes), CALENDAR_CONFIG.EVENTS.MIN_DURATION) /
        60 *
        CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT;
      return { event, top, height };
    });
  }, [events]);

  const slots = useMemo(() => {
    const minutesPerSlot = CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL; // 30
    const slotsPerDay = (24 * 60) / minutesPerSlot;
    return Array.from({ length: slotsPerDay }, (_, i) => i);
  }, []);

  return (
    <div
      ref={columnRef}
      className={`relative border-l border-gray-200 ${isWeekend ? "bg-rose-50/40" : ""} ${
        isToday ? "bg-[hsl(var(--accent))/0.18]" : ""
      }`}
      role="gridcell"
      aria-label={`Day column ${format(date, "EEEE MMM d")}${isToday ? " today" : ""}`}
    >
      {/* Time grid with half-hour divisions */}
      {slots.map((slotIndex) => {
        const hour = Math.floor((slotIndex * CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL) / 60);
        const isHourBoundary = (slotIndex % (60 / CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL)) === 0;
        return (
          <div
            key={`slot-${date.toISOString()}-${slotIndex}`}
            className={`h-8 border-b border-r ${
              isHourBoundary ? "border-gray-300" : "border-gray-200"
            } hover:bg-gray-100/60 cursor-pointer transition-colors`}
            onClick={() => {
              const minutesOffset = slotIndex * CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL;
              const slotDate = new Date(date);
              slotDate.setHours(0, 0, 0, 0);
              slotDate.setMinutes(minutesOffset);
              onTimeSlotClick(slotDate);
            }}
            role="button"
            aria-label={`Add event at ${hour}:${(slotIndex % 2) * 30 === 0 ? "00" : "30"}`}
            tabIndex={-1}
          />
        );
      })}

      {/* Positioned events */}
      {positioned.map(({ event, top, height }) => (
        <div
          key={event.id}
          className="absolute left-1 right-1"
          style={{ top, height }}
        >
          <EventCard
            event={event}
            isLocal={Boolean(event.createdBy)}
            isDragging={false}
            isSelected={false}
            onClick={() => onEventClick(event)}
            onDragStart={() => onEventDragStart(event.id)}
            onDragEnd={onEventDragEnd}
            onFocus={() => {}}
            onBlur={() => {}}
          />
        </div>
      ))}
    </div>
  );
}