import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { WeeklyCalendarView } from "../weekly-calendar-view/weekly-calendar-view";
import { WeeklyCreativeView } from "../weekly-creative-view/weekly-creative-view";
import { MonthlyView } from "../monthly-view/monthly-view";
import { StickyBoard } from "@/components/board/StickyBoard/StickyBoard";
import { CollaborationCursor, FloatingCollaborationCursors } from "@/components/collaboration/collaboration-cursor";
import { useJournal } from "@/contexts/journal-context";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/hooks/use-toast";
import { CalendarProvider } from "@/contexts/calendar-context";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Loader2 } from "lucide-react";

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function JournalWorkspace() {
  const {
    currentEntry,
    viewMode,
    isLoading,
    currentUserRole,
    currentDate,
    refreshEntry,
    isViewingSharedBoard,
  } = useJournal();
  const { data: user } = useUser();
  const { toast } = useToast();
  const [isBootstrappingEntry, setIsBootstrappingEntry] = useState(false);

  const workspaceRef = useRef<HTMLDivElement>(null);

  const handleCreateFirstNote = useCallback(async () => {
    if (isViewingSharedBoard) {
      toast({
        title: "View only",
        description: "You can only add notes on your own journal.",
        variant: "destructive",
      });
      return;
    }

    setIsBootstrappingEntry(true);
    try {
      const dateString = formatLocalDate(currentDate);
      await apiRequest("GET", `/api/journal/${dateString}`);
      await refreshEntry();
      toast({
        title: "Journal ready",
        description: "Your board is ready for new notes.",
      });
    } catch (error) {
      console.error('Failed to prepare journal entry', error);
      toast({
        title: "Unable to create entry",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsBootstrappingEntry(false);
    }
  }, [currentDate, refreshEntry, toast, isViewingSharedBoard]);

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
    const emptyStateTitle = isViewingSharedBoard ? 'Nothing shared for this day' : 'Begin Your Story';
    const emptyStateDescription = isViewingSharedBoard
      ? "This entry hasn't been shared with you yet. Ask your friend to grant access."
      : 'Create your first journal entry by adding beautiful content blocks';
    const buttonLabel = isViewingSharedBoard
      ? 'Request Access'
      : isBootstrappingEntry
        ? 'Preparing...'
        : 'Add First Note';

    return (
      <div className="flex-1 flex items-center justify-center relative overflow-auto min-h-screen">
        <div className="text-center neu-card p-12 rounded-2xl max-w-md mx-auto">
          <div className="w-20 h-20 gradient-button rounded-full flex items-center justify-center mx-auto mb-6 animate-glow">
            {(!isViewingSharedBoard && isBootstrappingEntry) ? (
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            ) : (
              <Plus className="w-10 h-10 text-white" />
            )}
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-4">{emptyStateTitle}</h3>
          <p className="text-muted-foreground mb-6 leading-relaxed">{emptyStateDescription}</p>
          <Button
            onClick={handleCreateFirstNote}
            disabled={!isViewingSharedBoard && isBootstrappingEntry}
            className="gradient-button text-white font-semibold px-6 py-3 rounded-xl"
          >
            {(!isViewingSharedBoard && isBootstrappingEntry) ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            {buttonLabel}
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

      <div className={viewMode === "weekly-calendar" ? "flex-1 flex flex-col min-h-0" : "hidden"}>
        <CalendarProvider initialDate={currentEntry?.createdAt ? new Date(currentEntry.createdAt) : new Date()}>
          <WeeklyCalendarView username={user?.username || ''} />
        </CalendarProvider>
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