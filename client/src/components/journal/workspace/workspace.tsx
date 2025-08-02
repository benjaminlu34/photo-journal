import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { WeeklyCalendarView } from "../weekly-calendar-view/weekly-calendar-view";
import { WeeklyCreativeView } from "../weekly-creative-view/weekly-creative-view";
import { MonthlyView } from "../monthly-view/monthly-view";
import { StickyBoard } from "@/components/board/StickyBoard/StickyBoard";
import { CollaborationCursor, FloatingCollaborationCursors } from "@/components/collaboration/collaboration-cursor";
import { useJournal } from "@/contexts/journal-context";
import { useCRDT } from "@/contexts/crdt-context";
import { useUser } from "@/hooks/useUser";
import type { Position } from "@/types/journal";
import { Plus, Loader2 } from "lucide-react";

export function JournalWorkspace() {
  const { currentEntry, viewMode, isLoading, currentUserRole } = useJournal();
  const { data: user } = useUser();

  const workspaceRef = useRef<HTMLDivElement>(null);

  // Show loading state while journal entry is being loaded (this is rendered unconditionally)
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center relative overflow-auto min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your journal...</p>
        </div>
      </div>
    );
  }

  // Only show "Begin Your Story" when we know for sure there's no entry (this is rendered unconditionally)
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
    <>
      <div
        ref={workspaceRef}
        data-workspace="true"
        className={viewMode === "daily" ? "flex-1 relative overflow-auto min-h-screen pinboard-bg" : "hidden"}
      >
        {/* Collaboration status indicator */}
        <div className="absolute top-4 left-4 z-10">
          <CollaborationCursor />
        </div>

        {/* New StickyBoard Component */}
        <StickyBoard spaceId={`workspace-${currentEntry.id}`} currentUserRole={currentUserRole} currentUserId={user?.id} />

        {/* Floating collaboration cursors */}
        <FloatingCollaborationCursors />
      </div>

      <div className={viewMode === "weekly-calendar" ? "flex-1" : "hidden"}>
        <WeeklyCalendarView username={user?.username || ''} />
      </div>

      <div className={viewMode === "weekly-creative" ? "flex-1" : "hidden"}>
        <WeeklyCreativeView />
      </div>

      <div className={viewMode === "monthly" ? "flex-1" : "hidden"}>
        <MonthlyView />
      </div>
    </>
  );
}