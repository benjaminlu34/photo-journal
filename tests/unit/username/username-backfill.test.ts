import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { users, usernameChanges } from '@shared/schema/schema'; // Import schema
import { eq } from 'drizzle-orm';

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'abc123')
}));

// Mock the db import with factory function
vi.mock('../../../server/db', () => {
  const mockDb = {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ([{ count: 0 }])) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn() })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    transaction: vi.fn((callback) => callback(mockDb)), // Mock transaction to execute callback directly
    delete: vi.fn(() => ({ where: vi.fn() }))
  };
  
  return {
    db: mockDb
  };
});

// Import after mocking
import {
  sanitizeEmail,
  generateUniqueUsername,
  usernameExists, // Import the actual function
  updateUserUsername // Import the actual function
} from '../../../scripts/backfill-usernames';

// Import the mocked db to access it in tests
import { db } from '../../../server/db';
const mockDb = vi.mocked(db);

describe('Username Back-fill Migration Script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks for db interactions
    mockDb.select.mockClear();
    mockDb.insert.mockClear();
    mockDb.update.mockClear();
    mockDb.transaction.mockClear();
    mockDb.delete.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sanitizeEmail', () => {
    it('should convert email to valid username format', () => {
      expect(sanitizeEmail('john.doe@example.com')).toBe('john_doe');
      expect(sanitizeEmail('user123@test.org')).toBe('user123');
      expect(sanitizeEmail('test_user@domain.co')).toBe('test_user');
    });

    it('should handle special characters and convert to underscores', () => {
      expect(sanitizeEmail('user-name@example.com')).toBe('user_name');
      expect(sanitizeEmail('user.name+tag@example.com')).toBe('user_name_tag');
      expect(sanitizeEmail('user@name@example.com')).toBe('user');
    });

    it('should remove multiple consecutive underscores', () => {
      expect(sanitizeEmail('user...name@example.com')).toBe('user_name');
      expect(sanitizeEmail('user---name@example.com')).toBe('user_name');
    });

    it('should remove leading and trailing underscores', () => {
      expect(sanitizeEmail('.user.name.@example.com')).toBe('user_name');
      expect(sanitizeEmail('-user-name-@example.com')).toBe('user_name');
    });

    it('should handle uppercase letters by converting to lowercase', () => {
      expect(sanitizeEmail('John.Doe@Example.COM')).toBe('john_doe');
      expect(sanitizeEmail('USER123@TEST.ORG')).toBe('user123');
    });

    it('should truncate to maximum 20 characters', () => {
      const longEmail = 'verylongusernamethatexceedslimit@example.com';
      const result = sanitizeEmail(longEmail);
      expect(result.length).toBeLessThanOrEqual(20);
      expect(result).toBe('verylongusernamethat');
    });

    it('should handle edge cases', () => {
      expect(sanitizeEmail('a@example.com')).toBe('a');
      expect(sanitizeEmail('123@example.com')).toBe('123');
      expect(sanitizeEmail('_@example.com')).toBe('');
    });

    it('should throw error for invalid input', () => {
      expect(() => sanitizeEmail('')).toThrow('Invalid email provided for sanitization');
      expect(() => sanitizeEmail(null as any)).toThrow('Invalid email provided for sanitization');
      expect(() => sanitizeEmail(undefined as any)).toThrow('Invalid email provided for sanitization');
    });
  });

  describe('generateUniqueUsername', () => {
    it('should return base username when available', async () => {
      // Mock usernameExists to return false (username is available)
      vi.spyOn(mockDb, 'select').mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ([{ count: 0 }])) })) } as any);

      const result = await generateUniqueUsername('john.doe@example.com');
      expect(result.username).toBe('john_doe');
      expect(result.hadConflict).toBe(false);
      expect(result.conflictResolution).toBeUndefined();
    });

    it('should handle reserved usernames', async () => {
      // Mock usernameExists to return false (username is available)
      vi.spyOn(mockDb, 'select').mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ([{ count: 0 }])) })) } as any);

      const result = await generateUniqueUsername('admin@example.com');
      expect(result.username).toBe('admin_abc123');
      expect(result.hadConflict).toBe(true);
      expect(result.conflictResolution).toContain('Username was reserved');
    });

    it('should handle username conflicts with suffix generation', async () => {
      // Mock usernameExists to simulate conflicts
      vi.spyOn(mockDb, 'select')
        .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ([{ count: 1 }])) })) } as any) // First call: base username exists
        .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ([{ count: 0 }])) })) } as any); // Second call: suffixed username available

      const result = await generateUniqueUsername('john.doe@example.com');
      expect(result.username).toBe('john_doe_abc123');
      expect(result.hadConflict).toBe(true);
      expect(result.conflictResolution).toContain('Added unique suffix');
    });

    it('should handle invalid email sanitization with fallback', async () => {
      // Mock usernameExists to return false (username is available)
      vi.spyOn(mockDb, 'select').mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ([{ count: 0 }])) })) } as any);

      const result = await generateUniqueUsername('_@example.com');
      expect(result.username).toBe('user_abc123');
      expect(result.hadConflict).toBe(true);
      expect(result.conflictResolution).toContain('Email sanitization resulted in invalid username');
    });

    it('should handle very short sanitized usernames', async () => {
      // Mock usernameExists to return false (username is available)
      vi.spyOn(mockDb, 'select').mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ([{ count: 0 }])) })) } as any);

      const result = await generateUniqueUsername('ab@example.com');
      expect(result.username).toBe('user_abc123');
      expect(result.hadConflict).toBe(true);
      expect(result.conflictResolution).toContain('Email sanitization resulted in invalid username');
    });
  });

  describe('updateUserUsername', () => {
    it('should update user and log username change', async () => {
      const userId = 'test-user-id';
      const newUsername = 'new_username';
      const oldUsername = 'old_username';

      // Mock db.update to return a successful update
      mockDb.update.mockReturnValueOnce({ set: vi.fn(() => ({ where: vi.fn() })) });
      // Mock db.insert for usernameChanges
      mockDb.insert.mockReturnValueOnce({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn() })) });

      await updateUserUsername(userId, newUsername);

      expect(mockDb.update).toHaveBeenCalledWith(users, {
        username: newUsername,
        updatedAt: expect.any(Date),
      });
      expect(mockDb.insert).toHaveBeenCalledWith(usernameChanges, {
        userId: userId,
        oldUsername: '',
        newUsername: newUsername,
        changedAt: expect.any(Date),
      });
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  describe('Email sanitization edge cases', () => {
    it('should handle emails with numbers', () => {
      expect(sanitizeEmail('user123@example.com')).toBe('user123');
      expect(sanitizeEmail('123user@example.com')).toBe('123user');
    });

    it('should handle emails with underscores', () => {
      expect(sanitizeEmail('user_name@example.com')).toBe('user_name');
      expect(sanitizeEmail('_user_@example.com')).toBe('user');
    });

    it('should handle complex email patterns', () => {
      expect(sanitizeEmail('first.last+tag@example.com')).toBe('first_last_tag');
      expect(sanitizeEmail('user-123.test@example.com')).toBe('user_123_test');
    });

    it('should handle international characters by replacing with underscores', () => {
      expect(sanitizeEmail('josé@example.com')).toBe('jos');
      expect(sanitizeEmail('müller@example.com')).toBe('m_ller');
    });
  });

  describe('Username length constraints', () => {
    it('should ensure usernames are at least 3 characters after processing', () => {
      // This would be handled by the fallback mechanism in generateUniqueUsername
      expect(sanitizeEmail('ab@example.com')).toBe('ab'); // Only 2 chars, should trigger fallback
    });

    it('should ensure usernames are at most 20 characters', () => {
      const longUsername = sanitizeEmail('verylongusernamethatdefinitelyexceedstwentycharacters@example.com');
      expect(longUsername.length).toBeLessThanOrEqual(20);
    });
  });
});