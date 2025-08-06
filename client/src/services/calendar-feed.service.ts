/**
 * Calendar feed service for external calendar integration.
 */

import ICAL from 'ical.js';
import { LRUCache } from 'lru-cache';
import DOMPurify from 'dompurify';
import type { CalendarEvent, CalendarFeed, EncryptedCredentials } from '@/types/calendar';
import { CALENDAR_CONFIG } from '@shared/config/calendar-config';
import { recurrenceExpansionService } from './recurrence-expansion.service';
import { duplicateEventResolver } from './duplicate-event-resolver.service';
import { timezoneService } from './timezone.service';
// Type-only import to avoid circular dependency
import type { OfflineCalendarService } from './offline-calendar.service';

// Google Calendar API types
interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  recurrence?: string[];
  sequence?: number;
  updated: string;
}

interface GoogleCalendarResponse {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
}

// Cache interfaces
interface CachedFeedData {
  events: CalendarEvent[];
  lastFetch: Date;
  etag?: string;
}

interface RateLimitState {
  requests: number;
  resetTime: number;
}

// Error types
export class CalendarFeedError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly feedId?: string
  ) {
    super(message);
    this.name = 'CalendarFeedError';
  }
}

export interface CalendarFeedService {
  // Core feed operations
  fetchFeedEvents(feed: CalendarFeed, dateRange?: { start: Date; end: Date }): Promise<CalendarEvent[]>;

  // Recurrence expansion
  expandRecurringEvents(events: CalendarEvent[], referenceDate: Date): Promise<CalendarEvent[]>;

  // Duplicate resolution
  resolveEventDuplicates(events: CalendarEvent[]): CalendarEvent[];

  // Offline support
  enableOfflineMode(): void;
  disableOfflineMode(): void;
  getCachedEvents(feedId: string): Promise<CalendarEvent[]>;

  // Google Calendar OAuth
  getGoogleAuthUrl(redirectUri: string): string;
  exchangeGoogleAuthCode(code: string, redirectUri: string): Promise<EncryptedCredentials>;
  refreshGoogleToken(credentials: EncryptedCredentials): Promise<EncryptedCredentials>;

  // iCal operations
  fetchICalFeed(url: string): Promise<string>;
  parseICalContent(content: string, feedId: string, feedName: string): CalendarEvent[];

  // Validation and sanitization
  validateICalUrl(url: string): boolean;
  validateICalContent(content: string): boolean;
  sanitizeDescription(description: string): string;
  validateDateRange(start: Date, end: Date): boolean;

  // Cache management
  clearCache(feedId?: string): void;
  getCacheStats(): { size: number; maxSize: number };

  // Lifecycle management
  destroy(): void;
}

export class CalendarFeedServiceImpl implements CalendarFeedService {
  private readonly MAX_FEED_SIZE = CALENDAR_CONFIG.FEEDS.MAX_FEED_SIZE;
  private readonly CACHE_TTL = CALENDAR_CONFIG.FEEDS.CACHE_TTL;
  private readonly VALID_URL_PATTERN = /^https?:\/\/.+/;

  // LRU cache for feed data with 15-minute TTL
  private readonly feedCache = new LRUCache<string, CachedFeedData>({
    max: 100, // Maximum 100 feeds cached
    ttl: this.CACHE_TTL,
    updateAgeOnGet: true,
    updateAgeOnHas: true,
  });

  // Rate limiting state per feed
  private readonly rateLimitState = new Map<string, RateLimitState>();

  // Retry tracking per feed
  private readonly retryState = new Map<string, { count: number; lastAttempt: number }>();

  // Google OAuth configuration (client-side only)
  private readonly GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  private readonly GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

  // Optional offline service dependency (injected to avoid circular dependency)
  private offlineService: OfflineCalendarService | null = null;

  // Store reference to visibility change handler for cleanup
  private visibilityChangeHandler: (() => void) | null = null;

