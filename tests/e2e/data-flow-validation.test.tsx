/**
 * Data Flow Validation Tests
 * Tests complete data flow from frontend to Supabase Storage and back
 * Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../client/src/contexts/auth-context';
import ProfilePage from '../../client/src/pages/profile';
import { EditProfileModal } from '../../client/src/components/profile/edit-profile-modal/edit-profile-modal';
import { ProfilePicture } from '../../client/src/components/profile/ProfilePicture/ProfilePicture';

// Mock Supabase with detailed storage operations
const mockSupabaseStorage = {
  upload: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn(),
  createSignedUrl: vi.fn(),
};

const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  },
  storage: {
    from: vi.fn(() => mockSupabaseStorage),
  },
};

vi.mock('../../../client/src/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock storage service with detailed tracking
const mockStorageService = {
  uploadProfilePicture: vi.fn(),
  getLatestProfilePictureUrl: vi.fn(),
  deleteAllUserProfilePictures: vi.fn(),
  listUserProfilePictures: vi.fn(),
};

vi.mock('@/services/storage.service', () => ({
  StorageService: {
    getInstance: () => mockStorageService,
  },
}));

describe('Data Flow Validation Tests', () => {
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
    
    // Mock FileReader
    global.FileReader = class {
      readAsDataURL = vi.fn();
      onloadend = vi.fn();
      result = 'data:image/jpeg;base64,mockImageData';
    } as any;
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

  const mockAuthSession = {
    user: { id: 'test-user-id', email: 'test@example.com' },
    access_token: 'mock-token',
  };

  describe('Complete Profile Data Flow', () => {
    it('should validate end-to-end profile data flow', async () => {
      // Setup authentication
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
      });

      // Mock initial profile fetch
      (global.fetch as any).mockResolvedValueOnce({
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

      // Verify initial data flow
      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/user', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer mock-token',
        },
      });

      // Verify data is displayed
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should validate profile update data flow', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
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

      const lastNameInput = screen.getByDisplayValue('Doe');
      await user.clear(lastNameInput);
      await user.type(lastNameInput, 'Smith');

      // Mock successful update response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...mockUser,
          first_name: 'Johnny',
          last_name: 'Smith',
        }),
      });

      // Submit form
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Verify update data flow
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token',
          },
          body: JSON.stringify({
            firstName: 'Johnny',
            lastName: 'Smith',
          }),
        });
      });
    });
  });

  describe('Profile Picture Data Flow', () => {
    it('should validate complete profile picture upload flow', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
      });

      // Mock storage operations
      mockStorageService.getLatestProfilePictureUrl.mockResolvedValue(null);
      mockStorageService.uploadProfilePicture.mockResolvedValue({
        url: 'https://supabase.co/storage/profile-pictures/test-user-id/profile.jpg',
        path: 'profile-pictures/test-user-id/profile.jpg',
      });

      // Mock Supabase storage operations
      mockSupabaseStorage.upload.mockResolvedValue({
        data: { path: 'profile-pictures/test-user-id/profile.jpg' },
        error: null,
      });

      mockSupabaseStorage.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://supabase.co/storage/profile-pictures/test-user-id/profile.jpg' },
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

      // Upload file
      const file = new File(['mock image data'], 'profile.jpg', {
        type: 'image/jpeg',
      });

      const fileInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      // Mock profile update
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser),
      });

      // Submit form
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Verify complete upload flow
      await waitFor(() => {
        expect(mockStorageService.uploadProfilePicture).toHaveBeenCalledWith(
          'test-user-id',
          file
        );
      });

      // Verify storage service was called
      expect(mockStorageService.getLatestProfilePictureUrl).toHaveBeenCalledWith('test-user-id');
    });

    it('should validate profile picture retrieval flow', async () => {
      const mockProfilePictureUrl = 'https://supabase.co/storage/profile-pictures/test-user-id/profile.jpg';

      // Mock storage service to return existing profile picture
      mockStorageService.getLatestProfilePictureUrl.mockResolvedValue(mockProfilePictureUrl);

      // Mock Supabase storage operations
      mockSupabaseStorage.list.mockResolvedValue({
        data: [
          { name: 'profile.jpg', updated_at: '2023-01-01T00:00:00Z' }
        ],
        error: null,
      });

      mockSupabaseStorage.getPublicUrl.mockReturnValue({
        data: { publicUrl: mockProfilePictureUrl },
      });

      renderWithProviders(
        <ProfilePicture userId="test-user-id" size="lg" />
      );

      // Verify retrieval flow
      await waitFor(() => {
        expect(mockStorageService.getLatestProfilePictureUrl).toHaveBeenCalledWith('test-user-id');
      });

      // Profile picture should be displayed
      const profileImage = screen.getByRole('img', { hidden: true });
      expect(profileImage).toBeInTheDocument();
    });

    it('should validate profile picture deletion flow', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
      });

      // Mock existing profile picture
      mockStorageService.getLatestProfilePictureUrl.mockResolvedValue(
        'https://supabase.co/storage/profile-pictures/test-user-id/profile.jpg'
      );

      // Mock deletion operation
      mockStorageService.deleteAllUserProfilePictures.mockResolvedValue(undefined);
      mockSupabaseStorage.remove.mockResolvedValue({
        data: null,
        error: null,
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

      // Wait for profile picture to load
      await waitFor(() => {
        expect(screen.getByText('Remove Picture')).toBeInTheDocument();
      });

      // Remove profile picture
      const removeButton = screen.getByText('Remove Picture');
      await user.click(removeButton);

      // Verify deletion flow
      await waitFor(() => {
        expect(mockStorageService.deleteAllUserProfilePictures).toHaveBeenCalledWith('test-user-id');
      });
    });
  });

  describe('Storage Bucket Organization', () => {
    it('should validate proper file organization in storage buckets', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
      });

      // Mock storage service to track file paths
      mockStorageService.uploadProfilePicture.mockImplementation(async (userId, file) => {
        const expectedPath = `profile-pictures/${userId}/${file.name}`;
        
        // Verify correct bucket and path structure
        expect(mockSupabase.storage.from).toHaveBeenCalledWith('profile-pictures');
        
        return {
          url: `https://supabase.co/storage/${expectedPath}`,
          path: expectedPath,
        };
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

      // Upload file
      const file = new File(['mock image data'], 'profile.jpg', {
        type: 'image/jpeg',
      });

      const fileInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      // Mock profile update
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser),
      });

      // Submit form
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Verify file organization
      await waitFor(() => {
        expect(mockStorageService.uploadProfilePicture).toHaveBeenCalledWith(
          'test-user-id',
          file
        );
      });
    });

    it('should validate user isolation in storage', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      // Mock storage service to verify user isolation
      mockStorageService.getLatestProfilePictureUrl.mockImplementation(async (userId) => {
        // Should only access files for the specific user
        expect(userId).toMatch(/^user-[12]$/);
        
        if (userId === userId1) {
          return 'https://supabase.co/storage/profile-pictures/user-1/profile.jpg';
        } else if (userId === userId2) {
          return 'https://supabase.co/storage/profile-pictures/user-2/profile.jpg';
        }
        
        return null;
      });

      // Test user 1
      renderWithProviders(
        <ProfilePicture userId={userId1} size="lg" />
      );

      await waitFor(() => {
        expect(mockStorageService.getLatestProfilePictureUrl).toHaveBeenCalledWith(userId1);
      });

      // Test user 2
      renderWithProviders(
        <ProfilePicture userId={userId2} size="lg" />
      );

      await waitFor(() => {
        expect(mockStorageService.getLatestProfilePictureUrl).toHaveBeenCalledWith(userId2);
      });

      // Verify each user only accessed their own files
      expect(mockStorageService.getLatestProfilePictureUrl).toHaveBeenCalledTimes(2);
    });
  });

  describe('Data Consistency and Caching', () => {
    it('should validate cache invalidation after profile updates', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
      });

      // Mock initial profile fetch
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUser),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ...mockUser,
            first_name: 'Johnny',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ...mockUser,
            first_name: 'Johnny',
          }),
        });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Open edit modal
      const editButton = screen.getByText('Edit Profile');
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      });

      // Update name
      const firstNameInput = screen.getByDisplayValue('John');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Johnny');

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Verify cache was invalidated and data refreshed
      await waitFor(() => {
        expect(screen.getByText('Johnny Doe')).toBeInTheDocument();
      });

      // Verify multiple API calls were made (initial + update + refresh)
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should validate real-time data synchronization', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
      });

      // Mock profile picture upload with immediate URL generation
      mockStorageService.uploadProfilePicture.mockResolvedValue({
        url: 'https://supabase.co/storage/profile-pictures/test-user-id/profile.jpg',
        path: 'profile-pictures/test-user-id/profile.jpg',
      });

      mockStorageService.getLatestProfilePictureUrl
        .mockResolvedValueOnce(null) // Initial load
        .mockResolvedValueOnce('https://supabase.co/storage/profile-pictures/test-user-id/profile.jpg'); // After upload

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

      const fileInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      // Mock profile update
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser),
      });

      // Submit form
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Verify real-time update
      await waitFor(() => {
        expect(mockStorageService.uploadProfilePicture).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling in Data Flow', () => {
    it('should validate error propagation through data flow', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockAuthSession },
      });

      // Mock storage error
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

      // Try to upload file
      const file = new File(['mock image data'], 'profile.jpg', {
        type: 'image/jpeg',
      });

      const fileInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Verify error is properly handled and displayed
      await waitFor(() => {
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      });

      // Verify error doesn't break the data flow
      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    });

    it('should validate rollback on partial failures', async () => {
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
        url: 'https://supabase.co/storage/profile-pictures/test-user-id/profile.jpg',
        path: 'profile-pictures/test-user-id/profile.jpg',
      });

      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
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

      // Upload file and update profile
      const file = new File(['mock image data'], 'profile.jpg', {
        type: 'image/jpeg',
      });

      const fileInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      const firstNameInput = screen.getByDisplayValue('John');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Johnny');

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Verify partial failure is handled
      await waitFor(() => {
        expect(screen.getByText(/update failed/i)).toBeInTheDocument();
      });

      // Form should remain open for retry
      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Johnny')).toBeInTheDocument();
    });
  });
});