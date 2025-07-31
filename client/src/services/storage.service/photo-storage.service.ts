import { BaseStorageService, BaseStorageUploadResult, StorageConfig, ALLOWED_MIME_TYPES } from './base-storage.service';
import { compressImage, shouldCompressImage, validateImageFile, CompressionResult } from '@/utils/image-compression';
import { PhotoCacheService, PhotoCacheEntry } from './photo-cache.service';
import { StorageError, StorageErrorFactory, StorageErrorType, StorageErrorRecovery } from './storage-errors';
import { StorageHealthService } from './storage-health.service';
import { z } from 'zod';
import path from 'path';

export interface PhotoUploadResult extends BaseStorageUploadResult {
  storagePath: string;
  signedUrl: string;
  compressionInfo?: CompressionResult;
}

export interface PhotoUploadOptions {
  compress?: boolean;
  quality?: number;
  maxDimension?: number;
}

const photoUploadSchema = z.object({
  file: z.instanceof(File),
  userId: z.string().min(1),
  journalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  noteId: z.string().min(1),
});

/**
 * PhotoStorageService extends BaseStorageService to handle journal image uploads
 * Supports compression, signed URLs, and offline caching
 * Enhanced with comprehensive error handling and recovery mechanisms
 */
export class PhotoStorageService extends BaseStorageService {
  private static photoInstance: PhotoStorageService;
  private readonly cacheService = PhotoCacheService.getInstance();

  protected config: StorageConfig = {
    bucket: 'journal-images',
    signedUrlTTL: 7 * 24 * 60 * 60, // 7 days in seconds
    maxFileSize: 10 * 1024 * 1024, // 10MB for journal images
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  };

  static getInstance(): PhotoStorageService {
    if (!PhotoStorageService.photoInstance) {
      PhotoStorageService.photoInstance = new PhotoStorageService();
    }
    return PhotoStorageService.photoInstance;
  }

  /**
   * Upload a photo with optional compression and comprehensive error handling
   * Implements deterministic path structure: userId/yyyy-mm-dd/noteId/filename
   */
  async uploadPhoto(
    userId: string,
    journalDate: string,
    file: File,
    noteId: string,
    options: PhotoUploadOptions = {}
  ): Promise<PhotoUploadResult> {
    try {
      // Check storage health first
      if (!this.healthService.isStorageAvailable()) {
        const status = this.healthService.getHealthStatus();
        if (status.error) {
          throw status.error;
        }
        throw StorageErrorFactory.createServiceUnavailableError('storage');
      }

      // Validate input with enhanced error handling
      try {
        const fileUploadSchema = this.createFileValidationSchema().extend({
          journalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
          noteId: z.string().min(1),
        });
        fileUploadSchema.parse({ file, userId, journalDate, noteId });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const issue = error.issues[0];
          if (issue.path.includes('file')) {
            // File validation error - convert to StorageError
            if (issue.message.includes('size')) {
              throw StorageErrorFactory.createFileValidationError(file, 'size', this.config.maxFileSize);
            } else if (issue.message.includes('type')) {
              throw StorageErrorFactory.createFileValidationError(file, 'type');
            }
          }
          throw new StorageError({
            type: StorageErrorType.UPLOAD_FAILED,
            message: `Validation failed: ${issue.message}`,
            userMessage: 'Invalid upload parameters. Please try again.',
            recoverable: true,
            retryable: false,
            suggestedActions: ['Check the file and try again'],
            originalError: error,
          });
        }
        throw error;
      }

      // Enhanced image file validation
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        throw StorageErrorFactory.createFileValidationError(file, 'type');
      }

      // Check for file corruption
      const isCorrupted = await this.detectFileCorruption(file);
      if (isCorrupted) {
        throw StorageErrorFactory.createFileValidationError(file, 'corrupted');
      }

      // Check storage quota
      const quotaCheck = await this.checkStorageQuota();
      if (!quotaCheck.available) {
        throw StorageErrorFactory.createQuotaError('storage', quotaCheck.usage, quotaCheck.limit);
      }

      let fileToUpload = file;
      let compressionInfo: CompressionResult | undefined;

