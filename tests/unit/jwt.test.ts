import { describe, it, expect, beforeEach, vi } from 'vitest';
import { verifySupabaseJwt, extractTokenFromHeader } from '../../server/utils/jwt';
import jwt from 'jsonwebtoken';

// Mock environment variables
vi.mock('process', () => ({
  env: {
    SUPABASE_JWT_SECRET: 'test-jwt-secret',
  },
}));

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

describe('JWT Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifySupabaseJwt', () => {
    it('should verify a valid JWT token', () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      (jwt.verify as any).mockReturnValue(mockPayload);

      const result = verifySupabaseJwt('valid-token');
      
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-jwt-secret');
      expect(result).toEqual(mockPayload);
    });

    it('should throw an error if JWT_SECRET is not set', () => {
      vi.mock('process', () => ({
        env: {},
      }));

      expect(() => verifySupabaseJwt('valid-token')).toThrow(
        'SUPABASE_JWT_SECRET environment variable is not set'
      );
    });

    it('should throw an error for invalid token', () => {
      (jwt.verify as any).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => verifySupabaseJwt('invalid-token')).toThrow('Invalid JWT token');
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Authorization header', () => {
      const token = extractTokenFromHeader('Bearer my-token');
      expect(token).toBe('my-token');
    });

    it('should return null for missing Authorization header', () => {
      const token = extractTokenFromHeader(undefined);
      expect(token).toBeNull();
    });

    it('should return null for malformed Authorization header', () => {
      const token = extractTokenFromHeader('not-a-bearer-token');
      expect(token).toBeNull();
    });
  });
}); 