import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhotoStorageService } from '../photo-storage.service';

// Mock the dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user' } } }
      })
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn(),
        createSignedUrl: vi.fn(),
        remove: vi.fn()
      })
    }
  }
}));

vi.mock('@/utils/image-compression', () => ({
  compressImage: vi.fn(),
  shouldCompressImage: vi.fn().mockReturnValue(true),
  validateImageFile: vi.fn().mockReturnValue({ isValid: true })
}));

vi.mock('../photo-cache.service', () => ({
  PhotoCacheService: {
    getInstance: vi.fn().mockReturnValue({
      initialize: vi.fn(),
      cachePhoto: vi.fn(),
      getCachedPhoto: vi.fn(),
      removeCachedPhoto: vi.fn(),
      getCachedPhotosForNote: vi.fn(),
      cleanup: vi.fn(),
      getStats: vi.fn(),
      clearAll: vi.fn()
    })
  }
}));

describe('PhotoStorageService', () => {
  let service: PhotoStorageService;

  beforeEach(() => {
    service = PhotoStorageService.getInstance();
  });

  it('should be a singleton', () => {
    const instance1 = PhotoStorageService.getInstance();
    const instance2 = PhotoStorageService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should have the correct bucket name', () => {
    expect(service.getBucketName()).toBe('journal-images');
  });

  it('should have the correct signed URL TTL', () => {
    expect(service.getSignedUrlTTL()).toBe(7 * 24 * 60 * 60); // 7 days in seconds
  });

  it('should have all required methods', () => {
    expect(typeof service.uploadPhoto).toBe('function');
    expect(typeof service.getPhotoUrl).toBe('function');
    expect(typeof service.getPhotoWithCache).toBe('function');
    expect(typeof service.deletePhoto).toBe('function');
    expect(typeof service.getCachedPhotosForNote).toBe('function');
    expect(typeof service.cleanupCache).toBe('function');
    expect(typeof service.getCacheStats).toBe('function');
    expect(typeof service.clearCache).toBe('function');
    expect(typeof service.initializeCache).toBe('function');
  });

  describe('validation', () => {
    it('should validate input parameters', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      // Test with invalid date format
      await expect(
        service.uploadPhoto('user-id', 'invalid-date', mockFile, 'note-id')
      ).rejects.toThrow();
      
      // Test with empty user ID
      await expect(
        service.uploadPhoto('', '2024-01-01', mockFile, 'note-id')
      ).rejects.toThrow();
      
      // Test with empty note ID
      await expect(
        service.uploadPhoto('user-id', '2024-01-01', mockFile, '')
      ).rejects.toThrow();
    });
  });
});