import { queryClient } from './queryClient';

// Clear only in-memory state, preserve persisted data
export async function cleanupUserState() {
  // 1. Clear TanStack Query cache (in-memory only)
  await queryClient.cancelQueries();
  queryClient.clear();
  
  // 2. Destroy in-memory SDK instances without deleting persisted data
  try {
    const { sdkRegistry } = await import('./board-sdk');
    Object.values(sdkRegistry).forEach(sdk => {
      if (sdk?.destroy) {
        sdk.destroy();
      }
    });
    // Clear only the registry, keep IndexedDB intact
    Object.keys(sdkRegistry).forEach(key => delete sdkRegistry[key]);
  } catch (error) {
    console.warn('Failed to clear SDK registry:', error);
  }
  
  // 3. DO NOT delete IndexedDB - this preserves user data
  // The Yjs documents will be re-initialized on next login
}

// Hook for sign-out cleanup
export function useSignOutCleanup() {
  return async () => {
    await cleanupUserState();
  };
}