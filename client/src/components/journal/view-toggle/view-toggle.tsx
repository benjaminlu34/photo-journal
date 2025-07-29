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
    <div>
      <div className="flex space-x-1">
        {views.map(({ mode, label, icon: Icon }) => (
          <Button
            key={mode}
            variant="neu"
            size="sm"
            onClick={() => setViewMode(mode)}
            data-active={viewMode === mode}
            className={`font-semibold neu-nav-pill ${
              viewMode === mode ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <Icon className="w-4 h-4 mr-2" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
