import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks, isSameWeek } from "date-fns";
import { CALENDAR_CONFIG } from "@shared/config/calendar-config";
import { useRef, useCallback, useMemo } from "react";

interface WeekHeaderProps {
  currentWeek: Date;
  onWeekChange: (date: Date) => void;
  onTodayClick: () => void;
  hasJournalEntries: boolean[];
  showRecurrenceBanner: boolean; // Controlled by ENABLE_RECURRENCE_UI flag
}


export function WeekHeader({
  currentWeek,
  onWeekChange,
  onTodayClick,
  hasJournalEntries,
  showRecurrenceBanner
}: WeekHeaderProps) {
  // Suppress unused variable warning for hasJournalEntries - will be used for visual indicators
  void hasJournalEntries;
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoize date calculations to prevent unnecessary re-computations
  const { startDate, endDate, weekRange, isCurrentWeek } = useMemo(() => {
    const start = startOfWeek(currentWeek, { weekStartsOn: 0 });
    const end = endOfWeek(currentWeek, { weekStartsOn: 0 });
    const range = `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    const isCurrent = isSameWeek(currentWeek, new Date(), { weekStartsOn: 0 });
    
    return {
      startDate: start,
      endDate: end,
      weekRange: range,
      isCurrentWeek: isCurrent
    };
  }, [currentWeek]);

  const goToPreviousWeek = useCallback(() => {
    onWeekChange(subWeeks(currentWeek, 1));
  }, [currentWeek, onWeekChange]);

  const goToNextWeek = useCallback(() => {
    onWeekChange(addWeeks(currentWeek, 1));
  }, [currentWeek, onWeekChange]);

  const handleTodayClick = useCallback(() => {
    onTodayClick();
  }, [onTodayClick]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-gray-200/60 bg-white/70 backdrop-blur-sm"
      role="region"
      aria-label="Week navigation header"
      onKeyDown={(e) => {
        // Keyboard support
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          goToPreviousWeek();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          goToNextWeek();
        } else if (e.key.toLowerCase() === "t") {
          e.preventDefault();
          onTodayClick();
        }
      }}
      tabIndex={0}
    >
      {/* Keep controls fixed; let title truncate on small widths */}
      <div className="flex items-center gap-2 mb-2 sm:mb-0 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={goToPreviousWeek}
          className="neu-card rounded-full shadow-neu hover:shadow-neu-lg transition-all p-2"
          aria-label="Previous week"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <h2
          className="text-lg font-bold text-gray-800 min-w-0 truncate"
          aria-live="polite"
        >
          {weekRange}
        </h2>

        <Button
          variant="ghost"
          size="sm"
          onClick={goToNextWeek}
          className="neu-card rounded-full shadow-neu hover:shadow-neu-lg transition-all p-2"
          aria-label="Next week"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTodayClick}
          className="neu-card"
          aria-label="Go to today"
          disabled={isCurrentWeek}
        >
          Today
        </Button>

        {showRecurrenceBanner && CALENDAR_CONFIG.FEATURES.ENABLE_RECURRENCE_UI && (
          <div
            className="hidden sm:block bg-yellow-100 border border-yellow-300 text-yellow-800 text-xs px-2 py-1 rounded-full"
            role="status"
            aria-live="polite"
          >
            Recurring events coming soon!
          </div>
        )}
      </div>
    </div>
  );
}