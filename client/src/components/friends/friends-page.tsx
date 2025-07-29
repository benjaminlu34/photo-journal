import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search,
  Settings,
  Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FriendList } from './friend-list';
import { FriendRequests } from './friend-requests';
import { FriendSearchModal } from '@/components/ui/friend-search-modal';
import { RoleManagementModal } from './role-management-modal';
import { JournalSharingModal } from './journal-sharing-modal';
import { FriendshipNotifications } from './friendship-notifications';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import { useUsernameNavigation } from '@/hooks/useUsernameNavigation';

interface Friend {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  status: 'accepted';
  roleUserToFriend: 'viewer' | 'contributor' | 'editor';
  roleFriendToUser: 'viewer' | 'contributor' | 'editor';
  createdAt: string;
  lastActivity?: string;
}

interface JournalEntry {
  id: string;
  date: string;
  title?: string;
  owner: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
  };
}

interface FriendsPageProps {
  className?: string;
  initialTab?: 'friends' | 'requests';
  selectedEntry?: JournalEntry | null;
  onEntryShared?: (entryId: string) => void;
}

export function FriendsPage({
  className,
  initialTab = 'friends',
  selectedEntry,
  onEntryShared
}: FriendsPageProps) {
  const { data: user } = useUser();
  const { toast } = useToast();
  const { navigateToUserBoard } = useUsernameNavigation();
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isSharingModalOpen, setIsSharingModalOpen] = useState(false);

  const handleFriendSelect = (friend: Friend) => {
    setSelectedFriend(friend);
    // Navigate to friend's journal profile
    navigateToUserBoard(friend.username, new Date());
  };

  const handleRoleManagement = (friend: Friend) => {
    setSelectedFriend(friend);
    setIsRoleModalOpen(true);
  };

  // handleRoleUpdated is no longer needed as RoleManagementModal directly updates via mutation
  // and query invalidation handles UI refresh.
  // const handleRoleUpdated = (friendId: string, newRoles: { toFriend: string; toUser: string }) => {
  //   toast({
  //     title: "Roles updated",
  //     description: "Friend permissions have been updated successfully",
  //   });
  //   setSelectedFriend(prev => prev ? {
  //     ...prev,
  //     roleUserToFriend: newRoles.toFriend as any,
  //     roleFriendToUser: newRoles.toUser as any
  //   } : null);
  // };

  const handleRequestHandled = (requestId: string, action: 'accepted' | 'declined') => {
    if (action === 'accepted') {
      toast({
        title: "Friend request accepted",
        description: "You are now friends!",
      });
      
      // Switch to friends tab to show the new friend
      setActiveTab('friends');
    }
  };

  const handleSharingUpdated = (entryId: string) => {
    onEntryShared?.(entryId);
    toast({
      title: "Sharing updated",
      description: "Journal entry sharing has been updated",
    });
  };

  const handleOpenSharing = (entry?: JournalEntry) => {
    if (entry) {
      setIsSharingModalOpen(true);
    }
  };

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Friends</h1>
            <p className="text-muted-foreground">
              Manage your friendships and sharing permissions
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <FriendshipNotifications />
            
            <Button variant="neu" onClick={() => setIsSearchModalOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Friends
            </Button>
            
            {selectedEntry && (
              <Button 
                variant="outline"
                onClick={() => handleOpenSharing(selectedEntry)}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Entry
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'friends' | 'requests')} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-96">
            <TabsTrigger value="friends" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Friends
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Requests
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Friends List */}
              <div className="lg:col-span-2">
                <FriendList
                  onFriendSelect={handleFriendSelect}
                  onRoleChange={handleRoleManagement}
                  showRoleManagement={true}
                />
              </div>
              
              {/* Quick Actions Sidebar */}
              {/* <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="neu"
                      className="w-full justify-start"
                      onClick={() => setIsSearchModalOpen(true)}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Find Friends
                    </Button>
                    
                    <Button
                      variant="neu"
                      className="w-full justify-start"
                      onClick={() => setActiveTab('requests')}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      View Requests
                    </Button>
                    
                    {selectedEntry && (
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => handleOpenSharing(selectedEntry)}
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Share Journal Entry
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Friends:</span>
                        <span className="font-medium">-</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pending Requests:</span>
                        <span className="font-medium">-</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shared Entries:</span>
                        <span className="font-medium">-</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div> */}
            </div>
          </TabsContent>

          <TabsContent value="requests" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Friend Requests */}
              <div className="lg:col-span-2">
                <FriendRequests
                  onRequestHandled={handleRequestHandled}
                />
              </div>
              
              {/* Request Guidelines */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Request Guidelines</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <h4 className="font-medium mb-1">Accepting Requests</h4>
                      <p className="text-muted-foreground">
                        When you accept a friend request, both users get "viewer" permissions by default.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-1">Declining Requests</h4>
                      <p className="text-muted-foreground">
                        Declined requests can be sent again after 24 hours.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-1">Managing Permissions</h4>
                      <p className="text-muted-foreground">
                        You can change friend permissions anytime from the Friends tab.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <FriendSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        currentUserId={user?.id}
      />

      <RoleManagementModal
        friend={selectedFriend}
        isOpen={isRoleModalOpen}
        onClose={() => {
          setIsRoleModalOpen(false);
          setSelectedFriend(null);
        }}
      />

      <JournalSharingModal
        entry={selectedEntry || null}
        isOpen={isSharingModalOpen}
        onClose={() => setIsSharingModalOpen(false)}
        onSharingUpdated={handleSharingUpdated}
      />
    </div>
  );
}