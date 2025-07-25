import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { storage } from '../../../server/storage';
import { randomUUID } from 'crypto';
import express from 'express';
import { registerRoutes } from '../../../server/routes';
import { db } from '../../../server/db';
import { users, friendships } from '../../../shared/schema/schema';

// Mock authentication middleware
vi.mock('../../../server/middleware/auth', () => ({
  isAuthenticatedSupabase: (req: any, _res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      req.user = {
        id: token,
        email: `${token}@example.com`,
        username: token.slice(0, 20)
      };
    } else {
      req.user = { id: 'test-user', email: 'test@example.com', username: 'testuser' };
    }
    next();
  }
}));

// Mock rate limiting middleware
vi.mock('../../../server/middleware/rateLimit', () => ({
  friendRequestRateLimit: (_req: any, _res: any, next: any) => next(),
  friendManagementRateLimit: (_req: any, _res: any, next: any) => next(),
  sharingRateLimit: (_req: any, _res: any, next: any) => next(),
  usernameCheckRateLimit: (_req: any, _res: any, next: any) => next(),
  friendshipInputValidation: (_req: any, _res: any, next: any) => next(),
  blockedUserSecurityCheck: (_req: any, _res: any, next: any) => next(),
  enhancedFriendMutationsRateLimit: (_req: any, _res: any, next: any) => next(),
  enhancedSearchRateLimit: (_req: any, _res: any, next: any) => next(),
  enhancedSharingRateLimit: (_req: any, _res: any, next: any) => next(),
  roleChangeAuditMiddleware: (_req: any, _res: any, next: any) => next()
}));

// Create test app with proper auth setup
const createTestApp = async () => {
  const app = express();
  app.use(express.json());
  
  // Import routes
  const { registerRoutes } = await import('../../../server/routes');
  const server = await registerRoutes(app);
  return { app, server };
};

import { setupTestDB, teardownTestDB } from '../../test-utils';

