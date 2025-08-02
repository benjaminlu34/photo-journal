import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { CALENDAR_CONFIG } from "@shared/config/calendar-config";
import type { DateRange } from "@/types/calendar";
import { subWeeks, addWeeks } from 'date-fns';
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
  const startDate = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const endDate = endOfWeek(currentWeek, { weekStartsOn: 0 });
  
  const weekRange = format(startDate, CALENDAR_CONFIG.DATE_FORMATS.WEEK_HEADER);
  
  const goToPreviousWeek = () => {
    onWeekChange(subWeeks(currentWeek, 1));
  };
  
  const goToNextWeek = () => {
    onWeekChange(addWeeks(currentWeek, 1));
  };
  
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center space-x-2 mb-2 sm:mb-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={goToPreviousWeek}
          className="neu-card rounded-full shadow-neu hover:shadow-neu-lg transition-all"
          aria-label="Previous week"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <h2 
          className="text-lg font-bold text-gray-800"
          aria-live="polite"
        >
          {weekRange}
        </h2>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={goToNextWeek}
          className="neu-card rounded-full shadow-neu hover:shadow-neu-lg transition-all"
          aria-label="Next week"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onTodayClick}
          className="neu-card"
        >
          Today
        </Button>
        
        {showRecurrenceBanner && (
          <div className="hidden sm:block bg-yellow-100 border border-yellow-300 text-yellow-800 text-xs px-2 py-1 rounded-full">
            Recurring events coming soon!
          </div>
        )}
      </div>
    </div>
  );
}