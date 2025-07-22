import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { Request, Response } from 'express';
import { usernameChangeRateLimit } from '../../server/middleware/rateLimit';
import { storage } from '../../server/storage';

// Mock the storage module
vi.mock('../../server/storage', () => ({
  storage: {
    getUsernameChangesInPeriod: vi.fn(),
  },
}));

describe('Username Change Rate Limiting', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: Mock;

  beforeEach(() => {
    mockReq = {
      user: { id: 'test-user-id', email: 'test@example.com' },
      query: {},
    };
    
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
    
    mockNext = vi.fn();
    
    // Reset mocks
    vi.clearAllMocks();
  });

  it('should allow username change when no recent changes exist', async () => {
    // Mock no recent changes
    vi.mocked(storage.getUsernameChangesInPeriod).mockResolvedValue([]);

    await usernameChangeRateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalledWith(429);
    expect(mockRes.set).toHaveBeenCalledWith('RateLimit-Limit', '2');
    expect(mockRes.set).toHaveBeenCalledWith('RateLimit-Remaining', '2');
  });

  it('should allow username change when only 1 recent change exists', async () => {
    // Mock 1 recent change
    const oneChangeAgo = new Date();
    oneChangeAgo.setDate(oneChangeAgo.getDate() - 15); // 15 days ago
    
    vi.mocked(storage.getUsernameChangesInPeriod).mockResolvedValue([
      {
        id: '1',
        userId: 'test-user-id',
        oldUsername: 'oldname',
        newUsername: 'newname',
        changedAt: oneChangeAgo,
      },
    ]);

    await usernameChangeRateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalledWith(429);
    expect(mockRes.set).toHaveBeenCalledWith('RateLimit-Remaining', '1');
  });

  it('should block username change when 2 recent changes exist', async () => {
    // Mock 2 recent changes
    const firstChange = new Date();
    firstChange.setDate(firstChange.getDate() - 10); // 10 days ago
    
    const secondChange = new Date();
    secondChange.setDate(secondChange.getDate() - 5); // 5 days ago
    
    vi.mocked(storage.getUsernameChangesInPeriod).mockResolvedValue([
      {
        id: '1',
        userId: 'test-user-id',
        oldUsername: 'oldname1',
        newUsername: 'newname1',
        changedAt: firstChange,
      },
      {
        id: '2',
        userId: 'test-user-id',
        oldUsername: 'newname1',
        newUsername: 'newname2',
        changedAt: secondChange,
      },
    ]);

    await usernameChangeRateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'USERNAME_CHANGE_LIMIT_EXCEEDED',
        message: 'You can only change your username 2 times per 30 days',
      })
    );
    expect(mockRes.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('should skip rate limiting in test environment with skipRateLimit flag', async () => {
    mockReq.query = { skipRateLimit: 'true' };
    process.env.NODE_ENV = 'test';

    await usernameChangeRateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(storage.getUsernameChangesInPeriod).not.toHaveBeenCalled();
  });

  it('should return 401 when user is not authenticated', async () => {
    mockReq.user = undefined;

    await usernameChangeRateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Authentication required' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(storage.getUsernameChangesInPeriod).mockRejectedValue(new Error('Database error'));

    await usernameChangeRateLimit(mockReq as Request, mockRes as Response, mockNext);

    // Should allow the request to proceed on error to avoid blocking legitimate users
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalledWith(429);
  });
});