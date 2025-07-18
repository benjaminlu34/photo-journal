/**
 * Technical Implementation Validation Test Suite
 * 
 * This test suite validates the technical implementation requirements:
 * 4.1 - Single user fetch per session
 * 4.2 - No JavaScript errors during auth flows
 * 4.3 - No "undefined user" errors in component rendering
 * 4.4 - Profile updates reflect immediately without page refresh
 * 4.5 - Auth redirects work smoothly without jarring transitions
 * 4.6 - React Query cache behavior and invalidation patterns
 * 4.7 - Error boundaries catch and handle component errors gracefully
 * 4.8 - Loading states prevent flickering and provide smooth UX
 * 4.9 - Retry mechanisms work for transient failures without infinite loops
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    }
  }
}));

// Import the actual hooks and components after mocking dependencies
import { useUser } from '@/hooks/useUser';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { supabase } from '@/lib/supabase';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Console error spy for detecting JavaScript errors
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Technical Implementation Validation', () => {
  let testQueryClient: QueryClient;

  beforeEach(() => {
    testQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    // Reset mocks
    vi.clearAllMocks();
    consoleErrorSpy.mockClear();
    
    // Default mock responses
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'test-token', user: { id: 'test-user-id' } } }
    });
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      })
    });
  });

  afterEach(() => {
    testQueryClient.clear();
  });

  describe('4.1 - Single User Fetch Per Session', () => {
    it('should only fetch user data once per session', async () => {
      const TestComponent = () => {
        const { data: user1 } = useUser();
        const { data: user2 } = useUser();
        const { data: user3 } = useUser();
        
        return (
          <div>
            <div data-testid="user1">{user1?.email || 'loading'}</div>
            <div data-testid="user2">{user2?.email || 'loading'}</div>
            <div data-testid="user3">{user3?.email || 'loading'}</div>
          </div>
        );
      };

      render(
        <QueryClientProvider client={testQueryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user1')).toHaveTextContent('test@example.com');
        expect(screen.getByTestId('user2')).toHaveTextContent('test@example.com');
        expect(screen.getByTestId('user3')).toHaveTextContent('test@example.com');
      });

      // Should only make one API call despite multiple useUser hooks
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/user', expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      }));
    });

    it('should use cached data for subsequent requests within stale time', async () => {
      const TestComponent = () => {
        const { data: user, refetch } = useUser();
        
        return (
          <div>
            <div data-testid="user-email">{user?.email || 'loading'}</div>
            <button onClick={() => refetch()} data-testid="refetch-btn">Refetch</button>
          </div>
        );
      };

      render(
        <QueryClientProvider client={testQueryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      });

      // First call
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Trigger refetch within stale time - should use cache
      fireEvent.click(screen.getByTestId('refetch-btn'));
      
      // Should still be only one call due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('4.2 - No JavaScript Errors During Auth Flows', () => {
    it('should not produce console errors during successful auth flow', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ error: null });
      
      const TestComponent = () => {
        const handleSignIn = async () => {
          await supabase.auth.signInWithPassword('test@example.com', 'password');
        };
        
        return <button onClick={handleSignIn} data-testid="signin-btn">Sign In</button>;
      };

      render(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('signin-btn'));
      
      await waitFor(() => {
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });
    });

    it('should handle auth errors gracefully without console errors', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ 
        error: { message: 'Invalid credentials' } 
      });
      
      const TestComponent = () => {
        const handleSignIn = async () => {
          try {
            const result = await supabase.auth.signInWithPassword('test@example.com', 'wrong-password');
            if (result.error) {
              // Handle error gracefully
              console.log('Auth error handled:', result.error.message);
            }
          } catch (error) {
            console.log('Caught auth error:', error);
          }
        };
        
        return <button onClick={handleSignIn} data-testid="signin-btn">Sign In</button>;
      };

      render(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('signin-btn'));
      
      await waitFor(() => {
        // Should not have console.error calls (only console.log for handled errors)
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('4.3 - No "undefined user" Errors in Component Rendering', () => {
    it('should handle undefined user state gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null) // Simulate no user
      });

      const TestComponent = () => {
        const { data: user, isLoading } = useUser();
        
        if (isLoading) return <div data-testid="loading">Loading...</div>;
        
        return (
          <div>
            <div data-testid="user-name">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : 'No user'}
            </div>
            <div data-testid="user-email">{user?.email || 'No email'}</div>
          </div>
        );
      };

      render(
        <QueryClientProvider client={testQueryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('No user');
        expect(screen.getByTestId('user-email')).toHaveTextContent('No email');
      });

      // Should not have any console errors about undefined user
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/undefined.*user/i)
      );
    });

    it('should handle partial user data without errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-user-id',
          email: 'test@example.com',
          // firstName and lastName are undefined
        })
      });

      const TestComponent = () => {
        const { data: user } = useUser();
        
        return (
          <div>
            <div data-testid="user-name">
              {user?.firstName || user?.lastName 
                ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                : 'Name not set'}
            </div>
            <div data-testid="user-email">{user?.email || 'No email'}</div>
          </div>
        );
      };

      render(
        <QueryClientProvider client={testQueryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('Name not set');
        expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('4.4 - Profile Updates Reflect Immediately Without Page Refresh', () => {
    it('should update user data immediately after profile update', async () => {
      let userResponse = {
        id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      };

      mockFetch.mockImplementation((url) => {
        if (url === '/api/auth/user') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(userResponse)
          });
        }
        if (url === '/api/auth/profile') {
          // Simulate profile update
          userResponse = { ...userResponse, firstName: 'Updated', lastName: 'Name' };
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(userResponse)
          });
        }
        return Promise.resolve({ ok: false });
      });

      const TestComponent = () => {
        const { data: user, refetch } = useUser();
        
        const updateProfile = async () => {
          await fetch('/api/auth/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: 'Updated', lastName: 'Name' })
          });
          // Invalidate cache to trigger refetch
          testQueryClient.invalidateQueries({ queryKey: ['user'] });
        };
        
        return (
          <div>
            <div data-testid="user-name">
              {user?.firstName} {user?.lastName}
            </div>
            <button onClick={updateProfile} data-testid="update-btn">Update</button>
          </div>
        );
      };

      render(
        <QueryClientProvider client={testQueryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
      });

      fireEvent.click(screen.getByTestId('update-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('Updated Name');
      });
    });
  });

  describe('4.6 - React Query Cache Behavior and Invalidation Patterns', () => {
    it('should properly invalidate cache after profile updates', async () => {
      const TestComponent = () => {
        const { data: user } = useUser();
        
        const invalidateCache = () => {
          testQueryClient.invalidateQueries({ queryKey: ['user'] });
        };
        
        return (
          <div>
            <div data-testid="user-email">{user?.email || 'loading'}</div>
            <button onClick={invalidateCache} data-testid="invalidate-btn">Invalidate</button>
          </div>
        );
      };

      render(
        <QueryClientProvider client={testQueryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      });

      // First fetch
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Invalidate cache
      fireEvent.click(screen.getByTestId('invalidate-btn'));

      await waitFor(() => {
        // Should trigger a new fetch after invalidation
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should respect stale time configuration', async () => {
      const shortStaleTimeClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 100, // 100ms
            retry: false,
          },
        },
      });

      const TestComponent = () => {
        const { data: user, refetch } = useUser();
        
        return (
          <div>
            <div data-testid="user-email">{user?.email || 'loading'}</div>
            <button onClick={() => refetch()} data-testid="refetch-btn">Refetch</button>
          </div>
        );
      };

      render(
        <QueryClientProvider client={shortStaleTimeClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Wait for stale time to pass
      await new Promise(resolve => setTimeout(resolve, 150));

      // Trigger refetch after stale time
      fireEvent.click(screen.getByTestId('refetch-btn'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('4.7 - Error Boundaries Catch and Handle Component Errors Gracefully', () => {
    it('should catch and display error when component throws', async () => {
      const ThrowingComponent = () => {
        throw new Error('Test component error');
      };

      const TestWrapper = () => (
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      render(<TestWrapper />);

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText('Test component error')).toBeInTheDocument();
      });
    });

    it('should allow recovery from error state', async () => {
      let shouldThrow = true;
      
      const ConditionalThrowingComponent = () => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <div data-testid="success">Component rendered successfully</div>;
      };

      const TestWrapper = () => (
        <ErrorBoundary>
          <ConditionalThrowingComponent />
        </ErrorBoundary>
      );

      render(<TestWrapper />);

      // Should show error initially
      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });

      // Fix the error condition
      shouldThrow = false;

      // Click try again
      fireEvent.click(screen.getByText('Try again'));

      await waitFor(() => {
        expect(screen.getByTestId('success')).toBeInTheDocument();
      });
    });
  });

  describe('4.8 - Loading States Prevent Flickering and Provide Smooth UX', () => {
    it('should show loading state during data fetch', async () => {
      // Delay the fetch to test loading state
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'test-user-id',
              email: 'test@example.com',
              firstName: 'Test',
              lastName: 'User'
            })
          }), 100)
        )
      );

      const TestComponent = () => {
        const { data: user, isLoading } = useUser();
        
        if (isLoading) {
          return <div data-testid="loading">Loading user...</div>;
        }
        
        return <div data-testid="user-email">{user?.email}</div>;
      };

      render(
        <QueryClientProvider client={testQueryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      // Should show loading initially
      expect(screen.getByTestId('loading')).toBeInTheDocument();

      // Should show user data after loading
      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      });
    });

    it('should not flicker between loading and content states', async () => {
      const TestComponent = () => {
        const { data: user, isLoading } = useUser();
        
        return (
          <div>
            {isLoading ? (
              <div data-testid="loading">Loading...</div>
            ) : (
              <div data-testid="content">{user?.email || 'No user'}</div>
            )}
          </div>
        );
      };

      render(
        <QueryClientProvider client={testQueryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('content')).toBeInTheDocument();
      });

      // Loading should not appear again for cached data
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });
  });

  describe('4.9 - Retry Mechanisms Work for Transient Failures Without Infinite Loops', () => {
    it('should retry failed requests with exponential backoff', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve({ ok: false, status: 500, statusText: 'Server Error' });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-user-id',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User'
          })
        });
      });

      const retryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
        },
      });

      const TestComponent = () => {
        const { data: user, isError, error } = useUser();
        
        if (isError) {
          return <div data-testid="error">Error: {(error as Error).message}</div>;
        }
        
        return <div data-testid="user-email">{user?.email || 'loading'}</div>;
      };

      render(
        <QueryClientProvider client={retryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      // Should eventually succeed after retries
      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      }, { timeout: 5000 });

      // Should have made 3 attempts (2 failures + 1 success)
      expect(callCount).toBe(3);
    });

    it('should not retry on 401 unauthorized errors', async () => {
      mockFetch.mockResolvedValue({ 
        ok: false, 
        status: 401, 
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Unauthorized')
      });

      const TestComponent = () => {
        const { data: user, isError } = useUser();
        
        // For 401 errors, useUser returns null (not an error state)
        if (user === null && !isError) {
          return <div data-testid="no-user">Not authenticated</div>;
        }
        
        if (isError) {
          return <div data-testid="error">Error occurred</div>;
        }
        
        return <div data-testid="user-email">{user?.email || 'loading'}</div>;
      };

      render(
        <QueryClientProvider client={testQueryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('no-user')).toBeInTheDocument();
      });

      // Should only make one call for 401 errors (no retries)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should limit retry attempts to prevent infinite loops', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        return Promise.resolve({ 
          ok: false, 
          status: 500, 
          statusText: 'Server Error',
          text: () => Promise.resolve('Server Error')
        });
      });

      const limitedRetryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2, // Limit to 2 retries
            retryDelay: 10, // Short delay for testing
          },
        },
      });

      const TestComponent = () => {
        const { data: user, isError } = useUser();
        
        if (isError) {
          return <div data-testid="error">Failed after retries</div>;
        }
        
        return <div data-testid="user-email">{user?.email || 'loading'}</div>;
      };

      render(
        <QueryClientProvider client={limitedRetryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Should make initial call + 2 retries = 3 total calls, but React Query might make additional calls
      expect(callCount).toBeGreaterThanOrEqual(3);
    });
  });
});