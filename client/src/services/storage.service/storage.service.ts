import { BaseStorageService, BaseStorageUploadResult, StorageConfig, ALLOWED_MIME_TYPES } from './base-storage.service';
import { z } from 'zod';

export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
export { ALLOWED_MIME_TYPES };

export interface StorageUploadResult extends BaseStorageUploadResult {}

export class StorageService extends BaseStorageService {
  private static instance: StorageService;
  
  protected config: StorageConfig = {
    bucket: 'profile-pictures',
    signedUrlTTL: 3600, // 1 hour
    maxFileSize: MAX_FILE_SIZE,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  };

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
    const fileUploadSchema = this.createFileValidationSchema().extend({
      userId: z.string().uuid(),
    });
    fileUploadSchema.parse({ file, userId });

    const fileName = this.generateSecureFileName(userId, file.name);
    const storagePath = `${userId}/${fileName}`;
    
    try {
      // Clean up existing profile pictures first
      await this.cleanupUserProfilePictures(userId);

      // Upload using base service
      await this.uploadToStorage(storagePath, file, { upsert: true });

      // Get signed URL
      const signedUrl = await this.createSignedUrl(storagePath);

      return {
        url: signedUrl,
        path: storagePath,
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
      const files = await this.listFiles(`${userId}/`, {
        sortBy: { column: 'created_at', order: 'desc' }
      });

      if (!files || files.length === 0) {
        return; // No files to clean up
      }

      // Keep the most recent file (last uploaded) as backup
      const sortedFiles = files
        .filter(file => file.name !== '.emptyFolderPlaceholder');

      // Remove all files except the most recent one
      const filesToDelete = sortedFiles.slice(1).map(file => `${userId}/${file.name}`);
      
      if (filesToDelete.length > 0) {
        for (const filePath of filesToDelete) {
          try {
            await this.deleteFromStorage(filePath);
          } catch (error) {
            console.warn(`Failed to delete old profile picture: ${filePath}`, error);
          }
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
      const files = await this.listFiles(`${userId}/`);

      if (!files || files.length === 0) {
        return;
      }

      const filesToDelete = files
        .filter(file => file.name !== '.emptyFolderPlaceholder')
        .map(file => `${userId}/${file.name}`);

      if (filesToDelete.length > 0) {
        for (const filePath of filesToDelete) {
          await this.deleteFromStorage(filePath);
        }
      }
    } catch (error) {
      console.error('Error deleting user profile pictures:', error);
      throw error;
    }
  }

  async deleteProfilePicture(userId: string, fileName: string): Promise<void> {
    // Validate file ownership
    if (!this.validateFileAccess(fileName, userId)) {
      throw new Error('Unauthorized file access');
    }

    await this.deleteFromStorage(fileName);
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
      return await this.createSignedUrl(fileName);
    } catch (error) {
      console.error('Failed to create signed URL:', error);
      return null;
    }
  }

  async getLatestProfilePictureUrl(userId: string): Promise<string | null> {
    try {
      const files = await this.listFiles(`${userId}/`, {
        limit: 1,
        sortBy: { column: 'created_at', order: 'desc' },
      });

      if (!files?.length) return null;

      // Construct the full path including user ID folder
      const fullPath = `${userId}/${files[0].name}`;
      
      return await this.createSignedUrl(fullPath);
    } catch (error) {
      console.error('Failed to get latest profile picture:', error);
      return null;
    }
  }

  // Removed - now using base class method
}