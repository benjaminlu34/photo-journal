/**
 * Friendship Events - WebSocket Event Schema and Analytics
 * 
 * This module defines the WebSocket event schema for friendship events including role changes
 * and provides event emission functionality for real-time notifications and analytics tracking.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

/* ------------------------------------------------------------------ */
/*  WebSocket Event Schema                                            */
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

export interface WebSocketClient {
  ws: WebSocket;
  userId: string;
  authenticated: boolean;
}

/* ------------------------------------------------------------------ */
/*  WebSocket Server Management                                       */
/* ------------------------------------------------------------------ */

class FriendshipEventManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient[]> = new Map();

  /**
   * Initialize WebSocket server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/friendship-events'
    });

    this.wss.on('connection', (ws: WebSocket, request) => {
      console.log('New WebSocket connection for friendship events');
      
      // Handle authentication and client registration
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
          ws.close(1003, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.removeClient(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeClient(ws);
      });
    });

    console.log('🔌 Friendship Events WebSocket server initialized on /ws/friendship-events');
  }

  /**
   * Handle client authentication and registration
   */
  private handleClientMessage(ws: WebSocket, message: any): void {
    if (message.type === 'authenticate' && message.userId && message.token) {
      // TODO: Validate JWT token here
      // For now, we'll accept the userId from the message
      // In production, this should validate the JWT token
      
      const client: WebSocketClient = {
        ws,
        userId: message.userId,
        authenticated: true
      };

      // Add client to user's connection list
      if (!this.clients.has(message.userId)) {
        this.clients.set(message.userId, []);
      }
      this.clients.get(message.userId)!.push(client);

      // Send authentication success
      ws.send(JSON.stringify({
        type: 'auth_success',
        message: 'Successfully authenticated for friendship events'
      }));

      console.log(`User ${message.userId} authenticated for friendship events`);
    }
  }

  /**
   * Remove client from all user connection lists
   */
  private removeClient(ws: WebSocket): void {
    for (const [userId, clients] of this.clients.entries()) {
      const index = clients.findIndex(client => client.ws === ws);
      if (index !== -1) {
        clients.splice(index, 1);
        if (clients.length === 0) {
          this.clients.delete(userId);
        }
        console.log(`Removed client for user ${userId}`);
        break;
      }
    }
  }

  /**
   * Emit friendship event to specific user(s)
   */
  emitToUser(userId: string, event: FriendshipEvent): void {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.length === 0) {
      console.log(`No active connections for user ${userId}`);
      return;
    }

    const eventData = JSON.stringify({
      type: 'friendship_event',
      event
    });

    userClients.forEach(client => {
      if (client.authenticated && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(eventData);
        } catch (error) {
          console.error(`Failed to send event to user ${userId}:`, error);
        }
      }
    });

    console.log(`Emitted ${event.type} event to ${userClients.length} client(s) for user ${userId}`);
  }

  /**
   * Emit friendship event to both users involved
   */
  emitToBothUsers(event: FriendshipEvent): void {
    // Emit to the primary user
    this.emitToUser(event.userId, event);
    
    // Emit to the friend with adjusted perspective
    const friendEvent: FriendshipEvent = {
      ...event,
      userId: event.friendId,
      friendId: event.userId,
      type: this.getRecipientEventType(event.type)
    };
    
    this.emitToUser(event.friendId, friendEvent);
  }

  /**
   * Convert event type to recipient perspective
   */
  private getRecipientEventType(eventType: FriendshipEvent['type']): FriendshipEvent['type'] {
    switch (eventType) {
      case 'friend_request_sent':
        return 'friend_request_received';
      case 'friend_request_received':
        return 'friend_request_sent';
      case 'friend_accepted':
      case 'friend_declined':
      case 'friend_blocked':
      case 'friend_unfriended':
      case 'friend_role_changed':
        return eventType; // These events are the same from both perspectives
      default:
        return eventType;
    }
  }

  /**
   * Get connection count for debugging
   */
  getConnectionCount(): number {
    let total = 0;
    for (const clients of this.clients.values()) {
      total += clients.length;
    }
    return total;
  }

  /**
   * Get connected user IDs for debugging
   */
  getConnectedUsers(): string[] {
    return Array.from(this.clients.keys());
  }
}

// Singleton instance
export const friendshipEventManager = new FriendshipEventManager();

/* ------------------------------------------------------------------ */
/*  Event Emission Functions                                          */
/* ------------------------------------------------------------------ */

/**
 * Emit friend request sent event
 */
export function emitFriendRequestSent(
  senderId: string,
  receiverId: string,
  friendshipId: string,
  metadata?: { username?: string; avatar?: string }
): void {
  const event: FriendshipEvent = {
    type: 'friend_request_sent',
    userId: senderId,
    friendId: receiverId,
    friendshipId,
    timestamp: new Date(),
    metadata: {
      ...metadata,
      initiatorId: senderId
    }
  };

  friendshipEventManager.emitToBothUsers(event);
}

/**
 * Emit friend request accepted event
 */
export function emitFriendAccepted(
  accepterId: string,
  requesterId: string,
  friendshipId: string,
  metadata?: { username?: string; avatar?: string }
): void {
  const event: FriendshipEvent = {
    type: 'friend_accepted',
    userId: accepterId,
    friendId: requesterId,
    friendshipId,
    timestamp: new Date(),
    metadata
  };

  friendshipEventManager.emitToBothUsers(event);
}

/**
 * Emit friend request declined event
 */
export function emitFriendDeclined(
  declinerId: string,
  requesterId: string,
  friendshipId: string,
  metadata?: { username?: string; avatar?: string }
): void {
  const event: FriendshipEvent = {
    type: 'friend_declined',
    userId: declinerId,
    friendId: requesterId,
    friendshipId,
    timestamp: new Date(),
    metadata
  };

  // Only emit to the requester (decliner doesn't need notification)
  friendshipEventManager.emitToUser(requesterId, event);
}

/**
 * Emit friend blocked event
 */
export function emitFriendBlocked(
  blockerId: string,
  blockedId: string,
  friendshipId: string,
  metadata?: { username?: string; avatar?: string }
): void {
  const event: FriendshipEvent = {
    type: 'friend_blocked',
    userId: blockerId,
    friendId: blockedId,
    friendshipId,
    timestamp: new Date(),
    metadata
  };

  // Only emit to the blocker (blocked user doesn't get notification)
  friendshipEventManager.emitToUser(blockerId, event);
}

/**
 * Emit friend unfriended event
 */
export function emitFriendUnfriended(
  unfrienderId: string,
  unfriendedId: string,
  friendshipId: string,
  metadata?: { username?: string; avatar?: string }
): void {
  const event: FriendshipEvent = {
    type: 'friend_unfriended',
    userId: unfrienderId,
    friendId: unfriendedId,
    friendshipId,
    timestamp: new Date(),
    metadata
  };

  // Only emit to the unfriender (unfriended user doesn't get notification)
  friendshipEventManager.emitToUser(unfrienderId, event);
}

/**
 * Emit friend role changed event
 */
export function emitFriendRoleChanged(
  changerId: string,
  friendId: string,
  friendshipId: string,
  oldRole: string,
  newRole: string,
  metadata?: { username?: string; avatar?: string }
): void {
  const event: FriendshipEvent = {
    type: 'friend_role_changed',
    userId: changerId,
    friendId,
    friendshipId,
    timestamp: new Date(),
    metadata: {
      ...metadata,
      oldRole,
      newRole
    }
  };

  // Emit to both users - both should know about role changes
  friendshipEventManager.emitToBothUsers(event);
}