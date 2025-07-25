import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { 
  friendMutationsLimiter, 
  searchLimiter, 
  shareLimiter,
  RateLimitBucket,
  RATE_LIMIT_CONFIG 
} from "../utils/redis";

/**
 * Rate limiting configuration for username validation endpoints
 * Requirements: 20/min per IP+User with RFC 6585 compliance
 */
export const usernameCheckRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20, // 20 requests per minute
  standardHeaders: 'draft-7', // RFC 6585 compliance with RateLimit-* headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: Request) => {
    // Use IP + User ID if authenticated, otherwise just IP
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = req.user?.id;
    return userId ? `${ip}:${userId}` : ip;
  },
  // Custom handler to return RFC 6585 compliant error format
  handler: (req, res) => {
    // RFC 6585 compliance: 429 status with Retry-After header
    res.set('Retry-After', '60');
    res.status(429).json({
      error: "RATE_LIMITED",
      message: "Too many username checks. Please try again in 60 seconds",
      retryAfter: 60
    });
  },
  // Skip rate limiting for successful requests to avoid test interference
  skip: (req) => {
    // Skip rate limiting in test environment for basic functionality tests
    return process.env.NODE_ENV === 'test' && req.query.skipRateLimit === 'true';
  },
});

/**
 * Rate limiting configuration for user search endpoints
 * Requirements: 20/min per IP+User with RFC 6585 compliance
 */
export const userSearchRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20, // 20 requests per minute
  standardHeaders: 'draft-7', // RFC 6585 compliance
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = req.user?.id;
    return userId ? `${ip}:${userId}` : ip;
  },
  handler: (req, res) => {
    // RFC 6585 compliance: 429 status with Retry-After header
    res.set('Retry-After', '60');
    res.status(429).json({
      error: "RATE_LIMITED",
      message: "Too many search requests. Please try again in 60 seconds",
      retryAfter: 60
    });
  },
  // Skip rate limiting for test environment
  skip: (req) => {
    return process.env.NODE_ENV === 'test' && req.query.skipRateLimit === 'true';
  },
});

/**
 * Rate limiting configuration for friend request endpoints
 * Requirements: 10/hour per user with RFC 6585 compliance
 */
export const friendRequestRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 10, // 10 requests per hour
  standardHeaders: 'draft-7', // RFC 6585 compliance
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = req.user?.id;
    return userId ? `friend_request:${userId}` : req.ip || 'unknown';
  },
  handler: (req, res) => {
    res.set('Retry-After', '3600');
    res.status(429).json({
      error: "RATE_LIMITED",
      message: "Too many friend requests. Please try again in 1 hour",
      retryAfter: 3600
    });
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' && req.query.skipRateLimit === 'true';
  },
});

/**
 * Rate limiting configuration for friend management endpoints (accept/decline/block/unfriend)
 * Requirements: 50/hour per user with RFC 6585 compliance
 */
export const friendManagementRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 50, // 50 requests per hour
  standardHeaders: 'draft-7', // RFC 6585 compliance
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = req.user?.id;
    return userId ? `friend_mgmt:${userId}` : req.ip || 'unknown';
  },
  handler: (req, res) => {
    res.set('Retry-After', '3600');
    res.status(429).json({
      error: "RATE_LIMITED",
      message: "Too many friend management actions. Please try again in 1 hour",
      retryAfter: 3600
    });
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' && req.query.skipRateLimit === 'true';
  },
});

/**
 * Rate limiting configuration for sharing operations
 * Requirements: 30/hour per user with RFC 6585 compliance
 */
export const sharingRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 30, // 30 requests per hour
  standardHeaders: 'draft-7', // RFC 6585 compliance
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = req.user?.id;
    return userId ? `sharing:${userId}` : req.ip || 'unknown';
  },
  handler: (req, res) => {
    res.set('Retry-After', '3600');
    res.status(429).json({
      error: "RATE_LIMITED",
      message: "Too many sharing operations. Please try again in 1 hour",
      retryAfter: 3600
    });
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' && req.query.skipRateLimit === 'true';
  },
});

/**
 * Enhanced Redis-based rate limiting middleware factory
 * Creates middleware for specific rate limiting buckets with fallback to memory
 */
