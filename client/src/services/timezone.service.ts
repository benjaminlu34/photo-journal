/**
 * Timezone service for timezone conversions and DST transitions.
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
  // Handle non-existent (spring-forward) and ambiguous (fall-back) local times
  private normalizeNonexistentLocalTime(date: Date, timezone: string): Date {
    const ONE_MINUTE_IN_MS = 60_000;
    try {
      // Round-trip to detect DST gaps
      const utc = fromZonedTime(date, timezone);
      const backToLocal = toZonedTime(utc, timezone);

      // If mismatch > 1 minute, treat as nonexistent time
      if (Math.abs(backToLocal.getTime() - date.getTime()) > ONE_MINUTE_IN_MS) {
        // Shift forward by 1 hour and round-trip again
        const shifted = addHours(date, 1);
        const shiftedUtc = fromZonedTime(shifted, timezone);
        return toZonedTime(shiftedUtc, timezone);
      }

      // Ambiguous times: use earliest occurrence (date-fns-tz default)
      return backToLocal;
    } catch (error) {
      console.warn('Error normalizing local time (DST handling):', error);
      return date;
    }
  }

  // Convert an absolute Date to user's local time
  convertAbsoluteDateToLocal(absoluteDate: Date, userTimezone: string): Date {
    try {
      return toZonedTime(absoluteDate, userTimezone);
    } catch (error) {
      console.warn('Error converting absolute date to local time:', error);
      return absoluteDate;
    }
  }

  // Safe conversion with DST handling
  convertToLocalTimeSafe<T extends BaseEvent>(event: T, userTimezone: string): T {
    if (!event.startTime || !event.endTime) return event;

    // Floating times
    if (!event.timezone) {
      return {
        ...event,
        startTime: this.handleFloatingTime(event.startTime, userTimezone),
        endTime: this.handleFloatingTime(event.endTime, userTimezone),
        timezone: userTimezone,
      };
    }

    // Zoned times
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

  // Convert event times to user's local timezone (non-safe)
  convertToLocalTime<T extends BaseEvent>(event: T, userTimezone: string): T {
    if (!event.startTime || !event.endTime) return event;

    // Floating time
    if (!event.timezone) {
      return {
        ...event,
        startTime: this.handleFloatingTime(event.startTime, userTimezone),
        endTime: this.handleFloatingTime(event.endTime, userTimezone),
      };
    }

    // Same timezone
    if (event.timezone === userTimezone) {
      return event;
    }

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

  // Handle floating times with DST awareness
  handleFloatingTime(dateTime: Date, userTimezone: string): Date {
    try {
      const y = dateTime.getFullYear();
      const m = dateTime.getMonth();
      const d = dateTime.getDate();
      const hh = dateTime.getHours();
      const mm = dateTime.getMinutes();
      const ss = dateTime.getSeconds();
      const ms = dateTime.getMilliseconds();

      const naiveLocal = new Date(y, m, d, hh, mm, ss, ms);

      // Normalize for DST gaps/ambiguities
      const interpreted = this.normalizeNonexistentLocalTime(naiveLocal, userTimezone);
      return interpreted;
    } catch (error) {
      console.warn('Error handling floating time, using fallback:', error);
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

  // Local day boundaries for all-day events
  getLocalDayBounds(date: Date, timezone: string): { start: Date; end: Date } {
    try {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
      
      const start = this.normalizeNonexistentLocalTime(startOfDay, timezone);
      const end = this.normalizeNonexistentLocalTime(endOfDay, timezone);
      
      return { start, end };
    } catch (error) {
      console.warn('Error getting local day bounds:', error);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
  }

  // Validate single-day all-day events: must start and end on same calendar day
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