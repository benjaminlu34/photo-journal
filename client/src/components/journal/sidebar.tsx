import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/contexts/journal-context";
import { useAuth } from "@/hooks/useAuth";
import { ChevronLeft, ChevronRight, Heart, CalendarDays } from "lucide-react";

export function JournalSidebar() {
  const { currentDate, setCurrentDate, friends } = useJournal();
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const navigateMonth = (direction: "prev" | "next") => {
    const newMonth = new Date(currentMonth);
    if (direction === "prev") {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date | null) => {
    if (!date) return false;
    return (
      date.getDate() === currentDate.getDate() &&
      date.getMonth() === currentDate.getMonth() &&
      date.getFullYear() === currentDate.getFullYear()
    );
  };

  const getOnlineFriends = () => {
    // Simulate online status - in real app this would come from real-time data
    return friends.slice(0, 3).map(friend => ({
      ...friend,
      isOnline: Math.random() > 0.5,
      lastSeen: Math.random() > 0.7 ? "Just now" : `${Math.floor(Math.random() * 60)} min ago`
    }));
  };

  return (
    <div className="w-80 bg-white shadow-neumorphic border-r border-primary-100 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-primary-100">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-lg shadow-soft">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-secondary-800">Connect & Create</h1>
            <p className="text-sm text-secondary-500">Share moments with loved ones</p>
          </div>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="p-6 border-b border-primary-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-secondary-800">
            {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              className="w-8 h-8 p-0 neumorphic-button"
              onClick={() => navigateMonth("prev")}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-8 h-8 p-0 neumorphic-button"
              onClick={() => navigateMonth("next")}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mini Calendar */}
        <div className="grid grid-cols-7 gap-1 text-center text-sm mb-4">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <div key={`weekday-${index}`} className="text-secondary-400 font-medium py-2">
              {day}
            </div>
          ))}
          
          {getDaysInMonth().map((date, index) => (
            <div
              key={index}
              className={`py-2 cursor-pointer rounded transition-colors ${
                !date
                  ? ""
                  : isSelected(date)
                  ? "bg-primary-500 text-white font-semibold shadow-soft"
                  : isToday(date)
                  ? "bg-primary-100 text-primary-700 font-medium"
                  : "text-secondary-600 hover:bg-primary-50"
              }`}
              onClick={() => date && setCurrentDate(date)}
            >
              {date?.getDate() || ""}
            </div>
          ))}
        </div>
      </div>

      {/* Your Circle */}
      <div className="p-6 flex-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-secondary-800">Your Circle</h3>
          <Badge variant="secondary" className="bg-primary-500 text-white">
            Online
          </Badge>
        </div>

        <div className="space-y-3">
          {getOnlineFriends().map((friend) => (
            <div
              key={friend.id}
              className="flex items-center space-x-3 p-3 rounded-xl hover:bg-primary-50 transition-colors cursor-pointer"
            >
              <div className="relative">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={friend.profileImageUrl || ""} />
                  <AvatarFallback className="bg-primary-200 text-primary-700">
                    {(friend.firstName?.[0] || friend.email?.[0] || "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`w-3 h-3 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-white ${
                    friend.isOnline ? "bg-green-400" : "bg-yellow-400"
                  }`}
                />
              </div>
              <div className="flex-1">
                <p className="font-medium text-secondary-800">
                  {friend.firstName && friend.lastName
                    ? `${friend.firstName} ${friend.lastName}`
                    : friend.email?.split("@")[0] || "Unknown"}
                </p>
                <p className="text-sm text-secondary-500">{friend.lastSeen}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Week's Happenings */}
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-secondary-700 mb-3 flex items-center">
            <CalendarDays className="w-4 h-4 text-primary-500 mr-2" />
            WEEK'S HAPPENINGS
          </h4>
          <div className="text-sm text-secondary-500 space-y-2">
            <div>• You created 3 new journal entries</div>
            <div>• {friends.length > 0 ? friends[0].firstName || "A friend" : "Someone"} shared memories about <span className="text-secondary-700">summer vibes</span></div>
            <div>• New content blocks added: photos, notes</div>
          </div>
        </div>
      </div>
    </div>
  );
}
