import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  RedisRateLimiter, 
  RateLimitBucket, 
  RATE_LIMIT_CONFIG,
  redisManager,
  friendMutationsLimiter,
  searchLimiter,
  shareLimiter
} from '../../server/utils/redis';

// Mock Redis client for testing
const mockRedisClient = {
  multi: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  exec: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
};

const mockPipeline = {
  incr: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

describe('RedisRateLimiter', () => {
  let rateLimiter: RedisRateLimiter;
  const testKey = 'test-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter = new RedisRateLimiter(RateLimitBucket.FRIEND_MUTATIONS);
    
    // Mock Redis manager
    vi.spyOn(redisManager, 'getClient').mockReturnValue(mockRedisClient as any);
    vi.spyOn(redisManager, 'isAvailable').mockReturnValue(true);
    
    mockRedisClient.multi.mockReturnValue(mockPipeline);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rate Limit Configuration', () => {
    it('should have correct configuration for friend mutations bucket', () => {
      const config = RATE_LIMIT_CONFIG[RateLimitBucket.FRIEND_MUTATIONS];
      expect(config.windowMs).toBe(60 * 60 * 1000); // 1 hour
      expect(config.maxRequests).toBe(50);
      expect(config.description).toBe('Friend management operations');
    });

    it('should have correct configuration for search bucket', () => {
      const config = RATE_LIMIT_CONFIG[RateLimitBucket.SEARCH];
      expect(config.windowMs).toBe(60 * 1000); // 1 minute
      expect(config.maxRequests).toBe(20);
      expect(config.description).toBe('Search operations');
    });

    it('should have correct configuration for share bucket', () => {
      const config = RATE_LIMIT_CONFIG[RateLimitBucket.SHARE];
      expect(config.windowMs).toBe(60 * 60 * 1000); // 1 hour
      expect(config.maxRequests).toBe(30);
      expect(config.description).toBe('Sharing operations');
    });
  });

  describe('Redis-based Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      // Mock Redis response for first request
      mockPipeline.exec.mockResolvedValue([1, 'OK']);

      const result = await rateLimiter.checkRateLimit(testKey);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(50);
      expect(result.remaining).toBe(49);
      expect(result.retryAfter).toBeUndefined();
      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockPipeline.incr).toHaveBeenCalledWith(`rate_limit:${RateLimitBucket.FRIEND_MUTATIONS}:${testKey}`);
      expect(mockPipeline.expire).toHaveBeenCalled();
    });

    it('should block requests when rate limit exceeded', async () => {
      // Mock Redis response for request that exceeds limit
      mockPipeline.exec.mockResolvedValue([51, 'OK']);

      const result = await rateLimiter.checkRateLimit(testKey);

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(50);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should handle Redis errors gracefully and fall back to memory', async () => {
      // Mock Redis error
      mockPipeline.exec.mockRejectedValue(new Error('Redis connection failed'));

      const result = await rateLimiter.checkRateLimit(testKey);

      // Should still work with memory fallback
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(50);
      expect(result.remaining).toBe(49);
    });

    it('should implement leak-rate algorithm correctly', async () => {
      const testLimiter = new RedisRateLimiter(RateLimitBucket.SEARCH);
      
      // Simulate multiple requests within the time window
      const requests = [];
      for (let i = 1; i <= 25; i++) {
        mockPipeline.exec.mockResolvedValueOnce([i, 'OK']);
        requests.push(testLimiter.checkRateLimit(testKey));
      }

      const results = await Promise.all(requests);

      // First 20 should be allowed (within limit)
      for (let i = 0; i < 20; i++) {
        expect(results[i].allowed).toBe(true);
        expect(results[i].remaining).toBe(20 - (i + 1));
      }

      // Remaining 5 should be blocked (exceeds limit)
      for (let i = 20; i < 25; i++) {
        expect(results[i].allowed).toBe(false);
        expect(results[i].remaining).toBe(0);
        expect(results[i].retryAfter).toBeGreaterThan(0);
      }
    });
  });

  describe('Memory Fallback', () => {
    beforeEach(() => {
      // Mock Redis as unavailable
      vi.spyOn(redisManager, 'getClient').mockReturnValue(null);
      vi.spyOn(redisManager, 'isAvailable').mockReturnValue(false);
    });

    it('should use memory fallback when Redis is unavailable', async () => {
      const result = await rateLimiter.checkRateLimit(testKey);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(50);
      expect(result.remaining).toBe(49);
      expect(mockRedisClient.multi).not.toHaveBeenCalled();
    });

    it('should enforce rate limits in memory fallback', async () => {
      const testLimiter = new RedisRateLimiter(RateLimitBucket.SEARCH);
      
      // Make 25 requests to exceed the limit of 20
      const results = [];
      for (let i = 0; i < 25; i++) {
        results.push(await testLimiter.checkRateLimit(testKey));
      }

      // First 20 should be allowed
      for (let i = 0; i < 20; i++) {
        expect(results[i].allowed).toBe(true);
      }

      // Remaining 5 should be blocked
      for (let i = 20; i < 25; i++) {
        expect(results[i].allowed).toBe(false);
        expect(results[i].retryAfter).toBeGreaterThan(0);
      }
    });

    it('should clean up expired entries in memory fallback', async () => {
      const testLimiter = new RedisRateLimiter(RateLimitBucket.SEARCH);
      
      // Make a request
      await testLimiter.checkRateLimit(testKey);
      
      // Mock time passage beyond window
      const originalNow = Date.now;
      Date.now = vi.fn(() => originalNow() + 2 * 60 * 1000); // 2 minutes later
      
      // Make another request - should reset the counter
      const result = await testLimiter.checkRateLimit(testKey);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19); // Should be reset
      
      Date.now = originalNow;
    });
  });

  describe('Rate Limit Status and Reset', () => {
    it('should get current rate limit status without incrementing', async () => {
      mockRedisClient.get.mockResolvedValue('5');

      const status = await rateLimiter.getRateLimitStatus(testKey);

      expect(status.limit).toBe(50);
      expect(status.remaining).toBe(45);
      expect(status.resetTime).toBeGreaterThan(Date.now());
      expect(mockRedisClient.get).toHaveBeenCalledWith(`rate_limit:${RateLimitBucket.FRIEND_MUTATIONS}:${testKey}`);
    });

    it('should reset rate limit for a specific key', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await rateLimiter.resetRateLimit(testKey);

      expect(mockRedisClient.del).toHaveBeenCalledWith(`rate_limit:${RateLimitBucket.FRIEND_MUTATIONS}:${testKey}`);
    });

    it('should handle Redis errors in status check gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const status = await rateLimiter.getRateLimitStatus(testKey);

      // Should fall back to memory
      expect(status.limit).toBe(50);
      expect(status.remaining).toBe(50); // No requests made yet
    });
  });

  describe('Pre-configured Rate Limiters', () => {
    it('should have correct bucket configuration for friendMutationsLimiter', () => {
      expect(friendMutationsLimiter).toBeInstanceOf(RedisRateLimiter);
    });

    it('should have correct bucket configuration for searchLimiter', () => {
      expect(searchLimiter).toBeInstanceOf(RedisRateLimiter);
    });

    it('should have correct bucket configuration for shareLimiter', () => {
      expect(shareLimiter).toBeInstanceOf(RedisRateLimiter);
    });
  });

  describe('Time Window Calculations', () => {
    it('should calculate correct reset time for different buckets', async () => {
      const searchLimiter = new RedisRateLimiter(RateLimitBucket.SEARCH);
      const shareLimiter = new RedisRateLimiter(RateLimitBucket.SHARE);

      mockPipeline.exec.mockResolvedValue([1, 'OK']);

      const now = Date.now();
      const searchResult = await searchLimiter.checkRateLimit(testKey);
      const shareResult = await shareLimiter.checkRateLimit(testKey);

      // Both should have reset times in the future
      expect(searchResult.resetTime).toBeGreaterThan(now);
      expect(shareResult.resetTime).toBeGreaterThan(now);

      // Search window is 1 minute, share window is 1 hour
      // The difference should be close to the window size difference when they align
      const searchConfig = RATE_LIMIT_CONFIG[RateLimitBucket.SEARCH];
      const shareConfig = RATE_LIMIT_CONFIG[RateLimitBucket.SHARE];
      
      expect(shareConfig.windowMs).toBeGreaterThan(searchConfig.windowMs);
    });

    it('should handle window boundaries correctly', async () => {
      const now = Date.now();
      const windowMs = RATE_LIMIT_CONFIG[RateLimitBucket.SEARCH].windowMs;
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const expectedResetTime = windowStart + windowMs;

      mockPipeline.exec.mockResolvedValue([1, 'OK']);

      const result = await searchLimiter.checkRateLimit(testKey);

      expect(result.resetTime).toBe(expectedResetTime);
    });
  });
});

describe('Rate Limiter Integration', () => {
  it('should handle concurrent requests correctly', async () => {
    const testLimiter = new RedisRateLimiter(RateLimitBucket.SEARCH);
    const testKey = 'concurrent-test-user';
    
    // Mock Redis to return incrementing values
    let counter = 0;
    mockPipeline.exec.mockImplementation(() => {
      counter++;
      return Promise.resolve([counter, 'OK']);
    });

    vi.spyOn(redisManager, 'getClient').mockReturnValue(mockRedisClient as any);
    vi.spyOn(redisManager, 'isAvailable').mockReturnValue(true);
    mockRedisClient.multi.mockReturnValue(mockPipeline);

    // Make 10 concurrent requests
    const promises = Array(10).fill(null).map(() => testLimiter.checkRateLimit(testKey));
    const results = await Promise.all(promises);

    // All should be allowed since limit is 20
    results.forEach(result => {
      expect(result.allowed).toBe(true);
    });

    // Verify Redis was called for each request
    expect(mockRedisClient.multi).toHaveBeenCalledTimes(10);
  });
});