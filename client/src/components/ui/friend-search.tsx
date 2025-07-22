import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Clock, Users, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useFriendSearch, type UserSearchResult } from '@/hooks/useFriendSearch';
import { UserDisplay } from '@/components/ui/user-display';

interface FriendSearchProps {
  onUserSelect?: (user: UserSearchResult) => void;
  onFriendRequest?: (user: UserSearchResult) => void;
  placeholder?: string;
  className?: string;
  showRecentSearches?: boolean;
  autoFocus?: boolean;
  currentUserId?: string;
}

export function FriendSearch({
  onUserSelect,
  onFriendRequest,
  placeholder = "Search for friends by username...",
  className,
  showRecentSearches = true,
  autoFocus = false,
  currentUserId
}: FriendSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    searchQuery,
    searchResults,
    isLoading,
    error,
    performSearch,
    clearSearch,
    recentSearches,
    clearSearchHistory,
  } = useFriendSearch();

  // Handle input changes with debouncing
  const handleInputChange = (value: string) => {
    setInputValue(value);
    
    // Clear existing timeout
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      if (value.trim()) {
        performSearch(value.trim());
      } else {
        clearSearch();
      }
    }, 300);

    setDebounceTimeout(timeout);
  };

  // Handle user selection
  const handleUserSelect = (user: UserSearchResult) => {
    onUserSelect?.(user);
    setIsOpen(false);
    setInputValue('');
    clearSearch();
  };

  // Handle friend request
  const handleFriendRequest = (user: UserSearchResult) => {
    onFriendRequest?.(user);
  };

  // Handle recent search selection
  const handleRecentSearchSelect = (query: string) => {
    setInputValue(query);
    performSearch(query);
    inputRef.current?.focus();
  };

  // Handle clear input
  const handleClear = () => {
    setInputValue('');
    clearSearch();
    inputRef.current?.focus();
  };

  // Handle focus
  const handleFocus = () => {
    setIsOpen(true);
  };

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [debounceTimeout]);

  // Filter out current user from search results
  const filteredSearchResults = searchResults.filter(user => user.id !== currentUserId);
  
  const hasResults = filteredSearchResults.length > 0;
  const hasRecentSearches = showRecentSearches && recentSearches.length > 0;
  const showDropdown = isOpen && (hasResults || hasRecentSearches || isLoading || error);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="pl-10 pr-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
        />
        {inputValue && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search Dropdown */}
      {showDropdown && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-[60] max-h-96 overflow-hidden shadow-lg border-border bg-background">
          <CardContent className="p-0">
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-4 text-center">
                <p className="text-sm text-destructive">{error.message}</p>
              </div>
            )}

            {/* Search Results */}
            {hasResults && !isLoading && (
              <div className="max-h-64 overflow-y-auto">
                <div className="p-2">
                  <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                    <Users className="h-3 w-3" />
                    Search Results
                  </div>
                </div>
                {filteredSearchResults.map((user) => (
                  <SearchResultItem
                    key={user.id}
                    user={user}
                    onSelect={handleUserSelect}
                    onFriendRequest={handleFriendRequest}
                  />
                ))}
              </div>
            )}

            {/* Recent Searches */}
            {hasRecentSearches && !hasResults && !isLoading && !error && (
              <>
                {hasResults && <Separator />}
                <div className="max-h-32 overflow-y-auto">
                  <div className="p-2">
                    <div className="flex items-center justify-between px-2 py-1">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Recent Searches
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSearchHistory}
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  {recentSearches.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => handleRecentSearchSelect(item.query)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-secondary transition-colors flex items-center gap-2"
                    >
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-foreground">{item.query}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* No Results */}
            {!hasResults && !hasRecentSearches && !isLoading && !error && searchQuery && (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No users found for "{searchQuery}"
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface SearchResultItemProps {
  user: UserSearchResult;
  onSelect: (user: UserSearchResult) => void;
  onFriendRequest?: (user: UserSearchResult) => void;
}

function SearchResultItem({ user, onSelect, onFriendRequest }: SearchResultItemProps) {
  const handleSelect = () => {
    onSelect(user);
  };

  const handleFriendRequest = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFriendRequest?.(user);
  };

  return (
    <div
      onClick={handleSelect}
      className="flex items-center justify-between px-4 py-3 hover:bg-secondary cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <UserDisplay
          user={{
            id: user.id,
            username: user.username,
          }}
          size="sm"
          variant="full"
        />
        {user.matchType === 'exact' && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            Exact match
          </span>
        )}
      </div>
      
      {onFriendRequest && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleFriendRequest}
          className="ml-2 text-xs"
        >
          Add Friend
        </Button>
      )}
    </div>
  );
}