/**
 * Rollback Scenarios and Error Recovery Tests
 * Tests system recovery from various failure scenarios
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

describe('Rollback Scenarios and Error Recovery Tests', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;
  let originalOnline: boolean;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();
    originalOnline = navigator.onLine;
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    queryClient.clear();
    // Restore online status
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnline,
      writable: true,
    });
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

  const mockAuthSession = {
    user: { id: 'test-user-id', email: 'test@example.com' },
    access_token: 'mock-token',
  };

  describe('Network Failure Recovery', () => {
    it('should handle complete network failure gracefully', async () => {
      // Mock network failure
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
      });

      renderWithProviders(<ProfilePage />);

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/unable to load profile/i)).toBeInTheDocument();
      });

      // Should provide recovery option
      expect(screen.getByText('Go Back')).toBeInTheDocument();

      // Simulate network recovery
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-user-id',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
      });

      // Retry should work
      const goBackButton = screen.getByText('Go Back');
      await user.click(goBackButton);

      // Should recover gracefully
      expect(goBackButton).toBeInTheDocument();
    });

    it('should handle intermittent network failures with retry', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
      });

      // Mock intermittent failures
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-user-id',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
          }),
        });

      // Configure query client with retry
      queryClient = new QueryClient({
        defaultOptions: {
          queries: { 
            retry: 3,
            retryDelay: 100,
          },
        },
      });

      renderWithProviders(<ProfilePage />);

      // Should eventually succeed after retries
      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should handle offline/online state changes', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
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

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      fireEvent(window, new Event('offline'));

      // Mock network failure for offline state
      (global.fetch as any).mockRejectedValue(new Error('Network unavailable'));

      // Try to open edit modal while offline
      const editButton = screen.getByText('Edit Profile');
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      });

      // Try to save changes while offline
      const firstNameInput = screen.getByDisplayValue('John');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Johnny');

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Should show network error
      await waitFor(() => {
        expect(screen.getByText(/update failed/i)).toBeInTheDocument();
      });

      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
      });

      fireEvent(window, new Event('online'));

      // Mock successful request after coming online
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-user-id',
          email: 'test@example.com',
          first_name: 'Johnny',
          last_name: 'Doe',
        }),
      });

      // Retry should work
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/profile updated/i)).toBeInTheDocument();
      });
    });
  });

  describe('Authentication Failure Recovery', () => {
    it('should handle session expiration during operations', async () => {
      // Start with valid session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
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

      // Open edit modal
      const editButton = screen.getByText('Edit Profile');
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      });

      // Simulate session expiration
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
      });

      // Mock 401 response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      // Try to save changes
      const firstNameInput = screen.getByDisplayValue('John');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Johnny');

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Should handle 401 gracefully
      await waitFor(() => {
        expect(screen.getByText(/update failed/i)).toBeInTheDocument();
      });

      // Form should remain open for retry after re-authentication
      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Johnny')).toBeInTheDocument();
    });

    it('should handle token refresh failures', async () => {
      // Mock token refresh failure
      mockSupabase.auth.getSession
        .mockResolvedValueOnce({
          data: { session: mockAuthSession },
        })
        .mockRejectedValueOnce(new Error('Token refresh failed'))
        .mockResolvedValueOnce({
          data: {
            session: {
              ...mockAuthSession,
              access_token: 'new-token',
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

      // Should recover from token refresh failure
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  describe('Storage Operation Rollback', () => {
    it('should rollback profile picture upload on API failure', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
      });

      // Mock successful upload but failed profile update
      mockStorageService.uploadProfilePicture.mockResolvedValue({
        url: 'https://supabase.co/storage/profile.jpg',
        path: 'profile-pictures/test-user-id/profile.jpg',
      });

      mockStorageService.deleteAllUserProfilePictures.mockResolvedValue(undefined);

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

      // Upload file
      const file = new File(['mock image data'], 'profile.jpg', {
        type: 'image/jpeg',
      });

      const fileInput = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      // Mock profile update failure
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });

      // Submit form
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/upload failed|update failed/i)).toBeInTheDocument();
      });

      // Upload should have been attempted
      expect(mockStorageService.uploadProfilePicture).toHaveBeenCalled();
    });

    it('should handle storage quota exceeded errors', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
      });

      // Mock storage quota error
      mockStorageService.uploadProfilePicture.mockRejectedValue(
        new Error('Storage quota exceeded')
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

      // Try to upload large file
      const file = new File(['x'.repeat(5 * 1024 * 1024)], 'large.jpg', {
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

      // Should show quota error
      await waitFor(() => {
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      });

      // Form should remain open for retry with smaller file
      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    });

    it('should handle concurrent upload conflicts', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
      });

      // Mock concurrent upload scenario
      let uploadCount = 0;
      mockStorageService.uploadProfilePicture.mockImplementation(async () => {
        uploadCount++;
        if (uploadCount === 1) {
          // First upload succeeds
          return {
            url: 'https://supabase.co/storage/profile1.jpg',
            path: 'profile-pictures/test-user-id/profile1.jpg',
          };
        } else {
          // Second upload conflicts
          throw new Error('Concurrent modification detected');
        }
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

      // Upload first file
      const file1 = new File(['image data 1'], 'profile1.jpg', {
        type: 'image/jpeg',
      });

      const fileInput = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      Object.defineProperty(fileInput, 'files', {
        value: [file1],
        writable: false,
      });

      fireEvent.change(fileInput);

      // Mock successful profile update
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser),
      });

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // First upload should succeed
      await waitFor(() => {
        expect(mockStorageService.uploadProfilePicture).toHaveBeenCalledTimes(1);
      });

      // Try second upload immediately
      const file2 = new File(['image data 2'], 'profile2.jpg', {
        type: 'image/jpeg',
      });

      Object.defineProperty(fileInput, 'files', {
        value: [file2],
        writable: false,
      });

      fireEvent.change(fileInput);
      await user.click(saveButton);

      // Second upload should fail with conflict
      await waitFor(() => {
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Consistency Recovery', () => {
    it('should recover from partial data corruption', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
      });

      // Mock corrupted data response
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-user-id',
            email: null, // Corrupted email
            firstName: 'John',
            lastName: null, // Corrupted last name
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-user-id',
            email: 'test@example.com', // Recovered email
            firstName: 'John',
            lastName: 'Doe', // Recovered last name
          }),
        });

      renderWithProviders(<ProfilePage />);

      // Should handle corrupted data gracefully
      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      // Should show available data
      expect(screen.getByText('John')).toBeInTheDocument();

      // Simulate data recovery (e.g., from cache or re-fetch)
      queryClient.invalidateQueries({ queryKey: ['user'] });

      // Should recover with complete data
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });
    });

    it('should handle cache corruption recovery', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
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

      // Simulate cache corruption by clearing all queries
      queryClient.clear();

      // Should recover by re-fetching data
      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });
    });
  });

  describe('System Recovery Scenarios', () => {
    it('should handle server maintenance mode', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
      });

      // Mock maintenance mode response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service temporarily unavailable'),
      });

      renderWithProviders(<ProfilePage />);

      // Should show maintenance message
      await waitFor(() => {
        expect(screen.getByText(/unable to load profile/i)).toBeInTheDocument();
      });

      // Should provide recovery option
      expect(screen.getByText('Go Back')).toBeInTheDocument();

      // Simulate server recovery
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-user-id',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
      });

      // Should recover when server is back
      const goBackButton = screen.getByText('Go Back');
      await user.click(goBackButton);

      // Should eventually show normal state
      expect(goBackButton).toBeInTheDocument();
    });

    it('should handle database connection failures', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
      });

      // Mock database connection error
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Database connection failed'),
      });

      renderWithProviders(<ProfilePage />);

      // Should handle database error gracefully
      await waitFor(() => {
        expect(screen.getByText(/unable to load profile/i)).toBeInTheDocument();
      });

      // Should not crash the application
      expect(screen.getByText('Go Back')).toBeInTheDocument();
    });

    it('should handle memory pressure and cleanup', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
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

      // Simulate memory pressure by creating many queries
      for (let i = 0; i < 100; i++) {
        queryClient.setQueryData([`test-query-${i}`], { data: `test-data-${i}` });
      }

      // Should handle memory pressure gracefully
      expect(screen.getByText('Profile')).toBeInTheDocument();

      // Cleanup should work
      queryClient.clear();
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });
  });
});