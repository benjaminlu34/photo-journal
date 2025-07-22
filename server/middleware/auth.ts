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
    return res.status(401).json({ error: 'No authorization header' });
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

    next();
  } catch (error) {
    console.error('JWT verification failed:', error);
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
    console.warn('Invalid token provided, continuing without auth');
  }

  next();
}