import { Switch, Route, useLocation } from "wouter";
import { Suspense, lazy, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useUser } from "@/hooks/useUser";
import { queryClient } from "@/lib/queryClient";
import { ErrorBoundary } from "@/components/ErrorBoundary/ErrorBoundary";
import { UsernameRouteValidator } from "@/components/routing/UsernameRouteValidator";
import { supabase } from "@/lib/supabase";
import { PhotoStorageService } from "@/services/storage.service/photo-storage.service";

// Lazy load pages
const Home = lazy(() => import("@/pages/home"));
const Landing = lazy(() => import("@/pages/landing"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Welcome = lazy(() => import("@/pages/welcome"));
const Profile = lazy(() => import("@/pages/profile"));
const Friends = lazy(() => import("@/pages/friends"));

function AppContent() {
  const { data: user, isLoading, error, refetch } = useUser();
  const [location, setLocation] = useLocation();

  const isProfileIncomplete = user && (!user.firstName || !user.lastName);

  // Initialize PhotoStorageService when app starts
  useEffect(() => {
    const initializeServices = async () => {
      try {
        const photoService = PhotoStorageService.getInstance();
        await photoService.initializeCache();
        console.log('Photo storage services initialized successfully');
      } catch (error) {
        console.error('Failed to initialize photo storage services:', error);
        // Don't block app startup if storage services fail to initialize
      }
    };

    initializeServices();
  }, []);

  // Handle routing based on user state
  useEffect(() => {
    if (isLoading) return;
    
    if (user && isProfileIncomplete && location !== "/welcome") {
      setLocation("/welcome");
    }
    if (user && !isProfileIncomplete && location === "/welcome") {
      setLocation("/");
    }
  }, [user, isProfileIncomplete, location, setLocation, isLoading]);

  // Handle Supabase auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        refetch();
      }
    });

    return () => subscription.unsubscribe();
  }, [refetch]);

  // Handle errors
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading User</h1>
          <p className="text-gray-600 mb-4">{(error as Error).message}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<div>Loading...</div>}>
          <Switch>
            <Route path="/welcome" component={Welcome} />
            <Route path="/profile" component={Profile} />
            <Route path="/friends" component={user ? Friends : Landing} />
            <Route path="/u/:username/:date?">
              <UsernameRouteValidator>
                {user ? <Home /> : <Landing />}
              </UsernameRouteValidator>
            </Route>
            <Route path="/journal/:date?" component={user ? Home : Landing} />
            <Route path="/" component={user ? Home : Landing} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </ErrorBoundary>

      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
