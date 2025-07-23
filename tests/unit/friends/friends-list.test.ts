import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { storage } from '../../../server/storage';
import { randomUUID } from 'crypto';
import { db } from '../../../server/db';
import { users, friendships } from '../../../shared/schema/schema';

describe('Friend List Storage Methods', () => {
  let user1: any;
  let user2: any;
  let user3: any;

  beforeEach(async () => {
    // Clean up any existing test data
    await db.delete(friendships);
    await db.delete(users);

    // Create test users with unique data
    const timestamp = Date.now().toString().slice(-5);
    
    user1 = await storage.upsertUser({
      id: `11111111-1111-1111-${timestamp}-111111111111`,
      email: `u1-${timestamp}@test.com`,
      username: `u1-${timestamp}`,
      firstName: 'Test',
      lastName: 'User1',
    });

    user2 = await storage.upsertUser({
      id: `22222222-2222-2222-${timestamp}-222222222222`,
      email: `u2-${timestamp}@test.com`,
      username: `u2-${timestamp}`,
      firstName: 'Test',
      lastName: 'User2',
    });

    user3 = await storage.upsertUser({
      id: `33333333-3333-3333-${timestamp}-333333333333`,
      email: `u3-${timestamp}@test.com`,
      username: `u3-${timestamp}`,
      firstName: 'Test',
      lastName: 'User3',
    });
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(friendships);
    await db.delete(users);
  });

  describe('getFriendsWithRoles', () => {
    it('should return empty list for user with no friends', async () => {
      const result = await storage.getFriendsWithRoles(user1.id);
      
      expect(result.friends).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should return accepted friends with role information', async () => {
      // Create friendship
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user2.id,
        user1.id
      );
      
      // Accept the friendship
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'accepted', user2.id);

      const result = await storage.getFriendsWithRoles(user1.id);

      expect(result.friends).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.friends[0].id).toBe(user2.id);
      expect(result.friends[0].friendshipId).toBe(friendship.id);
      expect(result.friends[0].roleUserToFriend).toBe('viewer');
      expect(result.friends[0].roleFriendToUser).toBe('viewer');
      expect(result.friends[0].status).toBe('accepted');
    });

    it('should not include declined friendships', async () => {
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user2.id,
        user1.id
      );
      
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'declined', user2.id);

      const result = await storage.getFriendsWithRoles(user1.id);

      expect(result.friends).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should not include blocked friendships', async () => {
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user2.id,
        user1.id
      );
      
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'blocked', user2.id);

      const result = await storage.getFriendsWithRoles(user1.id);

      expect(result.friends).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should not include unfriended relationships', async () => {
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user2.id,
        user1.id
      );
      
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'accepted', user2.id);
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'unfriended', user1.id);

      const result = await storage.getFriendsWithRoles(user1.id);

      expect(result.friends).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should handle bidirectional friendships correctly', async () => {
      // Create multiple friendships
      const friendship1 = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user2.id,
        user1.id
      );
      await storage.updateFriendshipStatusWithAudit(friendship1.id, 'accepted', user2.id);

      const friendship2 = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user3.id,
        user3.id
      );
      await storage.updateFriendshipStatusWithAudit(friendship2.id, 'accepted', user1.id);

      const result = await storage.getFriendsWithRoles(user1.id);

      expect(result.friends).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      
      const friendIds = result.friends.map(f => f.id);
      expect(friendIds).toContain(user2.id);
      expect(friendIds).toContain(user3.id);
    });

    it('should support pagination', async () => {
      // Create multiple friendships
      const friendships = [];
      for (let i = 0; i < 5; i++) {
        const user = await storage.upsertUser({
          id: randomUUID(),
          email: `f${i}-${Date.now().toString().slice(-5)}@test.com`,
          username: `f${i}-${Date.now().toString().slice(-5)}`,
        });
        
        const friendship = await storage.createFriendshipWithCanonicalOrdering(
          user1.id,
          user.id,
          user1.id
        );
        await storage.updateFriendshipStatusWithAudit(friendship.id, 'accepted', user.id);
        friendships.push(friendship);
      }

      const result1 = await storage.getFriendsWithRoles(user1.id, { limit: 2, offset: 0 });
      expect(result1.friends).toHaveLength(2);
      expect(result1.totalCount).toBe(5);

      const result2 = await storage.getFriendsWithRoles(user1.id, { limit: 2, offset: 2 });
      expect(result2.friends).toHaveLength(2);
      expect(result2.totalCount).toBe(5);
    });
  });

  describe('getFriendRequests', () => {
    it('should return empty lists for user with no requests', async () => {
      const result = await storage.getFriendRequests(user1.id);

      expect(result.sent).toHaveLength(0);
      expect(result.received).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should return sent pending requests', async () => {
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user2.id,
        user1.id
      );

      const result = await storage.getFriendRequests(user1.id);

      expect(result.sent).toHaveLength(1);
      expect(result.received).toHaveLength(0);
      expect(result.totalCount).toBe(1);
      expect(result.sent[0].id).toBe(friendship.id);
      expect(result.sent[0].friend.id).toBe(user2.id);
    });

    it('should return received pending requests', async () => {
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user2.id,
        user1.id,
        user2.id
      );

      const result = await storage.getFriendRequests(user1.id);

      // When user2 sends to user1, user1 receives it
      expect(result.received).toHaveLength(1);
      expect(result.received[0].id).toBe(friendship.id);
      expect(result.received[0].user.id).toBe(user2.id);
    });

    it('should not include accepted requests', async () => {
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user2.id,
        user1.id
      );
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'accepted', user2.id);

      const result = await storage.getFriendRequests(user1.id);

      expect(result.sent).toHaveLength(0);
      expect(result.received).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should not include declined requests', async () => {
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user2.id,
        user1.id
      );
      await storage.updateFriendshipStatusWithAudit(friendship.id, 'declined', user2.id);

      const result = await storage.getFriendRequests(user1.id);

      expect(result.sent).toHaveLength(0);
      expect(result.received).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should handle both sent and received requests', async () => {
      // User1 sends to user2
      const sentFriendship = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user2.id,
        user1.id
      );

      // User3 sends to user1
      const receivedFriendship = await storage.createFriendshipWithCanonicalOrdering(
        user3.id,
        user1.id,
        user3.id
      );

      const result = await storage.getFriendRequests(user1.id);

      // Should include both sent and received requests
      const hasSent = result.sent.some(r => r.id === sentFriendship.id);
      const hasReceived = result.received.some(r => r.id === receivedFriendship.id);
      
      expect(hasSent).toBe(true);
      expect(hasReceived).toBe(true);
      expect(result.totalCount).toBe(2);
    });

    it('should support pagination for requests', async () => {
      // Create multiple sent requests
      for (let i = 0; i < 4; i++) {
        const user = await storage.upsertUser({
          id: randomUUID(),
          email: `s${i}-${Date.now().toString().slice(-5)}@test.com`,
          username: `s${i}-${Date.now().toString().slice(-5)}`,
        });
        
        await storage.createFriendshipWithCanonicalOrdering(
          user1.id,
          user.id,
          user1.id
        );
      }

      const result = await storage.getFriendRequests(user1.id, { limit: 3, offset: 0 });
      
      expect(result.sent.length + result.received.length).toBeLessThanOrEqual(3);
      expect(result.totalCount).toBe(4);
    });
  });

  describe('Filtering behavior', () => {
    it('should properly filter by status', async () => {
      // Create friendships in different statuses
      const pending = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user2.id,
        user1.id
      );

      const accepted = await storage.createFriendshipWithCanonicalOrdering(
        user1.id,
        user3.id,
        user1.id
      );
      await storage.updateFriendshipStatusWithAudit(accepted.id, 'accepted', user3.id);

      // Test friends list only shows accepted
      const friendsResult = await storage.getFriendsWithRoles(user1.id);
      expect(friendsResult.friends).toHaveLength(1);
      expect(friendsResult.friends[0].id).toBe(user3.id);

      // Test requests only shows pending
      const requestsResult = await storage.getFriendRequests(user1.id);
      expect(requestsResult.sent).toHaveLength(1);
      expect(requestsResult.sent[0].id).toBe(pending.id);
    });
  });
});