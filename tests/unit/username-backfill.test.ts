import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  sanitizeEmail, 
  generateUniqueUsername,
  usernameExists 
} from '../../scripts/backfill-usernames';

// Mock the database module
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
    update: vi.fn(),
    insert: vi.fn()
  }
}));

// Mock the schema module
vi.mock('@shared/schema/schema', () => ({
  users: {
    id: 'id',
    email: 'email', 
    username: 'username',
    updatedAt: 'updated_at'
  },
  usernameChanges: {
    userId: 'user_id',
    oldUsername: 'old_username',
    newUsername: 'new_username',
    changedAt: 'changed_at'
  }
}));

// Mock drizzle-orm functions
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  isNull: vi.fn(),
  sql: vi.fn()
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'abc123')
}));

describe('Username Back-fill Migration Script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('usernameExists', () => {
    it('should return true when username exists', async () => {
      const mockDb = await import('../../server/db');
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }])
        })
      } as any);

      const result = await usernameExists('existinguser');
      expect(result).toBe(true);
    });

    it('should return false when username does not exist', async () => {
      const mockDb = await import('../../server/db');
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }])
        })
      } as any);

      const result = await usernameExists('newuser');
      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const mockDb = await import('../../server/db');
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database error'))
        })
      } as any);

      await expect(usernameExists('testuser')).rejects.toThrow('Database error');
    });
  });

  describe('generateUniqueUsername', () => {
    it('should return base username when available', async () => {
      const mockDb = await import('../../server/db');
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }])
        })
      } as any);

      const result = await generateUniqueUsername('john.doe@example.com');
      expect(result.username).toBe('john_doe');
      expect(result.hadConflict).toBe(false);
      expect(result.conflictResolution).toBeUndefined();
    });

    it('should handle reserved usernames', async () => {
      const mockDb = await import('../../server/db');
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }])
        })
      } as any);

      const result = await generateUniqueUsername('admin@example.com');
      expect(result.username).toBe('admin_abc123');
      expect(result.hadConflict).toBe(true);
      expect(result.conflictResolution).toContain('Username was reserved');
    });

    it('should handle username conflicts with suffix generation', async () => {
      const mockDb = await import('../../server/db');
      let callCount = 0;
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            // First call (base username) returns conflict, second call (with suffix) returns available
            return Promise.resolve([{ count: callCount === 1 ? 1 : 0 }]);
          })
        })
      } as any);

      const result = await generateUniqueUsername('john.doe@example.com');
      expect(result.username).toBe('john_doe_abc123');
      expect(result.hadConflict).toBe(true);
      expect(result.conflictResolution).toContain('Added unique suffix');
    });

    it('should handle invalid email sanitization with fallback', async () => {
      const mockDb = await import('../../server/db');
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }])
        })
      } as any);

      const result = await generateUniqueUsername('_@example.com');
      expect(result.username).toBe('user_abc123');
      expect(result.hadConflict).toBe(true);
      expect(result.conflictResolution).toContain('Email sanitization resulted in invalid username');
    });

    it('should handle very short sanitized usernames', async () => {
      const mockDb = await import('../../server/db');
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }])
        })
      } as any);

      const result = await generateUniqueUsername('ab@example.com');
      expect(result.username).toBe('user_abc123');
      expect(result.hadConflict).toBe(true);
      expect(result.conflictResolution).toContain('Email sanitization resulted in invalid username');
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