import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/contexts/journal-context";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay } from "date-fns";

export function WeeklyCalendarView() {
  const { currentWeek, setCurrentWeek } = useJournal();
  const [events, setEvents] = useState<any[]>([]);

  const startDate = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const endDate = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: startDate, end: endDate });



  const addEventToDay = (day: Date) => {
    const newEvent = {
      id: Math.random().toString(36).substr(2, 9),
      title: "New Event",
      date: day,
      time: "12:00 PM",
      color: "bg-blue-100 text-blue-800"
    };
    setEvents(prev => [...prev, newEvent]);
  };

  const importCalendar = () => {
    // Mock iCal/GCal import functionality
    const mockEvents = [
      { id: "1", title: "Team Meeting", date: weekDays[1], time: "10:00 AM", color: "bg-purple-100 text-purple-800" },
      { id: "2", title: "Lunch with Sarah", date: weekDays[3], time: "12:30 PM", color: "bg-green-100 text-green-800" },
      { id: "3", title: "Project Deadline", date: weekDays[5], time: "5:00 PM", color: "bg-red-100 text-red-800" }
    ];
    setEvents(prev => [...prev, ...mockEvents]);
  };

  return (
    <div className="flex-1 p-6 bg-surface overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-600 mt-1">Schedule and calendar view</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={importCalendar}
            className="neu-card text-gray-700"
          >
            Import Calendar
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-4 h-full">
        {weekDays.map((day) => {
          const isToday = isSameDay(day, new Date());
          const dayEvents = events.filter(event => isSameDay(event.date, day));
          
          return (
            <div
              key={day.toISOString()}
              className="group neu-card p-4 flex flex-col min-h-[400px] hover:shadow-neu-active transition-all"
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-center">
                  <div className="text-xs text-gray-500 font-medium uppercase">
                    {format(day, "EEE")}
                  </div>
                  <div className={`text-lg font-semibold ${
                    isToday ? "text-purple-600" : "text-gray-800"
                  }`}>
                    {format(day, "d")}
                  </div>
                  {isToday && (
                    <Badge variant="secondary" className="bg-purple-500 text-white text-xs mt-1">
                      Today
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => addEventToDay(day)}
                  className="w-6 h-6 p-0 neu-button text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>

              {/* Events List */}
              <div className="flex-1 space-y-2">
                {dayEvents.map((event) => (
                  <div key={event.id} className={`p-2 rounded-lg text-xs ${event.color}`}>
                    <div className="font-medium">{event.title}</div>
                    <div className="opacity-75">{event.time}</div>
                  </div>
                ))}
                
                {/* Sample events for demo */}
                {day.getDay() === 1 && dayEvents.length === 0 && (
                  <div className="neu-inset p-2 text-xs">
                    <div className="font-medium text-purple-700">Team Meeting</div>
                    <div className="text-purple-600">9:00 AM</div>
                  </div>
                )}
                {day.getDay() === 3 && dayEvents.length === 0 && (
                  <div className="neu-inset p-2 text-xs">
                    <div className="font-medium text-green-700">Lunch with friends</div>
                    <div className="text-green-600">12:30 PM</div>
                  </div>
                )}
                {day.getDay() === 5 && dayEvents.length === 0 && (
                  <div className="neu-inset p-2 text-xs">
                    <div className="font-medium text-blue-700">Movie night</div>
                    <div className="text-blue-600">7:00 PM</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}