function createRedisRateLimit(
  limiter: typeof friendMutationsLimiter | typeof searchLimiter | typeof shareLimiter,
  bucket: RateLimitBucket,
  errorMessage: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip rate limiting in test environment
      if (process.env.NODE_ENV === 'test' && req.query.skipRateLimit === 'true') {
        return next();
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check rate limit
      const result = await limiter.checkRateLimit(userId);
      
      // Set RFC 6585 compliant headers
      res.set('RateLimit-Limit', result.limit.toString());
      res.set('RateLimit-Remaining', result.remaining.toString());
      res.set('RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

      if (!result.allowed) {
        if (result.retryAfter) {
          res.set('Retry-After', result.retryAfter.toString());
        }
        
        return res.status(429).json({
          error: "RATE_LIMITED",
          message: errorMessage,
          retryAfter: result.retryAfter,
          bucket: bucket,
          limit: result.limit,
          remaining: result.remaining,
          resetTime: result.resetTime
        });
      }

      next();
    } catch (error) {
      console.error(`Redis rate limiting error for ${bucket}:`, error);
      // On error, allow the request to proceed to avoid blocking legitimate users
      next();
    }
  };
}

/**
 * Enhanced friend mutations rate limiting with Redis backend
 * Covers friend requests, accept, decline, block, unfriend operations
 * Requirements: 50/hour per user with audit logging for role changes
 */
export const enhancedFriendMutationsRateLimit = createRedisRateLimit(
  friendMutationsLimiter,
  RateLimitBucket.FRIEND_MUTATIONS,
  "Too many friend management operations. Please try again later."
);

/**
 * Enhanced search rate limiting with Redis backend
 * Covers user search and friend search operations
 * Requirements: 20/minute per user
 */
export const enhancedSearchRateLimit = createRedisRateLimit(
  searchLimiter,
  RateLimitBucket.SEARCH,
  "Too many search requests. Please try again in a minute."
);

/**
 * Enhanced sharing rate limiting with Redis backend
 * Covers journal sharing operations
 * Requirements: 30/hour per user
 */
export const enhancedSharingRateLimit = createRedisRateLimit(
  shareLimiter,
  RateLimitBucket.SHARE,
  "Too many sharing operations. Please try again later."
);

/**
 * Special rate limiting for role changes - unlimited but logged
 * This middleware doesn't block requests but logs all role changes for audit purposes
 */
export const roleChangeAuditMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Log the role change attempt for audit purposes
    const { friendshipId } = req.params;
    const { role } = req.body;
    
    console.log(`[AUDIT] Role change attempt - User: ${userId}, Friendship: ${friendshipId}, New Role: ${role}, Timestamp: ${new Date().toISOString()}`);
    
    // Store original response.json to capture the result
    const originalJson = res.json;
    res.json = function(body) {
      // Log successful role changes
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`[AUDIT] Role change successful - User: ${userId}, Friendship: ${friendshipId}, New Role: ${role}, Timestamp: ${new Date().toISOString()}`);
      } else {
        console.log(`[AUDIT] Role change failed - User: ${userId}, Friendship: ${friendshipId}, Status: ${res.statusCode}, Timestamp: ${new Date().toISOString()}`);
      }
      return originalJson.call(this, body);
    };

    next();
  } catch (error) {
    console.error('Role change audit middleware error:', error);
    next();
  }
};

/**
 * Input validation middleware for friendship-related endpoints
 * Validates and sanitizes input data to prevent injection attacks
 */
