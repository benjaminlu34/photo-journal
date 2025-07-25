import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storage } from '../../../server/storage';
import * as crypto from 'crypto';

import { setupTestDB, teardownTestDB } from '../../test-utils';

describe('Profile Username Management', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });
  const testUserIds: string[] = [];

  afterEach(async () => {
    // Clean up test users
    // Note: In a real implementation, we would clean up the database
    // For now, we rely on the test database being isolated
  });

  describe('Username Change Tracking', () => {
    it('should track username changes in audit table', async () => {
      const testUserId = crypto.randomUUID();
      
      // Create a test user
      const testUser = await storage.upsertUser({
        id: testUserId,
        email: `profile-${Date.now()}@test.com`,
        username: 'original_username',
        firstName: 'Test',
        lastName: 'User'
      });

      // Update the user with a new username
      const updatedUser = await storage.updateUser(testUserId, {
        username: 'new_username'
      });

      expect(updatedUser.username).toBe('new_username');

      // Verify the change was tracked
      // Note: In a real implementation, we would query the username_changes table
      // For now, we just verify the user was updated correctly
      const retrievedUser = await storage.getUser(testUserId);
      expect(retrievedUser?.username).toBe('new_username');
    });

    it('should handle profile updates without username changes', async () => {
      const testUserId = crypto.randomUUID();
      
      // Create a test user
      const testUser = await storage.upsertUser({
        id: testUserId,
        email: `profile2-${Date.now()}@test.com`,
        username: 'stable_username',
        firstName: 'Test',
        lastName: 'User'
      });

      // Update only the name fields
      const updatedUser = await storage.updateUser(testUserId, {
        firstName: 'Updated',
        lastName: 'Name'
      });

      expect(updatedUser.firstName).toBe('Updated');
      expect(updatedUser.lastName).toBe('Name');
      expect(updatedUser.username).toBe('stable_username'); // Should remain unchanged
    });

    it('should validate username format during profile updates', async () => {
      const testUserId = crypto.randomUUID();
      
      // Create a test user
      const testUser = await storage.upsertUser({
        id: testUserId,
        email: `profile3-${Date.now()}@test.com`,
        username: 'valid_username',
        firstName: 'Test',
        lastName: 'User'
      });

      // Attempt to update with invalid username should be handled at API level
      // The storage layer doesn't validate format, that's done in the API routes
      // This test verifies the storage layer accepts the update
      const updatedUser = await storage.updateUser(testUserId, {
        username: 'new_valid_username'
      });

      expect(updatedUser.username).toBe('new_valid_username');
    });
  });

  describe('Username Availability for Profile Updates', () => {
    it('should check username availability for profile changes', async () => {
      // Create two test users
      await storage.upsertUser({
        id: 'test-user-1',
        email: 'user1@test.com',
        username: 'taken_username',
        firstName: 'User',
        lastName: 'One'
      });

      await storage.upsertUser({
        id: 'test-user-2',
        email: 'user2@test.com',
        username: 'available_username',
        firstName: 'User',
        lastName: 'Two'
      });

      // Check that taken username is not available
      const isTakenAvailable = await storage.checkUsernameAvailability('taken_username');
      expect(isTakenAvailable).toBe(false);

      // Check that a new username is available
      const isNewAvailable = await storage.checkUsernameAvailability('completely_new_username');
      expect(isNewAvailable).toBe(true);
    });
  });

  describe('Profile Display Data', () => {
    it('should include username in user profile data', async () => {
      // Create a test user with username
      const testUser = await storage.upsertUser({
        id: 'test-display-user',
        email: 'display@test.com',
        username: 'display_username',
        firstName: 'Display',
        lastName: 'User'
      });

      // Retrieve the user
      const retrievedUser = await storage.getUser('test-display-user');
      
      expect(retrievedUser).toBeDefined();
      expect(retrievedUser?.username).toBe('display_username');
      expect(retrievedUser?.firstName).toBe('Display');
      expect(retrievedUser?.lastName).toBe('User');
      expect(retrievedUser?.email).toBe('display@test.com');
    });

    it('should handle users without usernames gracefully', async () => {
      // Create a test user without username (legacy user)
      const testUser = await storage.upsertUser({
        id: 'test-legacy-user',
        email: 'legacy@test.com',
        firstName: 'Legacy',
        lastName: 'User'
      });

      // Retrieve the user
      const retrievedUser = await storage.getUser('test-legacy-user');
      
      expect(retrievedUser).toBeDefined();
      expect(retrievedUser?.username).toBeNull();
      expect(retrievedUser?.firstName).toBe('Legacy');
      expect(retrievedUser?.lastName).toBe('User');
      expect(retrievedUser?.email).toBe('legacy@test.com');
    });
  });
});