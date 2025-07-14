import { Switch, Route, useLocation } from "wouter";
import { Suspense, lazy } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { queryClient } from "@/lib/queryClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEffect } from "react";

// Lazy load pages
const Home = lazy(() => import("@/pages/home"));
const Landing = lazy(() => import("@/pages/landing"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Welcome = lazy(() => import("@/pages/welcome"));

function AppContent() {
  const { user, isProfileIncomplete } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (user && isProfileIncomplete() && location !== "/welcome") {
      setLocation("/welcome");
    }
    if (user && !isProfileIncomplete() && location === "/welcome") {
      setLocation("/");
    }
  }, [user, isProfileIncomplete, location, setLocation]);

  if (user && isProfileIncomplete() && location !== "/welcome") {
    // Prevent rendering app content while redirecting
    return null;
  }

  return (
    <>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<div>Loading...</div>}>
          <Switch>
            <Route path="/welcome" component={Welcome} />
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
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}
