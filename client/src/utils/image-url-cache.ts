// URL Cache interface
export interface CachedURL {
  url: string;
  expiresAt: number; // timestamp in milliseconds
  storagePath: string;
  lastAccessed: number; // timestamp for LRU tracking
}

// LRU (Least Recently Used) Cache implementation
class LRUCache<K, V> extends Map<K, V> {
  private maxSize: number;
  
  constructor(maxSize = 200) {
    super();
    this.maxSize = maxSize;
  }
  
  set(key: K, value: V): this {
    // Update last accessed time
    if (value && typeof value === 'object' && 'lastAccessed' in (value as Record<string, unknown>)) {
      (value as { lastAccessed?: number }).lastAccessed = Date.now();
    }
    
    super.set(key, value);
    
    // Remove oldest entries if we exceed max size
    if (this.size > this.maxSize) {
      this.cleanupOldest();
    }
    
    return this;
  }
  
  get(key: K): V | undefined {
    const value = super.get(key);
    
    // Update last accessed time when retrieving
    if (value && typeof value === 'object' && 'lastAccessed' in (value as Record<string, unknown>)) {
      (value as { lastAccessed?: number }).lastAccessed = Date.now();
    }
    
    return value;
  }
  
  private cleanupOldest(): void {
    // Convert to array and sort by lastAccessed time
    const entries = Array.from(this.entries());
    entries.sort((a, b) => {
      const aVal = a[1] as { lastAccessed?: number };
      const bVal = b[1] as { lastAccessed?: number };
      const aTime = aVal.lastAccessed ?? 0;
      const bTime = bVal.lastAccessed ?? 0;
      return aTime - bTime;
    });
    
    // Remove oldest entries until we're at max size
    const entriesToRemove = entries.slice(0, this.size - this.maxSize);
    for (const [key] of entriesToRemove) {
      this.delete(key);
    }
  }
}

// Global URL cache to prevent unnecessary signed URL regeneration
export const globalURLCache = new LRUCache<string, CachedURL>(200);

// Cache management utilities
export const URL_CACHE_TTL = 7 * 60 * 1000; // 7 minutes (slightly less than server's 7 minutes)
export const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function isURLExpired(cachedURL: CachedURL): boolean {
  return Date.now() >= cachedURL.expiresAt;
}

export function getFromCache(storagePath: string): string | null {
  try {
    const cached = globalURLCache.get(storagePath);
    if (!cached) return null;
    
    if (isURLExpired(cached)) {
      globalURLCache.delete(storagePath);
      return null;
    }
    
    return cached.url;
  } catch (error) {
    console.error('Cache retrieval error:', error);
    return null;
  }
}

export function addToCache(storagePath: string, url: string, expiresAt: number): void {
  try {
    globalURLCache.set(storagePath, {
      url,
      expiresAt,
      storagePath,
      lastAccessed: Date.now()
    });
    
    // Clean up expired entries periodically
    if (globalURLCache.size > 150) {
      cleanupExpiredCache();
    }
  } catch (error) {
    console.error('Cache insertion error:', error);
  }
}

export function cleanupExpiredCache(): void {
  try {
    const now = Date.now();
    for (const [key, cached] of globalURLCache.entries()) {
      if (now >= cached.expiresAt) {
        globalURLCache.delete(key);
      }
    }
  } catch (error) {
    console.error('Cache cleanup error:', error);
  }
}

export function clearCacheForStoragePath(storagePath: string): void {
  try {
    globalURLCache.delete(storagePath);
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}

// Development utilities for testing and debugging
export function getCacheStats(): {
  totalEntries: number;
  expiredEntries: number;
  validEntries: number;
  sizeInBytes: number;
} {
  const now = Date.now();
  let expiredEntries = 0;
  let validEntries = 0;
  let sizeInBytes = 0;

  for (const cached of globalURLCache.values()) {
    sizeInBytes += cached.url.length + cached.storagePath.length;
    if (now >= cached.expiresAt) {
      expiredEntries++;
    } else {
      validEntries++;
    }
  }

  return {
    totalEntries: globalURLCache.size,
    expiredEntries,
    validEntries,
    sizeInBytes
  };
}

export function clearAllCache(): void {
  try {
    globalURLCache.clear();
  } catch (error) {
    console.error('Cache clear all error:', error);
  }
}

// Preload multiple URLs in batch (useful for initial page load)
export async function preloadURLs(
  storagePaths: string[],
  fetchURL: (storagePath: string) => Promise<{ signedUrl: string; expiresAt: string }>
): Promise<void> {
  const promises = storagePaths.map(async (storagePath) => {
    try {
      const result = await fetchURL(storagePath);
      const expiresAt = new Date(result.expiresAt).getTime();
      addToCache(storagePath, result.signedUrl, expiresAt);
    } catch (error) {
      console.warn(`Failed to preload URL for ${storagePath}:`, error);
    }
  });

  await Promise.allSettled(promises);
}

// Periodic cleanup mechanism to prevent memory leaks
let cleanupIntervalId: number | null = null;

export function startPeriodicCleanup(): void {
  if (cleanupIntervalId) return; // Already started
  
  cleanupIntervalId = window.setInterval(() => {
    cleanupExpiredCache();
  }, CACHE_CLEANUP_INTERVAL);
}

export function stopPeriodicCleanup(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

// Initialize periodic cleanup when module is loaded
if (typeof window !== 'undefined') {
  startPeriodicCleanup();
  
  // Cleanup on page unload to prevent memory leaks
  window.addEventListener('beforeunload', () => {
    stopPeriodicCleanup();
    clearAllCache();
  });
}