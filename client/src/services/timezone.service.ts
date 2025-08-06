/**
 * Timezone service for handling timezone conversions and DST transitions
 * Enhanced with explicit DST gap and ambiguity handling.
 */

import type { BaseEvent } from '@/types/calendar';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { addHours, differenceInCalendarDays } from 'date-fns';

export interface TimezoneService {
  // Convert event times to user's local timezone
  convertToLocalTime<T extends BaseEvent>(event: T, userTimezone: string): T;

  // Safe wrapper for convertToLocalTime with DST handling
  convertToLocalTimeSafe<T extends BaseEvent>(event: T, userTimezone: string): T;

  // Convert absolute Date object to user's local time safely
  convertAbsoluteDateToLocal(absoluteDate: Date, userTimezone: string): Date;

  // Handle floating times (no timezone specified)
  handleFloatingTime(dateTime: Date, userTimezone: string): Date;

  // DST transition handling
  adjustForDSTTransition<T extends BaseEvent>(events: T[], userTimezone: string): T[];

  // DST gap handling (e.g., 2:00 AM → 3:00 AM spring forward)
  handleDSTGaps(timeSlots: Date[], userTimezone: string): Date[];

  // Get user's current timezone
  getUserTimezone(): string;

  // Distinguish between absolute vs floating time sources
  isFloatingTime<T extends BaseEvent>(event: T): boolean;
  isAbsoluteTime<T extends BaseEvent>(event: T): boolean;

  // All-day event utilities
  getLocalDayBounds(date: Date, timezone: string): { start: Date; end: Date };
  validateAllDayEvent<T extends BaseEvent>(event: T, timezone: string): boolean;
}

export class TimezoneServiceImpl implements TimezoneService {
  // Handle non-existent and ambiguous local times across DST transitions
  // Strategy:
  // - For nonexistent times (spring-forward gap): shift forward by 1 hour
  // - For ambiguous times (fall-back overlap): prefer earliest occurrence (configurable if needed)
  private normalizeNonexistentLocalTime(date: Date, timezone: string): Date {
    const ONE_MINUTE_IN_MS = 60_000;
    try {
      // Round-trip to detect DST gaps
      const utc = fromZonedTime(date, timezone);
      const backToLocal = toZonedTime(utc, timezone);

      // If the time doesn't match after round-trip by > 1 minute, treat as nonexistent time
      if (Math.abs(backToLocal.getTime() - date.getTime()) > ONE_MINUTE_IN_MS) {
        // Shift forward by 1 hour to get past the gap and round-trip again
        const shifted = addHours(date, 1);
        const shiftedUtc = fromZonedTime(shifted, timezone);
        return toZonedTime(shiftedUtc, timezone);
      }

      // For ambiguous times, date-fns-tz will pick the first occurrence by default.
      // We keep this as the default behavior (earliest). If a "latest" strategy is needed
      // in the future, we can extend this method to accept a strategy parameter.
      return backToLocal;
    } catch (error) {
      // Propagate RangeError details upward for caller-specific handling if needed,
      // but return the original date as a conservative fallback to avoid crashing.
      console.warn('Error normalizing local time (DST handling):', error);
      return date;
    }
  }

  // Convert absolute Date object to user's local time safely
  convertAbsoluteDateToLocal(absoluteDate: Date, userTimezone: string): Date {
    try {
      // absoluteDate is already a proper Date object representing an absolute moment in time
      // We need to convert this absolute moment to the user's local timezone
      return toZonedTime(absoluteDate, userTimezone);
    } catch (error) {
      console.warn('Error converting absolute date to local time:', error);
      return absoluteDate;
    }
  }

  // Safe wrapper for convertToLocalTime with DST handling
  convertToLocalTimeSafe<T extends BaseEvent>(event: T, userTimezone: string): T {
    if (!event.startTime || !event.endTime) return event;

    // For floating times, use enhanced floating time handling
    if (!event.timezone) {
      return {
        ...event,
        startTime: this.handleFloatingTime(event.startTime, userTimezone),
        endTime: this.handleFloatingTime(event.endTime, userTimezone),
        timezone: userTimezone,
      };
    }

    // Always use safe conversion when timezone is present, even if same as user timezone
    // This ensures DST gaps and ambiguities are handled properly
    const startUtc = fromZonedTime(event.startTime, event.timezone);
    const endUtc = fromZonedTime(event.endTime, event.timezone);

    const startLocal = this.normalizeNonexistentLocalTime(
      toZonedTime(startUtc, userTimezone),
      userTimezone
    );
    const endLocal = this.normalizeNonexistentLocalTime(
      toZonedTime(endUtc, userTimezone),
      userTimezone
    );

    return {
      ...event,
      startTime: startLocal,
      endTime: endLocal,
      timezone: userTimezone,
    };
  }

