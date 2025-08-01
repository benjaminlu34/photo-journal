import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/contexts/journal-context";
import { useUser } from "@/hooks/useUser";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  CalendarDays,
  Calendar,
  User,
} from "lucide-react";
import { ProfilePicture } from "@/components/profile/ProfilePicture/ProfilePicture";
import { getInitials } from "@/hooks/useProfilePicture";

export function JournalSidebar() {
  const { currentDate, setCurrentDate, friends } = useJournal();
  const { data: user } = useUser();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [, setLocation] = useLocation();

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
    // Ensure friends is an array before calling slice
    if (!Array.isArray(friends)) {
      return [];
    }
    
    // Simulate online status - in real app this would come from real-time data
    return friends.slice(0, 3).map((friend) => ({
      ...friend,
      isOnline: Math.random() > 0.5,
      lastSeen:
        Math.random() > 0.7
          ? "Just now"
          : `${Math.floor(Math.random() * 60)} min ago`,
    }));
  };

  return (
    <div className="no-squish-sidebar bg-surface flex flex-col h-screen p-4 space-y-4">
      {/* Header Card */}
      <div className="neu-card p-6 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl neu-button flex items-center justify-center text-white font-semibold text-lg">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Journal</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long", 
                day: "numeric"
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Calendar Card */}
      <div className="neu-card p-6 flex-shrink-0">
        <div className="flex items-center justify-between mb-6">
          <h2 className="calendar-month-header">
            {currentMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div className="flex space-x-2">
            <button
              className="calendar-nav-button"
              onClick={() => navigateMonth("prev")}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="calendar-nav-button"
              onClick={() => navigateMonth("next")}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Neumorphic Calendar - Fixed size to prevent squishing */}
        <div className="calendar-grid">
          <div className="grid grid-cols-7 gap-2 text-center mb-4">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day, index) => (
              <div
                key={`weekday-${index}`}
                className="calendar-weekday py-2 flex items-center justify-center"
              >
                {day}
              </div>
            ))}

            {getDaysInMonth().map((date, index) => {
              const hasEvents = date && (date.getDate() === 8 || date.getDate() === 13 || date.getDate() === 16 || date.getDate() === 20 || date.getDate() === 28);
              
              return (
                <div
                  key={index}
                  className={`calendar-day-cell ${
                    !date
                      ? "calendar-day-empty"
                      : isSelected(date)
                        ? "calendar-day-selected"
                        : isToday(date)
                          ? "calendar-day-today"
                          : "calendar-day-default"
                  } ${hasEvents ? "calendar-day-has-events" : ""}`}
                  onClick={() => date && setCurrentDate(date)}
                >
                  {date?.getDate() || ""}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Friends Card */}
      <div className="neu-card p-6 flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-foreground">Friends Online</h3>
          <Badge
            variant="secondary"
            className="gradient-button text-white px-3 py-1 animate-bounce-gentle"
          >
            Online
          </Badge>
        </div>

        <div className="space-y-4 overflow-y-auto flex-1">
          {getOnlineFriends().map((friend) => (
            <div
              key={friend.id}
              className="flex items-center space-x-3 p-3 rounded-xl neu-card interactive cursor-pointer"
            >
              <div className="relative">
                <ProfilePicture userId={friend.id} size="md" />
                <div
                  className={`w-4 h-4 rounded-full absolute -bottom-1 -right-1 border-2 border-white/20 ${
                    friend.isOnline
                      ? "bg-green-400 animate-glow"
                      : "bg-purple-400"
                  }`}
                />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  {friend.firstName && friend.lastName
                    ? `${friend.firstName} ${friend.lastName}`
                    : friend.email?.split("@")[0] || "Unknown"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {friend.lastSeen}
                </p>
              </div>
            </div>
          ))}

          {/* Week's Happenings */}
          <div className="mt-8">
            <h4 className="text-sm font-bold text-foreground mb-4 flex items-center">
              <CalendarDays className="w-4 h-4 text-primary-400 mr-2" />
              WEEK'S HAPPENINGS
            </h4>
            <div className="text-sm text-muted-foreground space-y-3">
              <div className="neumorphic-inset p-3 rounded-lg">
                ✨ You created 3 new journal entries
              </div>
              <div className="neumorphic-inset p-3 rounded-lg">
                💫{" "}
                {friends.length > 0
                  ? friends[0].firstName || "A friend"
                  : "Someone"}{" "}
                shared memories about{" "}
                <span className="text-foreground font-semibold">
                  summer vibes
                </span>
              </div>
              <div className="neumorphic-inset p-3 rounded-lg">
                🎨 New content blocks added: photos, notes
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Card - Fixed at bottom */}
      <div className="neu-card p-4 flex-shrink-0">
        <Button
          variant="ghost"
          className="neu-card w-full flex items-center justify-center space-x-3 p-3 rounded-lg hover:bg-[var(--secondary)] hover:border-[var(--border)] text-[var(--foreground)]"
          onClick={() => setLocation('/profile')}
        >
          <ProfilePicture userId={user?.id} size="sm" />
          <div className="text-left">
            <p className="font-medium text-sm">
              {user?.firstName || ''} {user?.lastName || ''}
            </p>
          </div>
          <User className="w-9 h-9 text-[var(--muted-foreground)]" />
        </Button>
      </div>
    </div>
  );
}
