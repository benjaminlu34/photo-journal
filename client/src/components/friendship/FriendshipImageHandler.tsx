import React from 'react';
import { useFriendshipEvents, type FriendshipEvent } from '@/hooks/useFriendshipEvents';
import { useCRDT } from '@/contexts/crdt-context';

/**
 * Component that handles friendship events and refreshes image URLs when permissions change
 * This ensures that image access is properly updated when friendship status changes
 * Must be used within a CRDTProvider context
 */
export const FriendshipImageHandler: React.FC = () => {
  const { refreshImageUrls } = useCRDT();

  // Handle friendship events that affect image access
  const handlePermissionChange = React.useCallback(async (event: FriendshipEvent) => {
    console.log('Friendship permission change detected, refreshing image URLs:', event.type);
    
    try {
      await refreshImageUrls();
    } catch (error) {
      console.error('Failed to refresh image URLs after friendship change:', error);
    }
  }, [refreshImageUrls]);

  // Set up friendship event handlers
  useFriendshipEvents({
    onFriendBlocked: handlePermissionChange,
    onFriendUnfriended: handlePermissionChange,
    onFriendAccepted: handlePermissionChange,
    onFriendRoleChanged: handlePermissionChange,
  });

  // This component doesn't render anything - it just handles events
  return null;
};