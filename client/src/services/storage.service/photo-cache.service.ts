/**
 * PhotoCache service for offline image storage using IndexedDB
 * Implements cache-first loading with expiration and cleanup
 */

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

  static getInstance(): PhotoCacheService {
    if (!PhotoCacheService.instance) {
      PhotoCacheService.instance = new PhotoCacheService();
    }
    return PhotoCacheService.instance;
  }

  /**
   * Initialize IndexedDB connection
   */
  async initialize(): Promise<void> {
    if (this.db) {
      return; // Already initialized
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(new Error('Failed to initialize photo cache'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Photo cache initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
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
      };
    });
  }

  /**
   * Cache a photo blob with metadata
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
    await this.ensureInitialized();

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
      
      const request = store.put(entry);
      
      request.onsuccess = () => {
        console.log(`Photo cached: ${storagePath} (${blob.size} bytes)`);
        resolve();
      };
      
      request.onerror = () => {
        console.error('Failed to cache photo:', request.error);
        reject(new Error('Failed to cache photo'));
      };
    });
  }

  /**
   * Retrieve cached photo (cache-first approach)
   */
  async getCachedPhoto(storagePath: string): Promise<PhotoCacheEntry | null> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
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
          // Remove expired entry asynchronously
          this.removeCachedPhoto(storagePath).catch(console.error);
          resolve(null);
          return;
        }

        console.log(`Photo retrieved from cache: ${storagePath}`);
        resolve(entry);
      };
      
      request.onerror = () => {
        console.error('Failed to retrieve cached photo:', request.error);
        reject(new Error('Failed to retrieve cached photo'));
      };
    });
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
    if (!this.db) {
      await this.initialize();
    }
  }
}