import { useQuery } from '@tanstack/react-query';
import { StorageService } from '@/services/storage.service/storage.service';
import { useUser } from './useUser';
import { queryClient } from '@/lib/queryClient';

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
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false, // Prevent refetch on page navigation
    refetchOnMount: false, // Prevent refetch on component mount
    placeholderData: (previousData) => previousData, // Show previous data while loading
  });
}

// Utility function to invalidate profile picture cache
export function invalidateProfilePicture(userId?: string) {
  if (queryClient) {
    queryClient.invalidateQueries({
      queryKey: [PROFILE_PICTURE_QUERY_KEY, userId]
    });
  }
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