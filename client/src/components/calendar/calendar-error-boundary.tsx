import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class CalendarErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Call the onError prop if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console for development
    console.error('Calendar Error Boundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="max-w-md w-full">
            <Alert className="neu-card border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-medium">Calendar Error</h3>
                    <p className="text-sm mt-1">
                      Something went wrong with the calendar. This might be due to a network issue or temporary system problem.
                    </p>
                  </div>
                  
                  {this.state.error && (
                    <details className="text-xs">
                      <summary className="cursor-pointer hover:text-red-800">
                        Error Details
                      </summary>
                      <div className="mt-2 p-2 bg-red-100 rounded border">
                        <p className="font-mono text-xs break-all">
                          {this.state.error.message}
                        </p>
                      </div>
                    </details>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={this.handleRetry}
                      size="sm"
                      className="neu-card bg-red-600 hover:bg-red-700 text-white"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                    
                    <Button
                      onClick={() => window.location.reload()}
                      size="sm"
                      variant="ghost"
                      className="neu-card text-red-600 hover:text-red-700"
                    >
                      Reload Page
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for functional components
export function withCalendarErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorCallback?: (error: Error, errorInfo: React.ErrorInfo) => void
) {
  return function WrappedComponent(props: P) {
    return (
      <CalendarErrorBoundary onError={errorCallback}>
        <Component {...props} />
      </CalendarErrorBoundary>
    );
  };
}

// Hook for error handling in functional components
export function useCalendarErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return {
    throwError: setError,
    clearError: () => setError(null)
  };
}
