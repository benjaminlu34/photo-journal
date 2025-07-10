import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/contexts/journal-context";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Heart,
  Camera,
  PenTool,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
} from "date-fns";

export function MonthlyView() {
  const { currentDate, setCurrentDate, setViewMode } = useJournal();
  const [currentMonth, setCurrentMonth] = useState(currentDate);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) =>
      direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1),
    );
  };

  const getMemoryPreview = (day: Date) => {
    // Mock data - in real app this would come from actual journal entries
    const dayNumber = day.getDate();
    if (dayNumber % 7 === 0)
      return { type: "photo", content: "🌅 Beautiful sunrise" };
    if (dayNumber % 5 === 0)
      return { type: "note", content: "💭 Great conversation" };
    if (dayNumber % 3 === 0)
      return { type: "audio", content: "🎵 Favorite song" };
    return null;
  };

  const getActivityCount = (day: Date) => {
    // Mock activity count
    return Math.floor(Math.random() * 4);
  };

  return (
    <div className="flex-1 p-6 pinboard-bg overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center">
            <Calendar className="w-8 h-8 text-purple-500 mr-3" />
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <p className="text-gray-600 mt-1">
            Your month of memories and moments
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateMonth("prev")}
            className="neu-card text-gray-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
            className="neu-nav-pill text-gray-700"
          >
            This Month
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateMonth("next")}
            className="neu-card text-gray-700"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Month Stats */}
      {/* <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="neumorphic-content-block p-4 text-center">
          <div className="text-2xl font-bold text-primary-600">23</div>
          <div className="text-xs text-secondary-500">Memories Created</div>
        </div>
        <div className="neumorphic-content-block p-4 text-center">
          <div className="text-2xl font-bold text-green-600">15</div>
          <div className="text-xs text-secondary-500">Photos Captured</div>
        </div>
        <div className="neumorphic-content-block p-4 text-center">
          <div className="text-2xl font-bold text-indigo-600">31</div>
          <div className="text-xs text-secondary-500">Notes Written</div>
        </div>
        <div className="neumorphic-content-block p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">8</div>
          <div className="text-xs text-secondary-500">Voice Memos</div>
        </div>
      </div> */}

      {/* Calendar */}
      <div className="neumorphic-panel p-6">
        {/* Week Headers */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-secondary-500 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day) => {
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, currentDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const memory = getMemoryPreview(day);
            const activityCount = getActivityCount(day);

            return (
              <div
                key={day.toISOString()}
                onClick={() => {
                  setCurrentDate(day);
                  setViewMode("daily");
                }}
                className={`
                  relative p-3 min-h-[100px] rounded-xl cursor-pointer transition-all group
                  ${
                    isSelected
                      ? "neumorphic-content-block ring-2 ring-primary-500"
                      : "neumorphic-content-block hover:shadow-floating"
                  }
                  ${!isCurrentMonth ? "opacity-40" : ""}
                `}
              >
                {/* Day Number */}
                <div
                  className={`text-sm font-semibold mb-2 ${
                    isToday
                      ? "text-primary-600"
                      : isCurrentMonth
                        ? "text-secondary-800"
                        : "text-secondary-400"
                  }`}
                >
                  {format(day, "d")}
                  {isToday && (
                    <div className="w-2 h-2 bg-primary-500 rounded-full absolute top-1 right-1"></div>
                  )}
                </div>

                {/* Memory Preview */}
                {memory && isCurrentMonth && (
                  <div className="space-y-1">
                    <div
                      className={`text-xs p-1 rounded ${
                        memory.type === "photo"
                          ? "bg-blue-100 text-blue-700"
                          : memory.type === "note"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {memory.content}
                    </div>
                  </div>
                )}

                {/* Activity Indicators */}
                {isCurrentMonth && activityCount > 0 && (
                  <div className="absolute bottom-1 right-1 flex space-x-1">
                    {Array.from({ length: Math.min(activityCount, 3) }).map(
                      (_, i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 bg-primary-400 rounded-full"
                        />
                      ),
                    )}
                    {activityCount > 3 && (
                      <div className="text-xs text-primary-600 font-bold">
                        +
                      </div>
                    )}
                  </div>
                )}

                {/* Today Badge */}
                {isToday && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1 -left-1 bg-primary-500 text-white text-xs px-1 py-0"
                  >
                    Today
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Highlights */}
      <div className="mt-6 grid grid-cols-3 gap-6">
        <div className="neumorphic-content-block p-6">
          <h3 className="font-semibold text-secondary-800 mb-4 flex items-center">
            <Camera className="w-5 h-5 text-primary-500 mr-2" />
            Photo Memories
          </h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg"></div>
              <div>
                <div className="text-sm font-medium text-secondary-800">
                  Beach sunset
                </div>
                <div className="text-xs text-secondary-500">3 days ago</div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-lg"></div>
              <div>
                <div className="text-sm font-medium text-secondary-800">
                  Coffee with friends
                </div>
                <div className="text-xs text-secondary-500">1 week ago</div>
              </div>
            </div>
          </div>
        </div>

        <div className="neumorphic-content-block p-6">
          <h3 className="font-semibold text-secondary-800 mb-4 flex items-center">
            <PenTool className="w-5 h-5 text-primary-500 mr-2" />
            Popular Notes
          </h3>
          <div className="space-y-3">
            <div className="bg-purple-100 p-3 rounded-lg">
              <div className="text-sm text-purple-800">
                "Today was amazing! Had lunch at that new place..."
              </div>
              <div className="text-xs text-purple-600 mt-1">5 days ago</div>
            </div>
            <div className="bg-pink-100 p-3 rounded-lg">
              <div className="text-sm text-pink-800">
                "Feeling grateful for good friends..."
              </div>
              <div className="text-xs text-pink-600 mt-1">1 week ago</div>
            </div>
          </div>
        </div>

        <div className="neumorphic-content-block p-6">
          <h3 className="font-semibold text-secondary-800 mb-4 flex items-center">
            <Heart className="w-5 h-5 text-primary-500 mr-2" />
            Monthly Goals
          </h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div className="text-sm text-secondary-700">
                Share more photos
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
              <div className="text-sm text-secondary-700">
                Write daily reflections
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
              <div className="text-sm text-secondary-700">
                Try voice journaling
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
