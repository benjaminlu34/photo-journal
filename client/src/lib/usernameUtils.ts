/**
 * Username formatting utilities for consistent display across the application
 */

export interface UserDisplayData {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  profileImageUrl?: string;
}

/**
 * Formats a username with @ prefix for display
 */
export function formatUsername(username: string): string {
  return `@${username}`;
}

/**
 * Gets the display name for a user, preferring username over other options
 */
export function getUserDisplayName(user: UserDisplayData): string {
  if (user.username) {
    return formatUsername(user.username);
  }
  
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  
  if (user.firstName) {
    return user.firstName;
  }
  
  if (user.email) {
    // Extract name part from email as fallback
    const emailName = user.email.split('@')[0];
    return emailName.charAt(0).toUpperCase() + emailName.slice(1);
  }
  
  return 'Anonymous User';
}

/**
 * Gets a short display name for limited space (e.g., cursors)
 */
export function getShortDisplayName(user: UserDisplayData): string {
  if (user.username) {
    return formatUsername(user.username);
  }
  
  if (user.firstName) {
    return user.firstName;
  }
  
  if (user.email) {
    const emailName = user.email.split('@')[0];
    return emailName.charAt(0).toUpperCase() + emailName.slice(1);
  }
  
  return 'Anonymous';
}

/**
 * Gets initials for avatar display
 */
export function getUserInitials(user: UserDisplayData): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  }
  
  if (user.firstName) {
    return user.firstName.charAt(0).toUpperCase();
  }
  
  if (user.username) {
    return user.username.charAt(0).toUpperCase();
  }
  
  if (user.email) {
    return user.email.charAt(0).toUpperCase();
  }
  
  return 'A';
}

/**
 * Validates if a user has a username
 */
export function hasUsername(user: UserDisplayData): boolean {
  return Boolean(user.username && user.username.trim().length > 0);
}