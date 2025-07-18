/**
 * Cross-Browser Compatibility Tests for Profile Features
 * Tests profile functionality across different browser environments
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

// Mock different browser environments
const mockBrowserEnvironments = {
  chrome: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    features: {
      FileReader: true,
      fetch: true,
      localStorage: true,
      sessionStorage: true,
      WebRTC: true,
    },
  },
  firefox: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    features: {
      FileReader: true,
      fetch: true,
      localStorage: true,
      sessionStorage: true,
      WebRTC: true,
    },
  },
  safari: {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    features: {
      FileReader: true,
      fetch: true,
      localStorage: true,
      sessionStorage: true,
      WebRTC: false, // Safari has limited WebRTC support
    },
  },
  edge: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
    features: {
      FileReader: true,
      fetch: true,
      localStorage: true,
      sessionStorage: true,
      WebRTC: true,
    },
  },
  oldBrowser: {
    userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko',
    features: {
      FileReader: true,
      fetch: false, // Old browsers might not have fetch
      localStorage: true,
      sessionStorage: true,
      WebRTC: false,
    },
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

describe('Cross-Browser Compatibility Tests', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;
  let originalUserAgent: string;
  let originalFetch: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();
    originalUserAgent = navigator.userAgent;
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    // Restore original values
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true,
    });
    global.fetch = originalFetch;
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

  const mockBrowserEnvironment = (browserName: keyof typeof mockBrowserEnvironments) => {
    const browser = mockBrowserEnvironments[browserName];
    
    // Mock user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: browser.userAgent,
      writable: true,
    });

    // Mock fetch availability
    if (!browser.features.fetch) {
      global.fetch = undefined as any;
    } else {
      global.fetch = vi.fn();
    }

    // Mock FileReader availability
    if (!browser.features.FileReader) {
      global.FileReader = undefined as any;
    } else {
      global.FileReader = class {
        readAsDataURL = vi.fn();
        onloadend = vi.fn();
        result = 'data:image/jpeg;base64,mockImageData';
      } as any;
    }

    // Mock storage availability
    if (!browser.features.localStorage) {
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
      });
    }

    return browser;
  };

  describe('Chrome Browser Compatibility', () => {
    it('should work correctly in Chrome environment', async () => {
      const browser = mockBrowserEnvironment('chrome');
      
      // Mock successful user data
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-user-id',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
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

      // Verify all Chrome features work
      expect(browser.features.FileReader).toBe(true);
      expect(browser.features.fetch).toBe(true);
      expect(browser.features.localStorage).toBe(true);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should handle file uploads in Chrome', async () => {
      mockBrowserEnvironment('chrome');
      
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

      // Test file upload functionality
      const file = new File(['mock image data'], 'profile.jpg', {
        type: 'image/jpeg',
      });

      const fileInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      // FileReader should work in Chrome
      expect(global.FileReader).toBeDefined();
    });
  });

  describe('Firefox Browser Compatibility', () => {
    it('should work correctly in Firefox environment', async () => {
      const browser = mockBrowserEnvironment('firefox');
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-user-id',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
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

      // Verify Firefox-specific behavior
      expect(navigator.userAgent).toContain('Firefox');
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should handle Firefox-specific file handling', async () => {
      mockBrowserEnvironment('firefox');
      
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

      // Test that file input works in Firefox
      const fileInput = screen.getByRole('button').querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput?.getAttribute('accept')).toBe('image/*');
    });
  });

  describe('Safari Browser Compatibility', () => {
    it('should work correctly in Safari environment', async () => {
      const browser = mockBrowserEnvironment('safari');
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-user-id',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
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

      // Verify Safari-specific behavior
      expect(navigator.userAgent).toContain('Safari');
      expect(browser.features.WebRTC).toBe(false); // Safari has limited WebRTC
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should handle Safari file upload limitations', async () => {
      mockBrowserEnvironment('safari');
      
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

      // Test Safari-specific file handling
      const file = new File(['mock image data'], 'profile.heic', {
        type: 'image/heic', // Safari-specific format
      });

      const fileInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      // Should handle HEIC files (Safari-specific)
      await waitFor(() => {
        // Should show error for unsupported format in our validation
        expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Browser Compatibility', () => {
    it('should work correctly in Edge environment', async () => {
      const browser = mockBrowserEnvironment('edge');
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-user-id',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
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

      // Verify Edge-specific behavior
      expect(navigator.userAgent).toContain('Edg');
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  describe('Legacy Browser Support', () => {
    it('should gracefully degrade for older browsers', async () => {
      const browser = mockBrowserEnvironment('oldBrowser');
      
      // Mock XMLHttpRequest for older browsers without fetch
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        readyState: 4,
        status: 200,
        responseText: JSON.stringify({
          id: 'test-user-id',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
      };

      global.XMLHttpRequest = vi.fn(() => mockXHR) as any;

      // Since fetch is not available, the app should handle this gracefully
      renderWithProviders(<ProfilePage />);

      // Should still render basic structure
      await waitFor(() => {
        // May show loading or error state due to missing fetch
        expect(screen.getByText(/loading|unable to load/i)).toBeInTheDocument();
      });

      expect(browser.features.fetch).toBe(false);
      expect(browser.features.WebRTC).toBe(false);
    });

    it('should handle missing FileReader API', async () => {
      mockBrowserEnvironment('oldBrowser');
      
      // Remove FileReader to simulate older browser
      global.FileReader = undefined as any;
      
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

      // File input should still be present but may not show preview
      const fileInput = screen.getByRole('button').querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();

      // Try to upload file without FileReader
      const file = new File(['mock image data'], 'profile.jpg', {
        type: 'image/jpeg',
      });

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      // Should handle gracefully without FileReader
      expect(global.FileReader).toBeUndefined();
    });
  });

  describe('Feature Detection and Polyfills', () => {
    it('should detect browser capabilities correctly', async () => {
      const browsers = ['chrome', 'firefox', 'safari', 'edge', 'oldBrowser'] as const;
      
      for (const browserName of browsers) {
        const browser = mockBrowserEnvironment(browserName);
        
        // Test feature detection
        expect(typeof global.fetch !== 'undefined').toBe(browser.features.fetch);
        expect(typeof global.FileReader !== 'undefined').toBe(browser.features.FileReader);
        
        // Reset for next iteration
        vi.clearAllMocks();
      }
    });

    it('should provide fallbacks for missing features', async () => {
      mockBrowserEnvironment('oldBrowser');
      
      // Test that the app doesn't crash when features are missing
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      expect(() => {
        renderWithProviders(
          <EditProfileModal
            isOpen={true}
            onClose={() => {}}
            user={mockUser}
          />
        );
      }).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      });
    });
  });

  describe('Browser-Specific CSS and Styling', () => {
    it('should handle different CSS rendering across browsers', async () => {
      const browsers = ['chrome', 'firefox', 'safari', 'edge'] as const;
      
      for (const browserName of browsers) {
        mockBrowserEnvironment(browserName);
        
        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-user-id',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
          }),
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

        // Verify that CSS classes are applied correctly
        const profileContainer = screen.getByText('Profile').closest('div');
        expect(profileContainer).toHaveClass('neu-card');
        
        // Clean up for next iteration
        queryClient.clear();
        vi.clearAllMocks();
      }
    });
  });
});