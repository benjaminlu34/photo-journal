import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../../server/db';
import { users } from '../../../shared/schema/schema';
import { eq } from 'drizzle-orm';

import { setupTestDB, teardownTestDB } from '../../test-utils';

describe('Database Constraints', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });
  const testUserId = 'test-constraint-user';
  
  afterAll(async () => {
    // Clean up test user
    try {
      await db.delete(users).where(eq(users.id, testUserId));
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Reserved Username Constraint', () => {
    it('should prevent insertion of reserved usernames', async () => {
      const reservedUsernames = ['admin', 'api', 'support', 'help', 'root', 'system', 'moderator'];
      
      for (const reservedUsername of reservedUsernames) {
        await expect(
          db.insert(users).values({
            id: `test-${reservedUsername}`,
            email: `${reservedUsername}@test.com`,
            username: reservedUsername,
          })
        ).rejects.toThrow(/violates check constraint "username_reserved"/);
      }
    });

    it('should allow non-reserved usernames', async () => {
      await expect(
        db.insert(users).values({
          id: testUserId,
          email: 'test@example.com',
          username: 'validuser',
        })
      ).resolves.not.toThrow();
    });

    it('should allow null usernames', async () => {
      await expect(
        db.insert(users).values({
          id: 'test-null-username',
          email: 'null@example.com',
          username: null,
        })
      ).resolves.not.toThrow();
      
      // Clean up
      await db.delete(users).where(eq(users.id, 'test-null-username'));
    });
  });

  describe('Username Uniqueness Constraint', () => {
    it('should prevent duplicate usernames', async () => {
      // First insertion should succeed
      await db.insert(users).values({
        id: 'test-unique-1',
        email: 'unique1@test.com',
        username: 'uniquetest',
      });

      // Second insertion with same username should fail
      await expect(
        db.insert(users).values({
          id: 'test-unique-2',
          email: 'unique2@test.com',
          username: 'uniquetest',
        })
      ).rejects.toThrow(/duplicate key value violates unique constraint/);

      // Clean up
      await db.delete(users).where(eq(users.id, 'test-unique-1'));
    });
  });
});