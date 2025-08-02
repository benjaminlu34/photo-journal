import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CALENDAR_CONFIG } from "@shared/config/calendar-config";

interface MobileCalendarNavigationProps {
  currentPadIndex: number;
  totalPads: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  showDatePicker: boolean;
  showWeekNavigation: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}

export function MobileCalendarNavigation({
  currentPadIndex,
  totalPads,
  onSwipeLeft,
  onSwipeRight,
  showDatePicker,
  showWeekNavigation,
  onPreviousWeek,
  onNextWeek,
  onToday
}: MobileCalendarNavigationProps) {
  const canNavigatePrev = currentPadIndex > 0;
  const canNavigateNext = currentPadIndex < totalPads - 1;
  
  return (
    <div className="flex flex-col space-y-2 p-2 bg-gray-50 border-b border-gray-200">
      {/* Pad navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSwipeLeft}
          disabled={!canNavigatePrev}
          className="neu-card rounded-full shadow-neu hover:shadow-neu-lg transition-all"
          aria-label="Previous 3-day pad"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="flex space-x-2" role="tablist" aria-label="Calendar pads">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              role="tab"
              aria-selected={index === currentPadIndex}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${index === currentPadIndex
                ? 'bg-purple-500 shadow-neu-lg transform scale-125'
                : 'bg-gray-300 shadow-neu-soft'
                }`}
              aria-label={`Pad ${index + 1} of 3`}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onSwipeRight}
          disabled={!canNavigateNext}
          className="neu-card rounded-full shadow-neu hover:shadow-neu-lg transition-all"
          aria-label="Next 3-day pad"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Week navigation */}
      {showWeekNavigation && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPreviousWeek}
            className="neu-card rounded-full shadow-neu hover:shadow-neu-lg transition-all"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            className="neu-card"
          >
            Today
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onNextWeek}
            className="neu-card rounded-full shadow-neu hover:shadow-neu-lg transition-all"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
      
      {/* Date picker */}
      {showDatePicker && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="neu-card w-full max-w-xs"
            aria-label="Select date"
          >
            Select Date
          </Button>
        </div>
      )}
    </div>
  );
}