  constructor() {
    // Validate Google OAuth configuration
    if (!this.GOOGLE_CLIENT_ID) {
      console.warn('Google Calendar integration not configured - client ID missing');
    }
  }

  // Dependency injection method to set offline service
  setOfflineService(offlineService: OfflineCalendarService): void {
    this.offlineService = offlineService;
  }

  // Core feed operations
  async fetchFeedEvents(feed: CalendarFeed, dateRange?: { start: Date; end: Date }): Promise<CalendarEvent[]> {
    const cacheKey = this.generateCacheKey(feed.id, dateRange);

    // Check cache first
    const cached = this.feedCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return cached.events;
    }

    // Check rate limiting
    if (this.isRateLimited(feed.id)) {
      throw new CalendarFeedError(
        'Rate limit exceeded for feed',
        'RATE_LIMIT_EXCEEDED',
        feed.id
      );
    }

    try {
      const events = await this.fetchEventsFromSource(feed, dateRange);
      await this.cacheAndReturnEvents(feed, cacheKey, events);
      return events;
    } catch (error) {
      console.error(`Failed to fetch events for feed ${feed.id}:`, error);
      return await this.handleFetchError(feed, dateRange, cacheKey, error);
    }
  }

  // Recurrence expansion
  async expandRecurringEvents(events: CalendarEvent[], referenceDate: Date): Promise<CalendarEvent[]> {
    const expandedEvents: CalendarEvent[] = [];
    const nonRecurringEvents = events.filter(event => !event.isRecurring);
    const recurringEvents = events.filter(event => event.isRecurring);

    // Add non-recurring events as-is
    expandedEvents.push(...nonRecurringEvents);

    // Expand recurring events
    try {
      const expansionResults = await recurrenceExpansionService.expandMultipleEvents(
        recurringEvents,
        referenceDate,
        {
          windowWeeks: CALENDAR_CONFIG.FEEDS.EXPANSION_WINDOW_WEEKS,
          maxInstances: CALENDAR_CONFIG.FEEDS.MAX_RECURRENCE_INSTANCES,
        }
      );

      // Convert recurrence instances back to CalendarEvent format
      for (const [, instances] of expansionResults) {
        for (const instance of instances) {
          const expandedEvent: CalendarEvent = {
            ...instance.originalEvent,
            id: instance.instanceId,
            startTime: instance.instanceStart,
            endTime: instance.instanceEnd,
            originalEvent: instance.originalEvent.id,
          };

          expandedEvents.push(expandedEvent);
        }
      }

      return expandedEvents;
    } catch (error) {
      console.error('Failed to expand recurring events:', error);
      // Return non-recurring events if expansion fails
      return nonRecurringEvents;
    }
  }

  // Duplicate resolution
  resolveEventDuplicates(events: CalendarEvent[]): CalendarEvent[] {
    try {
      const deduplicationResult = duplicateEventResolver.resolveEvents(events);

      // Apply color assignments
      const resolvedEvents = Array.from(deduplicationResult.canonicalEvents.values());
      for (const event of resolvedEvents) {
        const assignedColor = deduplicationResult.colorAssignments.get(event.id);
        if (assignedColor) {
          event.color = assignedColor;
        }
      }

      // Log deduplication stats for debugging
      if (deduplicationResult.resolvedCount > 0) {
        console.log(`Resolved ${deduplicationResult.resolvedCount} duplicate events from ${events.length} total events`);
      }

      return resolvedEvents;
    } catch (error) {
      console.error('Failed to resolve event duplicates:', error);
      // Return original events if deduplication fails
      return events;
    }
  }

  // Offline support
  enableOfflineMode(): void {
    if (this.offlineService) {
      this.offlineService.enableBackgroundSync();
      console.log('Offline mode enabled for calendar feeds');
    } else {
      console.warn('Offline service not available');
    }
  }

  disableOfflineMode(): void {
    if (this.offlineService) {
      this.offlineService.disableBackgroundSync();
      console.log('Offline mode disabled for calendar feeds');
    } else {
      console.warn('Offline service not available');
    }
  }

  async getCachedEvents(feedId: string): Promise<CalendarEvent[]> {
    if (this.offlineService) {
      return this.offlineService.getCachedEvents(feedId);
    }
    return [];
  }

  // Google Calendar OAuth implementation
  getGoogleAuthUrl(redirectUri: string): string {
    if (!this.GOOGLE_CLIENT_ID) {
      throw new CalendarFeedError('Google OAuth not configured', 'OAUTH_NOT_CONFIGURED');
    }

    const params = new URLSearchParams({
      client_id: this.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: this.GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeGoogleAuthCode(code: string, redirectUri: string): Promise<EncryptedCredentials> {
    // SECURITY: OAuth token exchange must happen on the server to protect client secret
    const response = await fetch('/api/calendar/google/exchange-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        redirectUri,
      }),
    });

    if (!response.ok) {
      throw new CalendarFeedError('Failed to exchange auth code', 'OAUTH_EXCHANGE_FAILED');
    }

    const data = await response.json();

    return {
      encryptedToken: data.encryptedToken, // Server returns properly encrypted token
      refreshToken: data.refreshToken,
      expiresAt: new Date(data.expiresAt),
    };
  }

  async refreshGoogleToken(credentials: EncryptedCredentials): Promise<EncryptedCredentials> {
    if (!credentials.refreshToken) {
      throw new CalendarFeedError('No refresh token available', 'NO_REFRESH_TOKEN');
    }

    // SECURITY: Token refresh must happen on the server to protect client secret
    const response = await fetch('/api/calendar/google/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: credentials.refreshToken,
      }),
    });

    if (!response.ok) {
      throw new CalendarFeedError('Failed to refresh token', 'TOKEN_REFRESH_FAILED');
    }

    const data = await response.json();

    return {
      encryptedToken: data.encryptedToken, // Server returns properly encrypted token
      refreshToken: data.refreshToken || credentials.refreshToken,
      expiresAt: new Date(data.expiresAt),
    };
  }

  // iCal operations
  async fetchICalFeed(url: string): Promise<string> {
    if (!this.validateICalUrl(url)) {
      throw new CalendarFeedError('Invalid iCal URL', 'INVALID_URL');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'PhotoJournal/1.0',
          'Accept': 'text/calendar, application/ics, text/plain',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new CalendarFeedError(
          `HTTP ${response.status}: ${response.statusText}`,
          'HTTP_ERROR'
        );
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > this.MAX_FEED_SIZE) {
        throw new CalendarFeedError(
          'Feed size exceeds maximum limit',
          'FEED_TOO_LARGE'
        );
      }

      const content = await response.text();

      if (!this.validateICalContent(content)) {
        throw new CalendarFeedError('Invalid iCal content', 'INVALID_ICAL_CONTENT');
      }

      return content;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof CalendarFeedError) {
        throw error;
      }
      throw new CalendarFeedError(
        `Failed to fetch iCal feed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FETCH_FAILED'
      );
    }
  }

  parseICalContent(content: string, feedId: string, feedName: string): CalendarEvent[] {
    try {
      const jcalData = ICAL.parse(content);
      const comp = new ICAL.Component(jcalData);
      const vevents = comp.getAllSubcomponents('vevent');

      const events: CalendarEvent[] = [];

      for (const vevent of vevents) {
        const event = new ICAL.Event(vevent);

        // Extract basic event data
        const startTime = event.startDate.toJSDate();
        const endTime = event.endDate.toJSDate();

        if (!this.validateDateRange(startTime, endTime)) {
          console.warn(`Skipping event with invalid date range: ${event.uid}`);
          continue;
        }

        const baseEvent: CalendarEvent = {
          id: `${feedId}:${event.uid}`,
          title: event.summary || 'Untitled Event',
          description: this.sanitizeDescription(event.description || ''),
          startTime,
          endTime,
          timezone: event.startDate.timezone,
          isAllDay: event.startDate.isDate,
          color: '#3B82F6', // Default blue, will be assigned by color manager
          location: event.location || undefined,
          attendees: event.attendees?.map(att => att.toString()) || [],
          feedId,
          feedName,
          externalId: event.uid,
          sequence: event.sequence || 0,
          recurrenceRule: event.component.getFirstPropertyValue('rrule')?.toString(),
          isRecurring: !!event.component.getFirstPropertyValue('rrule'),
          source: 'ical',
          lastModified: event.component.getFirstPropertyValue('last-modified')?.toJSDate() || startTime,
        };

        // Apply timezone conversion with DST handling
        const userTimezone = timezoneService.getUserTimezone();
        let calendarEvent = baseEvent;

        if (event.startDate.timezone) {
          // Event has explicit timezone, always use safe conversion
          calendarEvent = timezoneService.convertToLocalTimeSafe(baseEvent, userTimezone);
        } else {
          // Floating time, interpret in user's timezone
          calendarEvent = {
            ...baseEvent,
            startTime: timezoneService.handleFloatingTime(startTime, userTimezone),
            endTime: timezoneService.handleFloatingTime(endTime, userTimezone),
            timezone: userTimezone,
          };
        }

        // Validate all-day events don't cross date boundaries
        if (calendarEvent.isAllDay && !timezoneService.validateAllDayEvent(calendarEvent, userTimezone)) {
          console.warn(`All-day event crosses date boundary, adjusting: ${event.uid}`);
          const dayBounds = timezoneService.getLocalDayBounds(calendarEvent.startTime, userTimezone);
          calendarEvent = {
            ...calendarEvent,
            startTime: dayBounds.start,
            endTime: dayBounds.end,
          };
        }

        events.push(calendarEvent);
      }

      return events;
    } catch (error) {
      throw new CalendarFeedError(
        `Failed to parse iCal content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_FAILED'
      );
    }
  }

  // Validation and sanitization
  validateICalUrl(url: string): boolean {
    return this.VALID_URL_PATTERN.test(url) && url.length <= 2048;
  }

  validateICalContent(content: string): boolean {
    return content.length <= this.MAX_FEED_SIZE &&
      content.includes('BEGIN:VCALENDAR') &&
      content.includes('END:VCALENDAR');
  }

  sanitizeDescription(description: string): string {
    if (!description) return '';

    // Use DOMPurify to sanitize HTML content
    return DOMPurify.sanitize(description, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a'],
      ALLOWED_ATTR: ['href'],
      ALLOW_DATA_ATTR: false,
    });
  }

  validateDateRange(start: Date, end: Date): boolean {
    return start instanceof Date &&
      end instanceof Date &&
      !isNaN(start.getTime()) &&
      !isNaN(end.getTime()) &&
      start <= end;
  }

  // Cache management
  clearCache(feedId?: string): void {
    try {
      if (feedId) {
        // FIXED: More efficient cache clearing - collect keys first to avoid iterator issues
        const keysToDelete: string[] = [];
        for (const key of this.feedCache.keys()) {
          if (key === feedId || key.startsWith(`${feedId}:`)) {
            keysToDelete.push(key);
          }
        }
        
        // Delete collected keys
        for (const key of keysToDelete) {
          this.feedCache.delete(key);
        }
      } else {
        // Clear all cache
        this.feedCache.clear();
      }
    } catch (error) {
      console.warn('Error clearing cache:', error);
      // Fallback: try to clear the entire cache if selective clearing fails
      try {
        this.feedCache.clear();
      } catch (fallbackError) {
        console.error('Failed to clear cache entirely:', fallbackError);
      }
    }
  }

  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.feedCache.size,
      maxSize: this.feedCache.max,
    };
  }

  // Handle visibility change refresh (maintains encapsulation)
  handleVisibilityRefresh(): void {
    try {
      // Get cache keys and extract unique feed IDs
      const keys: string[] = Array.from(this.feedCache.keys());
      const uniqueFeedIds = new Set<string>();
      
      for (const key of keys) {
        const parts = key.split(':');
        const feedId = parts[0];
        if (feedId) {
          uniqueFeedIds.add(feedId);
        }
      }

      // Clear cache for each feed ID to trigger refresh on next access
      uniqueFeedIds.forEach((feedId) => {
        try {
          this.clearCache(feedId);
        } catch (error) {
          console.debug('Visibility refresh skip for', feedId, error);
        }
      });
    } catch (error) {
      console.debug('Visibility refresh encountered an error:', error);
    }
  }

  // Lifecycle management
  destroy(): void {
    // Clean up event listeners to prevent memory leaks
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }
  }

  // Private helper methods
  private async fetchEventsFromSource(
    feed: CalendarFeed,
    dateRange?: { start: Date; end: Date }
  ): Promise<CalendarEvent[]> {
    switch (feed.type) {
      case 'google':
        return await this.fetchGoogleCalendarEvents(feed, dateRange);
      case 'ical':
        return await this.fetchICalEvents(feed, dateRange);
      default:
        throw new CalendarFeedError(
          `Unsupported feed type: ${feed.type}`,
          'UNSUPPORTED_FEED_TYPE',
          feed.id
        );
    }
  }

  private async cacheAndReturnEvents(
    feed: CalendarFeed,
    cacheKey: string,
    events: CalendarEvent[]
  ): Promise<void> {
    // Cache the results in memory
    this.feedCache.set(cacheKey, {
      events,
      lastFetch: new Date(),
    });

    // Cache the results in IndexedDB for offline access (if offline service is available)
    if (this.offlineService) {
      try {
        await this.offlineService.cacheEvents(feed.id, feed.name, events);
      } catch (error) {
        console.warn('Failed to cache events offline:', error);
      }
    }

    // Update rate limiting
    this.updateRateLimit(feed.id);
  }

  private async handleFetchError(
    feed: CalendarFeed,
    dateRange: { start: Date; end: Date } | undefined,
    cacheKey: string,
    error: unknown
  ): Promise<CalendarEvent[]> {
    // Try to get cached events as fallback (if offline service is available)
    if (this.offlineService) {
      try {
        const cachedEvents = await this.offlineService.handleNetworkFailure(
          feed.id,
          error instanceof Error ? error : new Error('Unknown fetch error')
        );

        console.log(`Using ${cachedEvents.length} cached events for feed ${feed.id}`);
        return cachedEvents;
      } catch (cacheError) {
        console.warn('Failed to get cached events:', cacheError);
      }
    }

    // Try to retry the fetch operation
    try {
      const retriedEvents = await this.retryFeedFetch(feed, dateRange, error);

      // Cache the retried results
      this.feedCache.set(cacheKey, {
        events: retriedEvents,
        lastFetch: new Date(),
      });

      if (this.offlineService) {
        try {
          await this.offlineService.cacheEvents(feed.id, feed.name, retriedEvents);
        } catch (cacheError) {
          console.warn('Failed to cache retried events offline:', cacheError);
        }
      }

      this.updateRateLimit(feed.id);
      return retriedEvents;

    } catch (retryError) {
      // All retries failed, throw the final error
      throw retryError;
    }
  }

  private async fetchGoogleCalendarEvents(
    feed: CalendarFeed,
    dateRange?: { start: Date; end: Date }
  ): Promise<CalendarEvent[]> {
    if (!feed.credentials || !feed.googleCalendarId) {
      throw new CalendarFeedError('Google Calendar credentials missing', 'MISSING_CREDENTIALS', feed.id);
    }

    // SECURITY: Token decryption should happen server-side
    // For now, we'll call the server to get a decrypted token for API calls
    const tokenResponse = await fetch('/api/calendar/google/decrypt-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        encryptedToken: feed.credentials.encryptedToken,
      }),
    });

    if (!tokenResponse.ok) {
      throw new CalendarFeedError('Failed to decrypt access token', 'TOKEN_DECRYPT_FAILED', feed.id);
    }

    const { accessToken } = await tokenResponse.json();

    const params = new URLSearchParams({
      maxResults: '2500',
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    if (dateRange) {
      params.set('timeMin', dateRange.start.toISOString());
      params.set('timeMax', dateRange.end.toISOString());
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(feed.googleCalendarId)}/events?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new CalendarFeedError('Google Calendar access token expired', 'TOKEN_EXPIRED', feed.id);
      }
      throw new CalendarFeedError(
        `Google Calendar API error: ${response.status}`,
        'GOOGLE_API_ERROR',
        feed.id
      );
    }

    const data: GoogleCalendarResponse = await response.json();

    return data.items.map(item => this.convertGoogleEventToCalendarEvent(item, feed));
  }

  private async fetchICalEvents(
    feed: CalendarFeed,
    dateRange?: { start: Date; end: Date }
  ): Promise<CalendarEvent[]> {
    if (!feed.url) {
      throw new CalendarFeedError('iCal URL missing', 'MISSING_URL', feed.id);
    }

    const content = await this.fetchICalFeed(feed.url);
    const events = this.parseICalContent(content, feed.id, feed.name);

    // Filter by date range if provided - check for interval overlap
    if (dateRange) {
      return events.filter(event =>
        event.startTime <= dateRange.end && event.endTime >= dateRange.start
      );
    }

    return events;
  }

  private convertGoogleEventToCalendarEvent(item: GoogleCalendarEvent, feed: CalendarFeed): CalendarEvent {
    const startTime = item.start.dateTime
      ? new Date(item.start.dateTime)
      : new Date(item.start.date + 'T00:00:00');

    // Google all-day: end.date is exclusive (midnight next day) → convert to inclusive end (-1 ms)
    const endTime = item.end.dateTime
      ? new Date(item.end.dateTime)
      : item.end.date
        ? new Date(new Date(item.end.date + 'T00:00:00').getTime() - 1)
        : new Date(startTime.getTime() + 24 * 60 * 60 * 1000 - 1);

    const baseEvent: CalendarEvent = {
      id: `${feed.id}:${item.id}`,
      title: item.summary || 'Untitled Event',
      description: this.sanitizeDescription(item.description || ''),
      startTime,
      endTime,
      timezone: item.start.timeZone,
      isAllDay: !item.start.dateTime,
      color: feed.color,
      location: item.location,
      attendees: item.attendees?.map(att => att.displayName || att.email) || [],
      feedId: feed.id,
      feedName: feed.name,
      externalId: item.id,
      sequence: item.sequence || 0,
      recurrenceRule: item.recurrence?.[0],
      isRecurring: !!item.recurrence,
      source: 'google',
      lastModified: new Date(item.updated),
    };

    const userTimezone = timezoneService.getUserTimezone();

    // Perform conversion first (explicit tz → safe conversion, no tz → floating handling)
    let calendarEvent: CalendarEvent = baseEvent;
    if (item.start.timeZone) {
      calendarEvent = timezoneService.convertToLocalTimeSafe(baseEvent, userTimezone);
    } else {
      calendarEvent = {
        ...baseEvent,
        startTime: timezoneService.handleFloatingTime(startTime, userTimezone),
        endTime: timezoneService.handleFloatingTime(endTime, userTimezone),
        timezone: userTimezone,
      };
    }

    // Validate all-day events don't cross date boundaries after conversion
    if (calendarEvent.isAllDay && !timezoneService.validateAllDayEvent(calendarEvent, userTimezone)) {
      console.warn(`All-day event from Google crosses date boundary, adjusting: ${item.id}`);
      const dayBounds = timezoneService.getLocalDayBounds(calendarEvent.startTime, userTimezone);
      calendarEvent = {
        ...calendarEvent,
        startTime: dayBounds.start,
        endTime: dayBounds.end,
      };
    }

    return calendarEvent;
  }

  private generateCacheKey(feedId: string, dateRange?: { start: Date; end: Date }): string {
    if (dateRange) {
      return `${feedId}:${dateRange.start.toISOString()}:${dateRange.end.toISOString()}`;
    }
    return feedId;
  }

  private isCacheValid(cached: CachedFeedData): boolean {
    const age = Date.now() - cached.lastFetch.getTime();
    return age < this.CACHE_TTL;
  }

  private isRateLimited(feedId: string): boolean {
    const state = this.rateLimitState.get(feedId);
    if (!state) return false;

    const now = Date.now();
    if (now > state.resetTime) {
      this.rateLimitState.delete(feedId);
      return false;
    }

    return state.requests >= 60; // 60 requests per hour
  }

  private updateRateLimit(feedId: string): void {
    const now = Date.now();
    const hourFromNow = now + 60 * 60 * 1000;

    const state = this.rateLimitState.get(feedId);
    if (!state || now > state.resetTime) {
      this.rateLimitState.set(feedId, {
        requests: 1,
        resetTime: hourFromNow,
      });
    } else {
      state.requests++;
    }
  }

  private async retryFeedFetch(
    feed: CalendarFeed,
    dateRange: { start: Date; end: Date } | undefined,
    originalError: unknown
  ): Promise<CalendarEvent[]> {
    const baseDelay = CALENDAR_CONFIG.ERROR_HANDLING.RETRY_DELAY_BASE;
    const maxDelay = CALENDAR_CONFIG.ERROR_HANDLING.RETRY_DELAY_MAX;
    const maxRetries = CALENDAR_CONFIG.ERROR_HANDLING.MAX_RETRY_ATTEMPTS;

    // Get or initialize retry state for this feed
    const now = Date.now();
    let retryState = this.retryState.get(feed.id);

    if (!retryState || (now - retryState.lastAttempt) > 60000) { // Reset after 1 minute
      retryState = { count: 0, lastAttempt: now };
    }

    for (let attempt = retryState.count; attempt < maxRetries; attempt++) {
      retryState.count = attempt + 1;
      retryState.lastAttempt = now;
      this.retryState.set(feed.id, retryState);

      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );

      console.warn(`Feed fetch failed for ${feed.id} (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms:`, originalError);

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        // Retry the actual fetch operation using the common helper
        const events = await this.fetchEventsFromSource(feed, dateRange);

        // Success - reset retry state and return events
        this.retryState.delete(feed.id);
        return events;

      } catch (retryError) {
        console.warn(`Retry ${attempt + 1} failed for feed ${feed.id}:`, retryError);

        // If this was the last attempt, throw the error
        if (attempt === maxRetries - 1) {
          console.error(`All retries exhausted for feed ${feed.id}`);
          throw retryError;
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    throw originalError;
  }
}

