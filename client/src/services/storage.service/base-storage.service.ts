import { supabase } from '@/lib/supabase';
import { z } from 'zod';

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
 */
export abstract class BaseStorageService {
  protected abstract config: StorageConfig;

  /**
   * Ensure we have a valid authenticated session
   */
  protected async ensureAuthenticated(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No authenticated session found');
    }
  }

  /**
   * Create file validation schema based on config
   */
  protected createFileValidationSchema() {
    return z.object({
      file: z.instanceof(File)
        .refine(
          (file) => file.size <= this.config.maxFileSize,
          `File size must be less than ${this.config.maxFileSize / 1024 / 1024}MB`
        )
        .refine(
          (file) => this.config.allowedMimeTypes.includes(file.type),
          `File type must be one of: ${this.config.allowedMimeTypes.join(', ')}`
        ),
      userId: z.string().min(1),
    });
  }

  /**
   * Upload file to Supabase Storage
   */
  protected async uploadToStorage(
    storagePath: string,
    file: File,
    options: {
      cacheControl?: string;
      upsert?: boolean;
    } = {}
  ): Promise<{ path: string }> {
    await this.ensureAuthenticated();

    const { data, error } = await supabase.storage
      .from(this.config.bucket)
      .upload(storagePath, file, {
        cacheControl: options.cacheControl || '3600',
        upsert: options.upsert || false,
        contentType: file.type,
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    return { path: data.path };
  }

  /**
   * Generate signed URL for a file
   */
  protected async createSignedUrl(storagePath: string): Promise<string> {
    await this.ensureAuthenticated();

    const { data, error } = await supabase.storage
      .from(this.config.bucket)
      .createSignedUrl(storagePath, this.config.signedUrlTTL);

    if (error) {
      console.error('Error creating signed URL:', error);
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    if (!data?.signedUrl) {
      throw new Error('No signed URL returned from Supabase');
    }

    return data.signedUrl;
  }

  /**
   * Delete file from storage
   */
  protected async deleteFromStorage(storagePath: string): Promise<void> {
    await this.ensureAuthenticated();

    const { error } = await supabase.storage
      .from(this.config.bucket)
      .remove([storagePath]);

    if (error) {
      console.error('Storage deletion failed:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
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
}