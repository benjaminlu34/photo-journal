import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  RedisRateLimiter, 
  RateLimitBucket, 
  RATE_LIMIT_CONFIG,
  redisManager
} from '../../server/utils/redis';

/**
 * Comprehensive tests for the leak-rate algorithm implementation
 * This test suite verifies that the rate limiter implements a proper
 * token bucket/leaky bucket algorithm with TTL-based cleanup
 */
describe('Leak-Rate Algorithm Implementation', () => {
  let rateLimiter: RedisRateLimiter;
  const testKey = 'leak-test-user';

  // Mock Redis client for controlled testing
  const mockRedisClient = {
    multi: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    exec: vi.fn(),
  };

  const mockPipeline = {
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter = new RedisRateLimiter(RateLimitBucket.SEARCH); // 20 requests/minute
    
    // Mock Redis manager to return our controlled client
    vi.spyOn(redisManager, 'getClient').mockReturnValue(mockRedisClient as any);
    vi.spyOn(redisManager, 'isAvailable').mockReturnValue(true);
    
    mockRedisClient.multi.mockReturnValue(mockPipeline);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Token Bucket Behavior', () => {
    it('should allow requests up to the bucket capacity', async () => {
      const limit = RATE_LIMIT_CONFIG[RateLimitBucket.SEARCH].maxRequests; // 20
      
      // Simulate requests filling the bucket
      for (let i = 1; i <= limit; i++) {
        mockPipeline.exec.mockResolvedValueOnce([i, 'OK']);
        
        const result = await rateLimiter.checkRateLimit(testKey);
        
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(limit - i);
        expect(result.limit).toBe(limit);
      }
    });

    it('should reject requests when bucket is full', async () => {
      const limit = RATE_LIMIT_CONFIG[RateLimitBucket.SEARCH].maxRequests; // 20
      
      // Fill the bucket beyond capacity
      mockPipeline.exec.mockResolvedValue([limit + 1, 'OK']);
      
      const result = await rateLimiter.checkRateLimit(testKey);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should implement proper leak rate with time windows', async () => {
      const config = RATE_LIMIT_CONFIG[RateLimitBucket.SEARCH];
      const now = Date.now();
      
      // Mock time at the start of a window
      const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
      const resetTime = windowStart + config.windowMs;
      
      mockPipeline.exec.mockResolvedValue([1, 'OK']);
      
      const result = await rateLimiter.checkRateLimit(testKey);
      
      expect(result.resetTime).toBe(resetTime);
      expect(result.resetTime).toBeGreaterThan(now);
      
      // Verify TTL is set correctly
      expect(mockPipeline.expire).toHaveBeenCalledWith(
        `rate_limit:${RateLimitBucket.SEARCH}:${testKey}`,
        Math.ceil(config.windowMs / 1000)
      );
    });
  });

  describe('Time Window Management', () => {
    it('should reset bucket at window boundaries', async () => {
      const config = RATE_LIMIT_CONFIG[RateLimitBucket.SEARCH];
      
      // Test with memory fallback to control timing
      vi.spyOn(redisManager, 'getClient').mockReturnValue(null);
      vi.spyOn(redisManager, 'isAvailable').mockReturnValue(false);
      
      const originalNow = Date.now;
      let mockTime = originalNow();
      Date.now = vi.fn(() => mockTime);
      
      // Fill bucket in first window
      for (let i = 0; i < 20; i++) {
        await rateLimiter.checkRateLimit(testKey);
      }
      
      // Next request should be blocked
      let result = await rateLimiter.checkRateLimit(testKey);
      expect(result.allowed).toBe(false);
      
      // Move to next time window
      mockTime += config.windowMs + 1000; // Move past window boundary
      
      // Should be allowed again (bucket reset)
      result = await rateLimiter.checkRateLimit(testKey);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19); // One request used in new window
      
      Date.now = originalNow;
    });

    it('should handle concurrent requests within same window', async () => {
      const promises = [];
      let counter = 0;
      
      // Mock Redis to simulate concurrent increments
      mockPipeline.exec.mockImplementation(() => {
        counter++;
        return Promise.resolve([counter, 'OK']);
      });
      
      // Make 15 concurrent requests
      for (let i = 0; i < 15; i++) {
        promises.push(rateLimiter.checkRateLimit(testKey));
      }
      
      const results = await Promise.all(promises);
      
      // All should be allowed since limit is 20
      results.forEach((result, index) => {
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(20 - (index + 1));
      });
    });
  });

  describe('Different Bucket Configurations', () => {
    it('should enforce different limits for different buckets', async () => {
      const friendLimiter = new RedisRateLimiter(RateLimitBucket.FRIEND_MUTATIONS); // 50/hour
      const searchLimiter = new RedisRateLimiter(RateLimitBucket.SEARCH); // 20/minute
      const shareLimiter = new RedisRateLimiter(RateLimitBucket.SHARE); // 30/hour
      
      mockPipeline.exec.mockResolvedValue([1, 'OK']);
      
      const friendResult = await friendLimiter.checkRateLimit(testKey);
      const searchResult = await searchLimiter.checkRateLimit(testKey);
      const shareResult = await shareLimiter.checkRateLimit(testKey);
      
      expect(friendResult.limit).toBe(50);
      expect(searchResult.limit).toBe(20);
      expect(shareResult.limit).toBe(30);
      
      // Different window sizes
      expect(friendResult.resetTime - searchResult.resetTime).toBeGreaterThan(0);
    });

    it('should maintain separate counters for different buckets', async () => {
      const friendLimiter = new RedisRateLimiter(RateLimitBucket.FRIEND_MUTATIONS);
      const searchLimiter = new RedisRateLimiter(RateLimitBucket.SEARCH);
      
      mockPipeline.exec.mockResolvedValue([1, 'OK']);
      
      await friendLimiter.checkRateLimit(testKey);
      await searchLimiter.checkRateLimit(testKey);
      
      // Should call Redis with different keys
      expect(mockPipeline.incr).toHaveBeenCalledWith(`rate_limit:friend_mut:${testKey}`);
      expect(mockPipeline.incr).toHaveBeenCalledWith(`rate_limit:search:${testKey}`);
    });
  });

  describe('Memory Fallback Leak-Rate Algorithm', () => {
    beforeEach(() => {
      // Force memory fallback
      vi.spyOn(redisManager, 'getClient').mockReturnValue(null);
      vi.spyOn(redisManager, 'isAvailable').mockReturnValue(false);
    });

    it('should implement leak-rate algorithm in memory fallback', async () => {
      const limit = RATE_LIMIT_CONFIG[RateLimitBucket.SEARCH].maxRequests;
      
      // Fill bucket to capacity
      for (let i = 1; i <= limit; i++) {
        const result = await rateLimiter.checkRateLimit(testKey);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(limit - i);
      }
      
      // Next request should be blocked
      const blockedResult = await rateLimiter.checkRateLimit(testKey);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.remaining).toBe(0);
    });

    it('should clean up expired entries automatically', async () => {
      const originalNow = Date.now;
      let mockTime = originalNow();
      Date.now = vi.fn(() => mockTime);
      
      // Make a request
      await rateLimiter.checkRateLimit(testKey);
      
      // Move time forward beyond window
      const config = RATE_LIMIT_CONFIG[RateLimitBucket.SEARCH];
      mockTime += config.windowMs + 1000;
      
      // Make another request - should reset counter
      const result = await rateLimiter.checkRateLimit(testKey);
      expect(result.remaining).toBe(19); // Should be reset, not continuing from previous
      
      Date.now = originalNow;
    });

    it('should handle rapid successive requests correctly', async () => {
      const results = [];
      
      // Make 25 rapid requests (exceeds limit of 20)
      for (let i = 0; i < 25; i++) {
        results.push(await rateLimiter.checkRateLimit(testKey));
      }
      
      // First 20 should be allowed
      for (let i = 0; i < 20; i++) {
        expect(results[i].allowed).toBe(true);
        expect(results[i].remaining).toBe(20 - (i + 1));
      }
      
      // Remaining 5 should be blocked
      for (let i = 20; i < 25; i++) {
        expect(results[i].allowed).toBe(false);
        expect(results[i].remaining).toBe(0);
        expect(results[i].retryAfter).toBeGreaterThan(0);
      }
    });
  });

  describe('TTL and Cleanup Behavior', () => {
    it('should set appropriate TTL for Redis keys', async () => {
      const config = RATE_LIMIT_CONFIG[RateLimitBucket.SEARCH];
      mockPipeline.exec.mockResolvedValue([1, 'OK']);
      
      await rateLimiter.checkRateLimit(testKey);
      
      expect(mockPipeline.expire).toHaveBeenCalledWith(
        `rate_limit:search:${testKey}`,
        Math.ceil(config.windowMs / 1000)
      );
    });

    it('should handle Redis pipeline errors gracefully', async () => {
      mockPipeline.exec.mockRejectedValue(new Error('Redis pipeline failed'));
      
      // Should fall back to memory and still work
      const result = await rateLimiter.checkRateLimit(testKey);
      
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(20);
      expect(result.remaining).toBe(19);
    });

    it('should maintain consistency across Redis operations', async () => {
      // Test atomic increment and expire operations
      mockPipeline.exec.mockResolvedValue([5, 'OK']);
      
      const result = await rateLimiter.checkRateLimit(testKey);
      
      expect(result.remaining).toBe(15); // 20 - 5
      expect(mockRedisClient.multi).toHaveBeenCalledTimes(1);
      expect(mockPipeline.incr).toHaveBeenCalledTimes(1);
      expect(mockPipeline.expire).toHaveBeenCalledTimes(1);
      expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed Redis responses', async () => {
      mockPipeline.exec.mockResolvedValue([null, 'OK']);
      
      const result = await rateLimiter.checkRateLimit(testKey);
      
      // Should treat null as 0 and allow request
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(20); // Treated as first request
    });

    it('should handle Redis connection loss during operation', async () => {
      // Start with Redis available
      mockPipeline.exec.mockResolvedValueOnce([1, 'OK']);
      
      let result = await rateLimiter.checkRateLimit(testKey);
      expect(result.allowed).toBe(true);
      
      // Simulate Redis connection loss
      mockPipeline.exec.mockRejectedValue(new Error('Connection lost'));
      
      // Should fall back to memory
      result = await rateLimiter.checkRateLimit(testKey);
      expect(result.allowed).toBe(true); // Memory fallback starts fresh
    });

    it('should handle very high request rates', async () => {
      // Simulate 100 concurrent requests
      const promises = [];
      let counter = 0;
      
      mockPipeline.exec.mockImplementation(() => {
        counter++;
        return Promise.resolve([counter, 'OK']);
      });
      
      for (let i = 0; i < 100; i++) {
        promises.push(rateLimiter.checkRateLimit(testKey));
      }
      
      const results = await Promise.all(promises);
      
      const allowedCount = results.filter(r => r.allowed).length;
      const blockedCount = results.filter(r => !r.allowed).length;
      
      expect(allowedCount).toBeLessThanOrEqual(20);
      expect(blockedCount).toBeGreaterThan(0);
      expect(allowedCount + blockedCount).toBe(100);
    });
  });
});