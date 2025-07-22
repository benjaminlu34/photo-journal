import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storage } from '../../server/storage';

// Mock the supabase-sync module
vi.mock('../../server/utils/supabase-sync', () => ({
  syncUsernameToAuth: vi.fn().mockResolvedValue(true),
}));

describe('JWT Sync Functionality', () => {
  const testUser = {
    id: 'test-user-jwt',
    email: 'jwttest@example.com',
    username: 'jwttest',
  };

  beforeEach(async () => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Create test user
    await storage.upsertUser(testUser);
  });

  describe('updateUserWithJWTSync', () => {
    it('should update user and sync username to auth', async () => {
      const newUsername = 'jwttest_updated';
      
      // Import the mock to verify it was called
      const { syncUsernameToAuth } = await import('../../server/utils/supabase-sync');
      
      // Update username using JWT sync method
      const updatedUser = await storage.updateUserWithJWTSync(testUser.id, {
        username: newUsername
      });
      
      // Verify user was updated
      expect(updatedUser.username).toBe(newUsername);
      expect(updatedUser.id).toBe(testUser.id);
      
      // Verify sync function was called
      expect(syncUsernameToAuth).toHaveBeenCalledWith(testUser.id, newUsername);
    });

    it('should update user without sync when username is not changed', async () => {
      const { syncUsernameToAuth } = await import('../../server/utils/supabase-sync');
      
      // Update user without changing username
      const updatedUser = await storage.updateUserWithJWTSync(testUser.id, {
        firstName: 'Updated Name'
      });
      
      // Verify user was updated
      expect(updatedUser.firstName).toBe('Updated Name');
      expect(updatedUser.username).toBe(testUser.username);
      
      // Verify sync function was NOT called
      expect(syncUsernameToAuth).not.toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      // Mock sync function to throw error
      const { syncUsernameToAuth } = await import('../../server/utils/supabase-sync');
      vi.mocked(syncUsernameToAuth).mockRejectedValueOnce(new Error('Sync failed'));
      
      // Update should still succeed even if sync fails
      const updatedUser = await storage.updateUserWithJWTSync(testUser.id, {
        username: 'jwttest_error'
      });
      
      // Verify user was updated despite sync error
      expect(updatedUser.username).toBe('jwttest_error');
      expect(updatedUser.id).toBe(testUser.id);
    });
  });

  describe('regular updateUser', () => {
    it('should update user without JWT sync', async () => {
      const { syncUsernameToAuth } = await import('../../server/utils/supabase-sync');
      
      // Update username using regular method
      const updatedUser = await storage.updateUser(testUser.id, {
        username: 'jwttest_regular'
      });
      
      // Verify user was updated
      expect(updatedUser.username).toBe('jwttest_regular');
      
      // Verify sync function was NOT called
      expect(syncUsernameToAuth).not.toHaveBeenCalled();
    });
  });
});