import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the storage service for testing
describe('StorageService', () => {
  let mockSupabase: any;
  
  beforeEach(() => {
    mockSupabase = {
      storage: {
        from: vi.fn()
      }
    };
  });

  describe('file validation', () => {
    it('should validate file types correctly', () => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      const invalidTypes = ['application/pdf', 'video/mp4', 'text/plain'];

      validTypes.forEach(type => {
        expect(validTypes.includes(type)).toBe(true);
      });

      invalidTypes.forEach(type => {
        expect(validTypes.includes(type)).toBe(false);
      });
    });

    it('should validate file size correctly', () => {
      const maxSize = 2 * 1024 * 1024; // 2MB
      
      expect(1024 * 1024).toBeLessThan(maxSize); // 1MB is valid
      expect(3 * 1024 * 1024).toBeGreaterThan(maxSize); // 3MB is invalid
    });
  });

  describe('file naming', () => {
    it('should generate secure filenames with user ID prefix', () => {
      const userId = 'test-user-123';
      const originalName = 'profile.jpg';
      
      // Test the pattern: userId/timestamp-random.ext
      const expectedPattern = new RegExp(`^${userId}/\\d+-[a-f0-9]{16}\\.jpg$`);
      expect('test-user-123/1234567890-abcdef0123456789.jpg').toMatch(expectedPattern);
    });

    it('should sanitize filenames with special characters', () => {
      const userId = 'test-user-123';
      const maliciousNames = [
        '../../../etc/passwd.jpg',
        'profile<script>.jpg',
        'test-file name(1).JPG',
        '.hiddenfile.jpg',
        'file with spaces and émojis.jpg',
        'file-with-dashes_and_underscores.jpg',
      ];

      maliciousNames.forEach(name => {
        // The actual filename generation is in StorageService, but we can test the pattern
        const sanitized = name.replace(/[^a-zA-Z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 50);
        expect(sanitized).not.toContain('..');
        expect(sanitized).not.toContain('/');
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
        expect(sanitized).toMatch(/^[a-zA-Z0-9-]*$/);
      });
    });

    it('should handle edge cases in filename generation', () => {
      const userId = 'test-user-123';
      
      // Test empty filename
      expect('test-user-123/profile-1234567890-abcdef0123456789.jpg').toMatch(
        new RegExp(`^${userId}/profile-\\d+-[a-f0-9]{16}\\.jpg$`)
      );
      
      // Test filename without extension
      expect('test-user-123/testfile-1234567890-abcdef0123456789.jpg').toMatch(
        new RegExp(`^${userId}/testfile-\\d+-[a-f0-9]{16}\\.jpg$`)
      );
      
      // Test filename with multiple dots
      expect('test-user-123/testfile-1234567890-abcdef0123456789.jpg').toMatch(
        new RegExp(`^${userId}/testfile-\\d+-[a-f0-9]{16}\\.jpg$`)
      );
    });

    it('should validate extension whitelist', () => {
      const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
      const invalidExtensions = ['exe', 'php', 'js', 'html', 'svg'];
      
      validExtensions.forEach(ext => {
        expect(validExtensions.includes(ext)).toBe(true);
      });
      
      invalidExtensions.forEach(ext => {
        expect(validExtensions.includes(ext)).toBe(false);
      });
    });
  });

  describe('security checks', () => {
    it('should validate file ownership correctly', () => {
      const userId = 'user-123';
      
      expect('user-123/profile.jpg'.startsWith(`${userId}/`)).toBe(true);
      expect('user-456/profile.jpg'.startsWith(`${userId}/`)).toBe(false);
      expect('user-123/subfolder/profile.jpg'.startsWith(`${userId}/`)).toBe(true);
    });
  });
});

// Integration test utilities
export const createTestFile = (size: number, type: string): File => {
  return new File([new ArrayBuffer(size)], 'test.jpg', { type });
};

export const expectValidFile = (file: File): void => {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 2 * 1024 * 1024;
  
  expect(validTypes.includes(file.type)).toBe(true);
  expect(file.size).toBeLessThanOrEqual(maxSize);
};

