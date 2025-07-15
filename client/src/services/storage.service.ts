import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Import crypto and path utilities for secure filename generation
// Note: In browser environment, crypto is available globally
// path module is not available, so we'll implement basic path operations

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const fileUploadSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => file.size <= MAX_FILE_SIZE,
    `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`
  ).refine(
    (file) => ALLOWED_MIME_TYPES.includes(file.type as any),
    'File type must be JPEG, PNG, WebP, or GIF'
  ),
  userId: z.string().uuid(),
});

export interface StorageUploadResult {
  url: string;
  path: string;
  size: number;
  mimeType: string;
}

export class StorageService {
  private static instance: StorageService;
  private readonly bucket = 'profile-pictures';

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  async uploadProfilePicture(
    userId: string,
    file: File
  ): Promise<StorageUploadResult> {
    // Validate input
    fileUploadSchema.parse({ file, userId });

    const fileName = this.generateSecureFileName(userId, file.name);
    
    try {
      // Ensure we have a valid session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No authenticated session found');
      }

      // Clean up existing profile pictures first
      await this.cleanupUserProfilePictures(userId);

      // Upload with security headers
      const { data, error } = await supabase.storage
        .from(this.bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      if (error) throw error;

      // Get signed URL with authentication
      const { data: signedData, error: signedError } = await supabase.storage
        .from(this.bucket)
        .createSignedUrl(fileName, 3600); // 1 hour expiry

      if (signedError) {
        throw new Error('Failed to create signed URL');
      }

      return {
        url: signedData.signedUrl,
        path: fileName,
        size: file.size,
        mimeType: file.type,
      };
    } catch (error) {
      console.error('Storage upload failed:', error);
      throw new Error('Failed to upload profile picture');
    }
  }

  /**
   * Clean up all existing profile pictures for a user
   * Keeps only the most recent one as backup
   */
  private async cleanupUserProfilePictures(userId: string): Promise<void> {
    try {
      const { data: files, error: listError } = await supabase.storage
        .from(this.bucket)
        .list(`${userId}/`);

      if (listError || !files || files.length === 0) {
        return; // No files to clean up
      }

      // Keep the most recent file (last uploaded) as backup
      // Sort by created_at (newest first)
      const sortedFiles = files
        .filter(file => file.name !== '.emptyFolderPlaceholder')
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      // Remove all files except the most recent one
      const filesToDelete = sortedFiles.slice(1).map(file => `${userId}/${file.name}`);
      
      if (filesToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from(this.bucket)
          .remove(filesToDelete);

        if (deleteError) {
          console.warn('Failed to delete some old profile pictures:', deleteError);
        }
      }
    } catch (error) {
      // Log but don't throw - cleanup is best-effort
      console.warn('Error during profile picture cleanup:', error);
    }
  }

  /**
   * Force cleanup - removes ALL profile pictures for a user
   * Use with caution - typically only for account deletion
   */
  async deleteAllUserProfilePictures(userId: string): Promise<void> {
    try {
      const { data: files, error: listError } = await supabase.storage
        .from(this.bucket)
        .list(`${userId}/`);

      if (listError || !files || files.length === 0) {
        return;
      }

      const filesToDelete = files
        .filter(file => file.name !== '.emptyFolderPlaceholder')
        .map(file => `${userId}/${file.name}`);

      if (filesToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from(this.bucket)
          .remove(filesToDelete);

        if (deleteError) {
          console.error('Failed to delete user profile pictures:', deleteError);
          throw new Error('Failed to delete all profile pictures');
        }
      }
    } catch (error) {
      console.error('Error deleting user profile pictures:', error);
      throw error;
    }
  }

  async deleteProfilePicture(userId: string, fileName: string): Promise<void> {
    // Validate file ownership
    if (!fileName.startsWith(`${userId}/`)) {
      throw new Error('Unauthorized file access');
    }

    const { error } = await supabase.storage
      .from(this.bucket)
      .remove([fileName]);

    if (error) {
      console.error('Storage deletion failed:', error);
      throw new Error('Failed to delete profile picture');
    }
  }

  /**
   * Get authenticated URL for profile picture using signed URLs
   * This ensures proper authentication and prevents 400 errors
   */
  async getProfilePictureUrl(userId: string, fileName?: string): Promise<string | null> {
    if (!fileName) {
      return null;
    }

    // Ensure the fileName includes the user ID for security
    if (!fileName.startsWith(`${userId}/`)) {
      fileName = `${userId}/${fileName}`;
    }

    try {
      const { data, error } = await supabase.storage
        .from(this.bucket)
        .createSignedUrl(fileName, 3600); // 1 hour expiry

      if (error) {
        console.error('Error creating signed URL:', error);
        return null;
      }

      return data?.signedUrl || null;
    } catch (error) {
      console.error('Failed to create signed URL:', error);
      return null;
    }
  }

  async getLatestProfilePictureUrl(userId: string): Promise<string | null> {
    try {
      // Ensure we have a valid session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No authenticated session found');
        return null;
      }

      const { data, error } = await supabase.storage
        .from(this.bucket)
        .list(`${userId}/`, {
          limit: 1,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error || !data?.length) return null;

      // Construct the full path including user ID folder
      const fullPath = `${userId}/${data[0].name}`;
      
      // Use signed URL with authentication
      const { data: signedData, error: signedError } = await supabase.storage
        .from(this.bucket)
        .createSignedUrl(fullPath, 3600); // 1 hour expiry

      if (signedError) {
        console.error('Error creating signed URL:', signedError);
        return null;
      }

      return signedData?.signedUrl || null;
    } catch (error) {
      console.error('Failed to get latest profile picture:', error);
      return null;
    }
  }

  private generateSecureFileName(userId: string, originalName: string): string {
    // Comprehensive filename sanitization to prevent path traversal and injection attacks
    
    // Extract extension using last occurrence of dot
    const lastDotIndex = originalName.lastIndexOf('.');
    let extension = 'jpg'; // Default fallback
    let baseName = originalName;
    
    if (lastDotIndex > 0) {
      extension = originalName.slice(lastDotIndex + 1).toLowerCase();
      baseName = originalName.slice(0, lastDotIndex);
    }
    
    // Validate extension against whitelist
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const sanitizedExtension = allowedExtensions.includes(extension) ? extension : 'jpg';
    
    // Sanitize base filename: remove special characters, prevent path traversal
    const sanitizedBaseName = baseName
      .replace(/[^a-zA-Z0-9-]/g, '') // Remove all non-alphanumeric characters except hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .slice(0, 50); // Limit length to prevent buffer issues
    
    // Use crypto-secure random string instead of Math.random()
    const timestamp = Date.now();
    const randomBytes = new Uint8Array(8);
    crypto.getRandomValues(randomBytes);
    const randomString = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Ensure no empty base name
    const finalBaseName = sanitizedBaseName || 'profile';
    
    return `${userId}/${finalBaseName}-${timestamp}-${randomString}.${sanitizedExtension}`;
  }
}