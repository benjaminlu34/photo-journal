import React, { useState } from 'react';
import { Search, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FriendSearch } from '@/components/ui/friend-search';
import { FriendSearchModal } from '@/components/ui/friend-search-modal';
import { useToast } from '@/hooks/use-toast';
import { type UserSearchResult } from '@/hooks/useFriendSearch';

interface FriendSearchCompactProps {
  className?: string;
  showTitle?: boolean;
  maxResults?: number;
}

export function FriendSearchCompact({ 
  className, 
  showTitle = true,
  maxResults = 3 
}: FriendSearchCompactProps) {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recentFriendRequests, setRecentFriendRequests] = useState<UserSearchResult[]>([]);

  // Handle friend request from inline search
  const handleFriendRequest = async (user: UserSearchResult) => {
    try {
      // TODO: Implement actual friend request API call
      // For now, simulate the request
      await new Promise(resolve => setTimeout(resolve, 500));

      // Add to recent requests
      setRecentFriendRequests(prev => {
        const filtered = prev.filter(u => u.id !== user.id);
        return [user, ...filtered].slice(0, maxResults);
      });

      toast({
        title: "Friend request sent",
        description: `Friend request sent to ${user.username}`,
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

  // Handle friend request from modal
  const handleModalFriendRequest = (user: UserSearchResult) => {
    setRecentFriendRequests(prev => {
      const filtered = prev.filter(u => u.id !== user.id);
      return [user, ...filtered].slice(0, maxResults);
    });
  };

  return (
    <>
      <Card className={className}>
        {showTitle && (
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Find Friends
            </CardTitle>
          </CardHeader>
        )}
        
        <CardContent className="space-y-3">
          {/* Compact Search */}
          <FriendSearch
            onFriendRequest={handleFriendRequest}
            placeholder="Search friends..."
            showRecentSearches={false}
            className="w-full"
          />

          {/* Advanced Search Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="w-full text-xs"
          >
            <Search className="h-3 w-3 mr-2" />
            Advanced Search
          </Button>

          {/* Recent Friend Requests */}
          {recentFriendRequests.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Recent Requests
              </div>
              {recentFriendRequests.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between text-xs p-2 bg-secondary/50 rounded"
                >
                  <span className="text-foreground">@{user.username}</span>
                  <span className="text-green-600 text-xs">Sent</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Search Modal */}
      <FriendSearchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFriendRequestSent={handleModalFriendRequest}
      />
    </>
  );
}