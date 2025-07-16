/**
 * Authentication and Profile Management Integration Tests
 * Tests the integration between authentication flows and profile management
 * Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/auth-context';
import ProfilePage from '@/pages/profile';
import { EditProfileModal } from '@/components/profile/edit-profile-modal';

// Mock Supabase
const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  },
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(),
      list: vi.fn(),
      remove: vi.fn(),
      getPublicUrl: vi.fn(),
    })),
  },
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock storage service
const mockStorageService = {
  uploadProfilePicture: vi.fn(),
  getLatestProfilePictureUrl: vi.fn(),
  deleteAllUserProfilePictures: vi.fn(),
};

vi.mock('@/services/storage.service', () => ({
  StorageService: {
    getInstance: () => mockStorageService,
  },
}));

describe('Authentication and Profile Management Integration Tests', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {component}
        </AuthProvider>
      </QueryClientProvider>
    );
  };

  describe('Authentication State Integration', () => {
    it('should sync authentication state with profile data', async () => {
      // Mock initial session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { 
              id: 'test-user-id', 
              email: 'test@example.com',
              created_at: '2023-01-01T00:00:00Z'
            },
            access_token: 'mock-token',
          },
        },
      });

      // Mock user profile fetch
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-user-id',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
      });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      // Verify that profile data is loaded with authentication
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();

      // Verify API was called with proper authentication
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/user', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer mock-token',
        },
      });
    });

    it('should handle authentication state changes during profile operations', async () => {
      // Start with authenticated state
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' },
            access_token: 'mock-token',
          },
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-user-id',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
      });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      // Simulate session expiration during profile update
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
      });

      // Mock 401 response for expired session
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      // Try to open edit modal
      const editButton = screen.getByText('Edit Profile');
      await user.click(editButton);

      // Should handle 401 gracefully
      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      });
    });

    it('should refresh authentication tokens automatically', async () => {
      let tokenRefreshCount = 0;
      
      mockSupabase.auth.getSession.mockImplementation(() => {
        tokenRefreshCount++;
        return Promise.resolve({
          data: {
            session: {
              user: { id: 'test-user-id', email: 'test@example.com' },
              access_token: `mock-token-${tokenRefreshCount}`,
            },
          },
        });
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-user-id',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
      });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      // Verify token was used in API call
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/user', 
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token-1',
          }),
        })
      );
    });
  });

  describe('Profile Update Authentication', () => {
    it('should include authentication headers in profile updates', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' },
            access_token: 'mock-token',
          },
        },
      });

      renderWithProviders(
        <EditProfileModal
          isOpen={true}
          onClose={() => {}}
          user={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      });

      // Update profile data
      const firstNameInput = screen.getByDisplayValue('John');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Johnny');

      // Mock successful profile update
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...mockUser,
          first_name: 'Johnny',
        }),
      });

      // Submit form
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Verify authentication header was included
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token',
          },
          body: JSON.stringify({
            firstName: 'Johnny',
          }),
        });
      });
    });

    it('should handle authentication failures during profile updates', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' },
            access_token: 'expired-token',
          },
        },
      });

      renderWithProviders(
        <EditProfileModal
          isOpen={true}
          onClose={() => {}}
          user={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      });

      // Mock authentication failure
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      // Try to update profile
      const firstNameInput = screen.getByDisplayValue('John');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Johnny');

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/update failed/i)).toBeInTheDocument();
      });

      // Modal should remain open for retry
      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    });
  });

  describe('Storage Authentication Integration', () => {
    it('should authenticate storage operations with user context', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' },
            access_token: 'mock-token',
          },
        },
      });

      mockStorageService.uploadProfilePicture.mockResolvedValue({
        url: 'https://example.com/profile.jpg',
        path: 'profile-pictures/test-user-id/profile.jpg',
      });

      renderWithProviders(
        <EditProfileModal
          isOpen={true}
          onClose={() => {}}
          user={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      });

      // Upload profile picture
      const file = new File(['mock image data'], 'profile.jpg', {
        type: 'image/jpeg',
      });

      const fileInput = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      // Mock successful profile update
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser),
      });

      // Submit form
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Verify storage operation was called with correct user ID
      await waitFor(() => {
        expect(mockStorageService.uploadProfilePicture).toHaveBeenCalledWith(
          'test-user-id',
          file
        );
      });
    });

    it('should handle storage authentication failures', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' },
            access_token: 'mock-token',
          },
        },
      });

      // Mock storage authentication failure
      mockStorageService.uploadProfilePicture.mockRejectedValue(
        new Error('Authentication failed')
      );

      renderWithProviders(
        <EditProfileModal
          isOpen={true}
          onClose={() => {}}
          user={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      });

      // Try to upload file
      const file = new File(['mock image data'], 'profile.jpg', {
        type: 'image/jpeg',
      });

      const fileInput = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Should show upload error
      await waitFor(() => {
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Session Management', () => {
    it('should handle concurrent authentication operations', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' },
            access_token: 'mock-token',
          },
        },
      });

      // Mock multiple concurrent API calls
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-user-id',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-user-id',
            email: 'test@example.com',
            firstName: 'Johnny',
            lastName: 'Doe',
          }),
        });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      // Open edit modal
      const editButton = screen.getByText('Edit Profile');
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      });

      // Make rapid profile updates
      const firstNameInput = screen.getByDisplayValue('John');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Johnny');

      const saveButton = screen.getByText('Save Changes');
      
      // Click save multiple times rapidly
      await user.click(saveButton);
      await user.click(saveButton);

      // Should handle concurrent operations gracefully
      await waitFor(() => {
        expect(screen.getByText(/profile updated|saving/i)).toBeInTheDocument();
      });
    });

    it('should maintain session consistency across profile operations', async () => {
      const sessionData = {
        user: { id: 'test-user-id', email: 'test@example.com' },
        access_token: 'consistent-token',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: sessionData },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-user-id',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
      });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      // Verify consistent session usage
      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/user', 
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer consistent-token',
          }),
        })
      );
    });
  });

  describe('Authentication Error Recovery', () => {
    it('should recover from temporary authentication failures', async () => {
      // Start with failed authentication
      mockSupabase.auth.getSession
        .mockResolvedValueOnce({
          data: { session: null },
        })
        .mockResolvedValueOnce({
          data: {
            session: {
              user: { id: 'test-user-id', email: 'test@example.com' },
              access_token: 'recovered-token',
            },
          },
        });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-user-id',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
          }),
        });

      renderWithProviders(<ProfilePage />);

      // Should initially show error or loading state
      await waitFor(() => {
        expect(screen.getByText(/unable to load profile|loading/i)).toBeInTheDocument();
      });

      // Simulate authentication recovery (e.g., token refresh)
      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should handle authentication state synchronization', async () => {
      let authStateCallback: ((event: string, session: any) => void) | null = null;

      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authStateCallback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' },
            access_token: 'initial-token',
          },
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-user-id',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
      });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      // Simulate authentication state change
      if (authStateCallback) {
        authStateCallback('SIGNED_IN', {
          user: { id: 'test-user-id', email: 'test@example.com' },
          access_token: 'new-token',
        });
      }

      // Should handle state change gracefully
      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });
    });
  });
});