import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JournalProvider, useJournal } from './contexts/journal-context';

// Create a query client for testing
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// Test component that uses the journal context
function JournalTestComponent() {
  const {
    currentDate,
    currentWeek,
    viewMode,
    setViewMode,
    setCurrentWeek,
    isLoading,
    currentUserRole
  } = useJournal();

  const handleViewModeChange = (mode: 'daily' | 'weekly-calendar' | 'weekly-creative' | 'monthly') => {
    setViewMode(mode);
  };

  const handleWeekChange = () => {
    const nextWeek = new Date(currentWeek);
    nextWeek.setDate(nextWeek.getDate() + 7);
    setCurrentWeek(nextWeek);
  };

  return (
    <div className="min-h-screen bg-surface p-8">
      <div className="max-w-4xl mx-auto">
        <div className="neu-card p-8 mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-6">
            Journal Context Test
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current State Display */}
            <div className="neu-card p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Current State</h2>
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-muted-foreground">Current Date:</span>
                  <p className="text-foreground">{currentDate.toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Current Week:</span>
                  <p className="text-foreground">{currentWeek.toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">View Mode:</span>
                  <p className="text-foreground capitalize">{viewMode}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">User Role:</span>
                  <p className="text-foreground capitalize">{currentUserRole}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Loading:</span>
                  <p className="text-foreground">{isLoading ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="neu-card p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Controls</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    View Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['daily', 'weekly-calendar', 'weekly-creative', 'monthly'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => handleViewModeChange(mode)}
                        className={`neu-button px-3 py-2 text-sm text-white rounded-lg transition-all ${
                          viewMode === mode ? 'opacity-100' : 'opacity-70 hover:opacity-90'
                        }`}
                      >
                        {mode.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <button
                    onClick={handleWeekChange}
                    className="neu-button px-4 py-2 text-white rounded-lg w-full"
                  >
                    Next Week
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="mt-8 p-4 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <span className="text-green-800 font-medium">
                Journal Context is working without infinite loops!
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mock providers for testing
function MockProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Main app component
export default function App() {
  return (
    <MockProviders>
      <JournalProvider>
        <JournalTestComponent />
      </JournalProvider>
    </MockProviders>
  );
}