import { BaseStorageService, BaseStorageUploadResult, StorageConfig, ALLOWED_MIME_TYPES } from './base-storage.service';
import { compressImage, shouldCompressImage, validateImageFile, CompressionResult } from '@/utils/image-compression';
import { PhotoCacheService, PhotoCacheEntry } from './photo-cache.service';
import { z } from 'zod';

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
 * Can work client-side first, talking directly to Supabase with RLS
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
   * Upload a photo with optional compression
   * Implements deterministic path structure: userId/yyyy-mm-dd/noteId/filename
   */
  async uploadPhoto(
    userId: string,
    journalDate: string,
    file: File,
    noteId: string,
    options: PhotoUploadOptions = {}
  ): Promise<PhotoUploadResult> {
    // Validate input
    const fileUploadSchema = this.createFileValidationSchema().extend({
      journalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
      noteId: z.string().min(1),
    });
    fileUploadSchema.parse({ file, userId, journalDate, noteId });

    // Validate image file
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    let fileToUpload = file;
    let compressionInfo: CompressionResult | undefined;

    // Apply compression if enabled (default: true) and beneficial
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
        // Continue with original file if compression fails
      }
    }

    // Generate deterministic storage path
    const storagePath = this.generatePhotoPath(userId, journalDate, noteId, fileToUpload.name);

    try {
      // Upload using base service
      const { path } = await this.uploadToStorage(storagePath, fileToUpload, { upsert: true });

      // Generate signed URL for immediate access
      const signedUrl = await this.getPhotoUrl(storagePath, userId);

      // Cache the uploaded file for offline access
      try {
        await this.cacheService.cachePhoto(storagePath, fileToUpload, signedUrl, {
          noteId,
          journalDate,
          userId,
        });
      } catch (cacheError) {
        console.warn('Failed to cache uploaded photo:', cacheError);
        // Don't fail the upload if caching fails
      }

      return {
        url: signedUrl,
        path,
        storagePath,
        signedUrl,
        size: fileToUpload.size,
        mimeType: fileToUpload.type,
        compressionInfo,
      };
    } catch (error) {
      console.error('Photo upload failed:', error);
      throw new Error('Failed to upload photo');
    }
  }

  /**
   * Get photo with cache-first approach
   * Checks IndexedDB cache first, falls back to signed URL generation
   */
  async getPhotoWithCache(storagePath: string, userId: string): Promise<{ url: string; fromCache: boolean }> {
    try {
      // Check cache first
      const cachedEntry = await this.cacheService.getCachedPhoto(storagePath);
      if (cachedEntry) {
        const blobUrl = URL.createObjectURL(cachedEntry.blob);
        return { url: blobUrl, fromCache: true };
      }

      // Cache miss - get from storage and cache it
      const signedUrl = await this.getPhotoUrl(storagePath, userId);
      
      // Fetch the image and cache it for future use
      try {
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
      } catch (cacheError) {
        console.warn('Failed to cache fetched photo:', cacheError);
        // Don't fail if caching fails
      }

      return { url: signedUrl, fromCache: false };
    } catch (error) {
      console.error('Failed to get photo with cache:', error);
      throw error;
    }
  }

  /**
   * Get signed URL for a photo with permission validation
   * Uses RLS policies to ensure user has access to the photo
   */
  async getPhotoUrl(storagePath: string, userId: string): Promise<string> {
    // Validate that user has access to this path (basic path-based check)
    if (!this.validatePhotoAccess(storagePath, userId)) {
      throw new Error('Unauthorized access to photo');
    }

    return await this.createSignedUrl(storagePath);
  }

  /**
   * Delete a photo from storage
   * Validates ownership before deletion
   */
  async deletePhoto(storagePath: string, userId: string): Promise<void> {
    // Validate ownership
    if (!this.validatePhotoAccess(storagePath, userId)) {
      throw new Error('Unauthorized access to photo');
    }

    // Delete from storage using base service
    await this.deleteFromStorage(storagePath);

    // Also remove from cache
    try {
      await this.cacheService.removeCachedPhoto(storagePath);
    } catch (cacheError) {
      console.warn('Failed to remove photo from cache:', cacheError);
      // Don't fail deletion if cache removal fails
    }

    console.log(`Photo deleted successfully: ${storagePath}`);
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
   * Initialize the cache service
   * Should be called when the app starts
   */
  async initializeCache(): Promise<void> {
    return this.cacheService.initialize();
  }
}