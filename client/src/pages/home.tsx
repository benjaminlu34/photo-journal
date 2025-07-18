import { useEffect } from "react";
import { JournalProvider, useJournal } from "@/contexts/journal-context";
import { CRDTProvider } from "@/contexts/crdt-context";
import { DndContextProvider } from "@/contexts/dnd-context";
import { JournalSidebar } from "@/components/journal/sidebar/sidebar";
import { JournalWorkspace } from "@/components/journal/workspace/workspace";
import { CollaborationPanel } from "@/components/journal/collaboration-panel/collaboration-panel";
import { ViewToggle } from "@/components/journal/view-toggle/view-toggle";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/useUser";
import { useAuthMigration } from "@/hooks/useAuthMigration";
import { useToast } from "@/hooks/use-toast";
import { CalendarPlus } from "lucide-react";

function HomeContent() {
  const { data: user, isLoading } = useUser();
  const { signOut } = useAuthMigration();
  const { toast } = useToast();
  const { currentDate, currentEntry } = useJournal();

  useEffect(() => {
    if (!isLoading && !user) {
      toast({
        title: "Session Expired",
        description: "Please sign in to continue",
        variant: "destructive",
      });
    }
  }, [user, isLoading, toast]);

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background:
            "linear-gradient(135deg, hsl(220, 14%, 96%) 0%, hsl(220, 14%, 99%) 50%, hsl(220, 14%, 94%) 100%)",
        }}
      >
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-secondary-600">Loading your journal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <JournalSidebar />

      {/* Main Content */}
      <div className="neu-card flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-purple-100 px-8 py-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Daily Pinboard
              </h2>
              <p className="text-gray-600">
                {currentDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            {/* View Toggle */}
            <ViewToggle />

            {/* User Actions */}
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                className="neu-nav-pill font-semibold active text-gray-700 hover:text-[rgb(139,92,246)]"
              >
                <CalendarPlus className="w-4 h-4 mr-2" />
                Calendar
              </Button>

              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await signOut();
                  } catch (error) {
                    console.error('Logout error:', error);
                    toast({
                      title: "Logout failed",
                      description: "Please try again",
                      variant: "destructive",
                    });
                  }
                }}
                className="neu-nav-pill font-semibold active text-gray-700 hover:text-red-500"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>

        {/* Workspace & Collaboration Panel */}
        {currentEntry ? (
          <CRDTProvider spaceId={`workspace-${currentEntry.id}`}>
            <div className="flex flex-1">
              <JournalWorkspace />
              <CollaborationPanel />
            </div>
          </CRDTProvider>
        ) : null}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <DndContextProvider>
      <JournalProvider>
        <HomeContent />
      </JournalProvider>
    </DndContextProvider>
  );
}
