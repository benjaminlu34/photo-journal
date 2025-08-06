/**
 * User Lookup Service
 * Provides functionality to resolve user IDs to usernames and user information
 * Not currently used, might in potential refactor down the road
 */

interface UserInfo {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

class UserLookupService {
  private cache = new Map<string, UserInfo>();
  private pendingRequests = new Map<string, Promise<UserInfo | null>>();

  /**
   * Get user information by user ID
   */
  async getUserById(userId: string): Promise<UserInfo | null> {
    // Check cache first
    if (this.cache.has(userId)) {
      return this.cache.get(userId)!;
    }

    // Check if there's already a pending request for this user
    if (this.pendingRequests.has(userId)) {
      return this.pendingRequests.get(userId)!;
    }

    // Create new request
    const request = this.fetchUserById(userId);
    this.pendingRequests.set(userId, request);

    try {
      const user = await request;
      if (user) {
        this.cache.set(userId, user);
      }
      return user;
    } finally {
      this.pendingRequests.delete(userId);
    }
  }

  /**
   * Get username by user ID (convenience method)
   */
  async getUsernameById(userId: string): Promise<string | null> {
    const user = await this.getUserById(userId);
    return user?.username || null;
  }

  /**
   * Batch lookup multiple user IDs
   */
  async getUsersByIds(userIds: string[]): Promise<Map<string, UserInfo>> {
    const results = new Map<string, UserInfo>();
    
    // Get all users in parallel
    const promises = userIds.map(async (userId) => {
      const user = await this.getUserById(userId);
      if (user) {
        results.set(userId, user);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Clear cache (useful for testing or when user data changes)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Remove specific user from cache
   */
  invalidateUser(userId: string): void {
    this.cache.delete(userId);
  }

  private async fetchUserById(userId: string): Promise<UserInfo | null> {
    try {
      // Use the existing user search endpoint with exact match
      const response = await fetch(`/api/users/search?query=${encodeURIComponent(userId)}&limit=1`);
      
      if (!response.ok) {
        console.warn(`Failed to fetch user ${userId}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const users = data.users || [];
      
      // Find exact match by ID (since we're searching by ID, not username)
      const user = users.find((u: any) => u.id === userId);
      
      if (user) {
        return {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      }

      return null;
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const userLookupService = new UserLookupService();

// Export hook for React components
export function useUserLookup() {
  return userLookupService;
}