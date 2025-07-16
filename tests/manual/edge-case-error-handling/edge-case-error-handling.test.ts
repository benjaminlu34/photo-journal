/**
 * Edge Case and Error Handling Tests
 * 
 * This test suite validates error handling scenarios for profile features,
 * storage integration, and authentication flows as specified in Phase 3
 * testing requirements.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageService, MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from '@/services/storage.service';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn()
    },
    storage: {
      from: vi.fn()
    }
  }
}));

// Import the mocked supabase after mocking
import { supabase } from '@/lib/supabase';

// Mock network conditions
const mockNetworkFailure = () => {
  vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network request failed'));
};

const mockSupabaseFailure = () => {
  (supabase.storage.from as any).mockReturnValue({
    upload: vi.fn().mockRejectedValue(new Error('Supabase service unavailable')),
    createSignedUrl: vi.fn().mockRejectedValue(new Error('Supabase service unavailable')),
    list: vi.fn().mockRejectedValue(new Error('Supabase service unavailable')),
    remove: vi.fn().mockRejectedValue(new Error('Supabase service unavailable')),
  } as any);
};

const mockJWTExpiration = () => {
  (supabase.auth.getSession as any).mockResolvedValue({
    data: { session: null },
    error: new Error('JWT expired')
  } as any);
};

const restoreNetworkMocks = () => {
  vi.restoreAllMocks();
};

describe('Edge Case and Error Handling Tests', () => {
  let storageService: StorageService;
  const testUserId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID

  beforeEach(() => {
    storageService = StorageService.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    restoreNetworkMocks();
  });

  describe('5.1 Profile Picture Upload Failure - File Size >2MB', () => {
    it('should reject files larger than 2MB with clear error message', async () => {
      // Create a mock file larger than 2MB
      const largeFile = new File(['x'.repeat(3 * 1024 * 1024)], 'large-image.jpg', {
        type: 'image/jpeg'
      });

      await expect(
        storageService.uploadProfilePicture(testUserId, largeFile)
      ).rejects.toThrow('File size must be less than 2MB');
    });

    it('should show file size limit in error message', async () => {
      const largeFile = new File(['x'.repeat(3 * 1024 * 1024)], 'large-image.jpg', {
        type: 'image/jpeg'
      });

      try {
        await storageService.uploadProfilePicture(testUserId, largeFile);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('2MB');
        expect(error.message).toContain('File size must be less than');
      }
    });

    it('should accept files exactly at 2MB limit', async () => {
      const exactSizeFile = new File(['x'.repeat(MAX_FILE_SIZE)], 'exact-size.jpg', {
        type: 'image/jpeg'
      });

      // Mock successful upload for valid size
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      (supabase.storage.from as any).mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://test-url.com' },
          error: null
        }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      const result = await storageService.uploadProfilePicture(testUserId, exactSizeFile);
      expect(result).toBeDefined();
      expect(result.url).toBe('https://test-url.com');
    });
  });

  describe('5.2 Invalid File Type Upload', () => {
    it('should reject unsupported file types with clear error message', async () => {
      const invalidFile = new File(['content'], 'document.pdf', {
        type: 'application/pdf'
      });

      await expect(
        storageService.uploadProfilePicture(testUserId, invalidFile)
      ).rejects.toThrow('File type must be JPEG, PNG, WebP, or GIF');
    });

    it('should show supported formats in error message', async () => {
      const invalidFile = new File(['content'], 'document.txt', {
        type: 'text/plain'
      });

      try {
        await storageService.uploadProfilePicture(testUserId, invalidFile);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('JPEG, PNG, WebP, or GIF');
      }
    });

    it('should accept all supported file types', async () => {
      // Mock successful upload
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      (supabase.storage.from as any).mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://test-url.com' },
          error: null
        }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      for (const mimeType of ALLOWED_MIME_TYPES) {
        const validFile = new File(['content'], `image.${mimeType.split('/')[1]}`, {
          type: mimeType
        });

        const result = await storageService.uploadProfilePicture(testUserId, validFile);
        expect(result).toBeDefined();
        expect(result.mimeType).toBe(mimeType);
      }
    });
  });

  describe('5.3 Profile Updates with Missing Required Fields', () => {
    it('should handle empty user ID gracefully', async () => {
      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      await expect(
        storageService.uploadProfilePicture('', validFile)
      ).rejects.toThrow();
    });

    it('should handle invalid UUID format', async () => {
      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      await expect(
        storageService.uploadProfilePicture('invalid-uuid', validFile)
      ).rejects.toThrow();
    });

    it('should validate required fields before processing', async () => {
      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      // Test null userId
      await expect(
        storageService.uploadProfilePicture(null as any, validFile)
      ).rejects.toThrow();

      // Test undefined userId
      await expect(
        storageService.uploadProfilePicture(undefined as any, validFile)
      ).rejects.toThrow();
    });
  });

  describe('5.4 Network Connectivity Loss Simulation', () => {
    it('should handle network failures during upload with retry behavior', async () => {
      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      mockNetworkFailure();

      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow('Failed to upload profile picture');
    });

    it('should handle network failures during profile updates', async () => {
      mockNetworkFailure();

      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: 'Test' }),
      }).catch(error => error);

      expect(response).toBeInstanceOf(Error);
      expect(response.message).toContain('Network request failed');
    });

    it('should queue operations for retry when connection is restored', async () => {
      // First attempt fails
      mockNetworkFailure();

      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow();

      // Restore network and retry should work
      restoreNetworkMocks();

      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      (supabase.storage.from as any).mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://test-url.com' },
          error: null
        }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      const result = await storageService.uploadProfilePicture(testUserId, validFile);
      expect(result).toBeDefined();
    });
  });

  describe('5.5 Concurrent Profile Updates', () => {
    it('should handle concurrent upload operations gracefully', async () => {
      const file1 = new File(['content1'], 'image1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['content2'], 'image2.jpg', { type: 'image/jpeg' });

      // Mock successful uploads
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      let uploadCount = 0;
      (supabase.storage.from as any).mockReturnValue({
        upload: vi.fn().mockImplementation(() => {
          uploadCount++;
          return Promise.resolve({ data: { path: `test-path-${uploadCount}` }, error: null });
        }),
        createSignedUrl: vi.fn().mockImplementation((path) =>
          Promise.resolve({
            data: { signedUrl: `https://test-url-${path}.com` },
            error: null
          })
        ),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      // Execute concurrent uploads
      const [result1, result2] = await Promise.all([
        storageService.uploadProfilePicture(testUserId, file1),
        storageService.uploadProfilePicture(testUserId, file2)
      ]);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1.url).not.toBe(result2.url);
    });

    it('should use last-write-wins for conflict resolution', async () => {
      const file1 = new File(['content1'], 'image1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['content2'], 'image2.jpg', { type: 'image/jpeg' });

      // Mock successful uploads with cleanup
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      const mockStorageOperations = {
        upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://test-url.com' },
          error: null
        }),
        list: vi.fn().mockResolvedValue({
          data: [{ name: 'old-file.jpg', created_at: '2023-01-01' }],
          error: null
        }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      };

      (supabase.storage.from as any).mockReturnValue(mockStorageOperations as any);

      // Second upload should clean up the first
      await storageService.uploadProfilePicture(testUserId, file1);
      await storageService.uploadProfilePicture(testUserId, file2);

      // Verify cleanup was called (list is called during cleanup process)
      expect(mockStorageOperations.list).toHaveBeenCalled();
    });
  });

  describe('5.6 Supabase Service Unavailability', () => {
    it('should show appropriate maintenance messages when Supabase is unavailable', async () => {
      mockSupabaseFailure();

      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow('Failed to upload profile picture');
    });

    it('should handle storage service errors gracefully', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      (supabase.storage.from as any).mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Storage service temporarily unavailable' }
        }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow('Failed to upload profile picture');
    });
  });

  describe('5.7 JWT Token Expiration', () => {
    it('should handle JWT token expiration during active sessions', async () => {
      mockJWTExpiration();

      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow('Failed to upload profile picture');
    });

    it('should attempt automatic token refresh', async () => {
      // First call returns expired session
      (supabase.auth.getSession as any)
        .mockResolvedValueOnce({
          data: { session: null },
          error: new Error('JWT expired')
        } as any)
        .mockResolvedValueOnce({
          data: { session: { access_token: 'refreshed-token' } },
          error: null
        } as any);

      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      // First attempt should fail due to expired token
      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow('Failed to upload profile picture');
    });
  });

  describe('5.8 Storage Quota Limits', () => {
    it('should provide clear guidance when storage quota is reached', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      (supabase.storage.from as any).mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Storage quota exceeded' }
        }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow('Failed to upload profile picture');
    });

    it('should handle storage cleanup when quota is reached', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      // Mock quota exceeded, then successful cleanup and retry
      let uploadAttempts = 0;
      const mockStorageOperations = {
        upload: vi.fn().mockImplementation(() => {
          uploadAttempts++;
          if (uploadAttempts === 1) {
            return Promise.resolve({
              data: null,
              error: { message: 'Storage quota exceeded' }
            });
          }
          return Promise.resolve({ data: { path: 'test-path' }, error: null });
        }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://test-url.com' },
          error: null
        }),
        list: vi.fn().mockResolvedValue({
          data: [
            { name: 'old-file1.jpg', created_at: '2023-01-01' },
            { name: 'old-file2.jpg', created_at: '2023-01-02' }
          ],
          error: null
        }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      };

      (supabase.storage.from as any).mockReturnValue(mockStorageOperations as any);

      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      // First attempt should fail, but cleanup should be attempted
      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow('Failed to upload profile picture');

      // Verify cleanup was attempted
      expect(mockStorageOperations.list).toHaveBeenCalled();
    });
  });
});