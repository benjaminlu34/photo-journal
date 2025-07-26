import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Settings,
  MoreVertical,
  MessageCircle,
  Shield,
  Eye,
  Edit3,
  UserX,
  Search,
  Filter,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ProfilePicture } from '@/components/profile/ProfilePicture/ProfilePicture';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useUsernameNavigation } from '@/hooks/useUsernameNavigation';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Friend {
  id: string;
  friendshipId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  status: 'accepted';
  roleUserToFriend: 'viewer' | 'contributor' | 'editor';
  roleFriendToUser: 'viewer' | 'contributor' | 'editor';
  currentUserRole: 'viewer' | 'contributor' | 'editor';
  createdAt: string;
  lastActivity?: string;
}

interface FriendListResponse {
  friends: Friend[];
  pagination: {
    limit: number;
    offset: number;
    totalCount: number;
    hasMore: boolean;
  };
}

interface FriendListProps {
  className?: string;
  onFriendSelect?: (friend: Friend) => void;
  onRoleChange?: (friendId: string, newRole: string) => void; // Changed back to pass friendId
  showRoleManagement?: boolean;
}

const ROLE_LABELS = {
  viewer: 'Viewer',
  contributor: 'Contributor',
  editor: 'Editor'
};

const ROLE_DESCRIPTIONS = {
  viewer: 'Can view shared content',
  contributor: 'Can view and add content',
  editor: 'Full edit permissions'
};

const ROLE_ICONS = {
  viewer: Eye,
  contributor: Edit3,
  editor: Shield
};

