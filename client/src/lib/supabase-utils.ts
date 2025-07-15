import { StorageService } from '@/services/storage.service';

export const getSupabaseUrl = (): string => {
  return import.meta.env.VITE_SUPABASE_URL || '';
};

/**
 * @deprecated Use useProfilePicture hook or StorageService directly instead
 * This function is kept for backward compatibility but will be removed in future versions
 */
export const getProfilePictureUrl = (userId: string | undefined): string | undefined => {
  if (!userId || !getSupabaseUrl()) return undefined;
  
  // For backward compatibility, construct the URL pattern
  // Note: This may not reflect the actual latest profile picture
  return `${getSupabaseUrl()}/storage/v1/object/public/profile-pictures/${userId}/profile.jpg`;
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