'use client';

import React, { Component, ErrorInfo } from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
          <p className="text-red-600 mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Note-specific error boundary
interface NoteErrorBoundaryProps {
  noteId: string;
  onDelete: (id: string) => void;
  children: React.ReactNode;
}

export const NoteErrorBoundary: React.FC<NoteErrorBoundaryProps> = ({
  noteId,
  onDelete,
  children,
}) => {
  const handleError = (error: Error) => {
    console.error(`Error in note ${noteId}:`, error);
  };

  return (
    <ErrorBoundary
      onError={handleError}
      fallback={
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Note Error</h3>
          <p className="text-red-600 mb-4">
            This note encountered an error and cannot be displayed.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onDelete(noteId)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Delete note
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}; 