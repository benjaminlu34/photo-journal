/**
 * Hook for username-based navigation
 */

import { useLocation } from 'wouter';
import { useUser } from '@/hooks/useUser';
import { generateBoardUrl, type NavigationOptions } from '@/lib/navigationUtils';

export function useUsernameNavigation() {
  const [, setLocation] = useLocation();
  const { data: user } = useUser();

  /**
   * Navigate to a board using username-based URL
   */
  const navigateToBoard = (options: NavigationOptions) => {
    const url = generateBoardUrl(options);
    setLocation(url);
  };

  /**
   * Navigate to current user's board for a specific date
   */
  const navigateToMyBoard = (date?: Date) => {
    if (!user?.username) {
      // Fallback to legacy journal route if no username
      const url = generateBoardUrl({ date, fallbackToJournal: true });
      setLocation(url);
      return;
    }

    navigateToBoard({ username: user.username, date });
  };

  /**
   * Navigate to another user's board for a specific date
   */
  const navigateToUserBoard = (username: string, date?: Date) => {
    navigateToBoard({ username, date });
  };

  /**
   * Get the current user's username for URL generation
   */
  const getCurrentUsername = () => user?.username;

  return {
    navigateToBoard,
    navigateToMyBoard,
    navigateToUserBoard,
    getCurrentUsername,
    generateBoardUrl,
  };
}