export const friendshipInputValidation = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username } = req.params;
    const { role, status } = req.body;

    // Validate username parameter if present
    if (username) {
      // Username validation - alphanumeric, underscores, hyphens only
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return res.status(400).json({
          error: "INVALID_INPUT",
          message: "Username contains invalid characters"
        });
      }
      
      // Length validation
      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({
          error: "INVALID_INPUT", 
          message: "Username must be between 3 and 30 characters"
        });
      }
    }

    // Validate role if present
    if (role) {
      const validRoles = ['viewer', 'contributor', 'editor'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          error: "INVALID_INPUT",
          message: "Invalid role. Must be one of: viewer, contributor, editor"
        });
      }
    }

    // Validate status if present
    if (status) {
      const validStatuses = ['pending', 'accepted', 'declined', 'unfriended', 'blocked'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: "INVALID_INPUT",
          message: "Invalid status. Must be one of: pending, accepted, declined, unfriended, blocked"
        });
      }
    }

    // Validate UUID parameters
    const { friendshipId, entryId } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (friendshipId && !uuidRegex.test(friendshipId)) {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "Invalid friendship ID format"
      });
    }
    
    if (entryId && !uuidRegex.test(entryId)) {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "Invalid entry ID format"
      });
    }

    next();
  } catch (error) {
    console.error('Friendship input validation error:', error);
    return res.status(500).json({
      error: "VALIDATION_ERROR",
      message: "Input validation failed"
    });
  }
};

/**
 * Security middleware for blocked user interactions
 * Prevents blocked users from interacting with each other
 */
export const blockedUserSecurityCheck = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = (req as any).user?.id;
    if (!currentUserId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { username, friendshipId } = req.params;
    let targetUserId: string | null = null;

    // Get target user ID from username or friendship
    if (username) {
      const targetUser = await storage.getUserByUsername(username);
      if (targetUser) {
        targetUserId = targetUser.id;
      }
    } else if (friendshipId) {
      const friendship = await storage.getFriendshipById(friendshipId);
      if (friendship) {
        targetUserId = friendship.userId === currentUserId ? friendship.friendId : friendship.userId;
      }
    }

    if (targetUserId) {
      // Check if users have blocked each other
      const friendship = await storage.getFriendship(currentUserId, targetUserId);
      if (friendship?.status === 'blocked') {
        // Don't reveal that the user is blocked - return generic not found
        return res.status(404).json({ message: "User not found" });
      }
    }

    next();
  } catch (error) {
    console.error('Blocked user security check error:', error);
    next();
  }
};

/**
 * Custom database-backed rate limiting for username changes
 * Requirements: 2 per 30 days per user with RFC 6585 compliance
 * 
 * Uses the username_changes table to track changes over a 30-day sliding window
 */
export const usernameChangeRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test' && req.query.skipRateLimit === 'true') {
      return next();
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Check username changes in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentChanges = await storage.getUsernameChangesInPeriod(userId, thirtyDaysAgo);
    
    if (recentChanges.length >= 2) {
      // Find the oldest change to calculate when the user can change again
      const oldestChange = recentChanges.sort((a, b) => {
        const aTime = a.changedAt ? new Date(a.changedAt).getTime() : 0;
        const bTime = b.changedAt ? new Date(b.changedAt).getTime() : 0;
        return aTime - bTime;
      })[0];
      
      const nextAllowedChange = new Date(oldestChange.changedAt || new Date());
      nextAllowedChange.setDate(nextAllowedChange.getDate() + 30);
      
      const retryAfterSeconds = Math.ceil((nextAllowedChange.getTime() - Date.now()) / 1000);
      
      // RFC 6585 compliance: 429 status with Retry-After header
      res.set('Retry-After', retryAfterSeconds.toString());
      res.set('RateLimit-Limit', '2');
      res.set('RateLimit-Remaining', '0');
      res.set('RateLimit-Reset', Math.ceil(nextAllowedChange.getTime() / 1000).toString());
      
      return res.status(429).json({
        error: "USERNAME_CHANGE_LIMIT_EXCEEDED",
        message: "You can only change your username 2 times per 30 days",
        retryAfter: retryAfterSeconds,
        nextAllowedAt: nextAllowedChange.toISOString()
      });
    }

    // Set rate limit headers for successful requests
    res.set('RateLimit-Limit', '2');
    res.set('RateLimit-Remaining', (2 - recentChanges.length).toString());
    
    // Calculate reset time (30 days from now or from oldest change)
    const resetTime = recentChanges.length > 0 
      ? new Date(Math.max(...recentChanges.map(c => new Date(c.changedAt || new Date()).getTime())) + 30 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    res.set('RateLimit-Reset', Math.ceil(resetTime.getTime() / 1000).toString());

    next();
  } catch (error) {
    console.error('Username change rate limiting error:', error);
    // On error, allow the request to proceed to avoid blocking legitimate users
    next();
  }
};