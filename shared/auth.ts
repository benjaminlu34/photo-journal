import { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
  role?: string;
}

// Database user type from auth.users
export interface DatabaseUser {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}