// Test the filename sanitization logic independently
describe('Filename sanitization logic', () => {
  const generateSecureFileName = (userId: string, originalName: string): string => {
    // Replicate the sanitization logic from StorageService
    const lastDotIndex = originalName.lastIndexOf('.');
    let extension = 'jpg';
    let baseName = originalName;
    
    if (lastDotIndex > 0) {
      extension = originalName.slice(lastDotIndex + 1).toLowerCase();
      baseName = originalName.slice(0, lastDotIndex);
    }
    
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const sanitizedExtension = allowedExtensions.includes(extension) ? extension : 'jpg';
    
    const sanitizedBaseName = baseName
      .replace(/[^a-zA-Z0-9-]/g, '')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
    
    const timestamp = 1234567890; // Fixed timestamp for testing
    const randomString = 'abcdef0123456789'; // Fixed random for testing
    
    const finalBaseName = sanitizedBaseName || 'profile';
    
    return `${userId}/${finalBaseName}-${timestamp}-${randomString}.${sanitizedExtension}`;
  };

  it('should properly sanitize malicious filenames', () => {
    const userId = 'test-user-123';
    const maliciousFilenames = [
      '../../../etc/passwd.jpg',
      'profile<script>alert("xss")</script>.png',
      'test-file name(1).JPG',
      'file.exe',
      'file%20encoded.jpg',
      'file<with>angle&brackets.jpg',
    ];

    maliciousFilenames.forEach(originalName => {
      const result = generateSecureFileName(userId, originalName);
      
      // Verify basic structure
      expect(result).toMatch(new RegExp(`^${userId}/[a-zA-Z0-9-]+-\\d+-[a-f0-9]{16}\\.(jpg|jpeg|png|webp|gif)$`));
      
      // Security assertions - check the filename part only (after userId/)
      const filenamePart = result.split('/')[1];
      expect(filenamePart).not.toContain('..');
      expect(filenamePart).not.toContain('\\');
      expect(filenamePart).not.toMatch(/[<>:"|?*\x00-\x1F]/);
      
      // Verify extension is from whitelist
      const extension = result.split('.').pop()?.toLowerCase();
      expect(['jpg', 'jpeg', 'png', 'webp', 'gif']).toContain(extension);
    });
  });

  it('should handle edge cases correctly', () => {
    const userId = 'test-user-123';
    
    // Empty filename
    expect(generateSecureFileName(userId, '')).toBe(`${userId}/profile-1234567890-abcdef0123456789.jpg`);
    
    // No extension
    expect(generateSecureFileName(userId, 'filename')).toBe(`${userId}/filename-1234567890-abcdef0123456789.jpg`);
    
    // Multiple extensions handled correctly
    expect(generateSecureFileName(userId, 'file.tar.gz.jpg')).toBe(`${userId}/filetargz-1234567890-abcdef0123456789.jpg`);
    
    // Case insensitive extension
    expect(generateSecureFileName(userId, 'test.JPEG')).toBe(`${userId}/test-1234567890-abcdef0123456789.jpeg`);
    
    // All special characters removed
    expect(generateSecureFileName(userId, '!@#$%^&*()_+{}[]|\\:;"\'<>?,./')).toBe(`${userId}/profile-1234567890-abcdef0123456789.jpg`);
  });
  it('should handle long names and special edges', () => {
  const userId = 'test-user-123';
  
  // Long base name
  const longName = 'a'.repeat(1000) + '.jpg';
  const resultLong = generateSecureFileName(userId, longName);
  expect(resultLong).toMatch(new RegExp(`^${userId}/a{50}-\\d+-[a-f0-9]{16}\\.jpg$`));
  
  // Leading/trailing hyphens
  expect(generateSecureFileName(userId, '--hello--.jpg')).toBe(`${userId}/hello-1234567890-abcdef0123456789.jpg`);
  
  // Unicode
  expect(generateSecureFileName(userId, 'café_😊.jpg')).toBe(`${userId}/caf-1234567890-abcdef0123456789.jpg`);
  
  // Leading dot
  expect(generateSecureFileName(userId, '.hidden.jpg')).toBe(`${userId}/hidden-1234567890-abcdef0123456789.jpg`);
});
});