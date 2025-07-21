/**
 * Navigation utilities for username-based routing
 */

// Import removed - using local implementation

export interface NavigationOptions {
  username?: string;
  date?: Date;
  fallbackToJournal?: boolean;
}

/**
 * Generate a board URL for a specific user and date
 */
export function generateBoardUrl(options: NavigationOptions): string {
  const { username, date, fallbackToJournal = true } = options;
  
  if (!username) {
    // If no username provided, use legacy journal route
    if (date) {
      const dateString = formatLocalDate(date);
      const today = formatLocalDate(new Date());
      return dateString === today ? '/' : `/journal/${dateString}`;
    }
    return '/';
  }

  // Generate username-based URL
  if (date) {
    const dateString = formatLocalDate(date);
    return `/@${username}/${dateString}`;
  }
  
  // Default to today's date for the user
  const today = formatLocalDate(new Date());
  return `/@${username}/${today}`;
}

/**
 * Parse a username-based URL to extract username and date
 */
export function parseBoardUrl(url: string): { username?: string; date?: Date } {
  // Match /@username/date pattern
  const usernameMatch = url.match(/^\/@([^\/]+)\/(.+)$/);
  if (usernameMatch) {
    const [, username, dateString] = usernameMatch;
    const date = parseLocalDate(dateString);
    return { username, date };
  }

  // Match /journal/date pattern
  const journalMatch = url.match(/^\/journal\/(.+)$/);
  if (journalMatch) {
    const [, dateString] = journalMatch;
    const date = parseLocalDate(dateString);
    return { date };
  }

  return {};
}

/**
 * Parse date string as local date (not UTC)
 */
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}

/**
 * Format date as YYYY-MM-DD in local timezone
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a URL is a username-based board URL
 */
export function isUsernameBoardUrl(url: string): boolean {
  return /^\/@[^\/]+\/\d{4}-\d{2}-\d{2}$/.test(url);
}

/**
 * Check if a URL is a legacy journal URL
 */
export function isLegacyJournalUrl(url: string): boolean {
  return /^\/journal\/\d{4}-\d{2}-\d{2}$/.test(url);
}

/**
 * Validate username format for URL generation
 */
export function isValidUsernameForUrl(username: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(username);
}