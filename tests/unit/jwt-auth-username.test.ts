import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { isAuthenticatedSupabase } from '../../server/middleware/auth';
import { JwtPayload } from '../../shared/auth';

// Mock JWT module
vi.mock('jsonwebtoken');

describe('JWT Authentication with Username', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      headers: {
        authorization: 'Bearer valid-jwt-token'
      }
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    mockNext = vi.fn();
    
    // Set up environment variable
    process.env.SUPABASE_JWT_SECRET = 'test-secret';
  });

  it('should extract username from JWT token when present', () => {
    const mockPayload: JwtPayload = {
      sub: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      iat: Date.now(),
      exp: Date.now() + 3600
    };

    (jwt.verify as any).mockReturnValue(mockPayload);

    isAuthenticatedSupabase(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser'
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle JWT token without username (migration phase)', () => {
    const mockPayload: JwtPayload = {
      sub: 'user-123',
      email: 'test@example.com',
      // username is undefined (migration phase)
      iat: Date.now(),
      exp: Date.now() + 3600
    };

    (jwt.verify as any).mockReturnValue(mockPayload);

    isAuthenticatedSupabase(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      username: undefined
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject request with invalid JWT token', () => {
    (jwt.verify as any).mockImplementation(() => {
      throw new Error('Invalid token');
    });

    isAuthenticatedSupabase(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request without authorization header', () => {
    mockReq.headers = {};

    isAuthenticatedSupabase(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'No authorization header' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request with malformed authorization header', () => {
    mockReq.headers = {
      authorization: 'InvalidFormat token'
    };

    isAuthenticatedSupabase(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'No authorization header' });
    expect(mockNext).not.toHaveBeenCalled();
  });
});