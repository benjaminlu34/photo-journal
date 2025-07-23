import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import { registerRoutes } from '../../../server/routes';
import { storage } from '../../../server/storage';
import { vi, describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';

// Mock authentication middleware
vi.mock('../../../server/middleware/auth', () => ({
  isAuthenticatedSupabase: (req: any, _res: any, next: any) => {
    req.user = {
      id: req.headers['x-user-id'] || 'test-user-id',
      email: 'test@example.com',
      username: req.headers['x-username'] || 'testuser'
    };
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
  sharingRateLimit: (_req: any, _res: any, next: any) => next()
}));

// Mock storage methods
vi.mock('../../../server/storage', () => {
  return {
    storage: {
      getUserByUsername: vi.fn(),
      canSendFriendRequestTo: vi.fn(),
      createFriendshipWithCanonicalOrdering: vi.fn(),
      getFriendshipById: vi.fn(),
      updateFriendshipStatusWithAudit: vi.fn(),
      updateFriendshipRole: vi.fn(),
      getFriendship: vi.fn(),
      getUser: vi.fn()
    }
  };
});

describe('Friend Management API', () => {
  let app: express.Express;
  let server: ReturnType<typeof createServer>;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/friends/:username/request', () => {
    it('should send a friend request successfully', async () => {
      const userId = 'user-123';
      const targetUserId = 'user-456';
      const targetUsername = 'targetuser';

      // Mock getUserByUsername
      (storage.getUserByUsername as any).mockResolvedValue({
        id: targetUserId,
        username: targetUsername,
        firstName: 'Target',
        lastName: 'User'
      });

      // Mock canSendFriendRequestTo
      (storage.canSendFriendRequestTo as any).mockResolvedValue(true);

      // Mock createFriendshipWithCanonicalOrdering
      (storage.createFriendshipWithCanonicalOrdering as any).mockResolvedValue({
        id: 'friendship-123',
        userId: userId,
        friendId: targetUserId,
        status: 'pending',
        initiatorId: userId,
        createdAt: new Date()
      });

      const response = await request(app)
        .post(`/api/friends/${targetUsername}/request`)
        .set('x-user-id', userId)
        .expect(201);

      expect(response.body).toHaveProperty('id', 'friendship-123');
      expect(response.body).toHaveProperty('status', 'pending');
      expect(response.body.targetUser).toHaveProperty('id', targetUserId);
      expect(response.body.targetUser).toHaveProperty('username', targetUsername);

      expect(storage.getUserByUsername).toHaveBeenCalledWith(targetUsername);
      expect(storage.canSendFriendRequestTo).toHaveBeenCalledWith(userId, targetUserId);
      expect(storage.createFriendshipWithCanonicalOrdering).toHaveBeenCalledWith(
        userId, targetUserId, userId
      );
    });

    it('should prevent sending friend request to self', async () => {
      const userId = 'user-123';
      const username = 'testuser';

      // Mock getUserByUsername to return the same user
      (storage.getUserByUsername as any).mockResolvedValue({
        id: userId,
        username: username
      });

      const response = await request(app)
        .post(`/api/friends/${username}/request`)
        .set('x-user-id', userId)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Cannot send friend request to yourself');
      expect(storage.createFriendshipWithCanonicalOrdering).not.toHaveBeenCalled();
    });

    it('should handle user not found', async () => {
      // Mock getUserByUsername to return null
      (storage.getUserByUsername as any).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/friends/nonexistentuser/request')
        .set('x-user-id', 'user-123')
        .expect(404);

      expect(response.body).toHaveProperty('message', 'User not found');
      expect(storage.createFriendshipWithCanonicalOrdering).not.toHaveBeenCalled();
    });

    it('should prevent duplicate friend requests', async () => {
      const userId = 'user-123';
      const targetUserId = 'user-456';
      const targetUsername = 'targetuser';

      // Mock getUserByUsername
      (storage.getUserByUsername as any).mockResolvedValue({
        id: targetUserId,
        username: targetUsername
      });

      // Mock canSendFriendRequestTo to return false
      (storage.canSendFriendRequestTo as any).mockResolvedValue(false);

      // Mock getFriendship to return a pending friendship
      (storage.getFriendship as any).mockResolvedValue({
        status: 'pending'
      });

      const response = await request(app)
        .post(`/api/friends/${targetUsername}/request`)
        .set('x-user-id', userId)
        .expect(409);

      expect(response.body).toHaveProperty('message', 'Friend request already pending');
      expect(storage.createFriendshipWithCanonicalOrdering).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/friends/:friendshipId/accept', () => {
    it('should accept a friend request successfully', async () => {
      const userId = 'user-123';
      const friendId = 'user-456';
      const friendshipId = 'friendship-123';

      // Mock getFriendshipById
      (storage.getFriendshipById as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'pending',
        initiatorId: friendId // Friend initiated the request
      });

      // Mock updateFriendshipStatusWithAudit
      (storage.updateFriendshipStatusWithAudit as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'accepted',
        updatedAt: new Date()
      });

      // Mock getUser for friend info
      (storage.getUser as any).mockResolvedValue({
        id: friendId,
        username: 'frienduser',
        firstName: 'Friend',
        lastName: 'User'
      });

      const response = await request(app)
        .patch(`/api/friends/${friendshipId}/accept`)
        .set('x-user-id', userId)
        .expect(200);

      expect(response.body).toHaveProperty('id', friendshipId);
      expect(response.body).toHaveProperty('status', 'accepted');
      expect(response.body.friend).toHaveProperty('id', friendId);
      expect(response.body.friend).toHaveProperty('username', 'frienduser');

      expect(storage.getFriendshipById).toHaveBeenCalledWith(friendshipId);
      expect(storage.updateFriendshipStatusWithAudit).toHaveBeenCalledWith(
        friendshipId, 'accepted', userId
      );
    });

    it('should prevent accepting own friend request', async () => {
      const userId = 'user-123';
      const friendId = 'user-456';
      const friendshipId = 'friendship-123';

      // Mock getFriendshipById where user is the initiator
      (storage.getFriendshipById as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'pending',
        initiatorId: userId // User initiated the request
      });

      const response = await request(app)
        .patch(`/api/friends/${friendshipId}/accept`)
        .set('x-user-id', userId)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Cannot accept your own friend request');
      expect(storage.updateFriendshipStatusWithAudit).not.toHaveBeenCalled();
    });

    it('should handle non-pending friendship status', async () => {
      const userId = 'user-123';
      const friendId = 'user-456';
      const friendshipId = 'friendship-123';

      // Mock getFriendshipById with non-pending status
      (storage.getFriendshipById as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'accepted', // Already accepted
        initiatorId: friendId
      });

      const response = await request(app)
        .patch(`/api/friends/${friendshipId}/accept`)
        .set('x-user-id', userId)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Cannot accept friend request with status: accepted');
      expect(storage.updateFriendshipStatusWithAudit).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/friends/:friendshipId/decline', () => {
    it('should decline a friend request successfully', async () => {
      const userId = 'user-123';
      const friendId = 'user-456';
      const friendshipId = 'friendship-123';

      // Mock getFriendshipById
      (storage.getFriendshipById as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'pending',
        initiatorId: friendId // Friend initiated the request
      });

      // Mock updateFriendshipStatusWithAudit
      (storage.updateFriendshipStatusWithAudit as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'declined',
        updatedAt: new Date()
      });

      const response = await request(app)
        .patch(`/api/friends/${friendshipId}/decline`)
        .set('x-user-id', userId)
        .expect(200);

      expect(response.body).toHaveProperty('id', friendshipId);
      expect(response.body).toHaveProperty('status', 'declined');

      expect(storage.getFriendshipById).toHaveBeenCalledWith(friendshipId);
      expect(storage.updateFriendshipStatusWithAudit).toHaveBeenCalledWith(
        friendshipId, 'declined', userId
      );
    });
  });

  describe('PATCH /api/friends/:friendshipId/block', () => {
    it('should block a user successfully', async () => {
      const userId = 'user-123';
      const friendId = 'user-456';
      const friendshipId = 'friendship-123';

      // Mock getFriendshipById
      (storage.getFriendshipById as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'accepted',
        initiatorId: friendId
      });

      // Mock updateFriendshipStatusWithAudit
      (storage.updateFriendshipStatusWithAudit as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'blocked',
        updatedAt: new Date()
      });

      const response = await request(app)
        .patch(`/api/friends/${friendshipId}/block`)
        .set('x-user-id', userId)
        .expect(200);

      expect(response.body).toHaveProperty('id', friendshipId);
      expect(response.body).toHaveProperty('status', 'blocked');

      expect(storage.getFriendshipById).toHaveBeenCalledWith(friendshipId);
      expect(storage.updateFriendshipStatusWithAudit).toHaveBeenCalledWith(
        friendshipId, 'blocked', userId
      );
    });

    it('should prevent blocking an already blocked user', async () => {
      const userId = 'user-123';
      const friendId = 'user-456';
      const friendshipId = 'friendship-123';

      // Mock getFriendshipById with already blocked status
      (storage.getFriendshipById as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'blocked',
        initiatorId: userId
      });

      const response = await request(app)
        .patch(`/api/friends/${friendshipId}/block`)
        .set('x-user-id', userId)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'User is already blocked');
      expect(storage.updateFriendshipStatusWithAudit).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/friends/:friendshipId/role', () => {
    it('should update friend role successfully', async () => {
      const userId = 'user-123';
      const friendId = 'user-456';
      const friendshipId = 'friendship-123';

      // Mock getFriendshipById
      (storage.getFriendshipById as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'accepted',
        initiatorId: friendId
      });

      // Mock updateFriendshipRole
      (storage.updateFriendshipRole as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'accepted',
        roleUserToFriend: 'editor',
        roleFriendToUser: 'viewer',
        updatedAt: new Date()
      });

      // Mock getUser for friend info
      (storage.getUser as any).mockResolvedValue({
        id: friendId,
        username: 'frienduser',
        firstName: 'Friend',
        lastName: 'User'
      });

      const response = await request(app)
        .patch(`/api/friends/${friendshipId}/role`)
        .set('x-user-id', userId)
        .send({ role: 'editor' })
        .expect(200);

      expect(response.body).toHaveProperty('id', friendshipId);
      expect(response.body).toHaveProperty('roleUserToFriend', 'editor');
      expect(response.body).toHaveProperty('roleFriendToUser', 'viewer');
      expect(response.body.friend).toHaveProperty('id', friendId);

      expect(storage.getFriendshipById).toHaveBeenCalledWith(friendshipId);
      expect(storage.updateFriendshipRole).toHaveBeenCalledWith(
        friendshipId, userId, 'editor'
      );
    });

    it('should reject invalid role values', async () => {
      const userId = 'user-123';
      const friendshipId = 'friendship-123';

      const response = await request(app)
        .patch(`/api/friends/${friendshipId}/role`)
        .set('x-user-id', userId)
        .send({ role: 'invalid-role' })
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Invalid role');
      expect(storage.updateFriendshipRole).not.toHaveBeenCalled();
    });

    it('should only allow role updates for accepted friendships', async () => {
      const userId = 'user-123';
      const friendId = 'user-456';
      const friendshipId = 'friendship-123';

      // Mock getFriendshipById with non-accepted status
      (storage.getFriendshipById as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'pending',
        initiatorId: friendId
      });

      const response = await request(app)
        .patch(`/api/friends/${friendshipId}/role`)
        .set('x-user-id', userId)
        .send({ role: 'editor' })
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Can only update roles for accepted friendships');
      expect(storage.updateFriendshipRole).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/friends/:friendshipId', () => {
    it('should unfriend a user successfully', async () => {
      const userId = 'user-123';
      const friendId = 'user-456';
      const friendshipId = 'friendship-123';

      // Mock getFriendshipById
      (storage.getFriendshipById as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'accepted',
        initiatorId: friendId
      });

      // Mock updateFriendshipStatusWithAudit
      (storage.updateFriendshipStatusWithAudit as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'unfriended',
        updatedAt: new Date()
      });

      const response = await request(app)
        .delete(`/api/friends/${friendshipId}`)
        .set('x-user-id', userId)
        .expect(200);

      expect(response.body).toHaveProperty('id', friendshipId);
      expect(response.body).toHaveProperty('status', 'unfriended');
      expect(response.body).toHaveProperty('message', 'Successfully unfriended user');

      expect(storage.getFriendshipById).toHaveBeenCalledWith(friendshipId);
      expect(storage.updateFriendshipStatusWithAudit).toHaveBeenCalledWith(
        friendshipId, 'unfriended', userId
      );
    });

    it('should only allow unfriending accepted friendships', async () => {
      const userId = 'user-123';
      const friendId = 'user-456';
      const friendshipId = 'friendship-123';

      // Mock getFriendshipById with non-accepted status
      (storage.getFriendshipById as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'pending',
        initiatorId: friendId
      });

      const response = await request(app)
        .delete(`/api/friends/${friendshipId}`)
        .set('x-user-id', userId)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Can only unfriend accepted friendships');
      expect(storage.updateFriendshipStatusWithAudit).not.toHaveBeenCalled();
    });

    it('should handle friendship not found', async () => {
      const userId = 'user-123';
      const friendshipId = 'nonexistent-123';

      // Mock getFriendshipById to return null
      (storage.getFriendshipById as any).mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/friends/${friendshipId}`)
        .set('x-user-id', userId)
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Friendship not found');
      expect(storage.updateFriendshipStatusWithAudit).not.toHaveBeenCalled();
    });

    it('should prevent unauthorized users from unfriending', async () => {
      const userId = 'user-123';
      const friendId = 'user-456';
      const unauthorizedUserId = 'user-789';
      const friendshipId = 'friendship-123';

      // Mock getFriendshipById
      (storage.getFriendshipById as any).mockResolvedValue({
        id: friendshipId,
        userId: userId,
        friendId: friendId,
        status: 'accepted',
        initiatorId: friendId
      });

      const response = await request(app)
        .delete(`/api/friends/${friendshipId}`)
        .set('x-user-id', unauthorizedUserId)
        .expect(403);

      expect(response.body).toHaveProperty('message', 'Not authorized to unfriend this user');
      expect(storage.updateFriendshipStatusWithAudit).not.toHaveBeenCalled();
    });
  });

  describe('Friendship State Transitions', () => {
    it('should handle blocked user trying to send friend request', async () => {
      const userId = 'user-123';
      const targetUserId = 'user-456';
      const targetUsername = 'targetuser';

      // Mock getUserByUsername
      (storage.getUserByUsername as any).mockResolvedValue({
        id: targetUserId,
        username: targetUsername
      });

      // Mock canSendFriendRequestTo to return false
      (storage.canSendFriendRequestTo as any).mockResolvedValue(false);

      // Mock getFriendship to return a blocked friendship
      (storage.getFriendship as any).mockResolvedValue({
        status: 'blocked'
      });

      const response = await request(app)
        .post(`/api/friends/${targetUsername}/request`)
        .set('x-user-id', userId)
        .expect(403);

      expect(response.body).toHaveProperty('message', 'Cannot send friend request to blocked user');
      expect(storage.createFriendshipWithCanonicalOrdering).not.toHaveBeenCalled();
    });

    it('should handle already accepted friendship', async () => {
      const userId = 'user-123';
      const targetUserId = 'user-456';
      const targetUsername = 'targetuser';

      // Mock getUserByUsername
      (storage.getUserByUsername as any).mockResolvedValue({
        id: targetUserId,
        username: targetUsername
      });

      // Mock canSendFriendRequestTo to return false
      (storage.canSendFriendRequestTo as any).mockResolvedValue(false);

      // Mock getFriendship to return an accepted friendship
      (storage.getFriendship as any).mockResolvedValue({
        status: 'accepted'
      });

      const response = await request(app)
        .post(`/api/friends/${targetUsername}/request`)
        .set('x-user-id', userId)
        .expect(409);

      expect(response.body).toHaveProperty('message', 'Already friends with this user');
      expect(storage.createFriendshipWithCanonicalOrdering).not.toHaveBeenCalled();
    });

    it('should handle cooldown period for declined/unfriended requests', async () => {
      const userId = 'user-123';
      const targetUserId = 'user-456';
      const targetUsername = 'targetuser';

      // Mock getUserByUsername
      (storage.getUserByUsername as any).mockResolvedValue({
        id: targetUserId,
        username: targetUsername
      });

      // Mock canSendFriendRequestTo to return false (cooldown active)
      (storage.canSendFriendRequestTo as any).mockResolvedValue(false);

      // Mock getFriendship to return a declined friendship
      (storage.getFriendship as any).mockResolvedValue({
        status: 'declined'
      });

      const response = await request(app)
        .post(`/api/friends/${targetUsername}/request`)
        .set('x-user-id', userId)
        .expect(429);

      expect(response.body).toHaveProperty('message', 'Must wait 24 hours before sending another friend request to this user');
      expect(response.body).toHaveProperty('retryAfter', 86400);
      expect(storage.createFriendshipWithCanonicalOrdering).not.toHaveBeenCalled();
    });
  });
});
