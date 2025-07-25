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
      // Get current session for authentication
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Send friend request to API
      const response = await fetch(`/api/friends/${user.username}/request`, {
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