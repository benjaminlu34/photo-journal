import { useEffect } from "react";
import { startOfWeek, addDays, addWeeks, subWeeks, isSameWeek } from "date-fns";
import { JournalProvider, useJournal } from "@/contexts/journal-context";
import { CRDTProvider } from "@/contexts/crdt-context";
import { DndContextProvider } from "@/contexts/dnd-context";
import { JournalSidebar } from "@/components/journal/sidebar/sidebar";
import { JournalWorkspace } from "@/components/journal/workspace/workspace";
import { CollaborationPanel } from "@/components/journal/collaboration-panel/collaboration-panel";
import { ViewToggle } from "@/components/journal/view-toggle/view-toggle";
import { FriendSearch } from "@/components/ui/friend-search";
import { FriendshipNotifications } from "@/components/friends/friendship-notifications";
import { FriendshipImageHandler } from "@/components/friendship/FriendshipImageHandler";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/useUser";
import { useAuthMigration } from "@/hooks/useAuthMigration";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { CalendarPlus, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import type { UserSearchResult } from "@/hooks/useFriendSearch";

function HomeContent() {
  const { data: user, isLoading } = useUser();
  const { signOut } = useAuthMigration();
  const { toast } = useToast();
  const { currentDate, currentEntry, viewMode, currentWeek, setCurrentDate, setCurrentWeek, setViewMode } = useJournal();


  // View persistence: handle both URL params and localStorage
  useEffect(() => {
    const url = new URL(window.location.href);
    const param = url.searchParams.get('view');
    const stored = window.localStorage.getItem('pj.viewMode');

    // Determine the view mode to use (URL param takes precedence over localStorage)
    const mode = (param || stored || viewMode || 'daily') as string;

    // Apply the view mode to the context
    if (mode !== viewMode) {
      // This will trigger the viewMode change in the context
      // which will then trigger the useEffect below to update URL and localStorage
      setViewMode(mode as any);
    }

    // Apply date/week anchors based on the mode (use date-fns for stability)
    if (mode === 'weekly-calendar' || mode === 'weekly-creative') {
      const start = startOfWeek(new Date(), { weekStartsOn: 0 });
      setCurrentWeek(start);
    } else {
      setCurrentDate(new Date());
    }

    // Ensure URL has the view parameter
    if (!param) {
      url.searchParams.set('view', mode);
      // Remove any hash fragment from the URL
      url.hash = '';
      window.history.replaceState(null, '', url.toString());
    }

    // Persist to localStorage
    try {
      window.localStorage.setItem('pj.viewMode', mode);
    } catch (e) {
      console.warn('Failed to persist view mode to localStorage:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update URL and localStorage when viewMode changes
  useEffect(() => {
    if (!viewMode) return;

    const url = new URL(window.location.href);
    if (url.searchParams.get('view') !== viewMode) {
      url.searchParams.set('view', viewMode);
      // Remove any hash fragment from the URL
      url.hash = '';
      window.history.replaceState(null, '', url.toString());
    }

    try {
      window.localStorage.setItem('pj.viewMode', viewMode);
    } catch (e) {
      console.warn('Failed to persist view mode to localStorage:', e);
    }
  }, [viewMode]);

  const handleFriendRequest = async (searchUser: UserSearchResult) => {
    if (user && searchUser.id === user.id) {
      toast({
        title: "Cannot add yourself",
        description: "You cannot send a friend request to yourself",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/friends/${searchUser.username}/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to send friend request' }));
        throw new Error(errorData.message || 'Failed to send friend request');
      }

      await response.json();

      toast({
        title: "Friend request sent",
        description: `Friend request sent to ${searchUser.username}`,
      });
    } catch (error) {
      console.error('Failed to send friend request:', error);

      toast({
        title: "Failed to send friend request",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

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
    return null;
  }

  return (
    <div className="flex h-screen">
      <JournalSidebar />

      <div className="neu-card flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="bg-white border-b border-purple-100 px-8 py-4 shadow-lg flex-shrink-0">
          <div className="grid grid-cols-[auto_1fr_auto] items-center w-full gap-4">
            {/* Left: Navigation at the very left */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="default"
                size="sm"
                aria-label={
                  viewMode === "daily" ? "Go to previous day" :
                  (viewMode === "weekly-calendar" || viewMode === "weekly-creative") ? "Go to previous week" :
                  viewMode === "monthly" ? "Go to previous month" : "Previous"
                }
                title={
                  viewMode === "daily" ? "Previous day" :
                  (viewMode === "weekly-calendar" || viewMode === "weekly-creative") ? "Previous week" :
                  viewMode === "monthly" ? "Previous month" : "Previous"
                }
                onClick={() => {
                  if (viewMode === "daily") {
                    const prevDay = addDays(new Date(currentDate), -1);
                    setCurrentDate(prevDay);
                  } else if (viewMode === "weekly-calendar" || viewMode === "weekly-creative") {
                    const newWeek = subWeeks(startOfWeek(new Date(currentWeek), { weekStartsOn: 0 }), 1);
                    setCurrentWeek(newWeek);
                  } else if (viewMode === "monthly") {
                    const prevMonth = new Date(currentDate);
                    prevMonth.setMonth(currentDate.getMonth() - 1);
                    setCurrentDate(prevMonth);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}
                className="neu-nav-pill text-gray-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <Button
                variant="default"
                size="sm"
                aria-label={
                  viewMode === "daily" ? "Go to today" :
                  (viewMode === "weekly-calendar" || viewMode === "weekly-creative") ? "Go to current week" :
                  viewMode === "monthly" ? "Go to current month" : "Go to current period"
                }
                title={
                  viewMode === "daily" ? "Go to today" :
                  (viewMode === "weekly-calendar" || viewMode === "weekly-creative") ? "Go to current week" :
                  viewMode === "monthly" ? "Go to current month" : "Go to current period"
                }
                onClick={() => {
                  if (viewMode === "daily") {
                    const today = new Date();
                    setCurrentDate(today);
                  } else if (viewMode === "weekly-calendar" || viewMode === "weekly-creative") {
                    const todayStart = startOfWeek(new Date(), { weekStartsOn: 0 });
                    setCurrentWeek(todayStart);
                  } else if (viewMode === "monthly") {
                    const today = new Date();
                    setCurrentDate(today);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}
                className="neu-nav-pill text-gray-700 whitespace-nowrap"
              >
                {viewMode === "daily" && "Today"}
                {(viewMode === "weekly-calendar" || viewMode === "weekly-creative") && (() => {
                  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
                  const currentWeekStart = startOfWeek(new Date(currentWeek), { weekStartsOn: 0 });
                  return isSameWeek(thisWeekStart, currentWeekStart, { weekStartsOn: 0 }) ? "This Week" : "Go to This Week";
                })()}
                {viewMode === "monthly" && "This Month"}
              </Button>

              <Button
                variant="default"
                size="sm"
                aria-label={
                  viewMode === "daily" ? "Go to next day" :
                  (viewMode === "weekly-calendar" || viewMode === "weekly-creative") ? "Go to next week" :
                  viewMode === "monthly" ? "Go to next month" : "Next"
                }
                title={
                  viewMode === "daily" ? "Next day" :
                  (viewMode === "weekly-calendar" || viewMode === "weekly-creative") ? "Next week" :
                  viewMode === "monthly" ? "Next month" : "Next"
                }
                onClick={() => {
                  if (viewMode === "daily") {
                    const nextDay = addDays(new Date(currentDate), 1);
                    setCurrentDate(nextDay);
                  } else if (viewMode === "weekly-calendar" || viewMode === "weekly-creative") {
                    const newWeek = addWeeks(startOfWeek(new Date(currentWeek), { weekStartsOn: 0 }), 1);
                    setCurrentWeek(newWeek);
                  } else if (viewMode === "monthly") {
                    const nextMonth = new Date(currentDate);
                    nextMonth.setMonth(currentDate.getMonth() + 1);
                    setCurrentDate(nextMonth);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}
                className="neu-nav-pill text-gray-700"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Center: Title and FriendSearch with fixed positioning */}
            <div className="flex items-center justify-between min-w-0 flex-1">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-gray-800 truncate">
                  {viewMode === "daily" && "Daily Pinboard"}
                  {viewMode === "monthly" && (
                    <>
                      <Calendar className="w-7 h-7 text-purple-500 mr-3 inline-block align-[-2px]" />
                      {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </>
                  )}
                </h2>
              </div>
              <div className="w-[280px] sm:w-[320px] md:w-[360px] ml-4 flex-shrink-0">
                <FriendSearch
                  onFriendRequest={handleFriendRequest}
                  placeholder="Find friends..."
                  showRecentSearches={false}
                  className="w-full"
                  currentUserId={user?.id}
                />
              </div>
            </div>

            {/* Right: utilities cluster unchanged */}
            <div className="flex items-center gap-3 shrink-0 justify-end">
              <ViewToggle />
              <FriendshipNotifications className="neu-nav-pill" />
              <Button
                variant="default"
                className="font-semibold text-gray-700 hover:text-[rgb(246,182,92)] neu-nav-pill whitespace-nowrap"
              >
                <CalendarPlus className="w-4 h-4 mr-2" />
                Calendar
              </Button>
              <Button
                variant="default"
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
                className="font-semibold text-gray-700 hover:text-red-500 neu-nav-pill whitespace-nowrap"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>

        <CRDTProvider spaceId={`workspace-${currentEntry?.id || 'new-journal-entry'}`}>
          {/* Handle friendship events and refresh image URLs when permissions change */}
          <FriendshipImageHandler />
          <div className="flex flex-1">
            <JournalWorkspace />
            <CollaborationPanel />
          </div>
        </CRDTProvider>
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