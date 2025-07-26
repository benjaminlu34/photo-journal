/**
 * Friendship Events Integration Tests
 * 
 * Integration tests for the complete friendship event flow including
 * API endpoints, WebSocket events, and analytics tracking.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../../server/routes';
import { storage } from '../../../server/storage';
import { db } from '../../../server/db';
import { users, friendships } from '../../../shared/schema/schema';
import { randomUUID } from 'crypto';
import { 
  emitFriendRequestSent,
  emitFriendAccepted,
  emitFriendDeclined,
  emitFriendBlocked,
  emitFriendUnfriended,
  emitFriendRoleChanged
} from '../../../server/utils/friendship-events';
import { 
  trackFriendRequestSent,
  trackFriendAccepted,
  trackFriendDeclined,
  trackFriendBlocked,
  trackFriendUnfriended,
  trackFriendRoleChanged
} from '../../../server/utils/analytics';

// Mock authentication middleware
vi.mock('../../../server/middleware/auth', () => ({
  isAuthenticatedSupabase: (req: any, _res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const userId = authHeader.split(' ')[1];
      req.user = { id: userId, email: `${userId}@test.com`, username: `user_${userId}` };
    }
    next();
  }
}));

// Mock rate limiting middleware
vi.mock('../../../server/middleware/rateLimit', () => ({
  friendRequestRateLimit: (_req: any, _res: any, next: any) => next(),
  friendManagementRateLimit: (_req: any, _res: any, next: any) => next(),
  usernameCheckRateLimit: (_req: any, _res: any, next: any) => next(),
  userSearchRateLimit: (_req: any, _res: any, next: any) => next(),
  usernameChangeRateLimit: (_req: any, _res: any, next: any) => next(),
  sharingRateLimit: (_req: any, _res: any, next: any) => next(),
  friendshipInputValidation: (_req: any, _res: any, next: any) => next(),
  blockedUserSecurityCheck: (_req: any, _res: any, next: any) => next(),
  enhancedFriendMutationsRateLimit: (_req: any, _res: any, next: any) => next(),
  enhancedSearchRateLimit: (_req: any, _res: any, next: any) => next(),
  enhancedSharingRateLimit: (_req: any, _res: any, next: any) => next(),
  roleChangeAuditMiddleware: (_req: any, _res: any, next: any) => next()
}));

// Mock event emission functions
vi.mock('../../../server/utils/friendship-events', async () => {
  const actual = await vi.importActual('../../../server/utils/friendship-events');
  return {
    ...actual,
    emitFriendRequestSent: vi.fn(),
    emitFriendAccepted: vi.fn(),
    emitFriendDeclined: vi.fn(),
    emitFriendBlocked: vi.fn(),
    emitFriendUnfriended: vi.fn(),
    emitFriendRoleChanged: vi.fn()
  };
});

// Mock analytics tracking functions
vi.mock('../../../server/utils/analytics', () => ({
  analytics: {
    track: vi.fn(),
    identify: vi.fn()
  },
  trackFriendRequestSent: vi.fn(),
  trackFriendAccepted: vi.fn(),
  trackFriendDeclined: vi.fn(),
  trackFriendBlocked: vi.fn(),
  trackFriendUnfriended: vi.fn(),
  trackFriendRoleChanged: vi.fn()
}));

import { setupTestDB, teardownTestDB } from '../../test-utils';

describe('Friendship Events Integration Tests', () => {
  let app: express.Express;
  let server: any;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Clean up database
    await db.delete(friendships);
    await db.delete(users);

    // Create test users
    user1Id = randomUUID();
    user2Id = randomUUID();

    await db.insert(users).values([
      {
        id: user1Id,
        email: `${user1Id}@test.com`,
        username: `user_${user1Id.slice(0, 8)}`,
        firstName: 'User',
        lastName: 'One',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: user2Id,
        email: `${user2Id}@test.com`,
        username: `user_${user2Id.slice(0, 8)}`,
        firstName: 'User',
        lastName: 'Two',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    // Setup Express app
    app = express();
    server = await registerRoutes(app);
  });

  afterEach(async () => {
    // Clean up database
    await db.delete(friendships);
    await db.delete(users);
    
    if (server && server.close) {
      server.close();
    }
  });

  describe('Friend Request Events', () => {
    it('should emit events and track analytics when sending friend request', async () => {
      const targetUsername = `user_${user2Id.slice(0, 8)}`;
      
      const response = await request(app)
        .post(`/api/friends/${targetUsername}/request`)
        .set('Authorization', `Bearer ${user1Id}`)
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'pending',
        targetUser: {
          id: user2Id,
          username: targetUsername
        }
      });

      // Verify event emission was called
      expect(emitFriendRequestSent).toHaveBeenCalledWith(
        user1Id,
        user2Id,
        expect.any(String), // friendshipId
        {
          username: targetUsername,
          avatar: undefined
        }
      );

      // Verify analytics tracking was called
      expect(trackFriendRequestSent).toHaveBeenCalledWith(
        user1Id,
        user2Id,
        {
          senderUsername: `user_${user1Id.slice(0, 8)}`,
          receiverUsername: targetUsername,
          source: 'username_search'
        }
      );
    });

    it('should emit events and track analytics when accepting friend request', async () => {
      // First create a friendship
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1Id,
        user2Id,
        user1Id
      );

      // Clear mocks from the creation
      vi.clearAllMocks();

      const response = await request(app)
        .patch(`/api/friends/${friendship.id}/accept`)
        .set('Authorization', `Bearer ${user2Id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'accepted'
      });

      // Verify event emission was called
      expect(emitFriendAccepted).toHaveBeenCalledWith(
        user2Id,
        user1Id,
        friendship.id,
        {
          username: `user_${user1Id.slice(0, 8)}`,
          avatar: undefined
        }
      );

      // Verify analytics tracking was called
      expect(trackFriendAccepted).toHaveBeenCalledWith(
        user2Id,
        user1Id,
        {
          accepterUsername: `user_${user2Id.slice(0, 8)}`,
          requesterUsername: `user_${user1Id.slice(0, 8)}`,
          timeToAccept: expect.any(Number)
        }
      );
    });

    it('should emit events and track analytics when declining friend request', async () => {
      // First create a friendship
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1Id,
        user2Id,
        user1Id
      );

      // Clear mocks from the creation
      vi.clearAllMocks();

      const response = await request(app)
        .patch(`/api/friends/${friendship.id}/decline`)
        .set('Authorization', `Bearer ${user2Id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'declined'
      });

      // Verify event emission was called
      expect(emitFriendDeclined).toHaveBeenCalledWith(
        user2Id,
        user1Id,
        friendship.id,
        {
          username: `user_${user1Id.slice(0, 8)}`,
          avatar: undefined
        }
      );

      // Verify analytics tracking was called
      expect(trackFriendDeclined).toHaveBeenCalledWith(
        user2Id,
        user1Id,
        {
          declinerUsername: `user_${user2Id.slice(0, 8)}`,
          requesterUsername: `user_${user1Id.slice(0, 8)}`,
          timeToDecline: expect.any(Number)
        }
      );
    });
  });

  describe('Friend Management Events', () => {
    it('should emit events and track analytics when blocking user', async () => {
      // First create and accept a friendship
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1Id,
        user2Id,
        user1Id
      );
      
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'accepted', user2Id);

      // Clear mocks from the setup
      vi.clearAllMocks();

      const response = await request(app)
        .patch(`/api/friends/${friendship.id}/block`)
        .set('Authorization', `Bearer ${user1Id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'blocked'
      });

      // Verify event emission was called
      expect(emitFriendBlocked).toHaveBeenCalledWith(
        user1Id,
        user2Id,
        friendship.id,
        {
          username: `user_${user2Id.slice(0, 8)}`,
          avatar: undefined
        }
      );

      // Verify analytics tracking was called
      expect(trackFriendBlocked).toHaveBeenCalledWith(
        user1Id,
        user2Id,
        {
          blockerUsername: `user_${user1Id.slice(0, 8)}`,
          blockedUsername: `user_${user2Id.slice(0, 8)}`,
          previousStatus: 'accepted'
        }
      );
    });

    it('should emit events and track analytics when unfriending user', async () => {
      // First create and accept a friendship
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1Id,
        user2Id,
        user1Id
      );
      
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'accepted', user2Id);

      // Clear mocks from the setup
      vi.clearAllMocks();

      const response = await request(app)
        .delete(`/api/friends/${friendship.id}`)
        .set('Authorization', `Bearer ${user1Id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'unfriended',
        message: 'Successfully unfriended user'
      });

      // Verify event emission was called
      expect(emitFriendUnfriended).toHaveBeenCalledWith(
        user1Id,
        user2Id,
        friendship.id,
        {
          username: `user_${user2Id.slice(0, 8)}`,
          avatar: undefined
        }
      );

      // Verify analytics tracking was called
      expect(trackFriendUnfriended).toHaveBeenCalledWith(
        user1Id,
        user2Id,
        {
          unfrienderUsername: `user_${user1Id.slice(0, 8)}`,
          unfriendedUsername: `user_${user2Id.slice(0, 8)}`,
          friendshipDuration: expect.any(Number)
        }
      );
    });

    it('should emit events and track analytics when changing friend role', async () => {
      // First create and accept a friendship
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1Id,
        user2Id,
        user1Id
      );
      
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'accepted', user2Id);

      // Clear mocks from the setup
      vi.clearAllMocks();

      const response = await request(app)
        .patch(`/api/friends/${friendship.id}/role`)
        .set('Authorization', `Bearer ${user1Id}`)
        .send({ role: 'editor' })
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'accepted',
        roleUserToFriend: 'editor'
      });

      // Verify event emission was called
      expect(emitFriendRoleChanged).toHaveBeenCalledWith(
        user1Id,
        user2Id,
        friendship.id,
        'viewer', // Default old role
        'editor',
        {
          username: `user_${user2Id.slice(0, 8)}`,
          avatar: undefined
        }
      );

      // Verify analytics tracking was called
      expect(trackFriendRoleChanged).toHaveBeenCalledWith(
        user1Id,
        user2Id,
        'viewer', // Default old role
        'editor',
        {
          changerUsername: `user_${user1Id.slice(0, 8)}`,
          friendUsername: `user_${user2Id.slice(0, 8)}`,
          context: 'individual_change'
        }
      );
    });
  });

  describe('Event Emission Error Handling', () => {
    it('should continue API operation even if event emission fails', async () => {
      // Mock event emission to throw an error
      (emitFriendRequestSent as any).mockImplementation(() => {
        throw new Error('WebSocket error');
      });

      const targetUsername = `user_${user2Id.slice(0, 8)}`;
      
      // API should still succeed despite event emission failure
      const response = await request(app)
        .post(`/api/friends/${targetUsername}/request`)
        .set('Authorization', `Bearer ${user1Id}`)
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'pending'
      });

      // Verify the friendship was still created in the database
      const friendship = await storage.getFriendship(user1Id, user2Id);
      expect(friendship).toBeDefined();
      expect(friendship?.status).toBe('pending');
    });

    it('should continue API operation even if analytics tracking fails', async () => {
      // Mock analytics tracking to throw an error
      (trackFriendRequestSent as any).mockImplementation(() => {
        throw new Error('Analytics error');
      });

      const targetUsername = `user_${user2Id.slice(0, 8)}`;
      
      // API should still succeed despite analytics failure
      const response = await request(app)
        .post(`/api/friends/${targetUsername}/request`)
        .set('Authorization', `Bearer ${user1Id}`)
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'pending'
      });

      // Verify the friendship was still created in the database
      const friendship = await storage.getFriendship(user1Id, user2Id);
      expect(friendship).toBeDefined();
      expect(friendship?.status).toBe('pending');
    });
  });
});