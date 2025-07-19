import rateLimit from "express-rate-limit";
import { Request } from "express";

/**
 * Rate limiting configuration for username validation endpoints
 */
export const usernameCheckRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20, // 20 requests per minute
  message: {
    error: "RATE_LIMITED",
    message: "Too many username checks. Please try again in 60 seconds",
    retryAfter: 60
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: Request) => {
    // Use IP + User ID if authenticated, otherwise just IP
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = req.user?.id;
    return userId ? `${ip}:${userId}` : ip;
  },
  // Custom handler to return proper error format
  handler: (req, res) => {
    res.status(429).json({
      error: "RATE_LIMITED",
      message: "Too many username checks. Please try again in 60 seconds",
      retryAfter: 60
    });
  },
});

/**
 * Rate limiting configuration for user search endpoints
 */
export const userSearchRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20, // 20 requests per minute
  message: {
    error: "RATE_LIMITED",
    message: "Too many search requests. Please try again in 60 seconds",
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = req.user?.id;
    return userId ? `${ip}:${userId}` : ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: "RATE_LIMITED",
      message: "Too many search requests. Please try again in 60 seconds",
      retryAfter: 60
    });
  },
});

/**
 * Rate limiting for username changes (stricter limits)
 */
export const usernameChangeRateLimit = rateLimit({
  windowMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  max: 2, // 2 changes per 30 days
  message: {
    error: "USERNAME_CHANGE_LIMIT_EXCEEDED",
    message: "You can only change your username 2 times per 30 days",
    retryAfter: 2592000 // 30 days in seconds (fixed overflow)
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Only use user ID for username changes
    return req.user?.id || 'anonymous';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: "USERNAME_CHANGE_LIMIT_EXCEEDED",
      message: "You can only change your username 2 times per 30 days",
      retryAfter: 2592000 // 30 days in seconds
    });
  },
});