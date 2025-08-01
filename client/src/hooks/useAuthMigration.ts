import { useUser } from "./useUser";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useAuthMigration() {
  const userQuery = useUser();
  const queryClient = useQueryClient();

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      // Enhance error messages for better UX
      let enhancedError = error;
      
      if (error.message.includes("Invalid login credentials")) {
        enhancedError.message = "Invalid email or password. Please check your credentials and try again.";
      } else if (error.message.includes("Email not confirmed")) {
        enhancedError.message = "Please check your email and confirm your account before signing in.";
      }
      
      throw enhancedError;
    }
    
    return data;
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    // Handle both error cases and duplicate registration
    if (error) {
      // Enhance error messages for better UX
      let enhancedError = error;
      
      if (error.message.includes("User already registered")) {
        enhancedError.message = "This email is already registered. Please sign in instead.";
      } else if (error.message.includes("email") && error.message.includes("taken")) {
        enhancedError.message = "This email is already registered. Please sign in instead.";
      } else if (error.message.includes("already exists")) {
        enhancedError.message = "This email is already registered. Please sign in instead.";
      }
      
      throw enhancedError;
    }
    
    // Check if user already exists (Supabase returns 200 but no session)
    if (!data.user || !data.session) {
      // This indicates the email was already registered
      const error = new Error("This email is already registered. Please sign in instead.");
      (error as any).code = "USER_ALREADY_EXISTS";
      throw error;
    }
    
    return data;
  };

  const signOut = async () => {
    // Import dynamically to avoid circular dependencies
    const { cleanupUserState } = await import('../lib/cleanup');
    
    // Clean up all user state before signing out
    await cleanupUserState();
    
    const { error } = await supabase.auth.signOut();
    window.location.href = '/';
    if (error) throw error;
    
  };

  const updateProfile = async (profileData: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No authenticated session');
    }

    const response = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      credentials: "include",
      body: JSON.stringify(profileData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update profile');
    }
    
    const updatedUser = await response.json();
    
    // Update the query cache immediately
    queryClient.setQueryData(["user"], updatedUser);
    
    return updatedUser;
  };

  const isProfileIncomplete = (user: any) => {
    return user && (!user.firstName || !user.lastName || !user.username);
  };

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    error: userQuery.error,
    refetch: userQuery.refetch,
    signIn,
    signUp,
    signOut,
    updateProfile,
    isProfileIncomplete,
  };
}