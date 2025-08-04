/**
 * Type definitions for the Weekly Calendar View
 */

export interface BaseEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timezone?: string; // IANA timezone identifier, undefined for floating times
  isAllDay: boolean;
  color: string;
  pattern?: 'stripe' | 'dot' | 'plain'; // Visual pattern for color-blind accessibility
  location?: string;
  attendees?: string[];
}

export interface CalendarEventBase extends BaseEvent {
  feedId: string;
  feedName: string;
  externalId: string; // UID from iCal/Google or friend canonical id
  sequence: number; // For duplicate detection
  recurrenceRule?: string;
  isRecurring: boolean;
  originalEvent?: string; // For recurring event instances
  lastModified: Date;
  source: 'google' | 'ical' | 'friend';
}

/**
 * Single discriminated union type for all non-local calendar events.
 */
export interface GoogleCalendarEvent extends CalendarEventBase {
  source: 'google';
}

export interface IcalCalendarEvent extends CalendarEventBase {
  source: 'ical';
}

export interface FriendCalendarEvent extends CalendarEventBase {
  source: 'friend';
  friendUserId: string;
  friendUsername: string;
  isFromFriend: true;
  originalEventId: string; // Reference to friend's local event
  canonicalEventId: string; // Stable ID after deduplication
  sourceId: string; // friendUserId (distinct from feedId)
}

/**
 * Unified CalendarEvent including friend
 */
export type CalendarEvent = GoogleCalendarEvent | IcalCalendarEvent | FriendCalendarEvent;

export interface LocalEvent extends BaseEvent {
  createdBy: string; // User ID
  createdAt: Date;
  updatedAt: Date;
  linkedJournalEntryId?: string;
  reminderMinutes?: number;
  collaborators: string[]; // User IDs with edit access
  tags: string[];
}

/* moved & extended above as a discriminated member with source: 'friend' */

export interface CalendarFeed {
  id: string;
  name: string;
  type: 'google' | 'ical' | 'friend';
  url?: string; // For iCal feeds
  googleCalendarId?: string; // For Google feeds
  friendUserId?: string; // For friend calendar sync
  color: string;
  isEnabled: boolean;
  lastSyncAt: Date;
  syncError?: string;
  credentials?: EncryptedCredentials;
}

export interface EncryptedCredentials {
  encryptedToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface ResponsiveBreakpoints {
  full: number; // >= 1024px - Full week visible
  scroll: number; // 640px - 1023px - Horizontal scroll
  pads: number; // < 640px - 3-day pads with swipe
}

export interface ViewportState {
  width: number;
  height: number;
  mode: 'full' | 'scroll' | 'pads';
  orientation: 'portrait' | 'landscape';
  touchDevice: boolean;
}

export interface MobileCalendarNavigation {
  currentPadIndex: number; // 0: Sun-Tue, 1: Wed-Fri, 2: Sat-Mon
  totalPads: number; // Always 3 for weekly view
  onSwipeLeft: () => void; // Next pad
  onSwipeRight: () => void; // Previous pad
  showDatePicker: boolean; // Large touch target for date selection
  showWeekNavigation: boolean; // Previous/next week arrows
}

export interface TouchInteractionConfig {
  swipeThreshold: number; // 30% of viewport width
  swipeVelocity: number; // Minimum px/ms for swipe detection
  dragStartDelay: number; // 150ms before drag begins
  dragStartDistance: number; // 10px movement threshold
  enableHaptics: boolean;
  hapticIntensity: 'light' | 'medium' | 'heavy';
}

export interface WeeklyCalendarViewProps {
  initialDate?: Date;
  username: string; // Current user or viewed user
  collaborationEnabled?: boolean;
  feedsEnabled?: boolean;
  syncedFriends?: string[]; // Friend usernames to sync calendars from
}

export interface WeeklyCalendarViewState {
  currentWeek: Date;
  selectedDate: Date | null;
  isCreateEventModalOpen: boolean;
  isImportCalendarModalOpen: boolean;
  isFriendSyncModalOpen: boolean;
  viewMode: 'full' | 'scroll' | 'pads';
  mobileNavigation: MobileCalendarNavigation;
  syncedFriendCalendars: Map<string, FriendCalendarEvent[]>;
}

export interface ColorAssignment {
  color: string;
  pattern?: 'stripe' | 'dot' | 'plain';
  wcagRating: 'AA' | 'AAA';
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface EventLayout {
  event: CalendarEvent | LocalEvent;
  column: number;
  totalColumns: number;
  width: number; // Percentage of day column width
  left: number; // Percentage offset from left
}

export interface DragState {
  isDragging: boolean;
  draggedEventId: string | null;
  startPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
  targetDate: Date | null;
}

// Constants
// To use constants RESPONSIVE_BREAKPOINTS and TOUCH_INTERACTION_CONFIG go to shared/calendar-config.ts