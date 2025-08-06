/**
 * Timezone service for handling timezone conversions and DST transitions
 * Refactored to use date-fns-tz for reliable timezone handling.
 */

import type { BaseEvent } from '@/types/calendar';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export interface TimezoneService {
  // Convert event times to user's local timezone
  convertToLocalTime<T extends BaseEvent>(event: T, userTimezone: string): T;

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
}

export class TimezoneServiceImpl implements TimezoneService {
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

  // Handle floating times (no timezone specified)
  handleFloatingTime(dateTime: Date, userTimezone: string): Date {
    // Interpret the naive wall-clock time components in the specified timezone
    // by constructing a UTC instant from those components in userTimezone, then
    // converting to a Date in that zone for consistent display.
    const y = dateTime.getFullYear();
    const m = dateTime.getMonth();
    const d = dateTime.getDate();
    const hh = dateTime.getHours();
    const mm = dateTime.getMinutes();
    const ss = dateTime.getSeconds();
    const ms = dateTime.getMilliseconds();

    // Build a Date with same local components in the current environment
    const naiveLocal = new Date(y, m, d, hh, mm, ss, ms);

    // Convert "wall time in userTimezone" to a UTC instant,
    // then back to a Date adjusted for userTimezone.
    const asUtc = fromZonedTime(naiveLocal, userTimezone);
    return toZonedTime(asUtc, userTimezone);
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
}

// Create singleton instance
export const timezoneService = new TimezoneServiceImpl();