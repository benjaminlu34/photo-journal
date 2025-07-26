import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface UserSearchResult {
  id: string;
  username: string;
  avatar?: string;
  matchType: 'exact' | 'prefix';
}

export interface UserSearchResponse {
  users: UserSearchResult[];
}

interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

const SEARCH_HISTORY_KEY = 'friend_search_history';
const MAX_HISTORY_ITEMS = 10;

export function useFriendSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load search history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        const history = JSON.parse(stored) as SearchHistoryItem[];
        setSearchHistory(history);
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }, []);

  // Save search history to localStorage
  const saveSearchHistory = useCallback((history: SearchHistoryItem[]) => {
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
      setSearchHistory(history);
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }, []);

  // Add query to search history
  const addToSearchHistory = useCallback((query: string) => {
    if (!query.trim()) return;

    setSearchHistory(prev => {
      // Remove existing entry if it exists
      const filtered = prev.filter(item => item.query.toLowerCase() !== query.toLowerCase());
      
      // Add new entry at the beginning
      const newHistory = [
        { query: query.trim(), timestamp: Date.now() },
        ...filtered
      ].slice(0, MAX_HISTORY_ITEMS);

      saveSearchHistory(newHistory);
      return newHistory;
    });
  }, [saveSearchHistory]);

  // Clear search history
  const clearSearchHistory = useCallback(() => {
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
      setSearchHistory([]);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }, []);

  // Search users query
  const {
    data: searchResults,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['userSearch', searchQuery],
    queryFn: async (): Promise<UserSearchResponse> => {
      if (!searchQuery.trim()) {
        return { users: [] };
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      

      
      if (!session || !session.access_token) {
        throw new Error('Not authenticated - no valid session');
      }

      const response = await fetch(
        `/api/users/search?query=${encodeURIComponent(searchQuery.trim())}&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Accept': 'application/json',
          },
        }
      );



      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Too many search requests. Please try again later.');
        }
        if (response.status === 401) {
          // Try to refresh the session and retry once
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshedSession?.access_token && !refreshError) {
            console.log('Session refreshed, retrying request');
            const retryResponse = await fetch(
              `/api/users/search?query=${encodeURIComponent(searchQuery.trim())}&limit=10`,
              {
                headers: {
                  'Authorization': `Bearer ${refreshedSession.access_token}`,
                  'Accept': 'application/json',
                },
              }
            );
            if (retryResponse.ok) {
              return retryResponse.json();
            }
          }
          throw new Error('Authentication failed - please sign in again');
        }
        const errorData = await response.json().catch(() => ({ message: 'Search failed' }));
        throw new Error(errorData.message || 'Failed to search users');
      }

      return response.json();
    },
    enabled: searchQuery.trim().length > 0,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on rate limit errors
      if (error?.message?.includes('Too many search requests')) return false;
      return failureCount < 2;
    },
  });

  // Perform search with debouncing
  const performSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setIsSearching(true);
    
    // Add to history when user actually searches
    if (query.trim()) {
      addToSearchHistory(query);
    }
  }, [addToSearchHistory]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearching(false);
  }, []);

  // Get recent searches (last 5)
  const recentSearches = searchHistory.slice(0, 5);

  return {
    // Search state
    searchQuery,
    searchResults: searchResults?.users || [],
    isLoading: isLoading && isSearching,
    error,
    
    // Search actions
    performSearch,
    clearSearch,
    refetch,
    
    // Search history
    searchHistory,
    recentSearches,
    addToSearchHistory,
    clearSearchHistory,
  };
}