export function FriendList({
  className,
  onFriendSelect,
  onRoleChange,
  showRoleManagement = true
}: FriendListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [cursor, setCursor] = useState<string | undefined>();

  // Fetch friends list
  const {
    data: friendsData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['friends', searchQuery, roleFilter],
    queryFn: async (): Promise<FriendListResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const params = new URLSearchParams({
        limit: '20',
        ...(cursor && { cursor }),
        ...(searchQuery && { search: searchQuery }),
        ...(roleFilter !== 'all' && { role: roleFilter })
      });

      const response = await fetch(`/api/friends?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch friends');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Update friend role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ friendshipId, role, direction }: {
      friendshipId: string;
      role: 'viewer' | 'contributor' | 'editor'; // Specify role types
      direction: 'to_friend' | 'to_user'
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/friends/${friendshipId}/role`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role, direction }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update role');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      // The onRoleChange prop is now used to trigger the modal, not update a role directly
      // The actual role update is handled by the query invalidation and re-fetch
      console.log('success data: ', data);
      toast({
        title: "Role updated",
        description: `Friend's role has been updated to ${ROLE_LABELS[variables.role]}`, // Use direct type
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Unfriend mutation
  const unfriendMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/friends/${friendshipId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to unfriend');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      toast({
        title: "Friend removed",
        description: "You have unfriended this user",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to unfriend",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const friends = friendsData?.friends || [];
  const filteredFriends = friends.filter(friend => {
    const matchesSearch = !searchQuery ||
      friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${friend.firstName} ${friend.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' ||
      friend.currentUserRole === roleFilter;

    return matchesSearch && matchesRole;
  });

  const handleRoleUpdate = (friendshipId: string, newRole: 'viewer' | 'contributor' | 'editor', direction: 'to_friend' | 'to_user') => {
    updateRoleMutation.mutate({ friendshipId, role: newRole, direction });
  };

  const handleUnfriend = (friendshipId: string) => {
    if (confirm('Are you sure you want to unfriend this user? This action cannot be undone.')) {
      unfriendMutation.mutate(friendshipId);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Friends
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <p className="text-destructive">Failed to load friends</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['friends'] })}
            className="mt-2"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Friends ({friends.length})
          </div>
        </CardTitle>

        {/* Search and Filter */}
        <div className="flex gap-2 mt-4">
          <Search className="h-4 w-4 text-muted-foreground self-center" />
          <Input
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md bg-dropdown-solid p-1 text-gray-950 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]">
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="viewer">Viewers</SelectItem>
              <SelectItem value="contributor">Contributors</SelectItem>
              <SelectItem value="editor">Editors</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {filteredFriends.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || roleFilter !== 'all' ? 'No friends match your filters' : 'No friends yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFriends.map((friend) => (
              <FriendItem
                key={`${friend.id}-${friend.currentUserRole}`}
                friend={friend}
                onSelect={onFriendSelect}
                onRoleUpdate={handleRoleUpdate}
                onUnfriend={handleUnfriend}
                showRoleManagement={showRoleManagement}
                isUpdatingRole={updateRoleMutation.isPending}
              />
            ))}

            {friendsData?.pagination?.hasMore && (
              <Button
                variant="outline"
                onClick={() => {
                  // TODO: Implement pagination
                  toast({
                    title: "Pagination not implemented",
                    description: "Load more functionality coming soon",
                  });
                }}
                className="w-full"
              >
                Load More
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FriendItemProps {
  friend: Friend;
  onSelect?: (friend: Friend) => void;
  onRoleUpdate: (friendshipId: string, newRole: 'viewer' | 'contributor' | 'editor', direction: 'to_friend' | 'to_user') => void; // Changed back to pass friendshipId
  onUnfriend: (friendshipId: string) => void;
  showRoleManagement: boolean;
  isUpdatingRole: boolean;
}

function FriendItem({
  friend,
  onSelect,
  onRoleUpdate,
  onUnfriend,
  showRoleManagement,
  isUpdatingRole
}: FriendItemProps) {
  const { navigateToUserBoard } = useUsernameNavigation();
  

  const displayName = friend.firstName && friend.lastName
    ? `${friend.firstName} ${friend.lastName}`
    : friend.username;

  // Use the role that applies to the current user
  const currentUserRole = friend.currentUserRole;
  const RoleIcon = ROLE_ICONS[currentUserRole];

  const [dropdownOpen, setDropdownOpen] = useState(false); // Add state for dropdown

  const handleItemClick = (e: React.MouseEvent) => {
    // Only open dropdown if not clicking the MoreVertical button itself
    if (e.target instanceof HTMLElement && (e.target as HTMLElement).closest('.more-vertical-button')) {
      return;
    }
    // Only trigger onSelect if not clicking a dropdown menu item
    if (e.target instanceof HTMLElement && !(e.target as HTMLElement).closest('[role="menuitem"]')) {
      navigateToUserBoard(friend.username, new Date());
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg bg-card shadow-neu transition-all duration-200 ease-in-out",
        onSelect && "cursor-pointer",
        "hover:shadow-lg hover:translate-y-[-2px] hover:bg-accent"
      )}
      onClick={handleItemClick} // Use new click handler
    >
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <ProfilePicture
          userId={friend.id}
          size="md"
          fallbackText={displayName}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{displayName}</p>
            {friend.username !== displayName && (
              <p className="text-xs text-muted-foreground">@{friend.username}</p>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <Badge variant="neu" className="text-xs">
              <RoleIcon className="h-3 w-3 mr-1" />
              {ROLE_LABELS[currentUserRole]}
            </Badge>

            {friend.lastActivity && (
              <span className="text-xs text-muted-foreground">
                Active {new Date(friend.lastActivity).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {showRoleManagement && (
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen} key={`${friend.id}-${friend.currentUserRole}`}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 more-vertical-button" // Add a class for identification
              onClick={(e) => e.stopPropagation()} // Stop propagation
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Manage Friend</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => {
              navigateToUserBoard(friend.username, new Date());
              setDropdownOpen(false); // Close dropdown after selection
            }}>
              <MessageCircle className="h-4 w-4 mr-2" />
              View Profile
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Role Permissions</DropdownMenuLabel>

            {(['viewer', 'contributor', 'editor'] as const).map((role) => (
              <DropdownMenuItem
                key={role}
                onClick={() => {
                  onRoleUpdate(friend.friendshipId, role, 'to_user');
                  setDropdownOpen(false); // Close dropdown after selection
                }}
                disabled={isUpdatingRole || currentUserRole === role}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center">
                    {React.createElement(ROLE_ICONS[role], { className: "h-4 w-4 mr-2" })}
                    {ROLE_LABELS[role]}
                  </div>
                  {currentUserRole === role && (
                    <Badge variant="secondary" className="text-xs">Current</Badge>
                  )}
                </div>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                onUnfriend(friend.friendshipId);
                setDropdownOpen(false); // Close dropdown after selection
              }}
              className="text-destructive focus:text-destructive"
            >
              <UserX className="h-4 w-4 mr-2" />
              Unfriend
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
