import { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  username?: string; // Optional during migration phase
  createdAt: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  showProfileModal: boolean;
  setShowProfileModal: (show: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateProfile: (profileData: Partial<AuthUser>) => Promise<AuthUser | undefined>;
  isProfileIncomplete: () => boolean;
}

export interface JwtPayload {
  sub: string;
  email: string;
  username?: string; // Optional during migration phase
  iat: number;
  exp: number;
  role?: string;
}

// Database user type from auth.users
export interface DatabaseUser {
  id: string;
  email: string;
  username?: string; // Optional during migration phase
  created_at: string;
  updated_at: string;
}