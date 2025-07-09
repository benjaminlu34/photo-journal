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
    <div className="flex items-center space-x-1 neumorphic-card p-2 rounded-2xl">
      {views.map(({ mode, label, icon: Icon }) => (
        <Button
          key={mode}
          variant="ghost"
          size="sm"
          onClick={() => setViewMode(mode)}
          className={`px-6 py-3 rounded-xl font-semibold transition-all ${
            viewMode === mode
              ? "gradient-button text-white animate-glow"
              : "text-purple-600 hover:bg-purple-100 hover:text-purple-700"
          }`}
        >
          <Icon className="w-4 h-4 mr-2" />
          {label}
        </Button>
      ))}
    </div>
  );
}
