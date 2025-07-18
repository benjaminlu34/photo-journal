import { StorageService } from '@/services/storage.service/storage.service';

export const getSupabaseUrl = (): string => {
  return import.meta.env.VITE_SUPABASE_URL || '';
};

/**
 * @deprecated Use useProfilePicture hook or StorageService directly instead
 * This function is kept for backward compatibility but will be removed in future versions
 */
export const getProfilePictureUrl = (userId: string | undefined): string | undefined => {
  if (!userId || !getSupabaseUrl()) return undefined;
  
  // This function is deprecated and should not be used
  // Use useProfilePicture hook or StorageService.getLatestProfilePictureUrl instead
  return undefined;
};

/**
 * Get the actual profile picture URL using the StorageService
 * This is the recommended approach for new code
 */
export const getActualProfilePictureUrl = async (userId: string): Promise<string | null> => {
  if (!userId) return null;
  
  const storageService = StorageService.getInstance();
  return storageService.getLatestProfilePictureUrl(userId);
};