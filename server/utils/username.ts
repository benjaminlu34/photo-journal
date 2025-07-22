import { storage } from "../storage";
import { RESERVED_USERNAMES } from "@shared/schema/schema";

/**
 * Generate username suggestions based on a taken username
 * @param baseUsername The username that was already taken
 * @param maxSuggestions Maximum number of suggestions to generate
 * @returns Array of available username suggestions
 */
export async function generateUsernameSuggestions(
  baseUsername: string,
  maxSuggestions: number = 3
): Promise<string[]> {
  const suggestions: string[] = [];
  const baseLower = baseUsername.toLowerCase();
  
  // Strategy 1: Add numbers to the end
  for (let i = 1; i <= 99 && suggestions.length < maxSuggestions; i++) {
    const candidate = `${baseLower}${i}`;
    if (candidate.length <= 20 && await storage.checkUsernameAvailability(candidate)) {
      suggestions.push(candidate);
    }
  }
  
  // Strategy 2: Add underscores and numbers
  if (suggestions.length < maxSuggestions) {
    for (let i = 1; i <= 99 && suggestions.length < maxSuggestions; i++) {
      const candidate = `${baseLower}_${i}`;
      if (candidate.length <= 20 && await storage.checkUsernameAvailability(candidate)) {
        suggestions.push(candidate);
      }
    }
  }
  
  // Strategy 3: Truncate and add random suffix
  if (suggestions.length < maxSuggestions) {
    const truncated = baseLower.slice(0, 15); // Leave room for suffix
    for (let i = 0; i < 10 && suggestions.length < maxSuggestions; i++) {
      const randomSuffix = Math.random().toString(36).substring(2, 6); // 4 chars
      const candidate = `${truncated}_${randomSuffix}`;
      if (await storage.checkUsernameAvailability(candidate)) {
        suggestions.push(candidate);
      }
    }
  }
  
  return suggestions;
}

/**
 * Validate username format and availability
 * @param username The username to validate (accepts mixed case, normalizes to lowercase)
 * @returns Validation result with error details if invalid
 */
export async function validateUsername(username: string): Promise<{
  isValid: boolean;
  error?: string;
  suggestions?: string[];
}> {
  // Format validation on original input
  if (username.length < 3) {
    return { isValid: false, error: "Username must be at least 3 characters" };
  }
  
  if (username.length > 20) {
    return { isValid: false, error: "Username must be at most 20 characters" };
  }
  
  // Check if input contains only valid characters (letters, numbers, underscores)
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { 
      isValid: false, 
      error: "Username can only contain letters, numbers, and underscores" 
    };
  }
  
  // Normalize to lowercase for database operations
  const normalizedUsername = username.toLowerCase();
  
  // Reserved username check
  if (RESERVED_USERNAMES.includes(normalizedUsername)) {
    const suggestions = await generateUsernameSuggestions(normalizedUsername);
    return { 
      isValid: false, 
      error: "Username is reserved",
      suggestions 
    };
  }
  
  // Availability check (use normalized username for database lookup)
  const isAvailable = await storage.checkUsernameAvailability(normalizedUsername);
  if (!isAvailable) {
    const suggestions = await generateUsernameSuggestions(normalizedUsername);
    return { 
      isValid: false, 
      error: "Username is already taken",
      suggestions 
    };
  }
  
  return { isValid: true };
}

/**
 * Sanitize email to create a base username
 * @param email The email address to convert
 * @returns Sanitized username base
 */
export function sanitizeEmailToUsername(email: string): string {
  return email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 20);
}