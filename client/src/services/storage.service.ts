import { supabase } from '@/lib/supabase';
import { z } from 'zod';

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

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(this.bucket)
        .getPublicUrl(fileName);

      return {
        url: publicUrl,
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

  getProfilePictureUrl(userId: string, fileName?: string): string | null {
    if (!fileName) {
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(this.bucket)
      .getPublicUrl(fileName);

    return publicUrl;
  }

  async getLatestProfilePictureUrl(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(this.bucket)
        .list(`${userId}/`, {
          limit: 1,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error || !data?.length) return null;

      return this.getProfilePictureUrl(userId, data[0].name);
    } catch (error) {
      console.error('Failed to get latest profile picture:', error);
      return null;
    }
  }

  private generateSecureFileName(userId: string, originalName: string): string {
    const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    return `${userId}/${timestamp}-${randomString}.${extension}`;
  }
}