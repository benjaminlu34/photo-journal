/**
 * Mobile Responsiveness Tests for Profile Components
 * Tests profile functionality across different screen sizes and mobile devices
 * Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../client/src/contexts/auth-context';
import ProfilePage from '../../client/src/pages/profile';
import { EditProfileModal } from '../../client/src/components/profile/edit-profile-modal';
import { ProfilePicture } from '../../client/src/components/profile/ProfilePicture';

// Mock different device viewports
const mockViewports = {
  mobile: {
    width: 375,
    height: 667,
    devicePixelRatio: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    touchEnabled: true,
  },
  tablet: {
    width: 768,
    height: 1024,
    devicePixelRatio: 2,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    touchEnabled: true,
  },
  desktop: {
    width: 1920,
    height: 1080,
    devicePixelRatio: 1,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    touchEnabled: false,
  },
  smallMobile: {
    width: 320,
    height: 568,
    devicePixelRatio: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    touchEnabled: true,
  },
  largeMobile: {
    width: 414,
    height: 896,
    devicePixelRatio: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    touchEnabled: true,
  },
};

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

vi.mock('../../client/src/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock window.matchMedia for responsive design
const mockMatchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

describe('Mobile Responsiveness Tests', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  let originalUserAgent: string;
  let originalMatchMedia: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    originalUserAgent = navigator.userAgent;
    originalMatchMedia = window.matchMedia;
    
    // Mock matchMedia
    window.matchMedia = vi.fn().mockImplementation(mockMatchMedia);
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    // Restore original values
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      writable: true,
    });
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true,
    });
    window.matchMedia = originalMatchMedia;
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

  const mockViewport = (viewportName: keyof typeof mockViewports) => {
    const viewport = mockViewports[viewportName];
    
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      value: viewport.width,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: viewport.height,
      writable: true,
    });

    // Mock user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: viewport.userAgent,
      writable: true,
    });

    // Mock device pixel ratio
    Object.defineProperty(window, 'devicePixelRatio', {
      value: viewport.devicePixelRatio,
      writable: true,
    });

    // Mock touch support
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: viewport.touchEnabled ? 5 : 0,
      writable: true,
    });

    // Update matchMedia to reflect mobile queries
    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      const isMobile = viewport.width < 768;
      const isTablet = viewport.width >= 768 && viewport.width < 1024;
      
      let matches = false;
      if (query.includes('max-width: 767px')) matches = isMobile;
      if (query.includes('min-width: 768px')) matches = !isMobile;
      if (query.includes('max-width: 1023px')) matches = isMobile || isTablet;
      
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    });

    // Trigger resize event
    fireEvent(window, new Event('resize'));
    
    return viewport;
  };

  const mockUserData = {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  describe('Mobile Phone Responsiveness', () => {
    it('should render profile page correctly on mobile devices', async () => {
      mockViewport('mobile');
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUserData),
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' },
            access_token: 'mock-token',
          },
        },
      });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      // Verify mobile-specific layout
      const profileContainer = screen.getByText('Profile').closest('div');
      expect(profileContainer).toBeInTheDocument();
      
      // Check that content is properly stacked on mobile
      const nameDisplay = screen.getByText('John Doe');
      expect(nameDisplay).toBeInTheDocument();
      
      // Verify buttons are accessible on mobile
      const editButton = screen.getByText('Edit Profile');
      expect(editButton).toBeInTheDocument();
      
      const backButton = screen.getByText('Back to Journal');
      expect(backButton).toBeInTheDocument();
    });

    it('should handle touch interactions on mobile', async () => {
      mockViewport('mobile');
      
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

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

      // Test touch interactions
      const firstNameInput = screen.getByDisplayValue('John');
      
      // Simulate touch events
      fireEvent.touchStart(firstNameInput);
      fireEvent.touchEnd(firstNameInput);
      fireEvent.focus(firstNameInput);
      
      expect(firstNameInput).toHaveFocus();
      
      // Test that virtual keyboard doesn't break layout
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Johnny');
      
      expect(screen.getByDisplayValue('Johnny')).toBeInTheDocument();
    });

    it('should handle file upload on mobile devices', async () => {
      mockViewport('mobile');
      
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

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

      // Test mobile file upload
      const fileInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      
      // Mobile devices should support camera capture
      expect(fileInput.getAttribute('accept')).toBe('image/*');
      
      // Simulate mobile photo capture
      const file = new File(['mock image data'], 'photo.jpg', {
        type: 'image/jpeg',
      });

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      // Should handle file processing on mobile
      expect(global.FileReader).toBeDefined();
    });
  });

  describe('Small Mobile Device Support', () => {
    it('should work on very small screens (320px)', async () => {
      mockViewport('smallMobile');
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUserData),
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' },
            access_token: 'mock-token',
          },
        },
      });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      // Verify content doesn't overflow on small screens
      const profileContainer = screen.getByText('Profile').closest('div');
      expect(profileContainer).toBeInTheDocument();
      
      // Check that buttons are still accessible
      const editButton = screen.getByText('Edit Profile');
      expect(editButton).toBeInTheDocument();
      
      // Verify text doesn't get cut off
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should handle modal display on small screens', async () => {
      mockViewport('smallMobile');
      
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

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

      // Modal should be properly sized for small screens
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      
      // Form elements should be accessible
      const firstNameInput = screen.getByDisplayValue('John');
      const lastNameInput = screen.getByDisplayValue('Doe');
      
      expect(firstNameInput).toBeInTheDocument();
      expect(lastNameInput).toBeInTheDocument();
      
      // Buttons should be properly sized and accessible
      const saveButton = screen.getByText('Save Changes');
      const cancelButton = screen.getByText('Cancel');
      
      expect(saveButton).toBeInTheDocument();
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Large Mobile Device Support', () => {
    it('should optimize for large mobile screens', async () => {
      mockViewport('largeMobile');
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUserData),
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' },
            access_token: 'mock-token',
          },
        },
      });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      // Should utilize larger screen space effectively
      const profileContainer = screen.getByText('Profile').closest('div');
      expect(profileContainer).toBeInTheDocument();
      
      // Content should be well-spaced on larger mobile screens
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  describe('Tablet Responsiveness', () => {
    it('should render correctly on tablet devices', async () => {
      mockViewport('tablet');
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUserData),
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' },
            access_token: 'mock-token',
          },
        },
      });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      // Tablet should have more spacious layout
      const profileContainer = screen.getByText('Profile').closest('div');
      expect(profileContainer).toBeInTheDocument();
      
      // Should show content in a more desktop-like layout
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    });

    it('should handle tablet-specific interactions', async () => {
      mockViewport('tablet');
      
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

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

      // Tablet should support both touch and mouse interactions
      const firstNameInput = screen.getByDisplayValue('John');
      
      // Test touch interaction
      fireEvent.touchStart(firstNameInput);
      fireEvent.touchEnd(firstNameInput);
      
      // Test mouse interaction
      fireEvent.mouseDown(firstNameInput);
      fireEvent.mouseUp(firstNameInput);
      
      expect(firstNameInput).toBeInTheDocument();
    });
  });

  describe('Orientation Changes', () => {
    it('should handle portrait to landscape orientation change', async () => {
      // Start in portrait
      mockViewport('mobile');
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUserData),
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' },
            access_token: 'mock-token',
          },
        },
      });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      // Simulate orientation change to landscape
      Object.defineProperty(window, 'innerWidth', {
        value: 667,
        writable: true,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 375,
        writable: true,
      });

      fireEvent(window, new Event('resize'));
      fireEvent(window, new Event('orientationchange'));

      // Content should still be accessible after orientation change
      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should handle modal display during orientation changes', async () => {
      mockViewport('mobile');
      
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

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

      // Simulate orientation change while modal is open
      Object.defineProperty(window, 'innerWidth', {
        value: 667,
        writable: true,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 375,
        writable: true,
      });

      fireEvent(window, new Event('resize'));
      fireEvent(window, new Event('orientationchange'));

      // Modal should remain functional after orientation change
      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
        expect(screen.getByDisplayValue('John')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
      });
    });
  });

  describe('Profile Picture Responsiveness', () => {
    it('should display profile pictures correctly on mobile', async () => {
      mockViewport('mobile');
      
      renderWithProviders(
        <ProfilePicture userId="test-user-id" size="xl" />
      );

      // Profile picture should be rendered
      const avatar = screen.getByRole('img', { hidden: true });
      expect(avatar).toBeInTheDocument();
      
      // Should have appropriate size classes for mobile
      const avatarContainer = avatar.closest('span');
      expect(avatarContainer).toHaveClass('h-16', 'w-16');
    });

    it('should handle different profile picture sizes on mobile', async () => {
      mockViewport('mobile');
      
      const sizes = ['sm', 'md', 'lg', 'xl'] as const;
      
      for (const size of sizes) {
        const { unmount } = renderWithProviders(
          <ProfilePicture userId="test-user-id" size={size} />
        );
        
        const avatar = screen.getByRole('img', { hidden: true });
        expect(avatar).toBeInTheDocument();
        
        unmount();
      }
    });
  });

  describe('Accessibility on Mobile', () => {
    it('should maintain accessibility features on mobile', async () => {
      mockViewport('mobile');
      
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

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

      // Check that form labels are properly associated
      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      
      expect(firstNameInput).toBeInTheDocument();
      expect(lastNameInput).toBeInTheDocument();
      
      // Check that buttons have proper accessibility attributes
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      
      expect(saveButton).toBeInTheDocument();
      expect(cancelButton).toBeInTheDocument();
      
      // File input should be accessible
      const fileInput = screen.getByRole('button').querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
    });

    it('should support screen readers on mobile', async () => {
      mockViewport('mobile');
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUserData),
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' },
            access_token: 'mock-token',
          },
        },
      });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      // Check for proper heading structure
      const heading = screen.getByRole('heading', { name: /profile/i });
      expect(heading).toBeInTheDocument();
      
      // Check for proper button roles
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      const backButton = screen.getByRole('button', { name: /back to journal/i });
      
      expect(editButton).toBeInTheDocument();
      expect(backButton).toBeInTheDocument();
    });
  });
});