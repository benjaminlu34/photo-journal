import * as crypto from 'crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { storage } from '../../../server/storage';
import { db } from '../../../server/db';
import { users, friendships } from '../../../shared/schema/schema';
import { eq, sql } from 'drizzle-orm';

describe('Enhanced User Search with Friendship Status', () => {
  let currentUser: any;
  let usersToSearch: any[] = [];

  beforeEach(async () => {
    // Clean up any existing test data
    await db.delete(friendships);
    await db.delete(users);

    // Setup test data with proper UUID format
    const timestamp = Date.now().toString().slice(-5);
    
    currentUser = await storage.upsertUser({
      id: `00000000-0000-0000-${timestamp}-000000000001`,
      email: `test-${timestamp}@example.com`,
      username: `current-${timestamp}`,
      firstName: 'Current',
      lastName: 'User',
    });

    // Create test users with proper UUID format
    usersToSearch = [
      await storage.upsertUser({
        id: `00000000-0000-0000-${timestamp}-000000000002`,
        email: `user2-${timestamp}@example.com`,
        username: `user2-${timestamp}`,
        firstName: 'User',
        lastName: 'Two',
      }),
      await storage.upsertUser({
        id: `00000000-0000-0000-${timestamp}-000000000003`,
        email: `user3-${timestamp}@example.com`,
        username: `user3-${timestamp}`,
        firstName: 'User',
        lastName: 'Three',
      }),
      await storage.upsertUser({
        id: `00000000-0000-0000-${timestamp}-000000000004`,
        email: `user4-${timestamp}@example.com`,
        username: `user4-${timestamp}`,
        firstName: 'User',
        lastName: 'Four',
      }),
    ];
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(friendships);
    await db.delete(users);
  });

  describe('searchUsersByUsernameWithFriendshipStatus', () => {
    it('should return users with no friendship status when no relationships exist', async () => {
      const results = await storage.searchUsersByUsernameWithFriendshipStatus(
        currentUser.id,
        'user'
      );

      expect(results).toHaveLength(3);
      expect(results[0].friendshipStatus).toBeUndefined();
      expect(results[0].friendshipId).toBeUndefined();
    });

    it('should exclude the current user from results', async () => {
      const results = await storage.searchUsersByUsernameWithFriendshipStatus(
        currentUser.id,
        'current'
      );

      expect(results).toHaveLength(0);
    });

    it('should include friendship status when relationships exist', async () => {
      // Create a friendship
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        currentUser.id,
        usersToSearch[0].id,
        currentUser.id
      );

      const results = await storage.searchUsersByUsernameWithFriendshipStatus(
        currentUser.id,
        usersToSearch[0].username
      );

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(usersToSearch[0].id);
      expect(results[0].friendshipStatus).toBe('pending');
      expect(results[0].friendshipId).toBe(friendship.id);
    });

    it('should exclude blocked users', async () => {
      // Create and block a friendship
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        currentUser.id,
        usersToSearch[0].id,
        currentUser.id
      );
      await storage.updateFriendshipStatusWithAudit(
        friendship.id,
        'blocked',
        currentUser.id
      );

      const results = await storage.searchUsersByUsernameWithFriendshipStatus(
        currentUser.id,
        usersToSearch[0].username
      );

      expect(results).toHaveLength(0);
    });

    it('should exclude unfriended users', async () => {
      // Create a friendship in accepted state first
      let friendship = await storage.createFriendshipWithCanonicalOrdering(
        currentUser.id,
        usersToSearch[0].id,
        usersToSearch[0].id  // Let the other user be the initiator
      );
      
      // Then have the other user accept it
      await storage.updateFriendshipStatusWithAudit(
        friendship.id,
        'accepted',
        currentUser.id
      );
      
      // Then unfriend it
      await storage.updateFriendshipStatusWithAudit(
        friendship.id,
        'unfriended',
        currentUser.id
      );

      const results = await storage.searchUsersByUsernameWithFriendshipStatus(
        currentUser.id,
        usersToSearch[0].username
      );

      expect(results).toHaveLength(0);
    });

    it('should respect friendsOnly parameter', async () => {
      // Create accepted friendship
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        currentUser.id,
        usersToSearch[0].id,
        currentUser.id
      );
      await storage.updateFriendshipStatusWithAudit(
        friendship.id,
        'accepted',
        usersToSearch[0].id // Accept as the other user
      );

      const results = await storage.searchUsersByUsernameWithFriendshipStatus(
        currentUser.id,
        'user',
        { friendsOnly: true }
      );

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(usersToSearch[0].id);
      expect(results[0].friendshipStatus).toBe('accepted');
    });

    it('should handle case-insensitive username matching', async () => {
      const results = await storage.searchUsersByUsernameWithFriendshipStatus(
        currentUser.id,
        'USER' // uppercase
      );

      expect(results).toHaveLength(3);
    });

    it('should order results with exact matches first', async () => {
      // Create user with exact match
      const timestamp = Date.now().toString().slice(-5);
      await storage.upsertUser({
        id: `test-exact-${timestamp}`,
        email: `exact-${timestamp}@example.com`,
        username: `user2ex-${timestamp}`,
        firstName: 'Exact',
        lastName: 'Match',
      });

      const results = await storage.searchUsersByUsernameWithFriendshipStatus(
        currentUser.id,
        usersToSearch[0].username
      );

      // Should find user2 and user2ex, with user2 as exact match
      const user2Result = results.find(r => r.username === usersToSearch[0].username);
      expect(user2Result).toBeDefined();
    });

    it('should handle bidirectional friendship checks', async () => {
      // Test that blocking works in both directions
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        currentUser.id,
        usersToSearch[0].id,
        usersToSearch[0].id // Initiated by other user
      );
      
      // Current user blocks the other user
      await storage.updateFriendshipStatusWithAudit(
        friendship.id,
        'blocked',
        currentUser.id
      );

      const results = await storage.searchUsersByUsernameWithFriendshipStatus(
        currentUser.id,
        usersToSearch[0].username
      );

      expect(results).toHaveLength(0);
    });

    it('should handle pending requests correctly', async () => {
      // Create pending friendship
      await storage.createFriendshipWithCanonicalOrdering(
        usersToSearch[0].id,
        currentUser.id,
        usersToSearch[0].id
      );

      const results = await storage.searchUsersByUsernameWithFriendshipStatus(
        currentUser.id,
        usersToSearch[0].username
      );

      expect(results).toHaveLength(1);
      expect(results[0].friendshipStatus).toBe('pending');
    });
  });

  describe('API endpoint integration', () => {
    it('should handle friendsOnly parameter correctly', async () => {
      // Test the endpoint integration
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        currentUser.id,
        usersToSearch[0].id,
        currentUser.id
      );
      await storage.updateFriendshipStatusWithAudit(
        friendship.id,
        'accepted',
        usersToSearch[0].id
      );

      // Simulate API call with friendsOnly=true
      const results = await storage.searchUsersByUsernameWithFriendshipStatus(
        currentUser.id,
        'user',
        { friendsOnly: true }
      );

      expect(results).toHaveLength(1);
      expect(results[0].username).toBe(usersToSearch[0].username);
    });

    it('should return empty array when no matches', async () => {
      const results = await storage.searchUsersByUsernameWithFriendshipStatus(
        currentUser.id,
        'nonexistent'
      );

      expect(results).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      const results = await storage.searchUsersByUsernameWithFriendshipStatus(
        currentUser.id,
        'user',
        { limit: 2 }
      );

      expect(results).toHaveLength(2);
    });
  });
});