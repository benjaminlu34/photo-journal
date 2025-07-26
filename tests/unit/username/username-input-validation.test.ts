import { describe, it, expect } from 'vitest';
import { usernameSchema } from '@shared/schema/schema';

describe('Username Input Validation', () => {
  describe('usernameSchema', () => {
    it('should accept mixed case input and normalize to lowercase', () => {
      const result = usernameSchema.parse('JohnDoe123');
      expect(result).toBe('johndoe123');
    });

    it('should accept lowercase input as-is', () => {
      const result = usernameSchema.parse('johndoe123');
      expect(result).toBe('johndoe123');
    });

    it('should accept uppercase input and normalize to lowercase', () => {
      const result = usernameSchema.parse('JOHNDOE123');
      expect(result).toBe('johndoe123');
    });

    it('should accept underscores and numbers', () => {
      const result = usernameSchema.parse('John_Doe_123');
      expect(result).toBe('john_doe_123');
    });

    it('should reject usernames that are too short', () => {
      expect(() => usernameSchema.parse('ab')).toThrow('Username must be at least 3 characters');
    });

    it('should reject usernames that are too long', () => {
      const longUsername = 'a'.repeat(21);
      expect(() => usernameSchema.parse(longUsername)).toThrow('Username must be at most 20 characters');
    });

    it('should reject usernames with invalid characters', () => {
      expect(() => usernameSchema.parse('john-doe')).toThrow('Username can only contain letters, numbers, and underscores');
      expect(() => usernameSchema.parse('john.doe')).toThrow('Username can only contain letters, numbers, and underscores');
      expect(() => usernameSchema.parse('john@doe')).toThrow('Username can only contain letters, numbers, and underscores');
    });

    it('should reject reserved usernames (case insensitive)', () => {
      expect(() => usernameSchema.parse('admin')).toThrow('Username is reserved');
      expect(() => usernameSchema.parse('ADMIN')).toThrow('Username is reserved');
      expect(() => usernameSchema.parse('Admin')).toThrow('Username is reserved');
      expect(() => usernameSchema.parse('API')).toThrow('Username is reserved');
    });

    it('should accept valid usernames', () => {
      expect(usernameSchema.parse('johndoe')).toBe('johndoe');
      expect(usernameSchema.parse('user123')).toBe('user123');
      expect(usernameSchema.parse('my_username')).toBe('my_username');
      expect(usernameSchema.parse('User_123')).toBe('user_123');
    });
  });
});