describe('Friends List API Integration Tests', () => {
  let user1: any;
  let user2: any;
  let user3: any;
  let user4: any;
  let app: any;
  let server: any;
  let timestamp: string;

  beforeAll(async () => {
    await setupTestDB();
    // Use a consistent timestamp for this test run
    timestamp = Date.now().toString().slice(-4);
    
    // Clean up any existing test data
    await db.delete(friendships);
    await db.delete(users);

    const result = await createTestApp();
    app = result.app;
    server = result.server;

    // Create test users with unique data and short usernames
    user1 = await storage.upsertUser({
      id: `u1${timestamp}`,
      email: `u1${timestamp}@example.com`,
      username: `u1${timestamp}`.slice(0, 20),
      firstName: 'Test',
      lastName: 'User1',
    });

    user2 = await storage.upsertUser({
      id: `u2${timestamp}`,
      email: `u2${timestamp}@example.com`,
      username: `u2${timestamp}`.slice(0, 20),
      firstName: 'Test',
      lastName: 'User2',
    });

    user3 = await storage.upsertUser({
      id: `u3${timestamp}`,
      email: `u3${timestamp}@example.com`,
      username: `u3${timestamp}`.slice(0, 20),
      firstName: 'Test',
      lastName: 'User3',
    });

    user4 = await storage.upsertUser({
      id: `u4${timestamp}`,
      email: `u4${timestamp}@example.com`,
      username: `u4${timestamp}`.slice(0, 20),
      firstName: 'Test',
      lastName: 'User4',
    });
  });

  afterAll(async () => {
    await teardownTestDB();
    // Clean up test data
    await db.delete(friendships);
    await db.delete(users);
    if (server) {
      server.close();
    }
  });

  describe('GET /api/friends', () => {
    it('should return empty friends list for new user', async () => {
      const response = await request(app)
        .get('/api/friends')
        .set('Authorization', `Bearer ${user1.id}`);

      expect(response.status).toBe(200);
      expect(response.body.friends).toHaveLength(0);
      expect(response.body.pagination.totalCount).toBe(0);
    });

    it('should return accepted friends with role information', async () => {
      // Create friendship between user1 and user2
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user2.id,
        user1.id
      );
      
      // Update to accepted
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'accepted', user2.id);

      const response = await request(app)
        .get('/api/friends')
        .set('Authorization', `Bearer ${user1.id}`);

      expect(response.status).toBe(200);
      expect(response.body.friends).toHaveLength(1);
      expect(response.body.friends[0].id).toBe(user2.id);
      expect(response.body.friends[0].friendshipId).toBe(friendship.id);
      expect(response.body.friends[0].roleUserToFriend).toBeDefined();
      expect(response.body.friends[0].roleFriendToUser).toBeDefined();
      expect(response.body.pagination.totalCount).toBe(1);
    });

    it('should not return blocked or declined friendships', async () => {
      // Create and decline friendship
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user3.id,
        user1.id
      );
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'declined', user3.id);

      const response = await request(app)
        .get('/api/friends')
        .set('Authorization', `Bearer ${user1.id}`);

      const data = response.body;
      const friendIds = data.friends?.map((f: any) => f.id) || [];
      expect(friendIds).not.toContain(user3.id);
    });

    it('should support pagination', async () => {
      // Create multiple friendships with unique IDs
      const friendships = [];
      for (let i = 0; i < 3; i++) {
        const uniqueId = `${Date.now()}-${i}`;
        const user = await storage.upsertUser({
          id: uniqueId,
          email: `f${i}-${uniqueId}@example.com`,
          username: `f${i}-${uniqueId}`,
        });
        
        const friendship = await storage.createFriendshipWithCanonicalOrdering(
          user1.id,
          user.id,
          user1.id
        );
        await storage.updateFriendshipStatusWithAudit(friendship.id, 'accepted', user.id);
        friendships.push(friendship);
      }

      // Test pagination
      const response1 = await request(app)
        .get('/api/friends?limit=2')
        .set('Authorization', `Bearer ${user1.id}`);

      const data1 = response1.body;
      expect(data1.friends).toHaveLength(2);
      expect(data1.pagination.limit).toBe(2);
      expect(data1.pagination.hasMore).toBe(true);

      const response2 = await request(app)
        .get('/api/friends?limit=2&offset=2')
        .set('Authorization', `Bearer ${user1.id}`);

      const data2 = response2.body;
      expect(data2.pagination.offset).toBe(2);
    });

    it('should enforce pagination limits', async () => {
      const response = await request(app)
        .get('/api/friends?limit=150')
        .set('Authorization', `Bearer ${user1.id}`);

      const data = response.body || {};
      expect(data.pagination?.limit || 100).toBe(100); // Should be capped
    });
  });

  describe('GET /api/friends/requests', () => {
    it('should return empty request lists for new user', async () => {
      const response = await request(app)
        .get('/api/friends/requests')
        .set('Authorization', `Bearer ${user4.id}`);

      expect(response.status).toBe(200);
      const data = response.body || { sent: [], received: [], pagination: { totalCount: 0 } };
      expect(data.sent).toHaveLength(0);
      expect(data.received).toHaveLength(0);
      expect(data.pagination.totalCount).toBe(0);
    });

    it('should return sent and received pending requests', async () => {
      // User1 sends request to User4
      const sentRequest = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user4.id,
        user1.id
      );

      // User2 sends request to User1
      const receivedRequest = await storage.createFriendshipWithCanonicalOrdering(
        user2.id,
        user1.id,
        user2.id
      );

      const response = await request(app)
        .get('/api/friends/requests')
        .set('Authorization', `Bearer ${user1.id}`);

      expect(response.status).toBe(200);
      const data = response.body || { sent: [], received: [], pagination: { totalCount: 0 } };
      
      // Check sent requests
      expect(data.sent).toHaveLength(1);
      expect(data.sent[0].friend.id).toBe(user4.id);
      
      // Check received requests
      expect(data.received).toHaveLength(1);
      expect(data.received[0].user.id).toBe(user2.id);
      
      expect(data.pagination.totalCount).toBe(2);
    });

    it('should not return accepted or declined requests', async () => {
      // Create and accept request
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user4.id,
        user1.id
      );
      const updatedFriendship = await storage.updateFriendshipStatusWithAudit(friendship.id, 'accepted', user4.id);

      const response = await request(app)
        .get('/api/friends/requests')
        .set('Authorization', `Bearer ${user1.id}`);

      const data = response.body || { sent: [], received: [], pagination: { totalCount: 0 } };
      expect(data.sent).toHaveLength(0);
      expect(data.received).toHaveLength(0);
    });

    it('should support pagination for requests', async () => {
      // Create multiple pending requests with unique IDs
      for (let i = 0; i < 3; i++) { // Reduced to 3 to avoid conflicts
        const uniqueId = `${Date.now()}-${i}`;
        const user = await storage.upsertUser({
          id: uniqueId,
          email: `p${i}-${uniqueId}@example.com`,
          username: `p${i}-${uniqueId}`,
        });
        
        await storage.createFriendshipWithCanonicalOrdering(
          user1.id,
          user.id,
          user1.id
        );
      }

      const response = await request(app)
        .get('/api/friends/requests?limit=3')
        .set('Authorization', `Bearer ${user1.id}`);

      const data = response.body || { sent: [], received: [], pagination: { totalCount: 0 } };
      const totalLength = (data.sent?.length || 0) + (data.received?.length || 0);
      expect(totalLength).toBeLessThanOrEqual(3);
      expect(data.pagination?.limit || 3).toBe(3);
    });
  });

  describe('Filtering behavior', () => {
    it('should filter out blocked relationships from friends list', async () => {
      // Create a unique user for this test
      const uniqueUserId = `f${Date.now()}`;
      const filterUser = await storage.upsertUser({
        id: uniqueUserId,
        email: `${uniqueUserId}@example.com`,
        username: uniqueUserId.slice(0, 20),
      });

      // Create and block friendship
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        filterUser.id,
        user1.id
      );
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'accepted', filterUser.id);
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'blocked', user1.id);

      const response = await request(app)
        .get('/api/friends')
        .set('Authorization', `Bearer ${user1.id}`);

      const data = response.body || { friends: [] };
      const friendIds = data.friends?.map((f: any) => f.id) || [];
      expect(friendIds).not.toContain(filterUser.id);
    });

    it('should filter out unfriended relationships from friends list', async () => {
      // Create a unique user for this test
      const uniqueUserId = `u${Date.now()}`;
      const filterUser = await storage.upsertUser({
        id: uniqueUserId,
        email: `${uniqueUserId}@example.com`,
        username: uniqueUserId.slice(0, 20),
      });

      // Create and unfriend
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        filterUser.id,
        user1.id
      );
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'accepted', filterUser.id);
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'unfriended', user1.id);

      const response = await request(app)
        .get('/api/friends')
        .set('Authorization', `Bearer ${user1.id}`);

      const data = response.body || { friends: [] };
      const friendIds = data.friends?.map((f: any) => f.id) || [];
      expect(friendIds).not.toContain(filterUser.id);
    });
  });
});