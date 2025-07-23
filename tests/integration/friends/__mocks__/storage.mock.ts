import { vi } from 'vitest';

// Create proper mock functions
export const mockStorage = {
  getUserByUsername: vi.fn(),
  canSendFriendRequestTo: vi.fn(),
  createFriendshipWithCanonicalOrdering: vi.fn(),
  getFriendshipById: vi.fn(),
  updateFriendshipStatusWithAudit: vi.fn(),
  updateFriendshipRole: vi.fn(),
  getFriendship: vi.fn(),
  getUser: vi.fn(),
  getFriendsWithRoles: vi.fn(),
  getFriendRequests: vi.fn(),
  upsertUser: vi.fn(),
};

// Reset all mocks
export const resetAllMocks = () => {
  Object.values(mockStorage).forEach(mock => {
    if (typeof mock === 'function') {
      mock.mockClear();
    }
  });
};