// Factory function to create properly wired service instances
export function createCalendarFeedService(): CalendarFeedServiceImpl {
  const feedService = new CalendarFeedServiceImpl();

  // Lazy load offline service to avoid circular dependency
  import('./offline-calendar.service').then(({ offlineCalendarService }) => {
    feedService.setOfflineService(offlineCalendarService);
    // Enable background sync for feeds once offline service is available
    try {
      feedService.enableOfflineMode();
    } catch (err) {
      console.warn('Unable to enable offline mode:', err);
    }
  }).catch(error => {
    console.warn('Failed to load offline calendar service:', error);
  });

  // Background refresh on visibility change with simple rate limit (5 min)
  let lastVisibilityRefresh = 0;
  const VISIBILITY_REFRESH_MIN_MS = 5 * 60 * 1000;
  const onVisibilityChange = () => {
    if (document.hidden) return;
    const now = Date.now();
    if (now - lastVisibilityRefresh < VISIBILITY_REFRESH_MIN_MS) return;
    lastVisibilityRefresh = now;

    // Use proper method to handle visibility refresh
    feedService.handleVisibilityRefresh();
  };
  
  // Store handler reference for cleanup and add listener
  (feedService as any).visibilityChangeHandler = onVisibilityChange;
  document.addEventListener('visibilitychange', onVisibilityChange);

  return feedService;
}

// Create a singleton instance
export const calendarFeedService = createCalendarFeedService();