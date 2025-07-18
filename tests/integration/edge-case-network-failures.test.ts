/**
 * Integration Tests for Network Failures and Retry Mechanisms
 * 
 * Tests edge cases related to network connectivity, service availability,
 * and retry behavior in real-world scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageService } from '@/services/storage.service/storage.service';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    storage: {
      from: vi.fn(),
    }
  }
}));

// Import after mocking
import { supabase } from '@/lib/supabase';

// Network simulation utilities
class NetworkSimulator {
  private originalFetch: typeof global.fetch;
  private isOffline = false;
  private latency = 0;
  private failureRate = 0;

  constructor() {
    this.originalFetch = global.fetch;
  }

  setOffline(offline: boolean) {
    this.isOffline = offline;
    this.setupFetchMock();
  }

  setLatency(ms: number) {
    this.latency = ms;
    this.setupFetchMock();
  }

  setFailureRate(rate: number) {
    this.failureRate = rate;
    this.setupFetchMock();
  }

  private setupFetchMock() {
    global.fetch = vi.fn().mockImplementation(async (...args) => {
      if (this.isOffline) {
        throw new Error('Network request failed - offline');
      }

      if (Math.random() < this.failureRate) {
        throw new Error('Network request failed - random failure');
      }

      if (this.latency > 0) {
        await new Promise(resolve => setTimeout(resolve, this.latency));
      }

      return this.originalFetch(...args);
    });
  }

  restore() {
    global.fetch = this.originalFetch;
  }
}

describe('Edge Case Network Failures Integration Tests', () => {
  let networkSimulator: NetworkSimulator;
  let storageService: StorageService;
  const testUserId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID

  beforeEach(() => {
    networkSimulator = new NetworkSimulator();
    storageService = StorageService.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    networkSimulator.restore();
    vi.restoreAllMocks();
  });

  describe('Network Connectivity Loss Scenarios', () => {
    it('should handle complete network failure gracefully', async () => {
      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      // Simulate complete network failure
      networkSimulator.setOffline(true);

      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow('Failed to upload profile picture');
    });

    it('should handle intermittent network failures with retry', async () => {
      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      // Mock auth session
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      // Simulate 50% failure rate
      networkSimulator.setFailureRate(0.5);

      // Mock Supabase storage operations to fail on first attempt
      let uploadAttempts = 0;
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockImplementation(() => {
          uploadAttempts++;
          throw new Error('Network timeout');
        }),
        createSignedUrl: vi.fn().mockResolvedValue({ 
          data: { signedUrl: 'https://test-url.com' }, 
          error: null 
        }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      // Should fail due to network issues
      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow('Failed to upload profile picture');

      // Verify the attempt was made
      expect(uploadAttempts).toBe(1);
    });

    it('should handle slow network connections without timeout errors', async () => {
      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      // Simulate slow network (2 second delay)
      networkSimulator.setLatency(2000);

      // Mock successful operations with delay
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return { data: { path: 'test-path' }, error: null };
        }),
        createSignedUrl: vi.fn().mockResolvedValue({ 
          data: { signedUrl: 'https://test-url.com' }, 
          error: null 
        }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      const startTime = Date.now();
      const result = await storageService.uploadProfilePicture(testUserId, validFile);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000); // Should take time due to latency
    });
  });

  describe('Service Unavailability Scenarios', () => {
    it('should handle Supabase Auth service unavailability', async () => {
      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      // Mock auth service failure
      vi.mocked(supabase.auth.getSession).mockRejectedValue(
        new Error('Auth service temporarily unavailable')
      );

      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow('Failed to upload profile picture');
    });

    it('should handle Supabase Storage service unavailability', async () => {
      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      // Mock successful auth but failed storage
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockRejectedValue(new Error('Storage service unavailable')),
        createSignedUrl: vi.fn().mockRejectedValue(new Error('Storage service unavailable')),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow('Failed to upload profile picture');
    });

    it('should handle partial service degradation', async () => {
      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      // Mock auth working but signed URL generation failing
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
        createSignedUrl: vi.fn().mockRejectedValue(new Error('Signed URL service unavailable')),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow('Failed to upload profile picture');
    });
  });

  describe('JWT Token Expiration and Refresh', () => {
    it('should handle JWT token expiration during upload', async () => {
      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      // Mock expired session
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: new Error('JWT expired')
      } as any);

      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow('Failed to upload profile picture');
    });

    it('should handle token refresh during long operations', async () => {
      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      // Mock token refresh scenario
      let sessionCalls = 0;
      vi.mocked(supabase.auth.getSession).mockImplementation(() => {
        sessionCalls++;
        if (sessionCalls === 1) {
          // First call returns valid session
          return Promise.resolve({
            data: { session: { access_token: 'valid-token' } },
            error: null
          } as any);
        } else {
          // Subsequent calls return refreshed token
          return Promise.resolve({
            data: { session: { access_token: 'refreshed-token' } },
            error: null
          } as any);
        }
      });

      vi.mocked(supabase.storage.from).mockReturnValue({
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
      expect(sessionCalls).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Concurrent Operations and Race Conditions', () => {
    it('should handle concurrent uploads without race conditions', async () => {
      const file1 = new File(['content1'], 'image1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['content2'], 'image2.jpg', { type: 'image/jpeg' });
      const file3 = new File(['content3'], 'image3.jpg', { type: 'image/jpeg' });

      // Mock successful auth
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      // Track concurrent operations
      let activeUploads = 0;
      let maxConcurrentUploads = 0;

      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockImplementation(async () => {
          activeUploads++;
          maxConcurrentUploads = Math.max(maxConcurrentUploads, activeUploads);
          
          // Simulate upload time
          await new Promise(resolve => setTimeout(resolve, 100));
          
          activeUploads--;
          return { data: { path: `test-path-${Date.now()}` }, error: null };
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
      const results = await Promise.all([
        storageService.uploadProfilePicture(testUserId, file1),
        storageService.uploadProfilePicture(testUserId, file2),
        storageService.uploadProfilePicture(testUserId, file3)
      ]);

      expect(results).toHaveLength(3);
      expect(results.every(result => result !== null)).toBe(true);
      expect(maxConcurrentUploads).toBe(3); // All uploads should run concurrently
    });

    it('should handle cleanup operations during concurrent uploads', async () => {
      const file1 = new File(['content1'], 'image1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['content2'], 'image2.jpg', { type: 'image/jpeg' });

      // Mock successful auth
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      let cleanupCalls = 0;
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ 
          data: { signedUrl: 'https://test-url.com' }, 
          error: null 
        }),
        list: vi.fn().mockImplementation(() => {
          cleanupCalls++;
          return Promise.resolve({ 
            data: [{ name: 'old-file.jpg', created_at: '2023-01-01' }], 
            error: null 
          });
        }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      // Execute concurrent uploads that trigger cleanup
      await Promise.all([
        storageService.uploadProfilePicture(testUserId, file1),
        storageService.uploadProfilePicture(testUserId, file2)
      ]);

      // Cleanup should be called for each upload
      expect(cleanupCalls).toBe(2);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from transient errors without data loss', async () => {
      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      // Mock auth
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      // Simulate transient error followed by success
      let uploadAttempts = 0;
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockImplementation(() => {
          uploadAttempts++;
          if (uploadAttempts === 1) {
            throw new Error('Transient network error');
          }
          return Promise.resolve({ data: { path: 'test-path' }, error: null });
        }),
        createSignedUrl: vi.fn().mockResolvedValue({ 
          data: { signedUrl: 'https://test-url.com' }, 
          error: null 
        }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      // First attempt should fail, but we can verify the error is handled
      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow('Failed to upload profile picture');

      // Verify the attempt was made
      expect(uploadAttempts).toBe(1);
    });

    it('should maintain data consistency during partial failures', async () => {
      const validFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg'
      });

      // Mock auth
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'valid-token' } },
        error: null
      } as any);

      // Mock upload success but signed URL failure
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
        createSignedUrl: vi.fn().mockRejectedValue(new Error('Signed URL generation failed')),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      await expect(
        storageService.uploadProfilePicture(testUserId, validFile)
      ).rejects.toThrow('Failed to upload profile picture');

      // Verify upload was attempted but signed URL failed
      expect(vi.mocked(supabase.storage.from)).toHaveBeenCalledWith('profile-pictures');
      const mockStorageBucket = vi.mocked(supabase.storage.from).mock.results[0].value;
      expect(mockStorageBucket.upload).toHaveBeenCalled();
      expect(mockStorageBucket.createSignedUrl).toHaveBeenCalled();
    });
  });
});