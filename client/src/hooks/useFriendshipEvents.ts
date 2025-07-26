/**
 * Friendship Events Hook - Real-Time UI Updates
 * 
 * This hook provides WebSocket connection management and event handlers
 * for real-time friendship notifications and role change updates.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useUser } from '@/hooks/useUser';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface FriendshipEvent {
  type: 'friend_request_sent' | 'friend_request_received' | 'friend_accepted' | 'friend_declined' | 'friend_blocked' | 'friend_unfriended' | 'friend_role_changed';
  userId: string;
  friendId: string;
  friendshipId: string;
  timestamp: Date;
  metadata?: {
    username?: string;
    avatar?: string;
    oldRole?: string;
    newRole?: string;
    initiatorId?: string;
  };
}

export interface FriendshipEventHandlers {
  onFriendRequestReceived?: (event: FriendshipEvent) => void;
  onFriendRequestSent?: (event: FriendshipEvent) => void;
  onFriendAccepted?: (event: FriendshipEvent) => void;
  onFriendDeclined?: (event: FriendshipEvent) => void;
  onFriendBlocked?: (event: FriendshipEvent) => void;
  onFriendUnfriended?: (event: FriendshipEvent) => void;
  onFriendRoleChanged?: (event: FriendshipEvent) => void;
}

export interface ConnectionStatus {
  connected: boolean;
  authenticated: boolean;
  reconnecting: boolean;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Hook Implementation                                               */
/* ------------------------------------------------------------------ */

export function useFriendshipEvents(handlers: FriendshipEventHandlers = {}) {
  const { data: user } = useUser();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    authenticated: false,
    reconnecting: false
  });

  // Store handlers in a ref to avoid recreating connection on handler changes
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (!user?.id) {
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return;
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/friendship-events`;

      console.log('Connecting to friendship events WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Friendship events WebSocket connected');
        setConnectionStatus(prev => ({ ...prev, connected: true, reconnecting: false, error: undefined }));

        // Authenticate with the server
        ws.send(JSON.stringify({
          type: 'authenticate',
          userId: user.id,
          token: 'placeholder-token' // TODO: Use actual JWT token
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'auth_success') {
            console.log('Friendship events authentication successful');
            setConnectionStatus(prev => ({ ...prev, authenticated: true }));
            return;
          }

          if (data.type === 'friendship_event' && data.event) {
            const friendshipEvent: FriendshipEvent = {
              ...data.event,
              timestamp: new Date(data.event.timestamp)
            };

            console.log('Received friendship event:', friendshipEvent);

            // Use handlers from ref to avoid dependency issues
            const currentHandlers = handlersRef.current;

            // Call appropriate handler based on event type
            switch (friendshipEvent.type) {
              case 'friend_request_received':
                currentHandlers.onFriendRequestReceived?.(friendshipEvent);
                break;
              case 'friend_request_sent':
                currentHandlers.onFriendRequestSent?.(friendshipEvent);
                break;
              case 'friend_accepted':
                currentHandlers.onFriendAccepted?.(friendshipEvent);
                break;
              case 'friend_declined':
                currentHandlers.onFriendDeclined?.(friendshipEvent);
                break;
              case 'friend_blocked':
                currentHandlers.onFriendBlocked?.(friendshipEvent);
                break;
              case 'friend_unfriended':
                currentHandlers.onFriendUnfriended?.(friendshipEvent);
                break;
              case 'friend_role_changed':
                currentHandlers.onFriendRoleChanged?.(friendshipEvent);
                break;
              default:
                console.warn('Unknown friendship event type:', friendshipEvent.type);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('Friendship events WebSocket closed:', event.code, event.reason);
        setConnectionStatus(prev => ({
          ...prev,
          connected: false,
          authenticated: false,
          error: event.reason || 'Connection closed'
        }));

        // Only attempt to reconnect if it wasn't a clean close and user is still authenticated
        if (event.code !== 1000 && user?.id && !reconnectTimeoutRef.current) {
          setConnectionStatus(prev => ({ ...prev, reconnecting: true }));
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect to friendship events...');
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('Friendship events WebSocket error:', error);
        setConnectionStatus(prev => ({
          ...prev,
          error: 'Connection error',
          reconnecting: false
        }));
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus(prev => ({
        ...prev,
        error: 'Failed to create connection',
        reconnecting: false
      }));
    }
  }, [user?.id]); // Removed handlers from dependency array

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    setConnectionStatus({
      connected: false,
      authenticated: false,
      reconnecting: false
    });
  }, []);

  // Connect when user is available
  useEffect(() => {
    // TODO: WebSocket connections disabled to prevent connection loops
    // The WebSocket server exists but creates too many connections
    // Re-enable when connection management is improved
    console.log('Friendship events WebSocket temporarily disabled to prevent connection loops');

    // if (user?.id) {
    //   connect();
    // } else {
    //   disconnect();
    // }

    return () => {
      disconnect();
    };
  }, [user?.id]); // Removed connect and disconnect from dependencies

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionStatus,
    connect,
    disconnect,
    isConnected: connectionStatus.connected && connectionStatus.authenticated
  };
}

/* ------------------------------------------------------------------ */
/*  Notification Helpers                                              */
/* ------------------------------------------------------------------ */

/**
 * Format friendship event for display in notifications
 */
export function formatFriendshipEventMessage(event: FriendshipEvent): string {
  const username = event.metadata?.username || 'Someone';

  switch (event.type) {
    case 'friend_request_received':
      return `${username} sent you a friend request`;
    case 'friend_request_sent':
      return `Friend request sent to ${username}`;
    case 'friend_accepted':
      return `${username} accepted your friend request`;
    case 'friend_declined':
      return `${username} declined your friend request`;
    case 'friend_blocked':
      return `You blocked ${username}`;
    case 'friend_unfriended':
      return `You unfriended ${username}`;
    case 'friend_role_changed':
      const oldRole = event.metadata?.oldRole || 'viewer';
      const newRole = event.metadata?.newRole || 'viewer';
      return `${username}'s role changed from ${oldRole} to ${newRole}`;
    default:
      return `Friendship event: ${event.type}`;
  }
}

/**
 * Get notification type for styling
 */
export function getFriendshipEventNotificationType(event: FriendshipEvent): 'success' | 'info' | 'warning' | 'error' {
  switch (event.type) {
    case 'friend_accepted':
      return 'success';
    case 'friend_request_received':
    case 'friend_role_changed':
      return 'info';
    case 'friend_declined':
    case 'friend_unfriended':
      return 'warning';
    case 'friend_blocked':
      return 'error';
    default:
      return 'info';
  }
}