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
    <div className="neu-card p-1">
      <div className="flex space-x-1">
        {views.map(({ mode, label, icon: Icon }) => (
          <Button
            key={mode}
            variant="ghost"
            size="sm"
            onClick={() => setViewMode(mode)}
            className={`neu-nav-pill font-semibold ${
              viewMode === mode ? "active text-white" : "text-gray-700"
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
