import { describe, it, expect } from 'vitest';
import { 
  generateBoardUrl, 
  parseBoardUrl, 
  isUsernameBoardUrl, 
  isLegacyJournalUrl,
  isValidUsernameForUrl 
} from '../../client/src/lib/navigationUtils';

describe('Username Routing Utils', () => {
  describe('generateBoardUrl', () => {
    it('should generate username-based URL with date', () => {
      const date = new Date(2025, 0, 15); // January 15, 2025 in local time
      const url = generateBoardUrl({ username: 'testuser', date });
      expect(url).toBe('/@testuser/2025-01-15');
    });

    it('should generate username-based URL for today when no date provided', () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const expectedDate = `${year}-${month}-${day}`;
      const url = generateBoardUrl({ username: 'testuser' });
      expect(url).toBe(`/@testuser/${expectedDate}`);
    });

    it('should fallback to journal route when no username provided', () => {
      const date = new Date(2025, 0, 15); // January 15, 2025 in local time
      const url = generateBoardUrl({ date, fallbackToJournal: true });
      expect(url).toBe('/journal/2025-01-15');
    });

    it('should generate root URL for today when no username and no date', () => {
      const url = generateBoardUrl({ fallbackToJournal: true });
      expect(url).toBe('/');
    });
  });

  describe('parseBoardUrl', () => {
    it('should parse username-based URL correctly', () => {
      const result = parseBoardUrl('/@testuser/2025-01-15');
      expect(result.username).toBe('testuser');
      expect(result.date).toEqual(new Date(2025, 0, 15)); // month is 0-indexed
    });

    it('should parse legacy journal URL correctly', () => {
      const result = parseBoardUrl('/journal/2025-01-15');
      expect(result.username).toBeUndefined();
      expect(result.date).toEqual(new Date(2025, 0, 15));
    });

    it('should return empty object for invalid URL', () => {
      const result = parseBoardUrl('/invalid/url');
      expect(result.username).toBeUndefined();
      expect(result.date).toBeUndefined();
    });
  });

  describe('isUsernameBoardUrl', () => {
    it('should return true for valid username board URL', () => {
      expect(isUsernameBoardUrl('/@testuser/2025-01-15')).toBe(true);
    });

    it('should return false for legacy journal URL', () => {
      expect(isUsernameBoardUrl('/journal/2025-01-15')).toBe(false);
    });

    it('should return false for invalid URL', () => {
      expect(isUsernameBoardUrl('/invalid/url')).toBe(false);
    });
  });

  describe('isLegacyJournalUrl', () => {
    it('should return true for legacy journal URL', () => {
      expect(isLegacyJournalUrl('/journal/2025-01-15')).toBe(true);
    });

    it('should return false for username board URL', () => {
      expect(isLegacyJournalUrl('/@testuser/2025-01-15')).toBe(false);
    });

    it('should return false for invalid URL', () => {
      expect(isLegacyJournalUrl('/invalid/url')).toBe(false);
    });
  });

  describe('isValidUsernameForUrl', () => {
    it('should return true for valid username', () => {
      expect(isValidUsernameForUrl('testuser')).toBe(true);
      expect(isValidUsernameForUrl('test_user')).toBe(true);
      expect(isValidUsernameForUrl('user123')).toBe(true);
    });

    it('should return false for invalid username', () => {
      expect(isValidUsernameForUrl('ab')).toBe(false); // too short
      expect(isValidUsernameForUrl('a'.repeat(21))).toBe(false); // too long
      expect(isValidUsernameForUrl('test-user')).toBe(false); // invalid character
      expect(isValidUsernameForUrl('Test_User')).toBe(false); // uppercase
    });
  });
});