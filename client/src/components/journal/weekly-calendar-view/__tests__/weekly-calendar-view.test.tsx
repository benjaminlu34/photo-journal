/**
 * Tests for WeeklyCalendarView component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeeklyCalendarView } from '../weekly-calendar-view';
import { JournalProvider } from '@/contexts/journal-context';

// Mock the hooks and services
vi.mock('@/hooks/useCalendarResponsive', () => ({
  useCalendarResponsive: () => ({
    viewMode: 'full',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    currentPadIndex: 0,
    navigatePad: vi.fn(),
    canNavigatePad: vi.fn(() => false),
  }),
}));

vi.mock('@/services/timezone.service', () => ({
  timezoneService: {
    getUserTimezone: () => 'America/New_York',
  },
}));

vi.mock('@/services/color-palette-manager', () => ({
  colorPaletteManager: {
    getNextDistinctColor: () => '#3B82F6',
  },
}));

// Mock journal context
const mockJournalContext = {
  currentWeek: new Date('2024-01-15'),
  setCurrentWeek: vi.fn(),
  currentEntry: null,
  viewMode: 'weekly-calendar',
  isLoading: false,
  currentUserRole: 'owner',
};

const renderWithContext = (component: React.ReactElement) => {
  return render(
    <JournalProvider value={mockJournalContext as any}>
      {component}
    </JournalProvider>
  );
};

describe('WeeklyCalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    renderWithContext(<WeeklyCalendarView username="testuser" />);
    
    // Should render the main container
    expect(screen.getByText(/Week of/)).toBeInTheDocument();
  });

  it('should display the week header with navigation', () => {
    renderWithContext(<WeeklyCalendarView username="testuser" />);
    
    // Should show week range
    expect(screen.getByText(/Week of/)).toBeInTheDocument();
    
    // Should show timezone
    expect(screen.getByText(/America\/New_York/)).toBeInTheDocument();
    
    // Should show navigation buttons
    expect(screen.getByLabelText('Previous week')).toBeInTheDocument();
    expect(screen.getByLabelText('Next week')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('should display import calendar button', () => {
    renderWithContext(<WeeklyCalendarView username="testuser" />);
    
    expect(screen.getByText('Import Calendar')).toBeInTheDocument();
  });

  it('should display add event FAB', () => {
    renderWithContext(<WeeklyCalendarView username="testuser" />);
    
    expect(screen.getByLabelText('Add new event')).toBeInTheDocument();
  });

  it('should render 7 day columns in full view mode', () => {
    renderWithContext(<WeeklyCalendarView username="testuser" />);
    
    // Should render all 7 days of the week
    const dayColumns = screen.getAllByRole('gridcell');
    expect(dayColumns).toHaveLength(7);
  });

  it('should show coming soon banner when recurrence is disabled', () => {
    renderWithContext(<WeeklyCalendarView username="testuser" feedsEnabled={true} />);
    
    expect(screen.getByText('Recurring events coming soon!')).toBeInTheDocument();
  });

  it('should handle props correctly', () => {
    const props = {
      username: 'testuser',
      collaborationEnabled: false,
      feedsEnabled: false,
      syncedFriends: ['friend1', 'friend2'],
    };
    
    renderWithContext(<WeeklyCalendarView {...props} />);
    
    // Component should render without errors
    expect(screen.getByText(/Week of/)).toBeInTheDocument();
  });

  it('should display empty state for days with no events', () => {
    renderWithContext(<WeeklyCalendarView username="testuser" />);
    
    // Should show "No events" message in empty days
    const noEventsMessages = screen.getAllByText('No events');
    expect(noEventsMessages.length).toBeGreaterThan(0);
  });
});