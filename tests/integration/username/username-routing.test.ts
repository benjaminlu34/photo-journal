import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { storage } from '../../../server/storage';

import { setupTestDB, teardownTestDB } from '../../test-utils';

describe('Username Routing Integration', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });
  let testUserId: string;
  let testUsername: string;

  beforeAll(async () => {
    // Create a test user for routing tests
    testUserId = 'test-user-routing-' + Date.now();
    testUsername = 'testuser' + Date.now().toString().slice(-6);
    
    await storage.upsertUser({
      id: testUserId,
      email: `${testUsername}@test.com`,
      username: testUsername,
      firstName: 'Test',
      lastName: 'User',
    });
  });

  afterAll(async () => {
    // Clean up test data
    try {
      // Note: In a real test, you'd want to clean up the test user
      // For now, we'll leave it as the storage doesn't have a delete method
    } catch (error) {
      console.warn('Failed to clean up test user:', error);
    }
  });

  describe('getUserByUsername', () => {
    it('should find user by username', async () => {
      const user = await storage.getUserByUsername(testUsername);
      expect(user).toBeDefined();
      expect(user?.id).toBe(testUserId);
      expect(user?.username).toBe(testUsername);
    });

    it('should return undefined for non-existent username', async () => {
      const user = await storage.getUserByUsername('nonexistentuser123');
      expect(user).toBeUndefined();
    });

    it('should handle case-insensitive username lookup', async () => {
      const user = await storage.getUserByUsername(testUsername.toUpperCase());
      expect(user).toBeDefined();
      expect(user?.username).toBe(testUsername);
    });
  });

  describe('username validation', () => {
    it('should validate username availability correctly', async () => {
      const isAvailable = await storage.checkUsernameAvailability(testUsername);
      expect(isAvailable).toBe(false); // Should be taken by our test user

      const isAvailableNew = await storage.checkUsernameAvailability('newuser' + Date.now());
      expect(isAvailableNew).toBe(true); // Should be available
    });
  });

  describe('user search', () => {
    it('should find users by username prefix', async () => {
      const searchPrefix = testUsername.slice(0, 5);
      const results = await storage.searchUsersByUsername(searchPrefix, 10);
      
      expect(results.length).toBeGreaterThan(0);
      const foundUser = results.find(u => u.username === testUsername);
      expect(foundUser).toBeDefined();
    });

    it('should return exact matches first', async () => {
      const results = await storage.searchUsersByUsername(testUsername, 10);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].username).toBe(testUsername);
    });
  });
});