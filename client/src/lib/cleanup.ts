import { queryClient } from './queryClient';

// Generic SDK shape for destroyable instances
type DestroyableSdk = { destroy?: () => void | Promise<void> };

async function destroyAndClearRegistry(
  registry: Record<string, DestroyableSdk>,
  registryName: string
): Promise<void> {
  try {
    const results = await Promise.allSettled(
      Object.values(registry).map(async (sdk) => {
        if (sdk?.destroy) {
          await sdk.destroy();
        }
      })
    );

    // Log individual failures but continue clearing the registry
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.warn(`${registryName} destroy failed for index ${idx}:`, result.reason);
      }
    });

    Object.keys(registry).forEach((key) => delete registry[key]);
  } catch (error) {
    // This catch is defensive; allSettled should not throw
    console.warn(`Failed to clear ${registryName} registry:`, error);
  }
}

// Clear only in-memory state, preserve persisted data
export async function cleanupUserState() {
  // 1. Clear TanStack Query cache (in-memory only)
  await queryClient.cancelQueries();
  queryClient.clear();
  
  // 2. Destroy in-memory SDK instances without deleting persisted data
  try {
    const { sdkRegistry } = await import('./board-sdk');
    await destroyAndClearRegistry(sdkRegistry, 'board SDK');
  } catch (error) {
    console.warn('Failed to import board SDK registry:', error);
  }

  // 3. Destroy and clear calendar SDK instances as well
  try {
    const { calendarSdkRegistry } = await import('./calendar-sdk');
    await destroyAndClearRegistry(calendarSdkRegistry, 'calendar SDK');
  } catch (error) {
    console.warn('Failed to import calendar SDK registry:', error);
  }
  
  // 4. DO NOT delete IndexedDB - this preserves user data
  // The Yjs documents will be re-initialized on next login
}

// Hook for sign-out cleanup
export function useSignOutCleanup() {
  return async () => {
    await cleanupUserState();
  };
}