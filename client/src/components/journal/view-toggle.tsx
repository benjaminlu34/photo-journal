import { Button } from "@/components/ui/button";
import { useJournal } from "@/contexts/journal-context";
import type { ViewMode } from "@/types/journal";
import { Calendar, CalendarDays, Grid3X3, LayoutGrid } from "lucide-react";

export function ViewToggle() {
  const { viewMode, setViewMode } = useJournal();

  const views: { mode: ViewMode; label: string; icon: any }[] = [
    { mode: "daily", label: "Daily", icon: Grid3X3 },
    { mode: "weekly-calendar", label: "Weekly", icon: CalendarDays },
    { mode: "weekly-creative", label: "Creative", icon: LayoutGrid },
    { mode: "monthly", label: "Monthly", icon: Calendar },
  ];

  return (
    <div className="flex items-center space-x-2 bg-primary-50 p-1 rounded-xl">
      {views.map(({ mode, label, icon: Icon }) => (
        <Button
          key={mode}
          variant={viewMode === mode ? "default" : "ghost"}
          size="sm"
          onClick={() => setViewMode(mode)}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            viewMode === mode
              ? "bg-white text-primary-600 shadow-soft hover:shadow-neumorphic"
              : "text-secondary-500 hover:bg-white hover:shadow-soft"
          }`}
        >
          <Icon className="w-4 h-4 mr-2" />
          {label}
        </Button>
      ))}
    </div>
  );
}
