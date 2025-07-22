import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserPlus } from 'lucide-react';
import { FriendSearch } from '@/components/ui/friend-search';
import { useToast } from '@/hooks/use-toast';
import { type UserSearchResult } from '@/hooks/useFriendSearch';

interface FriendSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFriendRequestSent?: (user: UserSearchResult) => void;
  currentUserId?: string;
}

export function FriendSearchModal({ 
  isOpen, 
  onClose, 
  onFriendRequestSent,
  currentUserId
}: FriendSearchModalProps) {
  const { toast } = useToast();

  // Handle friend request sending
  const handleFriendRequest = async (user: UserSearchResult) => {
    // Prevent users from adding themselves as friends
    if (currentUserId && user.id === currentUserId) {
      toast({
        title: "Cannot add yourself",
        description: "You cannot send a friend request to yourself",
        variant: "destructive",
      });
      return;
    }

    try {
      // TODO: Implement actual friend request API call
      // For now, simulate the request
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: "Friend request sent",
        description: `Friend request sent to ${user.username}`,
      });

      onFriendRequestSent?.(user);
    } catch (error) {
      console.error('Failed to send friend request:', error);
      
      toast({
        title: "Failed to send friend request",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Find Friends
          </DialogTitle>
        </DialogHeader>
        
        {/* Search Interface Only */}
        <FriendSearch
          onFriendRequest={handleFriendRequest}
          placeholder="Search by username..."
          autoFocus
          showRecentSearches
          currentUserId={currentUserId}
        />
      </DialogContent>
    </Dialog>
  );
}