import { render, screen, fireEvent } from '@testing-library/react';
import { JournalProvider } from '@/contexts/journal-context';
import { DndContextProvider } from '@/contexts/dnd-context';
import Home from '../home';

// Mock the hooks and components
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    data: { id: 'test-user', username: 'testuser' },
    isLoading: false
  })
}));

jest.mock('@/hooks/useAuthMigration', () => ({
  useAuthMigration: () => ({
    signOut: jest.fn()
  })
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}));

// Mock all the complex components
jest.mock('@/components/journal/sidebar/sidebar', () => ({
  JournalSidebar: () => <div data-testid="journal-sidebar">Sidebar</div>
}));

jest.mock('@/components/journal/workspace/workspace', () => ({
  JournalWorkspace: () => <div data-testid="journal-workspace">Workspace</div>
}));

jest.mock('@/components/journal/collaboration-panel/collaboration-panel', () => ({
  CollaborationPanel: () => <div data-testid="collaboration-panel">Collaboration</div>
}));

jest.mock('@/components/journal/view-toggle/view-toggle', () => ({
  ViewToggle: () => <div data-testid="view-toggle">View Toggle</div>
}));

jest.mock('@/components/ui/friend-search', () => ({
  FriendSearch: () => <div data-testid="friend-search">Friend Search</div>
}));

jest.mock('@/components/friends/friendship-notifications', () => ({
  FriendshipNotifications: () => <div data-testid="friendship-notifications">Notifications</div>
}));

jest.mock('@/components/friendship/FriendshipImageHandler', () => ({
  FriendshipImageHandler: () => <div data-testid="friendship-image-handler">Image Handler</div>
}));

jest.mock('@/contexts/crdt-context', () => ({
  CRDTProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Mock date-fns functions
jest.mock('date-fns', () => ({
  startOfWeek: jest.fn(() => new Date('2024-01-07')),
  addDays: jest.fn((date, days) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
  }),
  addWeeks: jest.fn((date, weeks) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + (weeks * 7));
    return newDate;
  }),
  subWeeks: jest.fn((date, weeks) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() - (weeks * 7));
    return newDate;
  }),
  isSameWeek: jest.fn(() => false)
}));

const renderHome = () => {
  return render(
    <DndContextProvider>
      <JournalProvider>
        <Home />
      </JournalProvider>
    </DndContextProvider>
  );
};

describe('Home Navigation Accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'daily'),
        setItem: jest.fn(),
      },
      writable: true
    });
  });

  describe('Navigation buttons accessibility', () => {
    it('renders navigation buttons with proper accessibility attributes', () => {
      renderHome();

      const prevButton = screen.getByRole('button', { name: /go to previous/i });
      const todayButton = screen.getByRole('button', { name: /go to today/i });
      const nextButton = screen.getByRole('button', { name: /go to next/i });

      expect(prevButton).toBeInTheDocument();
      expect(todayButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();

      // Check aria-labels
      expect(prevButton).toHaveAttribute('aria-label', 'Go to previous day');
      expect(todayButton).toHaveAttribute('aria-label', 'Go to today');
      expect(nextButton).toHaveAttribute('aria-label', 'Go to next day');

      // Check titles
      expect(prevButton).toHaveAttribute('title', 'Previous day');
      expect(todayButton).toHaveAttribute('title', 'Go to today');
      expect(nextButton).toHaveAttribute('title', 'Next day');
    });

    it('handles keyboard activation with Enter key', () => {
      renderHome();

      const prevButton = screen.getByRole('button', { name: /go to previous/i });
      const todayButton = screen.getByRole('button', { name: /go to today/i });
      const nextButton = screen.getByRole('button', { name: /go to next/i });

      // Mock click method
      const prevClickSpy = jest.spyOn(prevButton, 'click');
      const todayClickSpy = jest.spyOn(todayButton, 'click');
      const nextClickSpy = jest.spyOn(nextButton, 'click');

      // Test Enter key activation
      fireEvent.keyDown(prevButton, { key: 'Enter' });
      expect(prevClickSpy).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(todayButton, { key: 'Enter' });
      expect(todayClickSpy).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(nextButton, { key: 'Enter' });
      expect(nextClickSpy).toHaveBeenCalledTimes(1);
    });

    it('handles keyboard activation with Space key', () => {
      renderHome();

      const prevButton = screen.getByRole('button', { name: /go to previous/i });
      const todayButton = screen.getByRole('button', { name: /go to today/i });
      const nextButton = screen.getByRole('button', { name: /go to next/i });

      // Mock click method
      const prevClickSpy = jest.spyOn(prevButton, 'click');
      const todayClickSpy = jest.spyOn(todayButton, 'click');
      const nextClickSpy = jest.spyOn(nextButton, 'click');

      // Test Space key activation
      fireEvent.keyDown(prevButton, { key: ' ' });
      expect(prevClickSpy).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(todayButton, { key: ' ' });
      expect(todayClickSpy).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(nextButton, { key: ' ' });
      expect(nextClickSpy).toHaveBeenCalledTimes(1);
    });

    it('ignores other keyboard keys', () => {
      renderHome();

      const prevButton = screen.getByRole('button', { name: /go to previous/i });
      const clickSpy = jest.spyOn(prevButton, 'click');

      // Test that other keys don't trigger actions
      fireEvent.keyDown(prevButton, { key: 'Tab' });
      fireEvent.keyDown(prevButton, { key: 'Escape' });
      fireEvent.keyDown(prevButton, { key: 'a' });

      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('prevents default behavior on keyboard activation', () => {
      renderHome();

      const prevButton = screen.getByRole('button', { name: /go to previous/i });

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
      
      const enterPreventDefaultSpy = jest.spyOn(enterEvent, 'preventDefault');
      const spacePreventDefaultSpy = jest.spyOn(spaceEvent, 'preventDefault');

      fireEvent(prevButton, enterEvent);
      fireEvent(prevButton, spaceEvent);

      expect(enterPreventDefaultSpy).toHaveBeenCalled();
      expect(spacePreventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Navigation button labels by view mode', () => {
    it('shows correct labels for daily view', () => {
      renderHome();

      const prevButton = screen.getByRole('button', { name: 'Go to previous day' });
      const todayButton = screen.getByRole('button', { name: 'Go to today' });
      const nextButton = screen.getByRole('button', { name: 'Go to next day' });

      expect(prevButton).toBeInTheDocument();
      expect(todayButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();

      expect(todayButton).toHaveTextContent('Today');
    });
  });
});