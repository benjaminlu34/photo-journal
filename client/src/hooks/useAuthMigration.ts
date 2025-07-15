import { useUser } from "./useUser";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useAuthMigration() {
  const userQuery = useUser();
  const queryClient = useQueryClient();

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // TanStack Query will automatically refetch on auth state change
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    // Import dynamically to avoid circular dependencies
    const { cleanupUserState } = await import('../lib/cleanup');
    
    // Clean up all user state before signing out
    await cleanupUserState();
    
    const { error } = await supabase.auth.signOut();
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
    return user && (!user.firstName || !user.lastName);
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