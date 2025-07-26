/**
 * Component to validate username-based routes and handle errors
 */

import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@/hooks/useUser';
import { isValidUsernameForUrl } from '@/lib/navigationUtils';
import { Button } from '@/components/ui/button';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface UsernameRouteValidatorProps {
  children: React.ReactNode;
}

interface UserValidationResponse {
  exists: boolean;
  username: string;
  canAccess: boolean;
  message?: string;
}

export function UsernameRouteValidator({ children }: UsernameRouteValidatorProps) {
  const { username: urlUsername, date: urlDate } = useParams();
  const [, setLocation] = useLocation();
  const { data: currentUser } = useUser();
  const [validationError, setValidationError] = useState<string | null>(null);

  // Only validate if we're in a username-based route
  const isUsernameRoute = !!urlUsername;

  // Validate username format
  useEffect(() => {
    if (isUsernameRoute && urlUsername && !isValidUsernameForUrl(urlUsername)) {
      setValidationError('Invalid username format in URL');
    } else {
      setValidationError(null);
    }
  }, [urlUsername, isUsernameRoute]);

  // Validate date format
  useEffect(() => {
    if (urlDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(urlDate)) {
        setValidationError('Invalid date format in URL');
        return;
      }

      // Check if date is valid
      const [year, month, day] = urlDate.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        setValidationError('Invalid date in URL');
        return;
      }
    }
  }, [urlDate]);

  // Validate user access (only for username routes)
  const { data: userValidation, isLoading: isValidatingUser, error: userValidationError } = useQuery<UserValidationResponse>({
    queryKey: ['validate-username-route', urlUsername],
    queryFn: async () => {
      if (!urlUsername) return { exists: true, username: '', canAccess: true };

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        // Check if user exists by trying to access their journal
        const response = await fetch(`/api/journal/user/${urlUsername}/${urlDate || new Date().toISOString().split('T')[0]}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.status === 404) {
          return {
            exists: false,
            username: urlUsername,
            canAccess: false,
            message: 'User not found'
          };
        }

        if (response.status === 403) {
          return {
            exists: true,
            username: urlUsername,
            canAccess: false,
            message: 'You do not have permission to view this user\'s journal'
          };
        }

        if (response.ok) {
          return {
            exists: true,
            username: urlUsername,
            canAccess: true
          };
        }

        throw new Error(`Unexpected response: ${response.status}`);
      } catch (error) {
        console.error('Username validation error:', error);
        return {
          exists: false,
          username: urlUsername,
          canAccess: false,
          message: 'Failed to validate user access'
        };
      }
    },
    enabled: isUsernameRoute && !!urlUsername && !validationError,
    retry: false,
  });

  // Handle navigation back to safe routes
  const handleGoHome = () => {
    setLocation('/');
  };

  const handleGoBack = () => {
    window.history.back();
  };

  // Show validation error
  if (validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid URL</h1>
          <p className="text-gray-600 mb-6">{validationError}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={handleGoBack} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Button onClick={handleGoHome}>
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state for user validation
  if (isUsernameRoute && isValidatingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Validating access...</p>
        </div>
      </div>
    );
  }

  // Show user validation error
  if (isUsernameRoute && (userValidationError || (userValidation && !userValidation.canAccess))) {
    const errorMessage = userValidation?.message || 'Failed to validate user access';
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-2">{errorMessage}</p>
          {urlUsername && (
            <p className="text-sm text-gray-500 mb-6">
              Username: @{urlUsername}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <Button onClick={handleGoBack} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Button onClick={handleGoHome}>
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // All validations passed, render children
  return <>{children}</>;
}