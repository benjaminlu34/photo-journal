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
    <div className="w-80 bg-surface-elevated border-r border-purple-100 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border/20">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 rounded-full gradient-button flex items-center justify-center text-white font-semibold text-lg">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Journal</h1>
            <p className="text-sm text-muted-foreground">Express yourself beautifully ✨</p>
          </div>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="p-6 border-b border-border/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-foreground">
            {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              className="w-10 h-10 p-0 neu-button text-white"
              onClick={() => navigateMonth("prev")}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-10 h-10 p-0 neu-button text-white"
              onClick={() => navigateMonth("next")}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mini Calendar */}
        <div className="grid grid-cols-7 gap-1 text-center text-sm mb-4">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <div key={`weekday-${index}`} className="text-muted-foreground font-semibold py-2">
              {day}
            </div>
          ))}
          
          {getDaysInMonth().map((date, index) => (
            <div
              key={index}
              className={`py-2 cursor-pointer rounded-lg transition-all ${
                !date
                  ? ""
                  : isSelected(date)
                  ? "gradient-button text-white font-bold animate-glow"
                  : isToday(date)
                  ? "neu-button text-white font-semibold"
                  : "text-muted-foreground hover:neu-button hover:text-white interactive"
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
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-foreground">Friends Online</h3>
          <Badge variant="secondary" className="gradient-button text-white px-3 py-1 animate-bounce-gentle">
            Online
          </Badge>
        </div>

        <div className="space-y-4">
          {getOnlineFriends().map((friend) => (
            <div
              key={friend.id}
              className="flex items-center space-x-3 p-3 rounded-xl neu-card interactive cursor-pointer"
            >
              <div className="relative">
                <Avatar className="w-12 h-12 glass-card">
                  <AvatarImage src={friend.profileImageUrl || ""} />
                  <AvatarFallback className="gradient-button text-white font-bold">
                    {(friend.firstName?.[0] || friend.email?.[0] || "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`w-4 h-4 rounded-full absolute -bottom-1 -right-1 border-2 border-white/20 ${
                    friend.isOnline ? "bg-green-400 animate-glow" : "bg-purple-400"
                  }`}
                />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  {friend.firstName && friend.lastName
                    ? `${friend.firstName} ${friend.lastName}`
                    : friend.email?.split("@")[0] || "Unknown"}
                </p>
                <p className="text-sm text-muted-foreground">{friend.lastSeen}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Week's Happenings */}
        <div className="mt-8">
          <h4 className="text-sm font-bold text-foreground mb-4 flex items-center">
            <CalendarDays className="w-4 h-4 text-primary-400 mr-2" />
            WEEK'S HAPPENINGS
          </h4>
          <div className="text-sm text-muted-foreground space-y-3">
            <div className="neumorphic-inset p-3 rounded-lg">✨ You created 3 new journal entries</div>
            <div className="neumorphic-inset p-3 rounded-lg">💫 {friends.length > 0 ? friends[0].firstName || "A friend" : "Someone"} shared memories about <span className="text-foreground font-semibold">summer vibes</span></div>
            <div className="neumorphic-inset p-3 rounded-lg">🎨 New content blocks added: photos, notes</div>
          </div>
        </div>
      </div>
    </div>
  );
}
