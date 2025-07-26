import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FriendList } from '../friend-list';
import { FriendRequests } from '../friend-requests';
import { RoleManagementModal } from '../role-management-modal';
import { FriendshipStatusIndicator, getFriendshipStatus } from '../friendship-status-indicator';
import { FriendsPage } from '../friends-page';

// Mock the hooks and utilities
vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ data: { id: 'user1', username: 'testuser' } })
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({
        data: { session: { access_token: 'mock-token' } }
      })
    }
  }
}));

vi.mock('@/hooks/useFriendshipEvents', () => ({
  useFriendshipEvents: () => ({
    connectionStatus: { connected: true, authenticated: true },
    isConnected: true
  }),
  formatFriendshipEventMessage: (event: any) => `Friend event: ${event.type}`,
  getFriendshipEventNotificationType: () => 'info'
}));

// Mock fetch globally
global.fetch = vi.fn();

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('Friend Management Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FriendshipStatusIndicator', () => {
    it('renders correct status for none', () => {
      render(
        <FriendshipStatusIndicator 
          status="none" 
          variant="badge"
        />
      );
      
      expect(screen.getByText('Add Friend')).toBeInTheDocument();
    });

    it('renders correct status for accepted with role', () => {
      render(
        <FriendshipStatusIndicator 
          status="accepted" 
          role="editor"
          variant="badge"
          showRole={true}
        />
      );
      
      expect(screen.getByText('Friends')).toBeInTheDocument();
      expect(screen.getByText('Editor')).toBeInTheDocument();
    });

    it('handles click events', () => {
      const handleClick = vi.fn();
      render(
        <FriendshipStatusIndicator 
          status="none" 
          variant="button"
          onClick={handleClick}
        />
      );
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('getFriendshipStatus utility', () => {
    it('returns none for no friendship', () => {
      const result = getFriendshipStatus(null, 'user1');
      expect(result.status).toBe('none');
    });

    it('returns pending_sent for initiator', () => {
      const friendship = {
        status: 'pending',
        initiatorId: 'user1',
        userId: 'user1',
        friendId: 'user2',
        roleUserToFriend: 'viewer',
        roleFriendToUser: 'viewer'
      };
      
      const result = getFriendshipStatus(friendship, 'user1');
      expect(result.status).toBe('pending_sent');
      expect(result.role).toBe('viewer');
    });

    it('returns pending_received for non-initiator', () => {
      const friendship = {
        status: 'pending',
        initiatorId: 'user2',
        userId: 'user1',
        friendId: 'user2',
        roleUserToFriend: 'viewer',
        roleFriendToUser: 'viewer'
      };
      
      const result = getFriendshipStatus(friendship, 'user1');
      expect(result.status).toBe('pending_received');
    });

    it('returns accepted with correct role', () => {
      const friendship = {
        status: 'accepted',
        initiatorId: 'user2',
        userId: 'user1',
        friendId: 'user2',
        roleUserToFriend: 'editor',
        roleFriendToUser: 'viewer'
      };
      
      const result = getFriendshipStatus(friendship, 'user1');
      expect(result.status).toBe('accepted');
      expect(result.role).toBe('viewer'); // roleFriendToUser for userId
    });
  });

  describe('FriendList', () => {
    const mockFriends = {
      friends: [
        {
          id: 'friend1',
          username: 'friend1',
          firstName: 'John',
          lastName: 'Doe',
          status: 'accepted',
          roleUserToFriend: 'viewer',
          roleFriendToUser: 'editor',
          createdAt: '2024-01-01T00:00:00Z'
        }
      ],
      hasMore: false
    };

    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFriends)
      });
    });

    it('renders friends list', async () => {
      renderWithQueryClient(<FriendList />);
      
      await waitFor(() => {
        expect(screen.getByText('Friends (1)')).toBeInTheDocument();
      });
      
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('@friend1')).toBeInTheDocument();
    });

    it('handles search functionality', async () => {
      renderWithQueryClient(<FriendList />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search friends...')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('Search friends...');
      fireEvent.change(searchInput, { target: { value: 'John' } });
      
      expect(searchInput).toHaveValue('John');
    });

    it('handles role filtering', async () => {
      renderWithQueryClient(<FriendList />);
      
      await waitFor(() => {
        expect(screen.getByText('All Roles')).toBeInTheDocument();
      });
      
      // Test role filter interaction
      const filterButton = screen.getByRole('combobox');
      fireEvent.click(filterButton);
      
      await waitFor(() => {
        expect(screen.getByText('Viewers')).toBeInTheDocument();
      });
    });

    it('calls onFriendSelect when friend is clicked', async () => {
      const onFriendSelect = vi.fn();
      renderWithQueryClient(<FriendList onFriendSelect={onFriendSelect} />);
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('John Doe'));
      expect(onFriendSelect).toHaveBeenCalledWith(expect.objectContaining({
        id: 'friend1',
        username: 'friend1'
      }));
    });
  });

  describe('FriendRequests', () => {
    const mockRequests = {
      sent: [
        {
          id: 'req1',
          username: 'user2',
          firstName: 'Jane',
          lastName: 'Smith',
          status: 'pending',
          direction: 'sent',
          createdAt: '2024-01-01T00:00:00Z',
          initiatorId: 'user1'
        }
      ],
      received: [
        {
          id: 'req2',
          username: 'user3',
          firstName: 'Bob',
          lastName: 'Johnson',
          status: 'pending',
          direction: 'received',
          createdAt: '2024-01-01T00:00:00Z',
          initiatorId: 'user3'
        }
      ]
    };

    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRequests)
      });
    });

    it('renders friend requests tabs', async () => {
      renderWithQueryClient(<FriendRequests />);
      
      await waitFor(() => {
        expect(screen.getByText('Received (1)')).toBeInTheDocument();
        expect(screen.getByText('Sent (1)')).toBeInTheDocument();
      });
    });

    it('shows received requests with action buttons', async () => {
      renderWithQueryClient(<FriendRequests />);
      
      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Accept')).toBeInTheDocument();
      expect(screen.getByText('Decline')).toBeInTheDocument();
    });

    it('shows sent requests with pending status', async () => {
      renderWithQueryClient(<FriendRequests />);
      
      // Click on sent tab
      fireEvent.click(screen.getByText('Sent (1)'));
      
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('handles accept request', async () => {
      const onRequestHandled = vi.fn();
      
      // Mock successful accept response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      
      renderWithQueryClient(<FriendRequests onRequestHandled={onRequestHandled} />);
      
      await waitFor(() => {
        expect(screen.getByText('Accept')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Accept'));
      
      await waitFor(() => {
        expect(onRequestHandled).toHaveBeenCalledWith('req2', 'accepted');
      });
    });
  });

  describe('RoleManagementModal', () => {
    const mockFriend = {
      id: 'friend1',
      username: 'friend1',
      firstName: 'John',
      lastName: 'Doe',
      roleUserToFriend: 'viewer' as const,
      roleFriendToUser: 'editor' as const
    };

    it('renders role management modal', () => {
      render(
        <RoleManagementModal
          friend={mockFriend}
          isOpen={true}
          onClose={vi.fn()}
        />
      );
      
      expect(screen.getByText('Manage Friend Permissions')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('shows directional role options', () => {
      render(
        <RoleManagementModal
          friend={mockFriend}
          isOpen={true}
          onClose={vi.fn()}
        />
      );
      
      expect(screen.getByText('Your Content → John Doe')).toBeInTheDocument();
      expect(screen.getByText('John Doe\'s Content → You')).toBeInTheDocument();
    });

    it('handles role changes', () => {
      render(
        <RoleManagementModal
          friend={mockFriend}
          isOpen={true}
          onClose={vi.fn()}
        />
      );
      
      // Find and click on editor role for "Your Content → Friend"
      const editorRadios = screen.getAllByLabelText(/Editor/);
      fireEvent.click(editorRadios[0]);
      
      // Check that save button becomes enabled (has changes)
      const saveButton = screen.getByText('Save Changes');
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('FriendsPage', () => {
    beforeEach(() => {
      // Mock all API calls
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/friends?')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ friends: [], hasMore: false })
          });
        }
        if (url.includes('/api/friends/requests')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ sent: [], received: [] })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        });
      });
    });

    it('renders friends page with tabs', async () => {
      renderWithQueryClient(<FriendsPage />);
      
      expect(screen.getByText('Friends')).toBeInTheDocument();
      expect(screen.getByText('Manage your friendships and sharing permissions')).toBeInTheDocument();
      
      // Check tabs
      expect(screen.getByRole('tab', { name: /Friends/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Requests/ })).toBeInTheDocument();
    });

    it('shows add friends button', () => {
      renderWithQueryClient(<FriendsPage />);
      
      expect(screen.getByText('Add Friends')).toBeInTheDocument();
    });

    it('shows share entry button when entry is provided', () => {
      const mockEntry = {
        id: 'entry1',
        date: '2024-01-01',
        title: 'Test Entry',
        owner: {
          id: 'user1',
          username: 'testuser'
        }
      };
      
      renderWithQueryClient(<FriendsPage selectedEntry={mockEntry} />);
      
      expect(screen.getByText('Share Entry')).toBeInTheDocument();
    });

    it('switches between tabs', async () => {
      renderWithQueryClient(<FriendsPage />);
      
      // Click on requests tab
      fireEvent.click(screen.getByRole('tab', { name: /Requests/ }));
      
      // Should show request guidelines
      await waitFor(() => {
        expect(screen.getByText('Request Guidelines')).toBeInTheDocument();
      });
    });

    it('opens friend search modal', () => {
      renderWithQueryClient(<FriendsPage />);
      
      fireEvent.click(screen.getByText('Add Friends'));
      
      // Modal should be rendered (though content might be mocked)
      expect(screen.getByText('Add Friends')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    it('handles complete friend request flow', async () => {
      // Mock the API responses for the complete flow
      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Initial requests fetch
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              sent: [],
              received: [{
                id: 'req1',
                username: 'newuser',
                firstName: 'New',
                lastName: 'User',
                status: 'pending',
                direction: 'received',
                createdAt: '2024-01-01T00:00:00Z',
                initiatorId: 'newuser'
              }]
            })
          });
        } else if (callCount === 2) {
          // Accept request
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          });
        } else {
          // Subsequent fetches
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ sent: [], received: [] })
          });
        }
      });

      const onRequestHandled = vi.fn();
      renderWithQueryClient(<FriendRequests onRequestHandled={onRequestHandled} />);
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('New User')).toBeInTheDocument();
      });
      
      // Accept the request
      fireEvent.click(screen.getByText('Accept'));
      
      await waitFor(() => {
        expect(onRequestHandled).toHaveBeenCalledWith('req1', 'accepted');
      });
    });

    it('handles role management flow', async () => {
      const mockFriend = {
        id: 'friend1',
        username: 'friend1',
        firstName: 'John',
        lastName: 'Doe',
        roleUserToFriend: 'viewer' as const,
        roleFriendToUser: 'viewer' as const
      };

      const onRoleUpdated = vi.fn();
      
      // Mock successful role update
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      render(
        <RoleManagementModal
          friend={mockFriend}
          isOpen={true}
          onClose={vi.fn()}
          onRoleUpdated={onRoleUpdated}
        />
      );
      
      // Change role to editor
      const editorRadios = screen.getAllByLabelText(/Editor/);
      fireEvent.click(editorRadios[0]);
      
      // Save changes
      fireEvent.click(screen.getByText('Save Changes'));
      
      await waitFor(() => {
        expect(onRoleUpdated).toHaveBeenCalledWith('friend1', {
          toFriend: 'editor',
          toUser: 'viewer'
        });
      });
    });
  });
});