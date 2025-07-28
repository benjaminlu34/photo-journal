import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhotoCacheService } from '../photo-cache.service';

// Mock IndexedDB for testing
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn()
};

// Mock IDBDatabase
const mockDB = {
  transaction: vi.fn(),
  close: vi.fn(),
  objectStoreNames: { contains: vi.fn() },
  createObjectStore: vi.fn()
};

// Mock IDBTransaction and IDBObjectStore
const mockStore = {
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
  clear: vi.fn(),
  createIndex: vi.fn(),
  index: vi.fn()
};

const mockTransaction = {
  objectStore: vi.fn().mockReturnValue(mockStore),
  oncomplete: null,
  onerror: null
};

// Setup global mocks
Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
});

Object.defineProperty(global, 'IDBKeyRange', {
  value: {
    bound: vi.fn(),
    only: vi.fn(),
    lowerBound: vi.fn(),
    upperBound: vi.fn()
  },
  writable: true
});

describe('PhotoCacheService', () => {
  let service: PhotoCacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = PhotoCacheService.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be a singleton', () => {
    const instance1 = PhotoCacheService.getInstance();
    const instance2 = PhotoCacheService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should have all required methods', () => {
    expect(typeof service.initialize).toBe('function');
    expect(typeof service.cachePhoto).toBe('function');
    expect(typeof service.getCachedPhoto).toBe('function');
    expect(typeof service.removeCachedPhoto).toBe('function');
    expect(typeof service.getCachedPhotosForNote).toBe('function');
    expect(typeof service.cleanup).toBe('function');
    expect(typeof service.getStats).toBe('function');
    expect(typeof service.clearAll).toBe('function');
  });

  describe('initialization', () => {
    it('should attempt to open IndexedDB', async () => {
      const mockRequest = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: mockDB
      };

      mockIndexedDB.open.mockReturnValue(mockRequest);

      const initPromise = service.initialize();

      // Simulate successful opening
      if (mockRequest.onsuccess) {
        mockRequest.onsuccess();
      }

      await expect(initPromise).resolves.toBeUndefined();
      expect(mockIndexedDB.open).toHaveBeenCalledWith('PhotoJournalCache', 1);
    });

    it('should handle IndexedDB open errors', async () => {
      const mockRequest = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        error: new Error('IndexedDB not available')
      };

      mockIndexedDB.open.mockReturnValue(mockRequest);

      const initPromise = service.initialize();

      // Simulate error
      if (mockRequest.onerror) {
        mockRequest.onerror();
      }

      await expect(initPromise).rejects.toThrow('Failed to initialize photo cache');
    });
  });

  describe('cache operations', () => {
    beforeEach(() => {
      // Mock successful DB initialization
      const mockRequest = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: mockDB
      };

      mockIndexedDB.open.mockReturnValue(mockRequest);
      mockDB.transaction.mockReturnValue(mockTransaction);
    });

    it('should cache photo data', async () => {
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      const mockPutRequest = {
        onsuccess: null,
        onerror: null
      };

      mockStore.put.mockReturnValue(mockPutRequest);

      const cachePromise = service.cachePhoto(
        'test/path/image.jpg',
        mockBlob,
        'https://signed-url.com',
        {
          noteId: 'note-1',
          journalDate: '2024-01-01',
          userId: 'user-1'
        }
      );

      // Simulate successful put
      if (mockPutRequest.onsuccess) {
        mockPutRequest.onsuccess();
      }

      await expect(cachePromise).resolves.toBeUndefined();
      expect(mockStore.put).toHaveBeenCalled();
    });

    it('should retrieve cached photos', async () => {
      const mockGetRequest = {
        onsuccess: null,
        onerror: null,
        result: {
          storagePath: 'test/path/image.jpg',
          blob: new Blob(['test'], { type: 'image/jpeg' }),
          signedUrl: 'https://signed-url.com',
          expiresAt: new Date(Date.now() + 86400000), // 1 day from now
          noteId: 'note-1',
          journalDate: '2024-01-01',
          userId: 'user-1',
          cachedAt: new Date(),
          size: 4,
          mimeType: 'image/jpeg'
        }
      };

      mockStore.get.mockReturnValue(mockGetRequest);

      const getPromise = service.getCachedPhoto('test/path/image.jpg');

      // Simulate successful get
      if (mockGetRequest.onsuccess) {
        mockGetRequest.onsuccess();
      }

      const result = await getPromise;
      expect(result).toBeTruthy();
      expect(result?.storagePath).toBe('test/path/image.jpg');
      expect(mockStore.get).toHaveBeenCalledWith('test/path/image.jpg');
    });

    it('should handle expired cache entries', async () => {
      const mockGetRequest = {
        onsuccess: null,
        onerror: null,
        result: {
          storagePath: 'test/path/image.jpg',
          blob: new Blob(['test'], { type: 'image/jpeg' }),
          signedUrl: 'https://signed-url.com',
          expiresAt: new Date(Date.now() - 86400000), // 1 day ago (expired)
          noteId: 'note-1',
          journalDate: '2024-01-01',
          userId: 'user-1',
          cachedAt: new Date(),
          size: 4,
          mimeType: 'image/jpeg'
        }
      };

      mockStore.get.mockReturnValue(mockGetRequest);

      const getPromise = service.getCachedPhoto('test/path/image.jpg');

      // Simulate successful get
      if (mockGetRequest.onsuccess) {
        mockGetRequest.onsuccess();
      }

      const result = await getPromise;
      expect(result).toBeNull(); // Should return null for expired entries
    });
  });
});