import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFriendSearch } from '@/hooks/useFriendSearch';
import React from 'react';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock supabase
vi.mock('@/lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn().mockResolvedValue({
                data: {
                    session: {
                        access_token: 'mock-token'
                    }
                }
            })
        }
    }
}));

// Mock localStorage
const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage
});

describe('Friend Search Hook', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });
        vi.clearAllMocks();
    });

    afterEach(() => {
        queryClient.clear();
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

    it('should initialize with empty state', () => {
        const { result } = renderHook(() => useFriendSearch(), { wrapper });

        expect(result.current.searchQuery).toBe('');
        expect(result.current.searchResults).toEqual([]);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.searchHistory).toEqual([]);
        expect(result.current.recentSearches).toEqual([]);
    });

    it('should load search history from localStorage', () => {
        const mockHistory = [
            { query: 'john', timestamp: Date.now() },
            { query: 'jane', timestamp: Date.now() - 1000 }
        ];
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockHistory));

        const { result } = renderHook(() => useFriendSearch(), { wrapper });

        expect(result.current.searchHistory).toEqual(mockHistory);
    });

    it('should perform search and get results', async () => {
        const mockResults = {
            users: [
                { id: '1', username: 'john_doe', matchType: 'exact' },
                { id: '2', username: 'john_smith', matchType: 'prefix' }
            ]
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockResults)
        });

        const { result } = renderHook(() => useFriendSearch(), { wrapper });

        result.current.performSearch('john');

        await waitFor(() => {
            expect(result.current.searchResults).toEqual(mockResults.users);
        });

        expect(mockFetch).toHaveBeenCalledWith(
            '/api/users/search?query=john&limit=10',
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer mock-token',
                    'Accept': 'application/json',
                })
            })
        );
    });

    it('should handle search errors', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ message: 'Server error' })
        });

        const { result } = renderHook(() => useFriendSearch(), { wrapper });

        result.current.performSearch('john');

        await waitFor(() => {
            expect(result.current.error).toBeTruthy();
        });
    });

    it('should handle rate limiting errors', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 429,
            json: () => Promise.resolve({ message: 'Too many requests' })
        });

        const { result } = renderHook(() => useFriendSearch(), { wrapper });

        result.current.performSearch('john');

        await waitFor(() => {
            expect(result.current.error?.message).toContain('Too many search requests');
        });
    });

    it('should add queries to search history', () => {
        const { result } = renderHook(() => useFriendSearch(), { wrapper });

        result.current.addToSearchHistory('john');

        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
            'friend_search_history',
            expect.stringContaining('john')
        );
    });

    it('should clear search history', () => {
        const { result } = renderHook(() => useFriendSearch(), { wrapper });

        result.current.clearSearchHistory();

        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('friend_search_history');
    });

    it('should clear search state', () => {
        const { result } = renderHook(() => useFriendSearch(), { wrapper });

        // First perform a search
        result.current.performSearch('john');

        // Then clear it
        result.current.clearSearch();

        expect(result.current.searchQuery).toBe('');
    });

    it('should limit recent searches to 5 items', () => {
        const mockHistory = Array.from({ length: 10 }, (_, i) => ({
            query: `user${i}`,
            timestamp: Date.now() - i * 1000
        }));

        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockHistory));

        const { result } = renderHook(() => useFriendSearch(), { wrapper });

        expect(result.current.recentSearches).toHaveLength(5);
        expect(result.current.recentSearches[0].query).toBe('user0');
    });
});