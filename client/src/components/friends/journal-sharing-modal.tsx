import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Share2, 
  Users, 
  Eye, 
  Edit3, 
  Shield, 
  Search,
  Check,
  X,
  Calendar,
  BookOpen,
  UserCheck,
  UserX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { FloatingInput } from '@/components/ui/floating-input';
import { Badge } from '@/components/ui/badge';
import { ProfilePicture } from '@/components/profile/ProfilePicture/ProfilePicture';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Friend {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  roleUserToFriend: 'viewer' | 'contributor' | 'editor';
  roleFriendToUser: 'viewer' | 'contributor' | 'editor';
}

interface SharedEntry {
  id: string;
  entryId: string;
  sharedWithId: string;
  permissions: 'view' | 'edit';
  friend: Friend;
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

interface JournalSharingModalProps {
  entry: JournalEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSharingUpdated?: (entryId: string) => void;
}

const PERMISSION_LABELS = {
  view: 'View Only',
  edit: 'Can Edit'
};

const PERMISSION_DESCRIPTIONS = {
  view: 'Friend can view the entry but cannot make changes',
  edit: 'Friend can view and edit the entry content'
};

const PERMISSION_ICONS = {
  view: Eye,
  edit: Edit3
};

export function JournalSharingModal({ 
  entry, 
  isOpen, 
  onClose, 
  onSharingUpdated 
}: JournalSharingModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [friendPermissions, setFriendPermissions] = useState<Record<string, 'view' | 'edit'>>({});

  // Fetch friends list
  const {
    data: friendsData,
    isLoading: friendsLoading
  } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/friends?limit=100', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch friends');
      return response.json();
    },
    enabled: isOpen,
  });

  // Fetch current sharing status
  const {
    data: sharingData,
    isLoading: sharingLoading
  } = useQuery({
    queryKey: ['journalSharing', entry?.id],
    queryFn: async () => {
      if (!entry) return { sharedEntries: [] };
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/journal/${entry.id}/sharing`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch sharing status');
      return response.json();
    },
    enabled: isOpen && !!entry,
  });

  // Share entry mutation
  const shareEntryMutation = useMutation({
    mutationFn: async ({ 
      entryId, 
      friendId, 
      permissions 
    }: { 
      entryId: string; 
      friendId: string; 
      permissions: 'view' | 'edit' 
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/journal/${entryId}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ friendId, permissions }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to share entry');
      }

      return response.json();
    },
  });

  // Revoke sharing mutation
  const revokeShareMutation = useMutation({
    mutationFn: async ({ entryId, friendId }: { entryId: string; friendId: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/journal/${entryId}/share/${friendId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to revoke sharing');
      }

      return response.json();
    },
  });

  // Initialize state when modal opens
  React.useEffect(() => {
    if (isOpen && sharingData) {
      const currentlyShared: Set<string> = new Set(sharingData.sharedEntries.map((s: SharedEntry) => s.friend.id));
      const permissions: Record<string, 'view' | 'edit'> = {};
      
      sharingData.sharedEntries.forEach((s: SharedEntry) => {
        permissions[s.friend.id] = s.permissions;
      });

      setSelectedFriends(currentlyShared);
      setFriendPermissions(permissions);
    }
  }, [isOpen, sharingData]);

  const friends = friendsData?.friends || [];
  const sharedEntries = sharingData?.sharedEntries || [];
  
  const filteredFriends = friends.filter((friend: Friend) =>
    !searchQuery || 
    friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `${friend.firstName} ${friend.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFriendToggle = (friendId: string, checked: boolean) => {
    const newSelected = new Set(selectedFriends);
    
    if (checked) {
      newSelected.add(friendId);
      // Set default permission based on friend's role
      const friend = friends.find((f: Friend) => f.id === friendId);
      const defaultPermission = friend?.roleUserToFriend === 'viewer' ? 'view' : 'edit';
      setFriendPermissions(prev => ({ ...prev, [friendId]: defaultPermission }));
    } else {
      newSelected.delete(friendId);
      setFriendPermissions(prev => {
        const updated = { ...prev };
        delete updated[friendId];
        return updated;
      });
    }
    
    setSelectedFriends(newSelected);
  };

  const handlePermissionChange = (friendId: string, permission: 'view' | 'edit') => {
    setFriendPermissions(prev => ({ ...prev, [friendId]: permission }));
  };

  const handleSave = async () => {
    if (!entry) return;

    try {
      const currentlySharedIds: Set<string> = new Set(sharedEntries.map((s: SharedEntry) => s.friend.id));
      const newSelectedIds = selectedFriends;

      // Friends to add
      const toAdd = Array.from(newSelectedIds).filter((id: string) => !currentlySharedIds.has(id));
      
      // Friends to remove
      const toRemove = Array.from(currentlySharedIds).filter((id: string) => !newSelectedIds.has(id));

      // Friends to update permissions
      const toUpdate = Array.from(newSelectedIds).filter((id: string) => {
        const currentShare = sharedEntries.find((s: SharedEntry) => s.friend.id === id);
        return currentShare && currentShare.permissions !== friendPermissions[id];
      });

      // Execute all changes
      const promises = [
        ...toAdd.map((friendId: string) =>
          shareEntryMutation.mutateAsync({
            entryId: entry.id,
            friendId,
            permissions: friendPermissions[friendId]
          })
        ),
        ...toRemove.map((friendId: string) =>
          revokeShareMutation.mutateAsync({
            entryId: entry.id,
            friendId
          })
        ),
        ...toUpdate.map((friendId: string) =>
          shareEntryMutation.mutateAsync({
            entryId: entry.id,
            friendId,
            permissions: friendPermissions[friendId]
          })
        )
      ];

      await Promise.all(promises);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['journalSharing', entry.id] });
      onSharingUpdated?.(entry.id);

      toast({
        title: "Sharing updated",
        description: "Journal entry sharing has been updated successfully",
      });

      onClose();
    } catch (error) {
      toast({
        title: "Failed to update sharing",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  if (!entry) return null;

  const entryDate = new Date(entry.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const isLoading = friendsLoading || sharingLoading;
  const hasChanges = JSON.stringify(Array.from(selectedFriends).sort()) !== 
                    JSON.stringify(sharedEntries.map((s: SharedEntry) => s.friend.id).sort()) ||
                    sharedEntries.some((s: SharedEntry) => friendPermissions[s.friend.id] !== s.permissions);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Journal Entry
          </DialogTitle>
          <DialogDescription>
            Share your journal entry from {entryDate} with friends
          </DialogDescription>
        </DialogHeader>

        {/* Entry Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{entry.title || 'Untitled Entry'}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {entryDate}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <FloatingInput
                label="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Friends List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredFriends.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No friends match your search' : 'No friends to share with'}
                  </p>
                </div>
              ) : (
                filteredFriends.map((friend: Friend) => (
                  <FriendSharingItem
                    key={friend.id}
                    friend={friend}
                    isSelected={selectedFriends.has(friend.id)}
                    permission={friendPermissions[friend.id] || 'view'}
                    onToggle={(checked) => handleFriendToggle(friend.id, checked)}
                    onPermissionChange={(permission) => handlePermissionChange(friend.id, permission)}
                  />
                ))
              )}
            </div>

            {/* Summary */}
            {selectedFriends.size > 0 && (
              <Alert>
                <UserCheck className="h-4 w-4" />
                <AlertDescription>
                  Sharing with {selectedFriends.size} friend{selectedFriends.size !== 1 ? 's' : ''}. 
                  Changes will take effect immediately.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!hasChanges || shareEntryMutation.isPending || revokeShareMutation.isPending}
          >
            {shareEntryMutation.isPending || revokeShareMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FriendSharingItemProps {
  friend: Friend;
  isSelected: boolean;
  permission: 'view' | 'edit';
  onToggle: (checked: boolean) => void;
  onPermissionChange: (permission: 'view' | 'edit') => void;
}

function FriendSharingItem({ 
  friend, 
  isSelected, 
  permission, 
  onToggle, 
  onPermissionChange 
}: FriendSharingItemProps) {
  const displayName = friend.firstName && friend.lastName 
    ? `${friend.firstName} ${friend.lastName}`
    : friend.username;

  const maxPermission = friend.roleUserToFriend === 'viewer' ? 'view' : 'edit';
  const PermissionIcon = PERMISSION_ICONS[permission];

  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg border transition-colors",
      isSelected ? "bg-accent/50 border-primary/20" : "bg-card"
    )}>
      <div className="flex items-center space-x-3 flex-1">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
        />
        
        <ProfilePicture
          userId={friend.id}
          size="sm"
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
            <Badge variant="outline" className="text-xs">
              {friend.roleUserToFriend} role
            </Badge>
          </div>
        </div>
      </div>

      {isSelected && (
        <Select value={permission} onValueChange={onPermissionChange}>
          <SelectTrigger className="w-32">
            <PermissionIcon className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="view">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                View Only
              </div>
            </SelectItem>
            {maxPermission === 'edit' && (
              <SelectItem value="edit">
                <div className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4" />
                  Can Edit
                </div>
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}