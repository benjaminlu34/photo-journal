import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateUsername } from '../../../server/utils/username';
import { storage } from '../../../server/storage';

// Mock the storage module
vi.mock('../../../server/storage', () => ({
  storage: {
    checkUsernameAvailability: vi.fn(),
  },
}));

const mockStorage = vi.mocked(storage);

describe('Username Case Normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should accept uppercase letters and normalize them to lowercase', async () => {
    mockStorage.checkUsernameAvailability.mockResolvedValue(true);
    
    const result = await validateUsername('TestUpperCaseName');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
    
    // Verify that the availability check was called with lowercase version
    expect(mockStorage.checkUsernameAvailability).toHaveBeenCalledWith('testuppercasename');
  });

  it('should accept mixed case usernames and normalize them', async () => {
    mockStorage.checkUsernameAvailability.mockResolvedValue(true);
    
    const result = await validateUsername('MyUserName123');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
    
    // Verify that the availability check was called with lowercase version
    expect(mockStorage.checkUsernameAvailability).toHaveBeenCalledWith('myusername123');
  });

  it('should handle uppercase letters with underscores', async () => {
    mockStorage.checkUsernameAvailability.mockResolvedValue(true);
    
    const result = await validateUsername('Test_User_Name');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
    
    // Verify that the availability check was called with lowercase version
    expect(mockStorage.checkUsernameAvailability).toHaveBeenCalledWith('test_user_name');
  });

  it('should still reject invalid characters even with uppercase letters', async () => {
    const result = await validateUsername('Test-User-Name');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Username can only contain letters, numbers, and underscores');
    
    // Should not call availability check for invalid format
    expect(mockStorage.checkUsernameAvailability).not.toHaveBeenCalled();
  });

  it('should handle taken usernames with uppercase input', async () => {
    mockStorage.checkUsernameAvailability.mockResolvedValue(false);
    
    const result = await validateUsername('TakenUsername');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Username is already taken');
    expect(result.suggestions).toBeDefined();
    
    // Verify that the availability check was called with lowercase version
    expect(mockStorage.checkUsernameAvailability).toHaveBeenCalledWith('takenusername');
  });
});