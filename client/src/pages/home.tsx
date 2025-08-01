import { useEffect, useState } from "react";
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
  const { currentDate, currentEntry, viewMode, currentWeek, setCurrentDate, setCurrentWeek } = useJournal();


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

      const result = await response.json();

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

      <div className="neu-card flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-purple-100 px-8 py-4 shadow-lg flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-4 flex-shrink-0">
              <h2 className="text-2xl font-bold text-gray-800 whitespace-nowrap flex items-center w-96">
                {viewMode === "daily" && "Daily Pinboard"}
                {(viewMode === "weekly-calendar" || viewMode === "weekly-creative") && (() => {
                  const startOfWeekDate = new Date(currentWeek);
                  startOfWeekDate.setDate(currentWeek.getDate() - currentWeek.getDay());
                  const endOfWeekDate = new Date(startOfWeekDate);
                  endOfWeekDate.setDate(startOfWeekDate.getDate() + 6);

                  const startMonth = startOfWeekDate.toLocaleDateString("en-US", { month: "short" });
                  const startDay = startOfWeekDate.getDate();
                  const endMonth = endOfWeekDate.toLocaleDateString("en-US", { month: "short" });
                  const endDay = endOfWeekDate.getDate();
                  const year = endOfWeekDate.getFullYear();

                  if (startMonth === endMonth) {
                    return `Week of ${startMonth} ${startDay} - ${endDay}, ${year}`;
                  } else {
                    return `Week of ${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
                  }
                })()}
                {viewMode === "monthly" && (
                  <>
                    <Calendar className="w-7 h-7 text-purple-500 mr-3" />
                    {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </>
                )}
              </h2>

              {/* Navigation Controls */}
              <div className="flex items-center space-x-1">
                <Button
                  variant="neu"
                  size="sm"
                  onClick={() => {
                    if (viewMode === "daily") {
                      const prevDay = new Date(currentDate);
                      prevDay.setDate(currentDate.getDate() - 1);
                      setCurrentDate(prevDay);
                    } else if (viewMode === "weekly-calendar" || viewMode === "weekly-creative") {
                      const prevWeek = new Date(currentWeek);
                      prevWeek.setDate(currentWeek.getDate() - 7);
                      setCurrentWeek(prevWeek);
                    } else if (viewMode === "monthly") {
                      const prevMonth = new Date(currentDate);
                      prevMonth.setMonth(currentDate.getMonth() - 1);
                      setCurrentDate(prevMonth);
                    }
                  }}
                  className="neu-nav-pill text-gray-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <Button
                  variant="neu"
                  size="sm"
                  onClick={() => {
                    if (viewMode === "daily") {
                      setCurrentDate(new Date());
                    } else if (viewMode === "weekly-calendar" || viewMode === "weekly-creative") {
                      setCurrentWeek(new Date());
                    } else if (viewMode === "monthly") {
                      setCurrentDate(new Date());
                    }
                  }}
                  className="neu-nav-pill text-gray-700 whitespace-nowrap"
                >
                  {viewMode === "daily" && "Today"}
                  {(viewMode === "weekly-calendar" || viewMode === "weekly-creative") && (() => {
                    const today = new Date();
                    const thisWeekStart = new Date(today);
                    thisWeekStart.setDate(today.getDate() - today.getDay());
                    thisWeekStart.setHours(0, 0, 0, 0);
                    const currentWeekStart = new Date(currentWeek);
                    currentWeekStart.setDate(currentWeek.getDate() - currentWeek.getDay());
                    currentWeekStart.setHours(0, 0, 0, 0);
                    return thisWeekStart.getTime() === currentWeekStart.getTime() ? "This Week" : "Go to This Week";
                  })()}
                  {viewMode === "monthly" && "This Month"}
                </Button>

                <Button
                  variant="neu"
                  size="sm"
                  onClick={() => {
                    if (viewMode === "daily") {
                      const nextDay = new Date(currentDate);
                      nextDay.setDate(currentDate.getDate() + 1);
                      setCurrentDate(nextDay);
                    } else if (viewMode === "weekly-calendar" || viewMode === "weekly-creative") {
                      const nextWeek = new Date(currentWeek);
                      nextWeek.setDate(currentWeek.getDate() + 7);
                      setCurrentWeek(nextWeek);
                    } else if (viewMode === "monthly") {
                      const nextMonth = new Date(currentDate);
                      nextMonth.setMonth(currentDate.getMonth() + 1);
                      setCurrentDate(nextMonth);
                    }
                  }}
                  className="neu-nav-pill text-gray-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Center Section */}
            <div className="flex items-center space-x-4 flex-1 justify-center max-w-md">
              <FriendSearch
                onFriendRequest={handleFriendRequest}
                placeholder="Find friends..."
                showRecentSearches={false}
                className="w-full"
                currentUserId={user?.id}
              />
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              <ViewToggle />
              <FriendshipNotifications className="neu-nav-pill" />
              <Button
                variant="neu"
                className="font-semibold text-gray-700 hover:text-[rgb(139,92,246)] neu-nav-pill whitespace-nowrap"
              >
                <CalendarPlus className="w-4 h-4 mr-2" />
                Calendar
              </Button>
              <Button
                variant="neu"
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
