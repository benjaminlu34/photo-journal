import { supabase } from '@/lib/supabase';
import { z } from 'zod';
import { StorageError, StorageErrorFactory, StorageErrorType } from './storage-errors';
import { StorageHealthService } from './storage-health.service';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export interface BaseStorageUploadResult {
  url: string;
  path: string;
  size: number;
  mimeType: string;
}

export interface StorageConfig {
  bucket: string;
  signedUrlTTL: number; // in seconds
  maxFileSize: number; // in bytes
  allowedMimeTypes: readonly string[];
}

/**
 * Base storage service with common functionality for all file uploads
 * Handles session validation, file sanitization, and basic Supabase operations
 * Enhanced with comprehensive error handling and recovery mechanisms
 */
export abstract class BaseStorageService {
  protected abstract config: StorageConfig;
  protected healthService = StorageHealthService.getInstance();

  /**
   * Ensure we have a valid authenticated session with enhanced error handling
   */
  protected async ensureAuthenticated(): Promise<void> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw StorageErrorFactory.createAuthError('invalid');
      }
      
      if (!session) {
        throw StorageErrorFactory.createAuthError('missing');
      }

      // Check if session is expired
      if (session.expires_at && session.expires_at * 1000 < Date.now()) {
        throw StorageErrorFactory.createAuthError('expired');
      }
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageErrorFactory.createFromError(error instanceof Error ? error : new Error('Authentication check failed'));
    }
  }

  /**
   * Create file validation schema based on config with enhanced error handling
   */
  protected createFileValidationSchema() {
    return z.object({
      file: z.instanceof(File)
        .refine(
          (file) => file.size <= this.config.maxFileSize,
          (file) => ({ 
            message: `File size must be less than ${this.config.maxFileSize / 1024 / 1024}MB`,
            file 
          })
        )
        .refine(
          (file) => this.config.allowedMimeTypes.includes(file.type),
          (file) => ({ 
            message: `File type must be one of: ${this.config.allowedMimeTypes.join(', ')}`,
            file 
          })
        ),
      userId: z.string().min(1),
    });
  }

  /**
   * Validate file with comprehensive error handling
   */
  protected validateFile(file: File): void {
    // Check file size
    if (file.size > this.config.maxFileSize) {
      throw StorageErrorFactory.createFileValidationError(file, 'size', this.config.maxFileSize);
    }

    // Check file type
    if (!this.config.allowedMimeTypes.includes(file.type)) {
      throw StorageErrorFactory.createFileValidationError(file, 'type');
    }

    // Basic corruption check - ensure file has content and proper extension
    if (file.size === 0) {
      throw StorageErrorFactory.createFileValidationError(file, 'corrupted');
    }

    // Check for suspicious file characteristics
    const extension = file.name.split('.').pop()?.toLowerCase();
    const expectedExtensions = this.config.allowedMimeTypes.map(type => {
      const ext = type.split('/')[1];
      return ext === 'jpeg' ? ['jpg', 'jpeg'] : [ext];
    }).flat();

    if (extension && !expectedExtensions.includes(extension)) {
      throw StorageErrorFactory.createFileValidationError(file, 'type');
    }
  }

  /**
   * Upload file to Supabase Storage with comprehensive error handling
   */
  protected async uploadToStorage(
    storagePath: string,
    file: File,
    options: {
      cacheControl?: string;
      upsert?: boolean;
      timeout?: number;
    } = {}
  ): Promise<{ path: string }> {
    // Check storage health first
    if (!this.healthService.isStorageAvailable()) {
      const status = this.healthService.getHealthStatus();
      if (status.error) {
        throw status.error;
      }
      throw StorageErrorFactory.createServiceUnavailableError('storage');
    }

    await this.ensureAuthenticated();

    // Validate file before upload
    this.validateFile(file);

    try {
      const uploadPromise = supabase.storage
        .from(this.config.bucket)
        .upload(storagePath, file, {
          cacheControl: options.cacheControl || '3600',
          upsert: options.upsert || false,
          contentType: file.type,
        });

      // Add timeout to upload
      const timeoutMs = options.timeout || 60000; // 60 seconds default
      const { data, error } = await Promise.race([
        uploadPromise,
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Upload timeout')), timeoutMs)
        ),
      ]);

      if (error) {
        console.error('Storage upload error:', error);
        throw this.handleStorageError(error, 'upload');
      }

      if (!data?.path) {
        throw new StorageError({
          type: StorageErrorType.UPLOAD_FAILED,
          message: 'Upload succeeded but no path returned',
          userMessage: 'Upload completed but response was invalid. Please try again.',
          recoverable: true,
          retryable: true,
          suggestedActions: ['Try uploading again', 'Check your internet connection'],
        });
      }

      return { path: data.path };
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      
      // Handle timeout specifically
      if (error instanceof Error && error.message.includes('timeout')) {
        throw StorageErrorFactory.createNetworkError(error);
      }
      
      throw StorageErrorFactory.createFromError(error instanceof Error ? error : new Error('Upload failed'));
    }
  }

  /**
   * Generate signed URL for a file with comprehensive error handling and fallbacks
   */
  protected async createSignedUrl(storagePath: string, retryCount = 0): Promise<string> {
    const maxRetries = 3;
    
    try {
      // Check storage health
      if (!this.healthService.getHealthStatus().capabilities.signedUrls) {
        throw StorageErrorFactory.createServiceUnavailableError('storage');
      }

      await this.ensureAuthenticated();

      const { data, error } = await supabase.storage
        .from(this.config.bucket)
        .createSignedUrl(storagePath, this.config.signedUrlTTL);

      if (error) {
        console.error('Error creating signed URL:', error);
        throw this.handleStorageError(error, 'signed URL generation');
      }

      if (!data?.signedUrl) {
        throw new StorageError({
          type: StorageErrorType.SIGNED_URL_FAILED,
          message: 'No signed URL returned from Supabase',
          userMessage: 'Failed to generate secure image link.',
          recoverable: true,
          retryable: true,
          suggestedActions: ['Try refreshing the page', 'Check your internet connection'],
        });
      }

      return data.signedUrl;
    } catch (error) {
      if (error instanceof StorageError) {
        // Retry logic for retryable errors
        if (error.isRetryable() && retryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          console.log(`Retrying signed URL generation in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.createSignedUrl(storagePath, retryCount + 1);
        }
        throw error;
      }
      
      throw StorageErrorFactory.createSignedUrlError(error instanceof Error ? error : new Error('Signed URL generation failed'));
    }
  }

  /**
   * Delete file from storage with comprehensive error handling
   */
  protected async deleteFromStorage(storagePath: string): Promise<void> {
    // Check storage health
    if (!this.healthService.getHealthStatus().capabilities.delete) {
      throw StorageErrorFactory.createServiceUnavailableError('storage');
    }

    await this.ensureAuthenticated();

    try {
      const { error } = await supabase.storage
        .from(this.config.bucket)
        .remove([storagePath]);

      if (error) {
        console.error('Storage deletion failed:', error);
        throw this.handleStorageError(error, 'deletion');
      }
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      
      throw StorageErrorFactory.createFromError(error instanceof Error ? error : new Error('Deletion failed'));
    }
  }

  /**
   * List files in a directory
   */
  protected async listFiles(
    path: string,
    options: {
      limit?: number;
      sortBy?: { column: string; order: 'asc' | 'desc' };
    } = {}
  ) {
    await this.ensureAuthenticated();

    const { data, error } = await supabase.storage
      .from(this.config.bucket)
      .list(path, options);

    if (error) {
      console.error('Storage list failed:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Sanitize filename to prevent security issues
   * Common implementation for all storage services
   */
  protected sanitizeFileName(fileName: string): string {
    // Extract extension
    const lastDotIndex = fileName.lastIndexOf('.');
    let extension = 'jpg';
    let baseName = fileName;
    
    if (lastDotIndex > 0) {
      extension = fileName.slice(lastDotIndex + 1).toLowerCase();
      baseName = fileName.slice(0, lastDotIndex);
    }
    
    // Validate extension against allowed types
    const allowedExtensions = this.config.allowedMimeTypes
      .map(type => type.split('/')[1])
      .filter(ext => ext !== 'jpeg') // Remove duplicate for jpeg
      .concat(['jpg']); // Add jpg as alias for jpeg
    
    const sanitizedExtension = allowedExtensions.includes(extension) ? extension : 'jpg';
    
    // Sanitize base name
    const sanitizedBaseName = baseName
      .replace(/[^a-zA-Z0-9-_]/g, '') // Remove special characters
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .slice(0, 50) || 'file'; // Limit length and provide fallback
    
    return `${sanitizedBaseName}.${sanitizedExtension}`;
  }

  /**
   * Generate secure filename with timestamp and random string
   */
  protected generateSecureFileName(baseName: string, originalFileName: string): string {
    const sanitizedFileName = this.sanitizeFileName(originalFileName);
    
    // Add timestamp and random string to prevent conflicts
    const timestamp = Date.now();
    const randomBytes = new Uint8Array(8);
    crypto.getRandomValues(randomBytes);
    const randomString = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const finalBaseName = baseName || 'file';
    
    return `${finalBaseName}-${timestamp}-${randomString}-${sanitizedFileName}`;
  }

  /**
   * Validate file ownership based on path
   */
  protected validateFileAccess(storagePath: string, userId: string): boolean {
    // Basic check - file path should start with user ID
    return storagePath.startsWith(`${userId}/`);
  }

  /**
   * Handle Supabase storage errors and convert to StorageError
   */
  protected handleStorageError(error: any, operation: string): StorageError {
    const message = error.message || error.error || 'Unknown storage error';
    const lowerMessage = message.toLowerCase();

    // Quota exceeded errors
    if (lowerMessage.includes('quota') || lowerMessage.includes('storage full') || lowerMessage.includes('insufficient storage')) {
      return StorageErrorFactory.createQuotaError('storage');
    }

    // Permission errors
    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('permission denied') || lowerMessage.includes('access denied')) {
      return StorageErrorFactory.createAuthError('invalid');
    }

    // Network/connectivity errors
    if (lowerMessage.includes('network') || lowerMessage.includes('connection') || lowerMessage.includes('timeout')) {
      return StorageErrorFactory.createNetworkError(new Error(message));
    }

    // Service unavailable
    if (lowerMessage.includes('service unavailable') || lowerMessage.includes('502') || lowerMessage.includes('503') || lowerMessage.includes('500')) {
      return StorageErrorFactory.createServiceUnavailableError('storage');
    }

    // File not found (for signed URLs)
    if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
      return new StorageError({
        type: StorageErrorType.SIGNED_URL_FAILED,
        message: `File not found: ${message}`,
        userMessage: 'The requested image could not be found.',
        recoverable: false,
        retryable: false,
        suggestedActions: [
          'The image may have been deleted',
          'Try refreshing the page',
          'Contact support if this persists',
        ],
        originalError: error,
        metadata: { operation },
      });
    }

    // Default to generic error
    return StorageErrorFactory.createFromError(new Error(`${operation} failed: ${message}`), operation);
  }

  /**
   * Check storage quota and warn if approaching limits
   */
  protected async checkStorageQuota(): Promise<{ available: boolean; usage?: number; limit?: number }> {
    try {
      // This would need to be implemented based on your quota tracking system
      // For now, return available = true
      return { available: true };
    } catch (error) {
      console.warn('Failed to check storage quota:', error);
      return { available: true }; // Assume available if check fails
    }
  }

  /**
   * Detect if file might be corrupted based on basic checks
   */
  protected async detectFileCorruption(file: File): Promise<boolean> {
    try {
      // Basic checks
      if (file.size === 0) return true;
      
      // For images, try to create an image element to validate
      if (file.type.startsWith('image/')) {
        return new Promise((resolve) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          
          img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(false); // Not corrupted
          };
          
          img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(true); // Likely corrupted
          };
          
          // Timeout after 5 seconds
          setTimeout(() => {
            URL.revokeObjectURL(url);
            resolve(false); // Assume not corrupted if timeout
          }, 5000);
          
          img.src = url;
        });
      }
      
      return false; // Not corrupted for non-images
    } catch (error) {
      console.warn('File corruption detection failed:', error);
      return false; // Assume not corrupted if detection fails
    }
  }
}