  // Convert event times to user's local timezone
  convertToLocalTime<T extends BaseEvent>(event: T, userTimezone: string): T {
    if (!event.startTime || !event.endTime) return event;

    // Floating time: interpret wall-clock time in userTimezone
    if (!event.timezone) {
      return {
        ...event,
        startTime: this.handleFloatingTime(event.startTime, userTimezone),
        endTime: this.handleFloatingTime(event.endTime, userTimezone),
      };
    }

    // If event timezone matches user timezone, no conversion needed
    if (event.timezone === userTimezone) {
      return event;
    }

    // Treat event.startTime/endTime as absolute instants in their declared timezone,
    // convert to userTimezone for display.
    const startAsZoned = toZonedTime(
      fromZonedTime(event.startTime, event.timezone),
      userTimezone
    );
    const endAsZoned = toZonedTime(
      fromZonedTime(event.endTime, event.timezone),
      userTimezone
    );

    return {
      ...event,
      startTime: startAsZoned,
      endTime: endAsZoned,
      timezone: userTimezone,
    };
  }

  // Handle floating times (no timezone specified) with DST awareness
  handleFloatingTime(dateTime: Date, userTimezone: string): Date {
    try {
      // Interpret the naive wall-clock time components in the specified timezone
      const y = dateTime.getFullYear();
      const m = dateTime.getMonth();
      const d = dateTime.getDate();
      const hh = dateTime.getHours();
      const mm = dateTime.getMinutes();
      const ss = dateTime.getSeconds();
      const ms = dateTime.getMilliseconds();

      // Build a Date with same local components
      const naiveLocal = new Date(y, m, d, hh, mm, ss, ms);

      // Handle potential DST gaps/ambiguities when interpreting floating time
      const interpreted = this.normalizeNonexistentLocalTime(naiveLocal, userTimezone);
      // normalizeNonexistentLocalTime already returns a correctly zoned Date.
      // Additional round-trips are unnecessary.
      return interpreted;
    } catch (error) {
      console.warn('Error handling floating time, using fallback:', error);
      // Fallback to original implementation
      const naiveLocal = new Date(
        dateTime.getFullYear(), dateTime.getMonth(), dateTime.getDate(),
        dateTime.getHours(), dateTime.getMinutes(), dateTime.getSeconds(), dateTime.getMilliseconds()
      );
      const asUtc = fromZonedTime(naiveLocal, userTimezone);
      return toZonedTime(asUtc, userTimezone);
    }
  }

  // DST transition handling
  adjustForDSTTransition<T extends BaseEvent>(events: T[], userTimezone: string): T[] {
    // With date-fns-tz, conversions already account for DST transitions.
    // Return events unchanged to avoid double-adjustments.
    return events;
  }

  // DST gap handling
  handleDSTGaps(timeSlots: Date[], userTimezone: string): Date[] {
    // date-fns-tz handles invalid local times via conversion.
    // Keep slots as-is; consumer code can validate if needed.
    return timeSlots.map((slot) => toZonedTime(fromZonedTime(slot, userTimezone), userTimezone));
  }

  // Get user's current timezone
  getUserTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
      console.warn('Failed to get user timezone, falling back to UTC:', error);
      return 'UTC';
    }
  }

  isFloatingTime<T extends BaseEvent>(event: T): boolean {
    return !event.timezone;
  }

  isAbsoluteTime<T extends BaseEvent>(event: T): boolean {
    return Boolean(event.timezone);
  }

  // Get local day boundaries for all-day events
  getLocalDayBounds(date: Date, timezone: string): { start: Date; end: Date } {
    try {
      // Create start of day in the target timezone
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
      
      // Handle potential DST transitions at midnight
      const start = this.normalizeNonexistentLocalTime(startOfDay, timezone);
      const end = this.normalizeNonexistentLocalTime(endOfDay, timezone);
      
      return { start, end };
    } catch (error) {
      console.warn('Error getting local day bounds:', error);
      // Fallback to simple day boundaries
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
  }

  // Validate that all-day events don't cross date boundaries
  // Stricter rule:
  // - A single-day all-day event must begin and end on the same calendar day (dayDiff === 0).
  // If callers use an exclusive end (e.g., Google all-day with end.date = next day 00:00),
  // they should pre-adjust to an inclusive end (e.g., subtract 1 ms) before validation.
  validateAllDayEvent<T extends BaseEvent>(event: T, timezone: string): boolean {
    if (!event.isAllDay || !event.startTime || !event.endTime) {
      return true; // Not an all-day event or missing times
    }

    try {
      const dayDiff = differenceInCalendarDays(event.endTime, event.startTime);
      return dayDiff === 0;
    } catch (error) {
      console.warn('Error validating all-day event:', error);
      return false;
    }
  }
}

// Create singleton instance
export const timezoneService = new TimezoneServiceImpl();