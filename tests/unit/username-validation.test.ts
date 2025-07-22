import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateUsername, generateUsernameSuggestions, sanitizeEmailToUsername } from '../../server/utils/username';
import { storage } from '../../server/storage';

// Mock the storage module
vi.mock('../../server/storage', () => ({
  storage: {
    checkUsernameAvailability: vi.fn(),
  },
}));

const mockStorage = vi.mocked(storage);

describe('Username Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateUsername', () => {
    it('should reject usernames that are too short', async () => {
      const result = await validateUsername('ab');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username must be at least 3 characters');
    });

    it('should reject usernames that are too long', async () => {
      const result = await validateUsername('a'.repeat(21));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username must be at most 20 characters');
    });

    it('should reject usernames with invalid characters', async () => {
      const result = await validateUsername('user-name');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username can only contain letters, numbers, and underscores');
    });

    it('should accept usernames with uppercase letters (normalized to lowercase)', async () => {
      mockStorage.checkUsernameAvailability.mockResolvedValue(true);
      
      const result = await validateUsername('UserName');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject reserved usernames', async () => {
      const result = await validateUsername('admin');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username is reserved');
      expect(result.suggestions).toBeDefined();
    });

    it('should reject taken usernames and provide suggestions', async () => {
      mockStorage.checkUsernameAvailability.mockResolvedValue(false);
      
      const result = await validateUsername('johndoe');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username is already taken');
      expect(result.suggestions).toBeDefined();
    });

    it('should accept valid available usernames', async () => {
      mockStorage.checkUsernameAvailability.mockResolvedValue(true);
      
      const result = await validateUsername('johndoe123');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept usernames with underscores and numbers', async () => {
      mockStorage.checkUsernameAvailability.mockResolvedValue(true);
      
      const result = await validateUsername('user_123');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('generateUsernameSuggestions', () => {
    beforeEach(() => {
      // Mock availability checks to return true for suggestions
      mockStorage.checkUsernameAvailability.mockImplementation(async (username: string) => {
        // Simulate that numbered suggestions are available
        return /\d+$/.test(username);
      });
    });

    it('should generate numbered suggestions', async () => {
      const suggestions = await generateUsernameSuggestions('johndoe', 3);
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toBe('johndoe1');
      expect(suggestions[1]).toBe('johndoe2');
      expect(suggestions[2]).toBe('johndoe3');
    });

    it('should limit suggestions to maxSuggestions', async () => {
      const suggestions = await generateUsernameSuggestions('johndoe', 2);
      expect(suggestions).toHaveLength(2);
    });

    it('should not exceed 20 character limit', async () => {
      const longUsername = 'verylongusername123';
      const suggestions = await generateUsernameSuggestions(longUsername, 3);
      
      suggestions.forEach(suggestion => {
        expect(suggestion.length).toBeLessThanOrEqual(20);
      });
    });
  });

  describe('sanitizeEmailToUsername', () => {
    it('should extract username from email', () => {
      const result = sanitizeEmailToUsername('john.doe@example.com');
      expect(result).toBe('john_doe');
    });

    it('should handle emails with numbers', () => {
      const result = sanitizeEmailToUsername('user123@example.com');
      expect(result).toBe('user123');
    });

    it('should replace invalid characters with underscores', () => {
      const result = sanitizeEmailToUsername('user-name+tag@example.com');
      expect(result).toBe('user_name_tag');
    });

    it('should remove leading and trailing underscores', () => {
      const result = sanitizeEmailToUsername('-user-@example.com');
      expect(result).toBe('user');
    });

    it('should collapse multiple underscores', () => {
      const result = sanitizeEmailToUsername('user--name@example.com');
      expect(result).toBe('user_name');
    });

    it('should truncate to 20 characters', () => {
      const longEmail = 'verylongusernamethatexceedslimit@example.com';
      const result = sanitizeEmailToUsername(longEmail);
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('should handle edge cases', () => {
      expect(sanitizeEmailToUsername('@example.com')).toBe('');
      expect(sanitizeEmailToUsername('___@example.com')).toBe('');
      expect(sanitizeEmailToUsername('a@example.com')).toBe('a');
    });
  });
});