import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient, User } from '@supabase/supabase-js';
import { AuthContextType, AuthUser } from '../../../shared/auth';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Function to check if profile is incomplete
  const isProfileIncomplete = (user: AuthUser | null): boolean => {
    if (!user) return false;
    return !user.firstName || !user.lastName;
  };

  // Function to fetch complete user profile from API
  const fetchUserProfile = async (userId: string): Promise<void> => {
    try {
      const response = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        
        // Update the user state with complete profile data
        setUser(prev => ({
          ...prev,
          ...userData
        }));
        
        // Show profile modal if the profile is incomplete
        if (isProfileIncomplete(userData)) {
          setShowProfileModal(true);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const authUser: AuthUser = {
          id: session.user.id,
          email: session.user.email!,
          createdAt: session.user.created_at!,
        };
        
        setUser(authUser);
        
        // Fetch complete user profile
        fetchUserProfile(session.user.id);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const authUser: AuthUser = {
          id: session.user.id,
          email: session.user.email!,
          createdAt: session.user.created_at!,
        };
        
        setUser(authUser);
        
        // For sign-in and sign-up events, fetch the complete profile
        if (event === 'SIGNED_IN' || event === 'SIGNED_UP') {
          fetchUserProfile(session.user.id);
        }
      } else {
        setUser(null);
        setShowProfileModal(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error) {
      console.error('Sign-in error:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
    } catch (error) {
      console.error('Sign-up error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const refreshSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    
    if (session?.user) {
      setUser({
        id: session.user.id,
        email: session.user.email!,
        createdAt: session.user.created_at!,
      });
      
      // Fetch complete profile after refreshing session
      fetchUserProfile(session.user.id);
    }
  };

  const updateProfile = async (profileData: Partial<AuthUser>) => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(profileData)
      });
      
      if (response.ok) {
        const updatedUser = await response.json();
        
        // Update the user state with updated profile data
        setUser(prev => ({
          ...prev,
          ...updatedUser
        }));
        
        // Close the profile modal if profile is now complete
        if (!isProfileIncomplete(updatedUser)) {
          setShowProfileModal(false);
        }
        
        return updatedUser;
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshSession,
        showProfileModal,
        setShowProfileModal,
        updateProfile,
        isProfileIncomplete: () => isProfileIncomplete(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}