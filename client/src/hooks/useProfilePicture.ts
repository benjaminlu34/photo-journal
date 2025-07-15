import { useQuery } from '@tanstack/react-query';
import { StorageService } from '@/services/storage.service';
import { useUser } from './useUser';

export const PROFILE_PICTURE_QUERY_KEY = 'profile-picture';

export function useProfilePicture(userId?: string) {
  const { data: user } = useUser();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: [PROFILE_PICTURE_QUERY_KEY, targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;

      const storageService = StorageService.getInstance();
      return storageService.getLatestProfilePictureUrl(targetUserId);
    },
    enabled: !!targetUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Utility function for generating initials
export function getInitials(
  firstName?: string, 
  lastName?: string, 
  email?: string
): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  return email?.[0]?.toUpperCase() || 'U';
}