import { createClient, RedisClientType } from 'redis';

/**
 * Redis client configuration for rate limiting
 * Supports both local development and production environments
 */
class RedisManager {
  private client: RedisClientType | null = null;
  private isConnected = false;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
        },
        // Graceful error handling
      });

      this.client.on('error', (err) => {
        console.warn('Redis client error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.warn('Redis client disconnected');
        this.isConnected = false;
      });

    } catch (error) {
      console.warn('Failed to initialize Redis client:', error);
      this.client = null;
    }
  }

  async connect(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      if (!this.isConnected) {
        await this.client.connect();
      }
      return true;
    } catch (error) {
      console.warn('Failed to connect to Redis:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.disconnect();
      } catch (error) {
        console.warn('Error disconnecting from Redis:', error);
      }
    }
  }

  getClient(): RedisClientType | null {
    return this.isConnected ? this.client : null;
  }

  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }
}

// Singleton instance
export const redisManager = new RedisManager();

/**
 * Rate limiting bucket types as specified in the friends system design
 */
export enum RateLimitBucket {
  FRIEND_MUTATIONS = 'friend_mut',  // Friend requests, accept, decline, block, unfriend
  SEARCH = 'search',                // User search and friend search
  SHARE = 'share'                   // Journal sharing operations
}

/**
 * Rate limit configuration for each bucket
 */
export const RATE_LIMIT_CONFIG = {
  [RateLimitBucket.FRIEND_MUTATIONS]: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,           // 50 requests per hour
    description: 'Friend management operations'
  },
  [RateLimitBucket.SEARCH]: {
    windowMs: 60 * 1000,       // 1 minute  
    maxRequests: 20,           // 20 requests per minute
    description: 'Search operations'
  },
  [RateLimitBucket.SHARE]: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 30,           // 30 requests per hour
    description: 'Sharing operations'
  }
} as const;

/**
 * Leaky bucket rate limiter implementation using Redis
 * Implements a token bucket algorithm with TTL-based cleanup
 */
export class RedisRateLimiter {
  private fallbackMemory: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(private bucket: RateLimitBucket) {}

  /**
   * Check if a request should be allowed and update the bucket
   * Returns rate limit information
   */
  async checkRateLimit(key: string): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  }> {
    const config = RATE_LIMIT_CONFIG[this.bucket];
    const bucketKey = `rate_limit:${this.bucket}:${key}`;
    const now = Date.now();
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
    const resetTime = windowStart + config.windowMs;

    // Try Redis first
    const client = redisManager.getClient();
    if (client) {
      try {
        return await this.checkRedisRateLimit(client, bucketKey, config, resetTime, now);
      } catch (error) {
        console.warn(`Redis rate limit check failed for ${this.bucket}:`, error);
        // Fall through to memory-based fallback
      }
    }

    // Fallback to memory-based rate limiting
    return this.checkMemoryRateLimit(key, config, resetTime, now);
  }

  private async checkRedisRateLimit(
    client: RedisClientType,
    bucketKey: string,
    config: typeof RATE_LIMIT_CONFIG[RateLimitBucket],
    resetTime: number,
    now: number
  ) {
    // Use Redis pipeline for atomic operations
    const pipeline = client.multi();
    
    // Increment counter and set expiry
    pipeline.incr(bucketKey);
    pipeline.expire(bucketKey, Math.ceil(config.windowMs / 1000));
    
    const results = await pipeline.exec();
    const currentCount = (results?.[0] as unknown as number) || 0;

    const remaining = Math.max(0, config.maxRequests - currentCount);
    const allowed = currentCount <= config.maxRequests;

    return {
      allowed,
      limit: config.maxRequests,
      remaining,
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000)
    };
  }

  private checkMemoryRateLimit(
    key: string,
    config: typeof RATE_LIMIT_CONFIG[RateLimitBucket],
    resetTime: number,
    now: number
  ) {
    const memoryKey = `${this.bucket}:${key}`;
    const existing = this.fallbackMemory.get(memoryKey);

    // Clean up expired entries
    if (existing && existing.resetTime <= now) {
      this.fallbackMemory.delete(memoryKey);
    }

    const current = this.fallbackMemory.get(memoryKey) || { count: 0, resetTime };
    current.count += 1;
    current.resetTime = resetTime;
    
    this.fallbackMemory.set(memoryKey, current);

    const remaining = Math.max(0, config.maxRequests - current.count);
    const allowed = current.count <= config.maxRequests;

    return {
      allowed,
      limit: config.maxRequests,
      remaining,
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000)
    };
  }

  /**
   * Reset rate limit for a specific key (useful for testing)
   */
  async resetRateLimit(key: string): Promise<void> {
    const bucketKey = `rate_limit:${this.bucket}:${key}`;
    
    const client = redisManager.getClient();
    if (client) {
      try {
        await client.del(bucketKey);
      } catch (error) {
        console.warn(`Failed to reset Redis rate limit for ${bucketKey}:`, error);
      }
    }

    // Also clear from memory fallback
    const memoryKey = `${this.bucket}:${key}`;
    this.fallbackMemory.delete(memoryKey);
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getRateLimitStatus(key: string): Promise<{
    limit: number;
    remaining: number;
    resetTime: number;
  }> {
    const config = RATE_LIMIT_CONFIG[this.bucket];
    const bucketKey = `rate_limit:${this.bucket}:${key}`;
    const now = Date.now();
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
    const resetTime = windowStart + config.windowMs;

    const client = redisManager.getClient();
    if (client) {
      try {
        const currentCount = await client.get(bucketKey);
        const count = currentCount ? parseInt(currentCount, 10) : 0;
        return {
          limit: config.maxRequests,
          remaining: Math.max(0, config.maxRequests - count),
          resetTime
        };
      } catch (error) {
        console.warn(`Failed to get Redis rate limit status for ${bucketKey}:`, error);
      }
    }

    // Fallback to memory
    const memoryKey = `${this.bucket}:${key}`;
    const existing = this.fallbackMemory.get(memoryKey);
    const count = (existing && existing.resetTime > now) ? existing.count : 0;

    return {
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetTime
    };
  }
}

// Pre-configured rate limiters for each bucket
export const friendMutationsLimiter = new RedisRateLimiter(RateLimitBucket.FRIEND_MUTATIONS);
export const searchLimiter = new RedisRateLimiter(RateLimitBucket.SEARCH);
export const shareLimiter = new RedisRateLimiter(RateLimitBucket.SHARE);