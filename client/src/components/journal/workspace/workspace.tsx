import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { WeeklyCalendarView } from "../weekly-calendar-view/weekly-calendar-view";
import { WeeklyCreativeView } from "../weekly-creative-view/weekly-creative-view";
import { MonthlyView } from "../monthly-view/monthly-view";
import { StickyBoard } from "@/components/board/StickyBoard/StickyBoard";
import { useJournal } from "@/contexts/journal-context";
import { useCRDT } from "@/contexts/crdt-context";
import type { Position } from "@/types/journal";
import { Plus } from "lucide-react";

export function JournalWorkspace() {
  const { currentEntry, viewMode } = useJournal();

  // Return appropriate view based on viewMode
  if (viewMode === "weekly-calendar") {
    return <WeeklyCalendarView />;
  }
  
  if (viewMode === "weekly-creative") {
    return <WeeklyCreativeView />;
  }
  
  if (viewMode === "monthly") {
    return <MonthlyView />;
  }

  // Daily view (default) - optimized workspace
  const workspaceRef = useRef<HTMLDivElement>(null);

  if (!currentEntry) {
    return (
      <div className="flex-1 flex items-center justify-center relative overflow-auto min-h-screen">
        <div className="text-center neu-card p-12 rounded-2xl max-w-md mx-auto">
          <div className="w-20 h-20 gradient-button rounded-full flex items-center justify-center mx-auto mb-6 animate-glow">
            <Plus className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-4">Begin Your Story</h3>
          <p className="text-muted-foreground mb-6 leading-relaxed">Create your first journal entry by adding beautiful content blocks</p>
          <Button onClick={() => {}} className="gradient-button text-white font-semibold px-6 py-3 rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Add First Note
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={workspaceRef}
      data-workspace="true"
      className="flex-1 relative overflow-auto min-h-screen pinboard-bg"
    >
      {/* New StickyBoard Component */}
      <StickyBoard spaceId={`workspace-${currentEntry.id}`} />
    </div>
  );
}