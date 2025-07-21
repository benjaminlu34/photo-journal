import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

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