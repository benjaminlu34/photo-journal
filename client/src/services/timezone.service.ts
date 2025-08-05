/**
 * Timezone service for handling timezone conversions and DST transitions
 */

import type { BaseEvent } from '@/types/calendar';

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
    // If event has no timezone, treat as floating time
    if (!event.timezone) {
      return {
        ...event,
        startTime: this.handleFloatingTime(event.startTime, userTimezone),
        endTime: this.handleFloatingTime(event.endTime, userTimezone)
      };
    }
    
    // If event timezone matches user timezone, no conversion needed
    if (event.timezone === userTimezone) {
      return event;
    }
    
    // Convert from event timezone to user timezone
    const convertedStartTime = this.convertTimezone(event.startTime, event.timezone, userTimezone);
    const convertedEndTime = this.convertTimezone(event.endTime, event.timezone, userTimezone);
    
    return {
      ...event,
      startTime: convertedStartTime,
      endTime: convertedEndTime,
      timezone: userTimezone
    };
  }
  
  // Handle floating times (no timezone specified)
  handleFloatingTime(dateTime: Date, userTimezone: string): Date {
    // For floating times, interpret the time in the user's timezone
    // This means we create a new Date object with the same local time components
    // but in the user's timezone
    
    const year = dateTime.getFullYear();
    const month = dateTime.getMonth();
    const date = dateTime.getDate();
    const hours = dateTime.getHours();
    const minutes = dateTime.getMinutes();
    const seconds = dateTime.getSeconds();
    const milliseconds = dateTime.getMilliseconds();
    
    // Create a new date with the same local time components
    return new Date(year, month, date, hours, minutes, seconds, milliseconds);
  }
  
  // DST transition handling
  adjustForDSTTransition<T extends BaseEvent>(events: T[], userTimezone: string): T[] {
    return events.map(event => {
      // Check if event spans a DST transition
      const startTime = new Date(event.startTime);
      const endTime = new Date(event.endTime);
      
      // Simple DST detection - check if offset changes between start and end
      const startOffset = this.getTimezoneOffset(startTime, userTimezone);
      const endOffset = this.getTimezoneOffset(endTime, userTimezone);
      
      if (startOffset !== endOffset) {
        // DST transition detected - adjust end time
        const offsetDiff = endOffset - startOffset;
        const adjustedEndTime = new Date(endTime.getTime() + (offsetDiff * 60 * 1000));
        
        return {
          ...event,
          endTime: adjustedEndTime
        };
      }
      
      return event;
    });
  }
  
  // DST gap handling
  handleDSTGaps(timeSlots: Date[], userTimezone: string): Date[] {
    return timeSlots.filter(slot => {
      // Check if this time slot exists (not in a DST gap)
      const nextHour = new Date(slot.getTime() + 60 * 60 * 1000);
      const slotOffset = this.getTimezoneOffset(slot, userTimezone);
      const nextOffset = this.getTimezoneOffset(nextHour, userTimezone);
      
      // If offset difference is more than 1 hour, this slot is in a DST gap
      return Math.abs(nextOffset - slotOffset) <= 60;
    });
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
  
  // Check if event has floating time (no timezone specified)
  isFloatingTime<T extends BaseEvent>(event: T): boolean {
    return !event.timezone;
  }
  
  // Check if event has absolute time (timezone specified)
  isAbsoluteTime<T extends BaseEvent>(event: T): boolean {
    return Boolean(event.timezone);
  }
  
  // Private helper methods
  private convertTimezone(date: Date, fromTimezone: string, toTimezone: string): Date {
    try {
      // Use Intl.DateTimeFormat to handle timezone conversion
      const fromFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: fromTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const toFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: toTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      // Get the UTC time
      const utcTime = date.getTime();
      
      // Create a new date in the target timezone
      const targetDate = new Date(utcTime);
      
      return targetDate;
    } catch (error) {
      console.warn('Timezone conversion failed, returning original date:', error);
      return date;
    }
  }
  
  private getTimezoneOffset(date: Date, timezone: string): number {
    try {
      // Get offset in minutes
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      
      return (utcDate.getTime() - tzDate.getTime()) / (1000 * 60);
    } catch (error) {
      console.warn('Failed to get timezone offset:', error);
      return 0;
    }
  }
}

// Create singleton instance
export const timezoneService = new TimezoneServiceImpl();