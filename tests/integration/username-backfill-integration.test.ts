import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../server/db';
import { users, usernameChanges } from '@shared/schema/schema';
import { eq, sql } from 'drizzle-orm';
import { 
  sanitizeEmail, 
  usernameExists, 
  generateUniqueUsername,
  verifyMigrationCompletion,
  backfillUsernames
} from '../../scripts/backfill-usernames';

describe('Username Back-fill Integration Tests', () => {
  const testUserIds: string[] = [];

  beforeAll(async () => {
    // Clean up any existing test data
    await db.delete(usernameChanges).where(sql`user_id LIKE 'test_%'`);
    await db.delete(users).where(sql`id LIKE 'test_%'`);
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(usernameChanges).where(sql`user_id LIKE 'test_%'`);
    await db.delete(users).where(sql`id LIKE 'test_%'`);
  });

  beforeEach(async () => {
    // Clean up any test users from previous tests
    for (const userId of testUserIds) {
      await db.delete(usernameChanges).where(eq(usernameChanges.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
    }
    testUserIds.length = 0;
  });

  describe('Database Integration', () => {
    it('should connect to database and check username existence', async () => {
      // Create a test user with a username
      const testUserId = 'test_user_exists';
      testUserIds.push(testUserId);
      
      await db.insert(users).values({
        id: testUserId,
        email: 'test@example.com',
        username: 'testuser'
      });

      // Test username existence check
      const exists = await usernameExists('testuser');
      expect(exists).toBe(true);

      const notExists = await usernameExists('nonexistentuser');
      expect(notExists).toBe(false);
    });

    it('should generate unique usernames with database validation', async () => {
      // Create a test user with existing username
      const testUserId = 'test_user_conflict';
      testUserIds.push(testUserId);
      
      await db.insert(users).values({
        id: testUserId,
        email: 'existing@example.com',
        username: 'john_doe'
      });

      // Test conflict resolution
      const result = await generateUniqueUsername('john.doe@example.com');
      expect(result.hadConflict).toBe(true);
      expect(result.username).toMatch(/^john_doe_[a-z0-9_]{4}$/);
      expect(result.conflictResolution).toContain('Added unique suffix');
    });

    it('should handle reserved usernames', async () => {
      const result = await generateUniqueUsername('admin@example.com');
      expect(result.hadConflict).toBe(true);
      expect(result.username).toMatch(/^admin_[a-z0-9]{4}$/);
      expect(result.conflictResolution).toContain('Username was reserved');
    });
  });

  describe('Migration Verification', () => {
    it('should accurately count users with and without usernames', async () => {
      // Create test users - some with usernames, some without
      const testUsers = [
        { id: 'test_with_username_1', email: 'user1@test.com', username: 'user1' },
        { id: 'test_with_username_2', email: 'user2@test.com', username: 'user2' },
        { id: 'test_without_username_1', email: 'user3@test.com', username: null },
        { id: 'test_without_username_2', email: 'user4@test.com', username: null }
      ];

      for (const user of testUsers) {
        testUserIds.push(user.id);
        await db.insert(users).values(user);
      }

      const verification = await verifyMigrationCompletion();
      
      // Should count at least our test users
      expect(verification.totalUsers).toBeGreaterThanOrEqual(4);
      expect(verification.usersWithoutUsernames).toBeGreaterThanOrEqual(2);
      expect(verification.usersWithUsernames).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Full Migration Process', () => {
    it('should successfully migrate users without usernames', async () => {
      // Create test users without usernames
      const testUsers = [
        { id: 'test_migrate_1', email: 'john.doe@example.com' },
        { id: 'test_migrate_2', email: 'jane.smith@example.com' },
        { id: 'test_migrate_3', email: 'user-123@test.org' }
      ];

      for (const user of testUsers) {
        testUserIds.push(user.id);
        await db.insert(users).values({
          id: user.id,
          email: user.email,
          username: null
        });
      }

      // Run the migration
      const results = await backfillUsernames();
      
      // Should have processed our test users
      const testResults = results.filter(r => testUserIds.includes(r.userId));
      expect(testResults.length).toBe(3);

      // Verify usernames were generated correctly
      expect(testResults.find(r => r.originalEmail === 'john.doe@example.com')?.generatedUsername).toBe('john_doe');
      expect(testResults.find(r => r.originalEmail === 'jane.smith@example.com')?.generatedUsername).toBe('jane_smith');
      expect(testResults.find(r => r.originalEmail === 'user-123@test.org')?.generatedUsername).toBe('user_123');

      // Verify database was updated
      for (const user of testUsers) {
        const updatedUser = await db.select().from(users).where(eq(users.id, user.id));
        expect(updatedUser[0].username).toBeTruthy();
        expect(updatedUser[0].username?.length).toBeGreaterThanOrEqual(3);
        expect(updatedUser[0].username?.length).toBeLessThanOrEqual(20);
      }

      // Verify audit records were created
      for (const user of testUsers) {
        const auditRecords = await db.select().from(usernameChanges).where(eq(usernameChanges.userId, user.id));
        expect(auditRecords.length).toBe(1);
        expect(auditRecords[0].oldUsername).toBe('');
        expect(auditRecords[0].newUsername).toBeTruthy();
      }
    });

    it('should handle users with existing usernames gracefully', async () => {
      // Create test user with existing username
      const testUserId = 'test_existing_username';
      testUserIds.push(testUserId);
      
      await db.insert(users).values({
        id: testUserId,
        email: 'existing@example.com',
        username: 'existing_user'
      });

      // Run migration
      const results = await backfillUsernames();
      
      // Should not process users who already have usernames
      const testResult = results.find(r => r.userId === testUserId);
      expect(testResult).toBeUndefined();

      // Verify username wasn't changed
      const user = await db.select().from(users).where(eq(users.id, testUserId));
      expect(user[0].username).toBe('existing_user');
    });

    it('should handle users without email addresses', async () => {
      // Create test user without email
      const testUserId = 'test_no_email';
      testUserIds.push(testUserId);
      
      await db.insert(users).values({
        id: testUserId,
        email: null,
        username: null
      });

      // Run migration
      const results = await backfillUsernames();
      
      // Should skip users without email
      const testResult = results.find(r => r.userId === testUserId);
      expect(testResult).toBeUndefined();

      // Verify username is still null
      const user = await db.select().from(users).where(eq(users.id, testUserId));
      expect(user[0].username).toBeNull();
    });
  });

  describe('Email Sanitization Real Database Tests', () => {
    it('should handle various email formats correctly', () => {
      const testCases = [
        { email: 'simple@example.com', expected: 'simple' },
        { email: 'with.dots@example.com', expected: 'with_dots' },
        { email: 'with-dashes@example.com', expected: 'with_dashes' },
        { email: 'with+plus@example.com', expected: 'with_plus' },
        { email: 'UPPERCASE@EXAMPLE.COM', expected: 'uppercase' },
        { email: 'numbers123@example.com', expected: 'numbers123' },
        { email: 'under_scores@example.com', expected: 'under_scores' },
        { email: 'mixed.case-123+tag@example.com', expected: 'mixed_case_123_tag' }
      ];

      for (const testCase of testCases) {
        const result = sanitizeEmail(testCase.email);
        expect(result).toBe(testCase.expected);
      }
    });
  });
});