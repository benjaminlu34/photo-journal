import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/contexts/journal-context";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay } from "date-fns";

export function WeeklyCalendarView() {
  const { currentDate, setCurrentDate, setViewMode, createContentBlock } = useJournal();
  const [currentWeek, setCurrentWeek] = useState(currentDate);

  const startDate = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const endDate = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: startDate, end: endDate });

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentWeek(prev => direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1));
  };

  const addEventToDay = (day: Date) => {
    setCurrentDate(day);
    createContentBlock("sticky_note", { text: "New event..." }, {
      x: Math.random() * 200 + 50,
      y: Math.random() * 200 + 50,
      width: 200,
      height: 120,
      rotation: 0
    });
  };

  return (
    <div className="flex-1 neumorphic-panel p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-secondary-800">
            Week of {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
          </h2>
          <p className="text-secondary-500 mt-1">Plan your week and track events</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateWeek("prev")}
            className="neumorphic-button"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentWeek(new Date())}
            className="neumorphic-button"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateWeek("next")}
            className="neumorphic-button"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-4 h-full">
        {weekDays.map((day) => {
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, currentDate);
          
          return (
            <div
              key={day.toISOString()}
              className={`bg-white p-4 flex flex-col min-h-[300px] cursor-pointer hover:shadow-lg transition-all rounded-lg border border-purple-100 ${
                isSelected ? "ring-2 ring-purple-500" : ""
              }`}
              onClick={() => {
                setCurrentDate(day);
                setViewMode("daily");
              }}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-center">
                  <div className="text-xs text-secondary-500 font-medium uppercase">
                    {format(day, "EEE")}
                  </div>
                  <div className={`text-lg font-semibold ${
                    isToday ? "text-primary-600" : "text-secondary-800"
                  }`}>
                    {format(day, "d")}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => addEventToDay(day)}
                  className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>

              {/* Day Content */}
              <div className="flex-1 space-y-2">
                {/* Mock events - in real app this would come from journal entries */}
                {day.getDay() === 1 && (
                  <div className="bg-primary-100 p-2 rounded-lg text-xs">
                    <div className="font-medium text-primary-700">Team Meeting</div>
                    <div className="text-primary-600">9:00 AM</div>
                  </div>
                )}
                {day.getDay() === 3 && (
                  <div className="bg-green-100 p-2 rounded-lg text-xs">
                    <div className="font-medium text-green-700">Lunch with friends</div>
                    <div className="text-green-600">12:30 PM</div>
                  </div>
                )}
                {day.getDay() === 5 && (
                  <div className="bg-yellow-100 p-2 rounded-lg text-xs">
                    <div className="font-medium text-yellow-700">Movie night</div>
                    <div className="text-yellow-600">7:00 PM</div>
                  </div>
                )}
              </div>

              {/* Day Indicator */}
              {isToday && (
                <Badge variant="secondary" className="bg-primary-500 text-white text-xs mt-2">
                  Today
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}