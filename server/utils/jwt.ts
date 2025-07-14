import jwt from 'jsonwebtoken';
import { JwtPayload } from '../../shared/auth';

export function verifySupabaseJwt(token: string): JwtPayload {
  if (!process.env.SUPABASE_JWT_SECRET) {
    throw new Error('SUPABASE_JWT_SECRET environment variable is not set');
  }

  try {
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid JWT token');
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7);
}