import { describe, it, expect } from 'vitest';
import { 
  formatUsername, 
  getUserDisplayName, 
  getShortDisplayName, 
  getUserInitials,
  hasUsername,
  type UserDisplayData 
} from '../../client/src/lib/usernameUtils';

describe('Username Utilities', () => {
  const testUser: UserDisplayData = {
    id: 'test-user-1',
    username: 'johndoe',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com'
  };

  const testUserNoUsername: UserDisplayData = {
    id: 'test-user-2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com'
  };

  const testUserEmailOnly: UserDisplayData = {
    id: 'test-user-3',
    email: 'user@example.com'
  };

  describe('formatUsername', () => {
    it('should add @ prefix to username', () => {
      expect(formatUsername('johndoe')).toBe('@johndoe');
    });
  });

  describe('getUserDisplayName', () => {
    it('should prefer username with @ prefix', () => {
      expect(getUserDisplayName(testUser)).toBe('@johndoe');
    });

    it('should fall back to full name when no username', () => {
      expect(getUserDisplayName(testUserNoUsername)).toBe('Jane Smith');
    });

    it('should fall back to first name only when no last name', () => {
      const user = { ...testUserNoUsername, lastName: undefined };
      expect(getUserDisplayName(user)).toBe('Jane');
    });

    it('should fall back to email name when no other info', () => {
      expect(getUserDisplayName(testUserEmailOnly)).toBe('User');
    });

    it('should return Anonymous User when no info available', () => {
      const user = { id: 'test', email: undefined };
      expect(getUserDisplayName(user)).toBe('Anonymous User');
    });
  });

  describe('getShortDisplayName', () => {
    it('should prefer username with @ prefix', () => {
      expect(getShortDisplayName(testUser)).toBe('@johndoe');
    });

    it('should fall back to first name when no username', () => {
      expect(getShortDisplayName(testUserNoUsername)).toBe('Jane');
    });

    it('should fall back to email name when no other info', () => {
      expect(getShortDisplayName(testUserEmailOnly)).toBe('User');
    });

    it('should return Anonymous when no info available', () => {
      const user = { id: 'test', email: undefined };
      expect(getShortDisplayName(user)).toBe('Anonymous');
    });
  });

  describe('getUserInitials', () => {
    it('should use first and last name initials', () => {
      expect(getUserInitials(testUser)).toBe('JD');
    });

    it('should use first name initial only when no last name', () => {
      const user = { ...testUser, lastName: undefined };
      expect(getUserInitials(user)).toBe('J');
    });

    it('should use username initial when no names', () => {
      const user = { id: 'test', username: 'johndoe' };
      expect(getUserInitials(user)).toBe('J');
    });

    it('should use email initial when no other info', () => {
      expect(getUserInitials(testUserEmailOnly)).toBe('U');
    });

    it('should return A when no info available', () => {
      const user = { id: 'test' };
      expect(getUserInitials(user)).toBe('A');
    });
  });

  describe('hasUsername', () => {
    it('should return true when user has username', () => {
      expect(hasUsername(testUser)).toBe(true);
    });

    it('should return false when user has no username', () => {
      expect(hasUsername(testUserNoUsername)).toBe(false);
    });

    it('should return false when username is empty string', () => {
      const user = { ...testUser, username: '' };
      expect(hasUsername(user)).toBe(false);
    });

    it('should return false when username is only whitespace', () => {
      const user = { ...testUser, username: '   ' };
      expect(hasUsername(user)).toBe(false);
    });
  });
});