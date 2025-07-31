/**
 * PhotoCache service for offline image storage using IndexedDB
 * Implements cache-first loading with expiration and cleanup
 * Enhanced with graceful degradation and comprehensive error handling
 */

import { StorageError, StorageErrorFactory, StorageErrorType } from './storage-errors';

export interface PhotoCacheEntry {
  storagePath: string;
  blob: Blob;
  signedUrl: string;
  expiresAt: Date;
  noteId: string;
  journalDate: string;
  userId: string;
  cachedAt: Date;
  size: number;
  mimeType: string;
}

export interface PhotoCacheStats {
  totalEntries: number;
  totalSize: number;
  expiredEntries: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

export class PhotoCacheService {
  private static instance: PhotoCacheService;
  private db: IDBDatabase | null = null;
  private readonly dbName = 'PhotoJournalCache';
  private readonly dbVersion = 1;
  private readonly storeName = 'photos';
  private readonly maxCacheSize = 50 * 1024 * 1024; // 50MB cache limit
  private readonly defaultTTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  private cacheAvailable = true; // Track cache availability
  private initializationError: Error | null = null;

  static getInstance(): PhotoCacheService {
    if (!PhotoCacheService.instance) {
      PhotoCacheService.instance = new PhotoCacheService();
    }
    return PhotoCacheService.instance;
  }

  /**
   * Initialize IndexedDB connection with comprehensive error handling
   */
  async initialize(): Promise<void> {
    if (this.db) {
      return; // Already initialized
    }

    // Check if IndexedDB is available
    if (!window.indexedDB) {
      this.cacheAvailable = false;
      this.initializationError = new Error('IndexedDB is not supported in this browser');
      console.warn('Photo cache unavailable: IndexedDB not supported');
      return;
    }

    try {
      await this.initializeDatabase();
      this.cacheAvailable = true;
      this.initializationError = null;
      console.log('Photo cache initialized successfully');
    } catch (error) {
      this.cacheAvailable = false;
      this.initializationError = error instanceof Error ? error : new Error('Cache initialization failed');
      console.error('Photo cache initialization failed:', error);
      
      // Don't throw - allow app to continue without cache
      console.warn('Continuing without photo cache - images will load from storage each time');
    }
  }

  /**
   * Initialize database with proper error handling
   */
  private initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      
      try {
        request = indexedDB.open(this.dbName, this.dbVersion);
      } catch (error) {
        reject(new Error(`Failed to open IndexedDB: ${error instanceof Error ? error.message : 'Unknown error'}`));
        return;
      }

