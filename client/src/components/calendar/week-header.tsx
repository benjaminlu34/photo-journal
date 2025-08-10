import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, Settings } from "lucide-react";
import { format, startOfWeek, endOfWeek, isSameDay, addWeeks, subWeeks } from "date-fns";
import { useCalendar } from "@/contexts/calendar-context";
import { CALENDAR_CONFIG } from "@shared/config/calendar-config";

interface WeekHeaderProps {
  currentWeek: Date;
  onWeekChange: (date: Date) => void;
  onTodayClick: () => void;
  onSettingsClick: () => void;
  onFeedModalClick: () => void;
  hasJournalEntries?: boolean[];
  showRecurrenceBanner?: boolean;
}

export function WeekHeader({
  currentWeek,
  onWeekChange,
  onTodayClick,
  onSettingsClick,
  onFeedModalClick,
  hasJournalEntries = [],
  showRecurrenceBanner = CALENDAR_CONFIG.FEATURES.ENABLE_RECURRENCE_UI
}: WeekHeaderProps) {
  const { isLoading, error } = useCalendar();
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const isCurrentWeek = isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 0 }));

  const handlePrevWeek = () => {
    const newWeek = subWeeks(startOfWeek(currentWeek, { weekStartsOn: 0 }), 1);
    onWeekChange(newWeek);
  };

  const handleNextWeek = () => {
    const newWeek = addWeeks(startOfWeek(currentWeek, { weekStartsOn: 0 }), 1);
    onWeekChange(newWeek);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };



  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
      {/* Coming Soon banner for recurring events */}
      {showRecurrenceBanner && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-200 px-4 py-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center text-blue-700">
              <Calendar className="w-4 h-4 mr-2" />
              <span className="font-medium">Recurring events coming soon!</span>
              <span className="ml-2 text-blue-600">Create individual events for now.</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3">
        {/* Left section: Week navigation */}
        <div className="flex items-center space-x-4">
          {/* Previous week button - removed to avoid duplicate navigation (home header is source of truth) */}

          {/* Week range display */}
          <div 
            className="text-center"
            role="region" 
            aria-live="polite"
            aria-label="Current week range"
          >
            <h2 className="text-lg font-bold text-gray-800">
              {format(weekStart, "MMM d")} - {format(weekEnd, "d, yyyy")}
            </h2>
            <div className="text-sm text-gray-600 mt-1">
              Week of {format(weekStart, "MMMM d, yyyy")}
              {hasJournalEntries.some(Boolean) && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {hasJournalEntries.filter(Boolean).length} journal entries
                </Badge>
              )}
            </div>
          </div>

          {/* Next week button - removed to avoid duplicate navigation (home header is source of truth) */}
        </div>

        {/* Center section: Today button - removed to avoid duplicate navigation */}
        <div className="flex items-center"></div>

        {/* Right section: Action buttons */}
        <div className="flex items-center space-x-2">
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-2" />
              Syncing...
            </div>
          )}

          {/* Error indicator */}
          {error && (
            <Badge variant="destructive" className="text-xs">
              Sync Error
            </Badge>
          )}

          {/* Calendar feeds button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onFeedModalClick}
            onKeyDown={(e) => handleKeyDown(e, onFeedModalClick)}
            className="neu-card rounded-lg shadow-neu hover:shadow-neu-lg transition-all"
            aria-label="Manage calendar feeds"
            title="Manage calendar feeds"
          >
            <Calendar className="w-4 h-4" />
          </Button>

          {/* Settings button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onSettingsClick}
            onKeyDown={(e) => handleKeyDown(e, onSettingsClick)}
            className="neu-card rounded-lg shadow-neu hover:shadow-neu-lg transition-all"
            aria-label="Calendar settings"
            title="Calendar settings"
          >
            <Settings className="w-4 h-4" />
          </Button>

          {/* Create event button removed - users can click/drag on calendar to create events */}
        </div>
      </div>

      {/* Touch-friendly horizontal drag hint for mobile */}
      <div className="md:hidden bg-gray-50 px-4 py-2 text-center">
        <div className="text-xs text-gray-500 flex items-center justify-center">
          <span>← Swipe to navigate between days →</span>
        </div>
      </div>
    </div>
  );
}
