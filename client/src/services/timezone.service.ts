/**
 * Timezone service for handling timezone conversions and floating time management
 */

import { format, parseISO, addMinutes } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import type { BaseEvent } from '@/types/calendar';

export interface TimezoneService {
  // Convert event times to user's local timezone
  convertToLocalTime(event: BaseEvent, userTimezone: string): BaseEvent;
  
  // Handle floating times (no timezone specified)
  // Rule: If TZID missing, treat as floating and render in viewer's zone
  // NEVER mutate original startTime - always create new Date objects
  handleFloatingTime(dateTime: Date, userTimezone: string): Date;
  
  // DST transition handling
  adjustForDSTTransition(events: BaseEvent[], userTimezone: string): BaseEvent[];
  
  // DST gap handling (e.g., 2:00 AM → 3:00 AM spring forward)
  // Rule: Skip missing hour slots in time grid rendering, don't shift events
  handleDSTGaps(timeSlots: Date[], userTimezone: string): Date[];
  
  // Get user's current timezone
  getUserTimezone(): string; // Uses Intl.DateTimeFormat().resolvedOptions().timeZone
  
  // Distinguish between absolute vs floating time sources
  isFloatingTime(event: BaseEvent): boolean; // True if timezone is undefined
  isAbsoluteTime(event: BaseEvent): boolean; // True if timezone is specified (Google events)
}

export class TimezoneServiceImpl implements TimezoneService {
  // Get user's current timezone
  getUserTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  
  // Convert event times to user's local timezone
  convertToLocalTime(event: BaseEvent, userTimezone: string): BaseEvent {
    // If event has no timezone, treat as floating time
    if (!event.timezone) {
      return {
        ...event,
        startTime: this.handleFloatingTime(event.startTime, userTimezone),
        endTime: this.handleFloatingTime(event.endTime, userTimezone)
      };
    }
    
    // If event timezone is the same as user timezone, no conversion needed
    if (event.timezone === userTimezone) {
      return event;
    }
    
    // Convert from event timezone to user timezone
    const startTime = toZonedTime(fromZonedTime(event.startTime, event.timezone), userTimezone);
    const endTime = toZonedTime(fromZonedTime(event.endTime, event.timezone), userTimezone);
    
    return {
      ...event,
      startTime,
      endTime,
      timezone: userTimezone // Update to user's timezone
    };
  }
  
  // Handle floating times (no timezone specified)
  handleFloatingTime(dateTime: Date, userTimezone: string): Date {
    // Treat the dateTime as if it's already in the user's timezone
    // This means we don't need to convert it, just ensure it's properly formatted
    return toZonedTime(dateTime, userTimezone);
  }
  
  // DST transition handling
  adjustForDSTTransition(events: BaseEvent[], userTimezone: string): BaseEvent[] {
    // For now, we'll just return the events as-is
    // In a more sophisticated implementation, we would:
    // 1. Detect when DST transitions occur in the user's timezone
    // 2. Adjust event times accordingly (e.g., move 2:30 AM to 3:30 AM during spring forward)
    // 3. Handle edge cases like recurring events that cross DST boundaries
    
    return events;
  }
  
  // DST gap handling (e.g., 2:00 AM → 3:00 AM spring forward)
  handleDSTGaps(timeSlots: Date[], userTimezone: string): Date[] {
    // For now, we'll just return the time slots as-is
    // In a more sophisticated implementation, we would:
    // 1. Detect when DST transitions occur in the user's timezone
    // 2. Skip the missing hour slots in time grid rendering
    // 3. Don't shift events during this process
    
    return timeSlots;
  }
  
  // Distinguish between absolute vs floating time sources
  isFloatingTime(event: BaseEvent): boolean {
    return !event.timezone;
  }
  
  isAbsoluteTime(event: BaseEvent): boolean {
    return !!event.timezone;
  }
}

// Create a singleton instance
export const timezoneService = new TimezoneServiceImpl();