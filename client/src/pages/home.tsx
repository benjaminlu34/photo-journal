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
import { CalendarPlus } from "lucide-react";
import type { UserSearchResult } from "@/hooks/useFriendSearch";

function HomeContent() {
  const { data: user, isLoading } = useUser();
  const { signOut } = useAuthMigration();
  const { toast } = useToast();
  const { currentDate, currentEntry } = useJournal();


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
    <div className="flex h-screen overflow-hidden">
      <JournalSidebar />

      <div className="neu-card flex-1 flex flex-col">
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

            {/* Friend Search */}
            <div className="w-80">
              <FriendSearch
                onFriendRequest={handleFriendRequest}
                placeholder="Find friends..."
                showRecentSearches={false}
                className="w-full"
                currentUserId={user?.id}
              />
            </div>
            <ViewToggle />

            <div className="flex items-center space-x-4">
              <FriendshipNotifications className="neu-nav-pill" />
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
