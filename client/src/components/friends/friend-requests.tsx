import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  UserPlus, 
  Clock, 
  Send,
  Inbox,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProfilePicture } from '@/components/profile/ProfilePicture/ProfilePicture';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface FriendRequest {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  status: 'pending';
  direction: 'sent' | 'received';
  createdAt: string;
  initiatorId: string;
  friend?: any; // For sent requests
  user?: any; // For received requests
}

interface FriendRequestsResponse {
  sent: FriendRequest[];
  received: FriendRequest[];
}

interface FriendRequestsProps {
  className?: string;
  onRequestHandled?: (requestId: string, action: 'accepted' | 'declined') => void;
}

export function FriendRequests({ className, onRequestHandled }: FriendRequestsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch friend requests
  const {
    data: requestsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['friendRequests'],
    queryFn: async (): Promise<FriendRequestsResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/friends/requests', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch friend requests');
      }

      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds cache
    refetchInterval: 60 * 1000, // Refetch every minute
  });

  // Accept friend request mutation
  const acceptMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/friends/${friendshipId}/accept`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to accept friend request');
      }

      return response.json();
    },
    onSuccess: (data, friendshipId) => {
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      onRequestHandled?.(friendshipId, 'accepted');
      
      toast({
        title: "Friend request accepted",
        description: "You are now friends!",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to accept request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Decline friend request mutation
  const declineMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/friends/${friendshipId}/decline`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to decline friend request');
      }

      return response.json();
    },
    onSuccess: (data, friendshipId) => {
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      onRequestHandled?.(friendshipId, 'declined');
      
      toast({
        title: "Friend request declined",
        description: "The request has been declined",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to decline request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sentRequests = requestsData?.sent || [];
  const receivedRequests = requestsData?.received || [];
  const totalRequests = sentRequests.length + receivedRequests.length;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Friend Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <p className="text-destructive">Failed to load friend requests</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
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
            <UserPlus className="h-5 w-5" />
            Friend Requests
          </div>
          {totalRequests > 0 && (
            <Badge variant="secondary">{totalRequests}</Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {totalRequests === 0 ? (
          <div className="text-center py-8">
            <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No pending friend requests</p>
          </div>
        ) : (
          <Tabs defaultValue="received" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="received" className="flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                Received ({receivedRequests.length})
              </TabsTrigger>
              <TabsTrigger value="sent" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Sent ({sentRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="received" className="mt-4">
              {receivedRequests.length === 0 ? (
                <div className="text-center py-6">
                  <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No incoming requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {receivedRequests.map((request) => (
                    <ReceivedRequestItem
                      key={request.id}
                      request={request}
                      onAccept={() => acceptMutation.mutate(request.id)}
                      onDecline={() => declineMutation.mutate(request.id)}
                      isProcessing={acceptMutation.isPending || declineMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sent" className="mt-4">
              {sentRequests.length === 0 ? (
                <div className="text-center py-6">
                  <Send className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No outgoing requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sentRequests.map((request) => (
                    <SentRequestItem
                      key={request.id}
                      request={request}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

interface ReceivedRequestItemProps {
  request: FriendRequest;
  onAccept: () => void;
  onDecline: () => void;
  isProcessing: boolean;
}

function ReceivedRequestItem({ request, onAccept, onDecline, isProcessing }: ReceivedRequestItemProps) {
  const displayName = request.firstName && request.lastName 
    ? `${request.firstName} ${request.lastName}`
    : request.username || 'Unknown User';

  const timeAgo = new Date(request.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-card shadow-neu">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <ProfilePicture
          userId={request.user?.id || request.initiatorId}
          size="md"
          fallbackText={displayName}
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{displayName}</p>
            {request.username !== displayName && (
              <p className="text-xs text-muted-foreground">@{request.username}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            <Clock className="h-3 w-3 inline mr-1" />
            {timeAgo}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={onAccept}
          disabled={isProcessing}
          className="bg-green-600 hover:bg-green-700"
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDecline}
          disabled={isProcessing}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Decline
        </Button>
      </div>
    </div>
  );
}

interface SentRequestItemProps {
  request: FriendRequest;
}

function SentRequestItem({ request }: SentRequestItemProps) {
  const displayName = request.firstName && request.lastName 
    ? `${request.firstName} ${request.lastName}`
    : request.username || 'Unknown User';

  const timeAgo = new Date(request.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-card shadow-neu">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <ProfilePicture
          userId={request.friend?.id}
          size="md"
          fallbackText={displayName}
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{displayName}</p>
            {request.username !== displayName && (
              <p className="text-xs text-muted-foreground">@{request.username}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            <Clock className="h-3 w-3 inline mr-1" />
            Sent {timeAgo}
          </p>
        </div>
      </div>

      <Badge variant="secondary" className="text-xs">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    </div>
  );
}