/**
 * Calendar configuration shared between client and server
 */

export const CALENDAR_CONFIG = {
  // Responsive breakpoints (px)
  BREAKPOINTS: {
    FULL_VIEW: 1024,    // >= 1024px - Full week visible
    SCROLL_VIEW: 640,   // 640px - 1023px - Horizontal scroll
    PADS_VIEW: 0,       // < 640px - 3-day pads with swipe
  },

  // Time grid configuration
  TIME_GRID: {
    HOUR_HEIGHT: 60,           // px per hour
    MINUTE_INTERVAL: 30,       // minutes between grid lines
    VIRTUALIZATION_THRESHOLD: 12, // hours before virtualization kicks in
    SNAP_INTERVALS: [5, 15, 30], // minute intervals for drag snapping
  },

  // Event configuration
  EVENTS: {
    MIN_DURATION: 15,          // minimum event duration in minutes
    MAX_TITLE_LENGTH: 100,     // maximum characters in event title
    MAX_DESCRIPTION_LENGTH: 500, // maximum characters in description
    DEFAULT_DURATION: 60,      // default event duration in minutes
  },

  // Feed synchronization
  FEEDS: {
    SYNC_INTERVAL: 15 * 60 * 1000,    // 15 minutes in ms
    MAX_FEED_SIZE: 10 * 1024 * 1024,  // 10MB max feed size
    CACHE_TTL: 15 * 60 * 1000,        // 15 minutes cache TTL
    MAX_RECURRENCE_INSTANCES: 500,     // max recurring event instances
    EXPANSION_WINDOW_WEEKS: 2,         // ±2 weeks for recurrence expansion
  },

  // Performance limits
  PERFORMANCE: {
    MAX_EVENTS_PER_DAY: 50,           // maximum events per day
    MAX_CONCURRENT_FEEDS: 10,         // maximum concurrent feed syncs
    DEBOUNCE_DELAY: 300,              // ms for search debouncing
    ANIMATION_DURATION: 200,          // ms for transitions
  },

  // Mobile configuration
  MOBILE: {
    PAD_SIZE: 3,                      // days per pad in mobile view
    SWIPE_THRESHOLD: 0.3,             // 30% of viewport width
    SWIPE_VELOCITY: 0.5,              // px/ms minimum velocity
    DRAG_START_DELAY: 150,            // ms before drag begins
    DRAG_START_DISTANCE: 10,          // px movement threshold
  },

  // Accessibility
  ACCESSIBILITY: {
    MIN_CONTRAST_RATIO: 4.5,          // WCAG AA standard
    PREFERRED_CONTRAST_RATIO: 7,      // WCAG AAA standard
    FOCUS_RING_WIDTH: 2,              // px
    KEYBOARD_NAV_DELAY: 100,          // ms between keyboard nav actions
  },

  // Feature flags
  FEATURES: {
    ENABLE_RECURRENCE_UI: false,      // Recurring events UI
    ENABLE_EMAIL_REMINDERS: false,    // Email reminder notifications
    ENABLE_PUSH_NOTIFICATIONS: false, // Push notifications
    ENABLE_OFFLINE_MODE: true,        // Offline functionality
    ENABLE_FRIEND_SYNC: true,         // Friend calendar synchronization
  },

  // Error handling
  ERROR_HANDLING: {
    MAX_RETRY_ATTEMPTS: 3,            // maximum retry attempts for failed operations
    RETRY_DELAY_BASE: 1000,           // base delay for exponential backoff (ms)
    RETRY_DELAY_MAX: 30000,           // maximum retry delay (ms)
    ERROR_DISPLAY_DURATION: 5000,     // ms to show error messages
  },

  // URL patterns
  URL_PATTERNS: {
    WEEKLY_CALENDAR: '/@{username}/calendar/{year}-W{week}',
    FRIEND_SYNC_PARAM: 'sync',        // ?sync=friend1,friend2
  },

  // Color palette
  COLORS: {
    DEFAULT_EVENT_COLOR: '#3B82F6',   // Blue
    DEFAULT_BACKGROUND: '#F9FAFB',    // Light gray
    TODAY_HIGHLIGHT: '#8B5CF6',       // Purple
    WEEKEND_TINT: '#F3F4F6',          // Slightly darker gray
  },

  // Date formatting
  DATE_FORMATS: {
    WEEK_HEADER: 'MMM d - d, yyyy',   // "Jan 15 - 21, 2024"
    DAY_HEADER: 'EEE d',              // "Mon 15"
    EVENT_TIME: 'h:mm a',             // "2:30 PM"
    ISO_WEEK: 'yyyy-\\WW',            // "2024-W03"
  },
} as const;

// Type definitions for configuration
export type CalendarConfig = typeof CALENDAR_CONFIG;
export type BreakpointKey = keyof typeof CALENDAR_CONFIG.BREAKPOINTS;
export type FeatureFlag = keyof typeof CALENDAR_CONFIG.FEATURES;