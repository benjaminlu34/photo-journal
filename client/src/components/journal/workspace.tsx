import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { WeeklyCalendarView } from "./weekly-calendar-view";
import { WeeklyCreativeView } from "./weekly-creative-view";
import { MonthlyView } from "./monthly-view";
import { StickyBoard } from "@/components/board/StickyBoard";
import { useJournal } from "@/contexts/journal-context";
import type { Position } from "@/types/journal";
import { Plus } from "lucide-react";

export function JournalWorkspace() {
  const { currentEntry, createContentBlock, viewMode } = useJournal();

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

  const addQuickNote = () => {
    const position: Position = {
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
      width: 240,
      height: 180,
      rotation: Math.random() * 6 - 3,
    };
    
    createContentBlock("sticky_note", { text: "New note..." }, position);
  };

  if (!currentEntry) {
    return (
      <div className="flex-1 flex items-center justify-center relative overflow-auto min-h-screen">
        <div className="text-center neu-card p-12 rounded-2xl max-w-md mx-auto">
          <div className="w-20 h-20 gradient-button rounded-full flex items-center justify-center mx-auto mb-6 animate-glow">
            <Plus className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-4">Begin Your Story</h3>
          <p className="text-muted-foreground mb-6 leading-relaxed">Create your first journal entry by adding beautiful content blocks</p>
          <Button onClick={addQuickNote} className="gradient-button text-white font-semibold px-6 py-3 rounded-xl">
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

      {/* Floating Add Button */}
      <Button
        onClick={addQuickNote}
        className="fixed bottom-8 right-96 w-16 h-16 gradient-button rounded-full group z-50 shadow-lg hover:shadow-xl transition-all duration-300"
      >
        <Plus className="w-8 h-8 text-white group-hover:rotate-90 transition-transform duration-300" />
      </Button>
    </div>
  );
}