      // Apply compression with error handling
      const shouldCompress = options.compress !== false && shouldCompressImage(file);
      if (shouldCompress) {
        try {
          compressionInfo = await compressImage(file, {
            quality: options.quality || 0.85,
            maxWidthOrHeight: options.maxDimension || 1920,
          });
          fileToUpload = compressionInfo.compressedFile;

          console.log(`Image compressed: ${file.size} → ${fileToUpload.size} bytes (${compressionInfo.sizeIncreasePercentage.toFixed(1)}% change)`);
        } catch (error) {
          console.warn('Image compression failed, using original file:', error);

          // Create compression error but continue with original file
          const compressionError = StorageErrorFactory.createCompressionError(
            error instanceof Error ? error : new Error('Compression failed'),
            true // fallback used
          );

          // Log the error but don't throw - we'll use the original file
          console.warn('Compression error (continuing with original):', compressionError.getUserMessage());
        }
      }

      // Upload to server endpoint instead of direct Supabase upload
      const uploadResult = await this.uploadToServer(fileToUpload, userId, journalDate, noteId);
      
      const storagePath = uploadResult.storagePath;
      const signedUrl = uploadResult.url;

      // Cache the uploaded file for offline access (non-blocking)
      this.cacheUploadedPhoto(storagePath, fileToUpload, signedUrl, {
        noteId,
        journalDate,
        userId,
      }).catch(cacheError => {
        console.warn('Failed to cache uploaded photo:', cacheError);
        // Don't fail the upload if caching fails
      });

