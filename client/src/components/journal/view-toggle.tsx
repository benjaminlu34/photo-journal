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
    <div className="flex items-center space-x-1 glass-card p-2 rounded-2xl">
      {views.map(({ mode, label, icon: Icon }) => (
        <Button
          key={mode}
          variant="ghost"
          size="sm"
          onClick={() => setViewMode(mode)}
          className={`px-6 py-3 rounded-xl font-semibold transition-all ${
            viewMode === mode
              ? "gradient-button text-white animate-glow"
              : "text-white/60 hover:glass-button hover:text-white"
          }`}
        >
          <Icon className="w-4 h-4 mr-2" />
          {label}
        </Button>
      ))}
    </div>
  );
}
