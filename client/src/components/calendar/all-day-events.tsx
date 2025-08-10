import { useMemo } from 'react';
import type { LocalEvent } from '@/types/calendar';

interface AllDayEventsProps {
    date: Date;
    events: LocalEvent[];
    onEventClick: (event: LocalEvent) => void;
    maxVisible?: number;
}

export function AllDayEvents({
    date,
    events,
    onEventClick,
    maxVisible = 3
}: AllDayEventsProps) {
    // Filter to only all-day events for this specific date
    const allDayEvents = useMemo(() => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        return events.filter(event => {
            if (!event.isAllDay) return false;

            const eventStart = new Date(event.startTime);
            const eventEnd = new Date(event.endTime);

            // Event overlaps with this day if it starts before day ends and ends after day starts
            return eventStart <= dayEnd && eventEnd > dayStart;
        });
    }, [events, date]);

    const visibleEvents = allDayEvents.slice(0, maxVisible);
    const hiddenCount = Math.max(0, allDayEvents.length - maxVisible);

    if (allDayEvents.length === 0) {
        return <div className="min-h-[24px]" />; // Maintain consistent height
    }

    return (
        <div className="space-y-1 py-1">
            {visibleEvents.map((event) => (
                <div
                    key={event.id}
                    className="px-2 py-1 rounded text-xs font-medium text-white shadow-sm cursor-pointer hover:shadow-md transition-all hover:scale-[1.02] border border-white/20"
                    style={{ backgroundColor: event.color }}
                    onClick={() => onEventClick(event)}
                    title={event.title}
                >
                    <div className="truncate">{event.title}</div>
                </div>
            ))}

            {hiddenCount > 0 && (
                <div className="px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-700 cursor-pointer hover:bg-gray-300 transition-colors">
                    +{hiddenCount} more
                </div>
            )}
        </div>
    );
}