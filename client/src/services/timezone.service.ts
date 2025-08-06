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
  // Handle non-existent local times during spring-forward
  private normalizeNonexistentLocalTime(date: Date, timezone: string): Date {
    try {
      // Try to convert to UTC and back to detect gaps
      const utc = fromZonedTime(date, timezone);
      const backToLocal = toZonedTime(utc, timezone);
      
      // If the time doesn't match, we hit a DST gap
      if (Math.abs(backToLocal.getTime() - date.getTime()) > 60000) { // More than 1 minute difference
        // Shift forward by 1 hour to get past the gap
        const shifted = addHours(date, 1);
        return toZonedTime(fromZonedTime(shifted, timezone), timezone);
      }
      
      return backToLocal;
    } catch (error) {
      console.warn('Error normalizing nonexistent local time:', error);
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

    try {
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
    } catch (error) {
      console.warn('Error in convertToLocalTimeSafe, falling back to basic conversion:', error);
      return this.convertToLocalTime(event, userTimezone);
    }
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
      
      // Convert to UTC and back to ensure proper timezone handling
      const asUtc = fromZonedTime(interpreted, userTimezone);
      return toZonedTime(asUtc, userTimezone);
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
  validateAllDayEvent<T extends BaseEvent>(event: T, timezone: string): boolean {
    if (!event.isAllDay || !event.startTime || !event.endTime) {
      return true; // Not an all-day event or missing times
    }

    try {
      // Use differenceInCalendarDays to safely handle DST transitions
      const dayDiff = differenceInCalendarDays(event.endTime, event.startTime);
      
      // For all-day events, end should be same day or next day
      return dayDiff >= 0 && dayDiff <= 1;
    } catch (error) {
      console.warn('Error validating all-day event:', error);
      return false;
    }
  }
}

// Create singleton instance
export const timezoneService = new TimezoneServiceImpl();