/**
 * Friendship Events Tests - WebSocket Event Emission and Analytics
 * 
 * Tests for the friendship event system including WebSocket event emission
 * and PostHog analytics tracking for all friendship state changes.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { 
  friendshipEventManager,
  emitFriendRequestSent,
  emitFriendAccepted,
  emitFriendDeclined,
  emitFriendBlocked,
  emitFriendUnfriended,
  emitFriendRoleChanged,
  type FriendshipEvent
} from '../../../server/utils/friendship-events';
import { 
  analytics,
  trackFriendRequestSent,
  trackFriendAccepted,
  trackFriendDeclined,
  trackFriendBlocked,
  trackFriendUnfriended,
  trackFriendRoleChanged
} from '../../../server/utils/analytics';

// Mock WebSocket
vi.mock('ws', () => ({
  WebSocketServer: vi.fn(),
  WebSocket: {
    OPEN: 1,
    CLOSED: 3
  }
}));

// Mock the analytics client, not the functions
vi.mock('../../../server/utils/analytics', async () => {
  const actual = await vi.importActual('../../../server/utils/analytics');
  return {
    ...actual,
    analytics: {
      track: vi.fn(),
      identify: vi.fn()
    }
  };
});

import { setupTestDB, teardownTestDB } from '../../test-utils';

describe('Friendship Events - WebSocket Event Emission', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });
  let mockServer: Server;
  let mockWss: any;
  let mockWs: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create mock WebSocket server
    mockWss = {
      on: vi.fn(),
      clients: new Set()
    };
    
    // Create mock WebSocket client
    mockWs = {
      send: vi.fn(),
      on: vi.fn(),
      close: vi.fn(),
      readyState: 1 // WebSocket.OPEN
    };
    
    // Mock WebSocketServer constructor
    (WebSocketServer as any).mockImplementation(() => mockWss);
    
    // Create mock HTTP server
    mockServer = {} as Server;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('WebSocket Server Initialization', () => {
    it('should initialize WebSocket server with correct configuration', () => {
      friendshipEventManager.initialize(mockServer);
      
      expect(WebSocketServer).toHaveBeenCalledWith({
        server: mockServer,
        path: '/ws/friendship-events'
      });
      
      expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should handle client connection and authentication', () => {
      friendshipEventManager.initialize(mockServer);
      
      // Get the connection handler
      const connectionHandler = mockWss.on.mock.calls.find(
        (call: any) => call[0] === 'connection'
      )?.[1];
      
      expect(connectionHandler).toBeDefined();
      
      // Simulate connection
      connectionHandler(mockWs, {});
      
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Event Emission Functions', () => {
    beforeEach(() => {
      friendshipEventManager.initialize(mockServer);
    });

    it('should emit friend request sent event', () => {
      const spy = vi.spyOn(friendshipEventManager, 'emitToBothUsers');
      
      emitFriendRequestSent('user1', 'user2', 'friendship1', {
        username: 'testuser',
        avatar: 'avatar.jpg'
      });
      
      expect(spy).toHaveBeenCalledWith({
        type: 'friend_request_sent',
        userId: 'user1',
        friendId: 'user2',
        friendshipId: 'friendship1',
        timestamp: expect.any(Date),
        metadata: {
          username: 'testuser',
          avatar: 'avatar.jpg',
          initiatorId: 'user1'
        }
      });
    });

    it('should emit friend accepted event', () => {
      const spy = vi.spyOn(friendshipEventManager, 'emitToBothUsers');
      
      emitFriendAccepted('user2', 'user1', 'friendship1', {
        username: 'accepter',
        avatar: 'avatar2.jpg'
      });
      
      expect(spy).toHaveBeenCalledWith({
        type: 'friend_accepted',
        userId: 'user2',
        friendId: 'user1',
        friendshipId: 'friendship1',
        timestamp: expect.any(Date),
        metadata: {
          username: 'accepter',
          avatar: 'avatar2.jpg'
        }
      });
    });

    it('should emit friend declined event to requester only', () => {
      const spy = vi.spyOn(friendshipEventManager, 'emitToUser');
      
      emitFriendDeclined('user2', 'user1', 'friendship1', {
        username: 'decliner'
      });
      
      expect(spy).toHaveBeenCalledWith('user1', {
        type: 'friend_declined',
        userId: 'user2',
        friendId: 'user1',
        friendshipId: 'friendship1',
        timestamp: expect.any(Date),
        metadata: {
          username: 'decliner'
        }
      });
    });

    it('should emit friend blocked event to blocker only', () => {
      const spy = vi.spyOn(friendshipEventManager, 'emitToUser');
      
      emitFriendBlocked('user1', 'user2', 'friendship1', {
        username: 'blocked_user'
      });
      
      expect(spy).toHaveBeenCalledWith('user1', {
        type: 'friend_blocked',
        userId: 'user1',
        friendId: 'user2',
        friendshipId: 'friendship1',
        timestamp: expect.any(Date),
        metadata: {
          username: 'blocked_user'
        }
      });
    });

    it('should emit friend unfriended event to unfriender only', () => {
      const spy = vi.spyOn(friendshipEventManager, 'emitToUser');
      
      emitFriendUnfriended('user1', 'user2', 'friendship1', {
        username: 'unfriended_user'
      });
      
      expect(spy).toHaveBeenCalledWith('user1', {
        type: 'friend_unfriended',
        userId: 'user1',
        friendId: 'user2',
        friendshipId: 'friendship1',
        timestamp: expect.any(Date),
        metadata: {
          username: 'unfriended_user'
        }
      });
    });

    it('should emit friend role changed event to both users', () => {
      const spy = vi.spyOn(friendshipEventManager, 'emitToBothUsers');
      
      emitFriendRoleChanged('user1', 'user2', 'friendship1', 'viewer', 'editor', {
        username: 'friend_user'
      });
      
      expect(spy).toHaveBeenCalledWith({
        type: 'friend_role_changed',
        userId: 'user1',
        friendId: 'user2',
        friendshipId: 'friendship1',
        timestamp: expect.any(Date),
        metadata: {
          username: 'friend_user',
          oldRole: 'viewer',
          newRole: 'editor'
        }
      });
    });
  });
});

describe('Friendship Events - Analytics Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Friend Request Analytics', () => {
    it('should track friend request sent event', () => {
      trackFriendRequestSent('user1', 'user2', {
        senderUsername: 'sender',
        receiverUsername: 'receiver',
        source: 'search'
      });
      
      expect(analytics.track).toHaveBeenCalledWith({
        event: 'friend_request_sent',
        distinctId: 'user1',
        properties: {
          receiver_id: 'user2',
          sender_username: 'sender',
          receiver_username: 'receiver',
          source: 'search',
          timestamp: expect.any(String)
        }
      });
    });

    it('should track friend accepted event with time to accept', () => {
      trackFriendAccepted('user2', 'user1', {
        accepterUsername: 'accepter',
        requesterUsername: 'requester',
        timeToAccept: 3600000 // 1 hour
      });
      
      expect(analytics.track).toHaveBeenCalledWith({
        event: 'friend_accepted',
        distinctId: 'user2',
        properties: {
          requester_id: 'user1',
          accepter_username: 'accepter',
          requester_username: 'requester',
          time_to_accept_ms: 3600000,
          timestamp: expect.any(String)
        }
      });
    });

    it('should track friend declined event with time to decline', () => {
      trackFriendDeclined('user2', 'user1', {
        declinerUsername: 'decliner',
        requesterUsername: 'requester',
        timeToDecline: 1800000 // 30 minutes
      });
      
      expect(analytics.track).toHaveBeenCalledWith({
        event: 'friend_declined',
        distinctId: 'user2',
        properties: {
          requester_id: 'user1',
          decliner_username: 'decliner',
          requester_username: 'requester',
          time_to_decline_ms: 1800000,
          timestamp: expect.any(String)
        }
      });
    });
  });

  describe('Friend Management Analytics', () => {
    it('should track friend blocked event with previous status', () => {
      trackFriendBlocked('user1', 'user2', {
        blockerUsername: 'blocker',
        blockedUsername: 'blocked',
        previousStatus: 'accepted',
        reason: 'spam'
      });
      
      expect(analytics.track).toHaveBeenCalledWith({
        event: 'friend_blocked',
        distinctId: 'user1',
        properties: {
          blocked_id: 'user2',
          blocker_username: 'blocker',
          blocked_username: 'blocked',
          previous_status: 'accepted',
          reason: 'spam',
          timestamp: expect.any(String)
        }
      });
    });

    it('should track friend unfriended event with friendship duration', () => {
      trackFriendUnfriended('user1', 'user2', {
        unfrienderUsername: 'unfriender',
        unfriendedUsername: 'unfriended',
        friendshipDuration: 86400000, // 1 day
        reason: 'inactive'
      });
      
      expect(analytics.track).toHaveBeenCalledWith({
        event: 'friend_unfriended',
        distinctId: 'user1',
        properties: {
          unfriended_id: 'user2',
          unfriender_username: 'unfriender',
          unfriended_username: 'unfriended',
          friendship_duration_ms: 86400000,
          reason: 'inactive',
          timestamp: expect.any(String)
        }
      });
    });

    it('should track friend role changed event', () => {
      trackFriendRoleChanged('user1', 'user2', 'viewer', 'editor', {
        changerUsername: 'changer',
        friendUsername: 'friend',
        context: 'individual_change'
      });
      
      expect(analytics.track).toHaveBeenCalledWith({
        event: 'friend_role_changed',
        distinctId: 'user1',
        properties: {
          friend_id: 'user2',
          old_role: 'viewer',
          new_role: 'editor',
          changer_username: 'changer',
          friend_username: 'friend',
          context: 'individual_change',
          timestamp: expect.any(String)
        }
      });
    });
  });

  describe('Analytics Edge Cases', () => {
    it('should handle missing metadata gracefully', () => {
      trackFriendRequestSent('user1', 'user2');
      
      expect(analytics.track).toHaveBeenCalledWith({
        event: 'friend_request_sent',
        distinctId: 'user1',
        properties: {
          receiver_id: 'user2',
          sender_username: undefined,
          receiver_username: undefined,
          source: 'unknown',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle undefined time values', () => {
      trackFriendAccepted('user2', 'user1', {
        accepterUsername: 'accepter',
        requesterUsername: 'requester'
        // timeToAccept is undefined
      });
      
      expect(analytics.track).toHaveBeenCalledWith({
        event: 'friend_accepted',
        distinctId: 'user2',
        properties: {
          requester_id: 'user1',
          accepter_username: 'accepter',
          requester_username: 'requester',
          time_to_accept_ms: undefined,
          timestamp: expect.any(String)
        }
      });
    });
  });
});

describe('Friendship Events - Integration', () => {
  it('should emit events and track analytics together', () => {
    const emitSpy = vi.spyOn(friendshipEventManager, 'emitToBothUsers');
    
    // This would typically be called from the API endpoint
    emitFriendRequestSent('user1', 'user2', 'friendship1', {
      username: 'receiver'
    });
    
    trackFriendRequestSent('user1', 'user2', {
      senderUsername: 'sender',
      receiverUsername: 'receiver',
      source: 'search'
    });
    
    // Verify both event emission and analytics tracking occurred
    expect(emitSpy).toHaveBeenCalled();
    expect(analytics.track).toHaveBeenCalled();
  });

  it('should handle role change events with proper old/new role tracking', () => {
    const emitSpy = vi.spyOn(friendshipEventManager, 'emitToBothUsers');
    
    emitFriendRoleChanged('user1', 'user2', 'friendship1', 'viewer', 'contributor', {
      username: 'friend'
    });
    
    trackFriendRoleChanged('user1', 'user2', 'viewer', 'contributor', {
      changerUsername: 'changer',
      friendUsername: 'friend'
    });
    
    // Verify event contains role change information
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'friend_role_changed',
        metadata: expect.objectContaining({
          oldRole: 'viewer',
          newRole: 'contributor'
        })
      })
    );
    
    // Verify analytics contains role change information
    expect(analytics.track).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'friend_role_changed',
        properties: expect.objectContaining({
          old_role: 'viewer',
          new_role: 'contributor'
        })
      })
    );
  });
});