      request.onerror = () => {
        const error = request.error;
        console.error('IndexedDB open error:', error);
        
        // Provide more specific error messages
        if (error?.name === 'QuotaExceededError') {
          reject(StorageErrorFactory.createQuotaError('cache'));
        } else if (error?.name === 'VersionError') {
          reject(new Error('IndexedDB version conflict. Try refreshing the page.'));
        } else {
          reject(new Error(`Failed to open IndexedDB: ${error?.message || 'Unknown error'}`));
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        
        // Set up error handler for the database
        this.db.onerror = (event) => {
          console.error('IndexedDB error:', event);
        };

        // Handle unexpected database closure
        this.db.onclose = () => {
          console.warn('IndexedDB connection closed unexpectedly');
          this.db = null;
          this.cacheAvailable = false;
        };

        resolve();
      };

      request.onupgradeneeded = (event) => {
        try {
          const db = (event.target as IDBOpenDBRequest).result;
          
          // Create object store if it doesn't exist
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { keyPath: 'storagePath' });
            
            // Create indexes for efficient querying
            store.createIndex('noteId', 'noteId', { unique: false });
            store.createIndex('journalDate', 'journalDate', { unique: false });
            store.createIndex('userId', 'userId', { unique: false });
            store.createIndex('expiresAt', 'expiresAt', { unique: false });
            store.createIndex('cachedAt', 'cachedAt', { unique: false });
            
            console.log('Photo cache object store created');
          }
        } catch (error) {
          console.error('Error during database upgrade:', error);
          reject(new Error(`Database upgrade failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      };

      // Add timeout to prevent hanging
      setTimeout(() => {
        if (request.readyState === 'pending') {
          reject(new Error('IndexedDB initialization timeout'));
        }
      }, 10000); // 10 second timeout
    });
  }

  /**
   * Cache a photo blob with metadata and comprehensive error handling
   */
  async cachePhoto(
    storagePath: string,
    blob: Blob,
    signedUrl: string,
    metadata: {
      noteId: string;
      journalDate: string;
      userId: string;
      ttl?: number;
    }
  ): Promise<void> {
    // Graceful degradation - if cache is unavailable, don't fail
    if (!this.cacheAvailable) {
      console.warn('Photo cache unavailable, skipping cache operation');
      return;
    }

    try {
      await this.ensureInitialized();

      // Check if we have space before caching
      const stats = await this.getStats();
      if (stats.totalSize + blob.size > this.maxCacheSize) {
        console.log('Cache size limit reached, cleaning up before caching new photo');
        await this.cleanup();
      }

      const now = new Date();
      const ttl = metadata.ttl || this.defaultTTL;
      
      const entry: PhotoCacheEntry = {
        storagePath,
        blob,
        signedUrl,
        expiresAt: new Date(now.getTime() + ttl),
        noteId: metadata.noteId,
        journalDate: metadata.journalDate,
        userId: metadata.userId,
        cachedAt: now,
        size: blob.size,
        mimeType: blob.type,
      };

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        transaction.onerror = () => {
          const error = transaction.error;
          console.error('Cache transaction failed:', error);
          
          if (error?.name === 'QuotaExceededError') {
            reject(StorageErrorFactory.createQuotaError('cache'));
          } else {
            reject(new Error(`Cache transaction failed: ${error?.message || 'Unknown error'}`));
          }
        };

        const request = store.put(entry);
        
        request.onsuccess = () => {
          console.log(`Photo cached: ${storagePath} (${blob.size} bytes)`);
          resolve();
        };
        
        request.onerror = () => {
          const error = request.error;
          console.error('Failed to cache photo:', error);
          
          if (error?.name === 'QuotaExceededError') {
            reject(StorageErrorFactory.createQuotaError('cache'));
          } else {
            reject(new Error(`Failed to cache photo: ${error?.message || 'Unknown error'}`));
          }
        };
      });
    } catch (error) {
      // Graceful degradation - log error but don't fail the operation
      console.warn('Photo caching failed, continuing without cache:', error);
      
      // If it's a quota error, try cleanup and inform user
      if (error instanceof StorageError && error.type === StorageErrorType.CACHE_FULL) {
        try {
          await this.cleanup();
          console.log('Cache cleaned up due to quota exceeded');
        } catch (cleanupError) {
          console.error('Cache cleanup failed:', cleanupError);
        }
      }
      
      // Don't throw - allow operation to continue without caching
    }
  }

  /**
   * Retrieve cached photo with graceful degradation
   */
  async getCachedPhoto(storagePath: string): Promise<PhotoCacheEntry | null> {
    // Graceful degradation - if cache is unavailable, return null
    if (!this.cacheAvailable) {
      return null;
    }

    try {
      await this.ensureInitialized();

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        
        transaction.onerror = () => {
          console.error('Cache read transaction failed:', transaction.error);
          resolve(null); // Graceful degradation
        };

        const request = store.get(storagePath);
        
        request.onsuccess = () => {
          const entry = request.result as PhotoCacheEntry | undefined;
          
          if (!entry) {
            resolve(null);
            return;
          }

          // Check if entry has expired
          if (new Date() > entry.expiresAt) {
            console.log(`Cached photo expired: ${storagePath}`);
            // Remove expired entry asynchronously (don't wait)
            this.removeCachedPhoto(storagePath).catch(error => {
              console.warn('Failed to remove expired cache entry:', error);
            });
            resolve(null);
            return;
          }

          console.log(`Photo retrieved from cache: ${storagePath}`);
          resolve(entry);
        };
        
        request.onerror = () => {
          console.error('Failed to retrieve cached photo:', request.error);
          resolve(null); // Graceful degradation instead of rejecting
        };

        // Add timeout to prevent hanging
        setTimeout(() => {
          if (request.readyState === 'pending') {
            console.warn('Cache read timeout, falling back to storage');
            resolve(null);
          }
        }, 5000); // 5 second timeout
      });
    } catch (error) {
      console.warn('Cache retrieval failed, falling back to storage:', error);
      return null; // Graceful degradation
    }
  }

  /**
   * Remove a specific photo from cache
   */
  async removeCachedPhoto(storagePath: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.delete(storagePath);
      
      request.onsuccess = () => {
        console.log(`Photo removed from cache: ${storagePath}`);
        resolve();
      };
      
      request.onerror = () => {
        console.error('Failed to remove cached photo:', request.error);
        reject(new Error('Failed to remove cached photo'));
      };
    });
  }

  /**
   * Get all cached photos for a specific note
   */
  async getCachedPhotosForNote(noteId: string): Promise<PhotoCacheEntry[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('noteId');
      
      const request = index.getAll(noteId);
      
      request.onsuccess = () => {
        const entries = request.result as PhotoCacheEntry[];
        const validEntries = entries.filter(entry => new Date() <= entry.expiresAt);
        
        // Remove expired entries asynchronously
        const expiredEntries = entries.filter(entry => new Date() > entry.expiresAt);
        expiredEntries.forEach(entry => {
          this.removeCachedPhoto(entry.storagePath).catch(console.error);
        });
        
        resolve(validEntries);
      };
      
      request.onerror = () => {
        console.error('Failed to get cached photos for note:', request.error);
        reject(new Error('Failed to get cached photos for note'));
      };
    });
  }

  /**
   * Clean up expired entries and enforce cache size limits
   */
  async cleanup(): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        const entries = request.result as PhotoCacheEntry[];
        const now = new Date();
        
        // Remove expired entries
        const expiredEntries = entries.filter(entry => now > entry.expiresAt);
        const validEntries = entries.filter(entry => now <= entry.expiresAt);
        
        // Calculate total size of valid entries
        const totalSize = validEntries.reduce((sum, entry) => sum + entry.size, 0);
        
        // Remove expired entries
        const deletePromises = expiredEntries.map(entry => 
          this.removeCachedPhoto(entry.storagePath)
        );
        
        // If still over size limit, remove oldest entries
        if (totalSize > this.maxCacheSize) {
          const sortedEntries = validEntries.sort((a, b) => 
            a.cachedAt.getTime() - b.cachedAt.getTime()
          );
          
          let currentSize = totalSize;
          for (const entry of sortedEntries) {
            if (currentSize <= this.maxCacheSize) break;
            
            deletePromises.push(this.removeCachedPhoto(entry.storagePath));
            currentSize -= entry.size;
          }
        }
        
        Promise.all(deletePromises)
          .then(() => {
            console.log(`Cache cleanup completed: removed ${deletePromises.length} entries`);
            resolve();
          })
          .catch(reject);
      };
      
      request.onerror = () => {
        console.error('Failed to cleanup cache:', request.error);
        reject(new Error('Failed to cleanup cache'));
      };
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<PhotoCacheStats> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        const entries = request.result as PhotoCacheEntry[];
        const now = new Date();
        
        const validEntries = entries.filter(entry => now <= entry.expiresAt);
        const expiredEntries = entries.filter(entry => now > entry.expiresAt);
        
        const totalSize = validEntries.reduce((sum, entry) => sum + entry.size, 0);
        
        const cachedDates = validEntries.map(entry => entry.cachedAt);
        const oldestEntry = cachedDates.length > 0 ? new Date(Math.min(...cachedDates.map(d => d.getTime()))) : undefined;
        const newestEntry = cachedDates.length > 0 ? new Date(Math.max(...cachedDates.map(d => d.getTime()))) : undefined;
        
        resolve({
          totalEntries: validEntries.length,
          totalSize,
          expiredEntries: expiredEntries.length,
          oldestEntry,
          newestEntry,
        });
      };
      
      request.onerror = () => {
        console.error('Failed to get cache stats:', request.error);
        reject(new Error('Failed to get cache stats'));
      };
    });
  }

  /**
   * Clear all cached photos
   */
  async clearAll(): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('All cached photos cleared');
        resolve();
      };
      
      request.onerror = () => {
        console.error('Failed to clear cache:', request.error);
        reject(new Error('Failed to clear cache'));
      };
    });
  }

  /**
   * Ensure the database is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.db && this.cacheAvailable) {
      await this.initialize();
    }
    
    if (!this.cacheAvailable) {
      throw new Error('Photo cache is not available');
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.cacheAvailable;
  }

  /**
   * Get initialization error if any
   */
  getInitializationError(): Error | null {
    return this.initializationError;
  }

  /**
   * Get cache health status
   */
  getHealthStatus(): {
    available: boolean;
    error?: Error;
    stats?: PhotoCacheStats;
  } {
    if (!this.cacheAvailable) {
      return {
        available: false,
        error: this.initializationError || new Error('Cache unavailable'),
      };
    }

    return {
      available: true,
    };
  }

  /**
   * Attempt to recover cache functionality
   */
  async attemptRecovery(): Promise<boolean> {
    if (this.cacheAvailable) {
      return true; // Already available
    }

    console.log('Attempting to recover photo cache...');
    
    try {
      // Close existing connection if any
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      // Reset state
      this.cacheAvailable = true;
      this.initializationError = null;

      // Try to reinitialize
      await this.initialize();
      
      if (this.cacheAvailable) {
        console.log('Photo cache recovery successful');
        return true;
      }
    } catch (error) {
      console.error('Photo cache recovery failed:', error);
      this.cacheAvailable = false;
      this.initializationError = error instanceof Error ? error : new Error('Recovery failed');
    }

    return false;
  }

  /**
   * Gracefully handle cache operations with fallback
   */
  async safeOperation<T>(
    operation: () => Promise<T>,
    fallback: T,
    operationName: string
  ): Promise<T> {
    if (!this.cacheAvailable) {
      console.warn(`Cache ${operationName} skipped - cache unavailable`);
      return fallback;
    }

    try {
      return await operation();
    } catch (error) {
      console.warn(`Cache ${operationName} failed, using fallback:`, error);
      
      // If it's a quota error, try cleanup
      if (error instanceof StorageError && error.type === StorageErrorType.CACHE_FULL) {
        try {
          await this.cleanup();
          console.log('Cache cleaned up after quota error');
        } catch (cleanupError) {
          console.error('Cache cleanup failed:', cleanupError);
        }
      }
      
      return fallback;
    }
  }
}