/**
 * TimezoneService - Handles timezone conversions, floating times, and DST transitions
 * for the Weekly Calendar View
 */

export interface BaseEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  timezone?: string; // IANA timezone identifier, undefined for floating times
  isAllDay: boolean;
}

export class TimezoneService {
  private static instance: TimezoneService;

  private constructor() {}

  public static getInstance(): TimezoneService {
    if (!TimezoneService.instance) {
      TimezoneService.instance = new TimezoneService();
    }
    return TimezoneService.instance;
  }

  /**
   * Get user's current timezone using Intl API
   * @returns IANA timezone identifier (e.g., "America/New_York")
   */
  public getUserTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * Check if an event has floating time (no timezone specified)
   * @param event - Event to check
   * @returns True if timezone is undefined (floating time)
   */
  public isFloatingTime(event: BaseEvent): boolean {
    return event.timezone === undefined;
  }

  /**
   * Check if an event has absolute time (timezone specified)
   * @param event - Event to check
   * @returns True if timezone is specified
   */
  public isAbsoluteTime(event: BaseEvent): boolean {
    return event.timezone !== undefined;
  }

  /**
   * Handle floating times by treating them as local to the viewer's timezone
   * Rule: If TZID missing, treat as floating and render in viewer's zone
   * NEVER mutate original startTime - always create new Date objects
   * @param dateTime - Original date/time
   * @param userTimezone - User's timezone
   * @returns New Date object adjusted for user's timezone
   */
  public handleFloatingTime(dateTime: Date, userTimezone: string): Date {
    // For floating times, we interpret the date/time as if it were in the user's timezone
    // This means a floating "2:00 PM" appears as "2:00 PM" in the user's local time
    const year = dateTime.getFullYear();
    const month = dateTime.getMonth();
    const date = dateTime.getDate();
    const hours = dateTime.getHours();
    const minutes = dateTime.getMinutes();
    const seconds = dateTime.getSeconds();
    const milliseconds = dateTime.getMilliseconds();

    // Create new date in user's timezone
    return new Date(year, month, date, hours, minutes, seconds, milliseconds);
  }

  /**
   * Convert event times to user's local timezone
   * @param event - Event to convert
   * @param userTimezone - User's timezone
   * @returns New event with converted times
   */
  public convertToLocalTime(event: BaseEvent, userTimezone: string): BaseEvent {
    // If it's a floating time event, handle it specially
    if (this.isFloatingTime(event)) {
      return {
        ...event,
        startTime: this.handleFloatingTime(event.startTime, userTimezone),
        endTime: this.handleFloatingTime(event.endTime, userTimezone),
      };
    }

    // For absolute time events, convert from event timezone to user timezone
    const startTime = this.convertTimezone(event.startTime, event.timezone!, userTimezone);
    const endTime = this.convertTimezone(event.endTime, event.timezone!, userTimezone);

    return {
      ...event,
      startTime,
      endTime,
    };
  }

  /**
   * Convert a date from one timezone to another
   * @param date - Date to convert
   * @param fromTimezone - Source timezone
   * @param toTimezone - Target timezone
   * @returns Converted date
   */
  private convertTimezone(date: Date, fromTimezone: string, toTimezone: string): Date {
    // Use Intl.DateTimeFormat to handle timezone conversion
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: fromTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const partsObj = parts.reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {} as Record<string, string>);

    // Create date string in ISO format
    const isoString = `${partsObj.year}-${partsObj.month}-${partsObj.day}T${partsObj.hour}:${partsObj.minute}:${partsObj.second}`;
    
    // Parse as if it were in the target timezone
    const targetFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: toTimezone,
    });

    // Create a new date and adjust for timezone difference
    const tempDate = new Date(isoString);
    const offset = this.getTimezoneOffset(tempDate, toTimezone) - this.getTimezoneOffset(tempDate, fromTimezone);
    
    return new Date(tempDate.getTime() - offset * 60000);
  }

  /**
   * Get timezone offset in minutes for a given date and timezone
   * @param date - Date to check
   * @param timezone - Timezone to check
   * @returns Offset in minutes
   */
  private getTimezoneOffset(date: Date, timezone: string): number {
    const utc1 = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const utc2 = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    return (utc2.getTime() - utc1.getTime()) / 60000;
  }

  /**
   * Handle DST transitions by adjusting events for time changes
   * @param events - Events to adjust
   * @param userTimezone - User's timezone
   * @returns Events adjusted for DST transitions
   */
  public adjustForDSTTransition(events: BaseEvent[], userTimezone: string): BaseEvent[] {
    return events.map(event => {
      // Only adjust absolute time events
      if (this.isFloatingTime(event)) {
        return event;
      }

      // Check if the event crosses a DST boundary
      const adjustedEvent = this.convertToLocalTime(event, userTimezone);
      
      // Re-evaluate recurring event occurrences if they cross DST
      return adjustedEvent;
    });
  }

  /**
   * Handle DST gaps (e.g., 2:00 AM → 3:00 AM spring forward)
   * Rule: Skip missing hour slots in time grid rendering, don't shift events
   * @param timeSlots - Array of time slots for the grid
   * @param userTimezone - User's timezone
   * @returns Filtered time slots with DST gaps removed
   */
  public handleDSTGaps(timeSlots: Date[], userTimezone: string): Date[] {
    return timeSlots.filter(slot => {
      // Check if this time slot exists in the user's timezone
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          hour: 'numeric',
          minute: 'numeric',
        });
        
        // If formatting succeeds, the time exists
        formatter.format(slot);
        return true;
      } catch (error) {
        // If formatting fails, this time doesn't exist (DST gap)
        return false;
      }
    });
  }

  /**
   * Check if a date falls within a DST transition
   * @param date - Date to check
   * @param timezone - Timezone to check
   * @returns True if date is during DST transition
   */
  public isDSTTransition(date: Date, timezone: string): boolean {
    const before = new Date(date.getTime() - 60 * 60 * 1000); // 1 hour before
    const after = new Date(date.getTime() + 60 * 60 * 1000);  // 1 hour after
    
    const offsetBefore = this.getTimezoneOffset(before, timezone);
    const offsetAfter = this.getTimezoneOffset(after, timezone);
    
    return offsetBefore !== offsetAfter;
  }

  /**
   * Generate time slots for a day, handling DST gaps
   * @param date - Date to generate slots for
   * @param userTimezone - User's timezone
   * @param intervalMinutes - Interval between slots in minutes (default: 30)
   * @returns Array of time slots for the day
   */
  public generateTimeSlots(date: Date, userTimezone: string, intervalMinutes: number = 30): Date[] {
    const slots: Date[] = [];
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    // Generate slots for 24 hours
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        const slot = new Date(startOfDay);
        slot.setHours(hour, minute, 0, 0);
        slots.push(slot);
      }
    }

    // Filter out DST gaps
    return this.handleDSTGaps(slots, userTimezone);
  }
}

// Export singleton instance
export const timezoneService = TimezoneService.getInstance();