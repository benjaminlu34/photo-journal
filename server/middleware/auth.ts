import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../../shared/auth';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username?: string; // Optional during migration phase
      };
    }
  }
}

export function isAuthenticatedSupabase(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Auth middleware: No authorization header');
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(
      token,
      process.env.SUPABASE_JWT_SECRET!
    ) as JwtPayload;

    // Set user info from JWT with consistent username extraction
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      username: decoded.username,
    };

    console.log('Auth middleware: Successfully authenticated user', {
      userId: decoded.sub,
      email: decoded.email,
    });

    next();
  } catch (error) {
    // Sanitize error logging to prevent information leakage in production
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('JWT verification failed:', errorMessage);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Alternative middleware for optional authentication
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Continue without user
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(
      token,
      process.env.SUPABASE_JWT_SECRET!
    ) as JwtPayload;

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      username: decoded.username, // Extract username from JWT
    };
  } catch (error) {
    // Continue without user, don't fail the request
    // Sanitize error logging to prevent information leakage
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn('Invalid token provided, continuing without auth:', errorMessage);
  }

  next();
}