import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { storage } from '../../server/storage';

describe('User Search Functionality', () => {
  const testUsers = [
    { id: 'user1', email: 'alice@example.com', username: 'alice123' },
    { id: 'user2', email: 'bob@example.com', username: 'bob_test' },
    { id: 'user3', email: 'charlie@example.com', username: 'charlie' },
    { id: 'user4', email: 'alice2@example.com', username: 'alice_2024' },
  ];

  beforeEach(async () => {
    // Create test users
    for (const user of testUsers) {
      await storage.upsertUser(user);
    }
  });

  afterEach(async () => {
    // Clean up test users
    // Note: In a real test environment, you'd want to use a test database
    // and clean up properly. For now, we'll leave the test data.
  });

  describe('searchUsersByUsername', () => {
    it('should find users by exact match', async () => {
      const results = await storage.searchUsersByUsername('alice123', 10);
      
      expect(results).toHaveLength(1);
      expect(results[0].username).toBe('alice123');
      expect(results[0].id).toBe('user1');
    });

    it('should find users by prefix match', async () => {
      const results = await storage.searchUsersByUsername('alice', 10);
      
      expect(results.length).toBeGreaterThanOrEqual(2);
      
      // Should include both alice123 and alice_2024
      const usernames = results.map(u => u.username);
      expect(usernames).toContain('alice123');
      expect(usernames).toContain('alice_2024');
    });

    it('should order results correctly (exact match first)', async () => {
      const results = await storage.searchUsersByUsername('alice', 10);
      
      // If there's an exact match for 'alice', it should be first
      // Otherwise, shorter matches should come first
      expect(results.length).toBeGreaterThan(0);
      
      // Verify ordering: exact match first, then by length, then by created date
      for (let i = 0; i < results.length - 1; i++) {
        const current = results[i];
        const next = results[i + 1];
        
        // If current is exact match and next is not, current should come first
        if (current.username === 'alice' && next.username !== 'alice') {
          // This is correct ordering
          continue;
        }
        
        // If neither is exact match, shorter should come first
        if (current.username !== 'alice' && next.username !== 'alice') {
          expect(current.username!.length).toBeLessThanOrEqual(next.username!.length);
        }
      }
    });

    it('should respect limit parameter', async () => {
      const results = await storage.searchUsersByUsername('', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should handle case-insensitive search', async () => {
      const results = await storage.searchUsersByUsername('ALICE', 10);
      
      expect(results.length).toBeGreaterThanOrEqual(2);
      const usernames = results.map(u => u.username);
      expect(usernames).toContain('alice123');
      expect(usernames).toContain('alice_2024');
    });

    it('should return empty array for non-matching queries', async () => {
      const results = await storage.searchUsersByUsername('nonexistent', 10);
      expect(results).toHaveLength(0);
    });

    it('should handle empty query', async () => {
      const results = await storage.searchUsersByUsername('', 10);
      // Should return users, but limited by the limit parameter
      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  describe('checkUsernameAvailability', () => {
    it('should return false for existing usernames', async () => {
      const isAvailable = await storage.checkUsernameAvailability('alice123');
      expect(isAvailable).toBe(false);
    });

    it('should return true for non-existing usernames', async () => {
      const isAvailable = await storage.checkUsernameAvailability('newuser123');
      expect(isAvailable).toBe(true);
    });

    it('should handle case-insensitive checks', async () => {
      const isAvailable = await storage.checkUsernameAvailability('ALICE123');
      expect(isAvailable).toBe(false);
    });
  });
});