      return {
        url: signedUrl,
        path: storagePath, // Use storagePath as the path
        storagePath,
        signedUrl,
        size: fileToUpload.size,
        mimeType: fileToUpload.type,
        compressionInfo,
      };
    } catch (error) {
      console.error('Photo upload failed:', error);

      if (error instanceof StorageError) {
        throw error;
      }

      // Convert generic errors to StorageError
      throw StorageErrorFactory.createFromError(
        error instanceof Error ? error : new Error('Upload failed'),
        'photo upload'
      );
    }
  }

  /**
   * Get photo with cache-first approach and stale-while-revalidate pattern
   * Enhanced with comprehensive error handling and graceful degradation
   */
  async getPhotoWithCache(
    storagePath: string,
    userId: string,
    options?: {
      onStaleUpdate?: (freshUrl: string) => void;
      maxStaleAge?: number; // in milliseconds
      fallbackToCache?: boolean; // Use cache even if stale when storage unavailable
    }
  ): Promise<{ url: string; fromCache: boolean; isStale?: boolean; error?: StorageError }> {
    const maxStaleAge = options?.maxStaleAge || 24 * 60 * 60 * 1000; // 24 hours default

    try {
      // Check cache first
      const cachedEntry = await this.cacheService.getCachedPhoto(storagePath);
      if (cachedEntry) {
        const blobUrl = URL.createObjectURL(cachedEntry.blob);
        const age = Date.now() - cachedEntry.cachedAt.getTime();
        const isStale = age > maxStaleAge;

        // If storage is unavailable, use cache regardless of staleness
        if (!this.healthService.isStorageAvailable()) {
          console.log(`Using cached image (storage unavailable): ${storagePath}`);
          return {
            url: blobUrl,
            fromCache: true,
            isStale: true,
            error: this.healthService.getHealthStatus().error
          };
        }

        // If stale but storage available, trigger background revalidation
        if (isStale && options?.onStaleUpdate) {
          this.revalidateInBackground(storagePath, userId, options.onStaleUpdate)
            .catch(error => {
              console.warn('Background revalidation failed:', error);
            });
        }

        return { url: blobUrl, fromCache: true, isStale };
      }

      // Cache miss - try to get from storage
      try {
        const signedUrl = await this.getPhotoUrl(storagePath, userId);

        // Fetch the image and cache it for future use (non-blocking)
        this.fetchAndCache(storagePath, signedUrl, userId).catch(error => {
          console.warn('Failed to cache fetched photo:', error);
        });

        return { url: signedUrl, fromCache: false };
      } catch (storageError) {
        // If storage fails and we have fallback cache option, check for any cached version
        if (options?.fallbackToCache) {
          const anyCachedEntry = await this.cacheService.getCachedPhoto(storagePath);
          if (anyCachedEntry) {
            const blobUrl = URL.createObjectURL(anyCachedEntry.blob);
            console.log(`Using stale cached image due to storage error: ${storagePath}`);
            return {
              url: blobUrl,
              fromCache: true,
              isStale: true,
              error: storageError instanceof StorageError ? storageError : undefined
            };
          }
        }

        throw storageError;
      }
    } catch (error) {
      console.error('Failed to get photo with cache:', error);

      if (error instanceof StorageError) {
        throw error;
      }

      throw StorageErrorFactory.createFromError(
        error instanceof Error ? error : new Error('Failed to get photo'),
        'photo retrieval'
      );
    }
  }

  /**
   * Background revalidation for stale-while-revalidate pattern
   */
  private async revalidateInBackground(
    storagePath: string,
    userId: string,
    onUpdate: (freshUrl: string) => void
  ): Promise<void> {
    try {
      const signedUrl = await this.getPhotoUrl(storagePath, userId);
      const response = await fetch(signedUrl);

      if (response.ok) {
        const blob = await response.blob();
        const freshBlobUrl = URL.createObjectURL(blob);

        // Update cache
        const pathParts = storagePath.split('/');
        if (pathParts.length >= 4) {
          await this.cacheService.cachePhoto(storagePath, blob, signedUrl, {
            noteId: pathParts[2],
            journalDate: pathParts[1],
            userId: pathParts[0],
          });
        }

        // Notify component of fresh content
        onUpdate(freshBlobUrl);
      }
    } catch (error) {
      console.warn('Background revalidation failed:', error);
    }
  }

  /**
   * Fetch and cache image without blocking
   */
  private async fetchAndCache(storagePath: string, signedUrl: string, userId: string): Promise<void> {
    const response = await fetch(signedUrl);
    if (response.ok) {
      const blob = await response.blob();

      // Extract metadata from storage path
      const pathParts = storagePath.split('/');
      if (pathParts.length >= 4) {
        await this.cacheService.cachePhoto(storagePath, blob, signedUrl, {
          noteId: pathParts[2],
          journalDate: pathParts[1],
          userId: pathParts[0],
        });
      }
    }
  }

  /**
   * Get signed URL for a photo with permission validation and comprehensive error handling
   * Uses server endpoint for signed URL generation with permission validation
   */
  async getPhotoUrl(storagePath: string, userId: string): Promise<string> {
    try {
      // Use server endpoint for signed URL generation
      const response = await fetch(`/api/photos/${encodeURIComponent(storagePath)}/signed-url`, {
        method: 'GET',
        credentials: 'include', // Include cookies for authentication
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to get signed URL' }));
        throw new Error(errorData.message || `Failed to get signed URL: ${response.status}`);
      }

      const result = await response.json();
      return result.signedUrl;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }

      throw StorageErrorFactory.createSignedUrlError(
        error instanceof Error ? error : new Error('Failed to get photo URL')
      );
    }
  }

  /**
   * Upload photo to server endpoint
   */
  private async uploadToServer(
    file: File,
    userId: string,
    journalDate: string,
    noteId: string
  ): Promise<{ url: string; storagePath: string; size: number; mimeType: string; fileName: string }> {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('journalDate', journalDate);
    formData.append('noteId', noteId);

    try {
      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include cookies for authentication
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(errorData.message || `Upload failed with status ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Server upload failed:', error);
      throw StorageErrorFactory.createFromError(
        error instanceof Error ? error : new Error('Upload failed'),
        'server upload'
      );
    }
  }

  /**
   * Get signed URL with retry logic and fallback strategies
   */
  private async getPhotoUrlWithRetry(storagePath: string, userId: string, retryCount = 0): Promise<string> {
    const maxRetries = 3;

    try {
      return await this.getPhotoUrl(storagePath, userId);
    } catch (error) {
      if (error instanceof StorageError && error.isRetryable() && retryCount < maxRetries) {
        const delay = StorageErrorRecovery.calculateRetryDelay(retryCount);
        console.log(`Retrying signed URL generation in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.getPhotoUrlWithRetry(storagePath, userId, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Delete a photo from storage
   * Uses server endpoint for deletion with permission validation
   */
  async deletePhoto(storagePath: string, userId: string): Promise<void> {
    try {
      // Use server endpoint for photo deletion
      const response = await fetch(`/api/photos/${encodeURIComponent(storagePath)}`, {
        method: 'DELETE',
        credentials: 'include', // Include cookies for authentication
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete photo' }));
        throw new Error(errorData.message || `Failed to delete photo: ${response.status}`);
      }

      // Also remove from cache
      try {
        await this.cacheService.removeCachedPhoto(storagePath);
      } catch (cacheError) {
        console.warn('Failed to remove photo from cache:', cacheError);
        // Don't fail deletion if cache removal fails
      }

      console.log(`Photo deleted successfully: ${storagePath}`);
    } catch (error) {
      console.error('Failed to delete photo:', error);
      throw StorageErrorFactory.createFromError(
        error instanceof Error ? error : new Error('Failed to delete photo'),
        'photo deletion'
      );
    }
  }

  /**
   * Generate deterministic photo path
   * Format: userId/yyyy-mm-dd/noteId/filename
   */
  private generatePhotoPath(
    userId: string,
    journalDate: string,
    noteId: string,
    originalFileName: string
  ): string {
    // Sanitize filename
    const sanitizedFileName = this.sanitizeFileName(originalFileName);

    // Add timestamp and random string to prevent conflicts
    const timestamp = Date.now();
    const randomBytes = new Uint8Array(4);
    crypto.getRandomValues(randomBytes);
    const randomString = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const finalFileName = `${timestamp}-${randomString}-${sanitizedFileName}`;

    return `${userId}/${journalDate}/${noteId}/${finalFileName}`;
  }

  // Removed - now using base class method

  /**
   * Basic path-based access validation
   * Checks if the storage path belongs to the user
   * Note: RLS policies provide the primary security layer
   */
  private validatePhotoAccess(storagePath: string, userId: string): boolean {
    // Path format: userId/yyyy-mm-dd/noteId/filename
    const pathParts = storagePath.split('/');

    if (pathParts.length < 4) {
      return false;
    }

    // First part should be the user ID
    return pathParts[0] === userId;
  }

  /**
   * Get bucket configuration for journal images
   */
  getBucketName(): string {
    return this.config.bucket;
  }

  /**
   * Get signed URL TTL in seconds
   */
  getSignedUrlTTL(): number {
    return this.config.signedUrlTTL;
  }

  /**
   * Get all cached photos for a specific note
   */
  async getCachedPhotosForNote(noteId: string): Promise<PhotoCacheEntry[]> {
    return this.cacheService.getCachedPhotosForNote(noteId);
  }

  /**
   * Clean up expired cache entries and enforce size limits
   */
  async cleanupCache(): Promise<void> {
    return this.cacheService.cleanup();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return this.cacheService.getStats();
  }

  /**
   * Clear all cached photos
   */
  async clearCache(): Promise<void> {
    return this.cacheService.clearAll();
  }

  /**
   * Initialize the cache service and health monitoring
   * Should be called when the app starts
   */
  async initializeCache(): Promise<void> {
    try {
      await this.cacheService.initialize();
      this.healthService.startMonitoring();

      // Initialize service availability manager
      const { ServiceAvailabilityManager } = await import('./service-availability.manager');
      const availabilityManager = ServiceAvailabilityManager.getInstance();

      console.log('PhotoStorageService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PhotoStorageService:', error);
      throw StorageErrorFactory.createFromError(
        error instanceof Error ? error : new Error('Initialization failed'),
        'service initialization'
      );
    }
  }

  /**
   * Cache uploaded photo (non-blocking helper)
   */
  private async cacheUploadedPhoto(
    storagePath: string,
    file: File | Blob,
    signedUrl: string,
    metadata: {
      noteId: string;
      journalDate: string;
      userId: string;
    }
  ): Promise<void> {
    try {
      await this.cacheService.cachePhoto(storagePath, file, signedUrl, metadata);
      console.log(`Photo cached successfully: ${storagePath}`);
    } catch (error) {
      // Convert to StorageError for consistent error handling
      const cacheError = new StorageError({
        type: StorageErrorType.CACHE_ERROR,
        message: `Failed to cache photo: ${error instanceof Error ? error.message : 'Unknown error'}`,
        userMessage: 'Photo uploaded successfully but caching failed. It may load slower next time.',
        recoverable: true,
        retryable: false,
        suggestedActions: [
          'Clear browser cache if you experience slow loading',
          'The photo is safely stored online',
        ],
        originalError: error instanceof Error ? error : undefined,
      });

      throw cacheError;
    }
  }



  /**
   * Get storage health status
   */
  getStorageHealth(): {
    isAvailable: boolean;
    isDegraded: boolean;
    capabilities: {
      upload: boolean;
      download: boolean;
      signedUrls: boolean;
      delete: boolean;
    };
    error?: StorageError;
  } {
    const status = this.healthService.getHealthStatus();
    return {
      isAvailable: status.isAvailable,
      isDegraded: status.degradedMode,
      capabilities: status.capabilities,
      error: status.error,
    };
  }

  /**
   * Subscribe to storage health changes
   */
  subscribeToHealthChanges(callback: (health: ReturnType<typeof this.getStorageHealth>) => void): () => void {
    return this.healthService.subscribe((status) => {
      callback({
        isAvailable: status.isAvailable,
        isDegraded: status.degradedMode,
        capabilities: status.capabilities,
        error: status.error,
      });
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.healthService.stopMonitoring();
    console.log('PhotoStorageService cleanup completed');
  }
}