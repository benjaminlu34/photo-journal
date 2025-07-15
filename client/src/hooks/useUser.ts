import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      // Get the current session from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return null; // Not authenticated
      }

      // Include the JWT token in the request
      const res = await fetch("/api/auth/user", {
        credentials: "include",
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          return null; // Not authenticated - handled gracefully
        }
        throw new Error(`Failed to fetch user: ${res.status}`);
      }
      
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    retry: (failureCount, error: any) => {
      // Don't retry on 401 (not authenticated)
      if (error?.message?.includes('401')) return false;
      return failureCount < 3;
    },
  });
}