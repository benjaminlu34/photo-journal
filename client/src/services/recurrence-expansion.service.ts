/**
 * Recurrence expansion service for handling recurring calendar events
 * Implements RRULE expansion with caching, memory management, and timezone handling
 */

import { RRule, RRuleSet, rrulestr } from 'rrule';
import { LRUCache } from 'lru-cache';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { addWeeks, startOfWeek, endOfWeek } from 'date-fns';
import type { CalendarEvent } from '@/types/calendar';
import { CALENDAR_CONFIG } from '@shared/config/calendar-config';

// Interfaces
interface RecurrenceInstance {
  originalEvent: CalendarEvent;
  instanceStart: Date;
  instanceEnd: Date;
  instanceId: string;
}

interface ExpandedRecurrence {
  instances: RecurrenceInstance[];
  truncated: boolean;
  totalCount: number;
  expandedAt: Date;
  windowStart: Date;
  windowEnd: Date;
}

interface RecurrenceExpansionOptions {
  windowWeeks?: number;
  maxInstances?: number;
  timezone?: string;
  includeExceptions?: boolean;
}

// Cache key generation
interface CacheKey {
  eventId: string;
  rrule: string;
  windowStart: string;
  windowEnd: string;
  timezone?: string;
}

export class RecurrenceExpansionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly eventId?: string
  ) {
    super(message);
    this.name = 'RecurrenceExpansionError';
  }
}

export interface RecurrenceExpansionService {
  // Core expansion methods
  expandRecurringEvent(
    event: CalendarEvent,
    referenceDate: Date,
    options?: RecurrenceExpansionOptions
  ): Promise<RecurrenceInstance[]>;
  
  // Batch expansion for multiple events
  expandMultipleEvents(
    events: CalendarEvent[],
    referenceDate: Date,
    options?: RecurrenceExpansionOptions
  ): Promise<Map<string, RecurrenceInstance[]>>;
  
  // Cache management
  pruneCache(currentWeek: Date): void;
  clearCache(eventId?: string): void;
  getCacheStats(): { size: number; maxSize: number; pruned: number };
  
  // Utility methods
  isRecurringEvent(event: CalendarEvent): boolean;
  parseRRule(rruleString: string): RRule | null;
  validateRecurrenceRule(rruleString: string): boolean;
}

export class RecurrenceExpansionServiceImpl implements RecurrenceExpansionService {
  private readonly MAX_INSTANCES = CALENDAR_CONFIG.FEEDS.MAX_RECURRENCE_INSTANCES;
  private readonly EXPANSION_WINDOW_WEEKS = CALENDAR_CONFIG.FEEDS.EXPANSION_WINDOW_WEEKS;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  // Aggregate cap across expandMultipleEvents results
  private readonly AGGREGATE_MAX_INSTANCES = 5000;
  
  // LRU cache for expanded recurrences with memory management
  private readonly expansionCache = new LRUCache<string, ExpandedRecurrence>({
    max: 200, // Maximum 200 expanded recurrences cached
    ttl: this.CACHE_TTL,
    updateAgeOnGet: true,
    updateAgeOnHas: true,
    // Custom disposal to track memory usage
    dispose: (value, key) => {
      this.prunedCount++;
    },
  });
  
  private prunedCount = 0;
  
  // Core expansion methods
  async expandRecurringEvent(
    event: CalendarEvent,
    referenceDate: Date,
    options: RecurrenceExpansionOptions = {}
  ): Promise<RecurrenceInstance[]> {
    if (!this.isRecurringEvent(event)) {
      return [];
    }
    
    const {
      windowWeeks = this.EXPANSION_WINDOW_WEEKS,
      maxInstances = this.MAX_INSTANCES,
      timezone = event.timezone,
      includeExceptions = true,
    } = options;
    
    // Calculate expansion window
    const windowStart = startOfWeek(addWeeks(referenceDate, -windowWeeks));
    const windowEnd = endOfWeek(addWeeks(referenceDate, windowWeeks));
    
    // Check cache first
    const cacheKey = this.generateCacheKey(event, windowStart, windowEnd, timezone);
    const cached = this.expansionCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached, windowStart, windowEnd)) {
      return cached.instances;
    }
    
    try {
      // Parse the recurrence rule
      const rrule = this.parseRRule(event.recurrenceRule!);
      if (!rrule) {
        throw new RecurrenceExpansionError(
          'Invalid recurrence rule',
          'INVALID_RRULE',
          event.id
        );
      }
      
      // Expand the recurrence within the window
      const instances = this.expandRRule(
        event,
        rrule,
        windowStart,
        windowEnd,
        maxInstances,
        timezone
      );
      
      // Handle exceptions (EXDATE) if needed
      const finalInstances = includeExceptions 
        ? this.applyExceptions(instances, event)
        : instances;
      
      // Check for truncation (instances were limited to maxInstances)
      const truncated = instances.length >= maxInstances;
      
      // Cache the results
      const expandedRecurrence: ExpandedRecurrence = {
        instances: finalInstances,
        truncated,
        totalCount: instances.length,
        expandedAt: new Date(),
        windowStart,
        windowEnd,
      };
      
      this.expansionCache.set(cacheKey, expandedRecurrence);
      
      return finalInstances;
    } catch (error) {
      if (error instanceof RecurrenceExpansionError) {
        throw error;
      }
      
      throw new RecurrenceExpansionError(
        `Failed to expand recurrence: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXPANSION_FAILED',
        event.id
      );
    }
  }
  
  async expandMultipleEvents(
    events: CalendarEvent[],
    referenceDate: Date,
    options: RecurrenceExpansionOptions = {}
  ): Promise<Map<string, RecurrenceInstance[]>> {
    const results = new Map<string, RecurrenceInstance[]>();

    // Filter to only recurring events
    const recurringEvents = events.filter(event => this.isRecurringEvent(event));

    // Expand each event (could be parallelized for better performance)
    const expansionPromises = recurringEvents.map(async (event) => {
      try {
        const instances = await this.expandRecurringEvent(event, referenceDate, options);
        return { eventId: event.id, instances };
      } catch (error) {
        console.error(`Failed to expand event ${event.id}:`, error);
        return { eventId: event.id, instances: [] };
      }
    });

    const expansionResults = await Promise.all(expansionPromises);

    // Enforce aggregate cap across all expanded results (truncate deterministically by input order)
    let total = 0;
    let truncated = false;

    for (const { eventId, instances } of expansionResults) {
      const remaining = this.AGGREGATE_MAX_INSTANCES - total;
      if (remaining <= 0) {
        // No capacity left
        results.set(eventId, []);
        truncated = true;
        continue;
      }

      const sliced = instances.slice(0, remaining);
      total += sliced.length;

      if (sliced.length < instances.length) {
        truncated = true;
      }

      results.set(eventId, sliced);
    }

    if (truncated) {
      console.warn(
        `Aggregate recurrence instances exceeded ${this.AGGREGATE_MAX_INSTANCES}. Results truncated.`
      );
    }

    return results;
  }
  
  // Cache management
  pruneCache(currentWeek: Date): void {
    const currentWindowStart = startOfWeek(addWeeks(currentWeek, -this.EXPANSION_WINDOW_WEEKS));
    const currentWindowEnd = endOfWeek(addWeeks(currentWeek, this.EXPANSION_WINDOW_WEEKS));
    
    // Remove cache entries that are outside the current window
    for (const [key, value] of this.expansionCache.entries()) {
      if (value.windowEnd < currentWindowStart || value.windowStart > currentWindowEnd) {
        this.expansionCache.delete(key);
      }
    }
  }
  
  clearCache(eventId?: string): void {
    if (eventId) {
      // FIXED: Safely parse JSON cache keys to check eventId
      for (const key of this.expansionCache.keys()) {
        try {
          const parsedKey: CacheKey = JSON.parse(key);
          if (parsedKey.eventId === eventId) {
            this.expansionCache.delete(key);
          }
        } catch (error) {
          // Skip invalid JSON keys
          console.warn('Failed to parse cache key:', key, error);
        }
      }
    } else {
      // Clear all cache
      this.expansionCache.clear();
    }
  }
  
  getCacheStats(): { size: number; maxSize: number; pruned: number } {
    return {
      size: this.expansionCache.size,
      maxSize: this.expansionCache.max,
      pruned: this.prunedCount,
    };
  }
  
  // Utility methods
  isRecurringEvent(event: CalendarEvent): boolean {
    return event.isRecurring && !!event.recurrenceRule;
  }
  
  parseRRule(rruleString: string): RRule | null {
    try {
      // Handle different RRULE formats
      if (rruleString.startsWith('RRULE:')) {
        return rrulestr(rruleString);
      } else {
        return rrulestr(`RRULE:${rruleString}`);
      }
    } catch (error) {
      console.error('Failed to parse RRULE:', rruleString, error);
      return null;
    }
  }
  
  validateRecurrenceRule(rruleString: string): boolean {
    try {
      const rrule = this.parseRRule(rruleString);
      return rrule !== null;
    } catch {
      return false;
    }
  }
  
  // Private helper methods
  private expandRRule(
    event: CalendarEvent,
    rrule: RRule,
    windowStart: Date,
    windowEnd: Date,
    maxInstances: number,
    timezone?: string
  ): RecurrenceInstance[] {
    const instances: RecurrenceInstance[] = [];
    
    // Get the original event duration
    const originalDuration = event.endTime.getTime() - event.startTime.getTime();
    
    // Handle timezone conversion for the expansion window
    const expandStart = timezone 
      ? fromZonedTime(windowStart, timezone)
      : windowStart;
    const expandEnd = timezone 
      ? fromZonedTime(windowEnd, timezone)
      : windowEnd;
    
    // Get occurrences within the window
    const occurrences = rrule.between(expandStart, expandEnd, true);
    
    // FIXED: Check for excessive instances before processing
    if (occurrences.length > 5000) {
      console.warn(`Event ${event.id} has ${occurrences.length} instances, aborting expansion`);
      throw new RecurrenceExpansionError(
        'Too many recurrence instances',
        'TOO_MANY_INSTANCES',
        event.id
      );
    }
    
    // Limit the number of instances to prevent memory issues
    const limitedOccurrences = occurrences.slice(0, maxInstances);
    
    for (let i = 0; i < limitedOccurrences.length; i++) {
      const occurrence = limitedOccurrences[i];
      
      // Handle timezone conversion for each occurrence
      const instanceStart = timezone 
        ? toZonedTime(occurrence, timezone)
        : occurrence;
      
      const instanceEnd = new Date(instanceStart.getTime() + originalDuration);
      
      // Handle DST transitions
      const adjustedTimes = this.handleDSTTransition(
        instanceStart,
        instanceEnd,
        event.startTime,
        timezone
      );
      
      const instance: RecurrenceInstance = {
        originalEvent: event,
        instanceStart: adjustedTimes.start,
        instanceEnd: adjustedTimes.end,
        instanceId: `${event.id}:${occurrence.toISOString()}`,
      };
      
      instances.push(instance);
    }
    
    return instances;
  }
  
  private applyExceptions(
    instances: RecurrenceInstance[],
    event: CalendarEvent
  ): RecurrenceInstance[] {
    try {
      const exdates = event.exceptionDates ?? [];

      if (!exdates || exdates.length === 0) {
        return instances;
      }

      const isAllDay = !!event.isAllDay;

      // Build fast-lookup set of normalized EXDATE keys
      const exdateKeys = new Set<string>(
        exdates
          .filter(d => d instanceof Date && !isNaN(d.getTime()))
          .map(d => this.getExceptionKey(d, isAllDay))
      );

      if (exdateKeys.size === 0) {
        return instances;
      }

      // Filter out instances whose start matches an EXDATE
      const filtered = instances.filter(inst => {
        const key = this.getExceptionKey(inst.instanceStart, isAllDay);
        return !exdateKeys.has(key);
      });

      return filtered;
    } catch (error) {
      console.warn('Failed to apply EXDATE exceptions, returning unfiltered instances:', error);
      return instances;
    }
  }
  
  private handleDSTTransition(
    instanceStart: Date,
    instanceEnd: Date,
    originalStart: Date,
    timezone?: string
  ): { start: Date; end: Date } {
    if (!timezone) {
      return { start: instanceStart, end: instanceEnd };
    }
    
    try {
      // FIXED: Use timezone-aware offset calculation instead of browser's local timezone
      const originalOffset = this.getTimezoneOffset(originalStart, timezone);
      const instanceOffset = this.getTimezoneOffset(instanceStart, timezone);
      
      if (originalOffset !== instanceOffset) {
        // DST transition detected - adjust times to maintain the same local time
        const offsetDiff = (instanceOffset - originalOffset) * 60 * 1000;
        
        return {
          start: new Date(instanceStart.getTime() - offsetDiff),
          end: new Date(instanceEnd.getTime() - offsetDiff),
        };
      }
      
      return { start: instanceStart, end: instanceEnd };
    } catch (error) {
      console.warn('Failed to handle DST transition:', error);
      return { start: instanceStart, end: instanceEnd };
    }
  }

  /**
   * Get timezone offset for a specific date in a given timezone
   * Uses Intl.DateTimeFormat to get accurate timezone-specific offset
   */
  private getTimezoneOffset(date: Date, timezone: string): number {
    try {
      // Create a date formatter for the specific timezone
      const formatter = new Intl.DateTimeFormat('en', {
        timeZone: timezone,
        timeZoneName: 'longOffset'
      });
      
      // Get the timezone offset string (e.g., "GMT+05:30" or "GMT-08:00")
      const parts = formatter.formatToParts(date);
      const offsetPart = parts.find(part => part.type === 'timeZoneName');
      
      if (!offsetPart || !offsetPart.value.startsWith('GMT')) {
        // Fallback to UTC offset calculation
        return this.calculateUTCOffset(date, timezone);
      }
      
      // Parse the offset string (e.g., "GMT+05:30" -> +330 minutes)
      const offsetString = offsetPart.value.slice(3); // Remove "GMT"
      const sign = offsetString.startsWith('+') ? 1 : -1;
      const [hours, minutes = '0'] = offsetString.slice(1).split(':');
      
      return sign * (parseInt(hours, 10) * 60 + parseInt(minutes, 10));
    } catch (error) {
      console.warn(`Failed to get timezone offset for ${timezone}:`, error);
      // Fallback to browser's local timezone offset
      return -date.getTimezoneOffset();
    }
  }

  /**
   * Fallback method to calculate UTC offset using date comparison
   */
  private calculateUTCOffset(date: Date, timezone: string): number {
    try {
      // Create dates in both UTC and the target timezone
      const utcDate = new Date(date.toISOString());
      const zonedDate = toZonedTime(utcDate, timezone);
      
      // Calculate the difference in minutes
      const offsetMs = zonedDate.getTime() - utcDate.getTime();
      return Math.round(offsetMs / (60 * 1000));
    } catch (error) {
      console.warn(`Failed to calculate UTC offset for ${timezone}:`, error);
      // Final fallback to browser's local timezone
      return -date.getTimezoneOffset();
    }
  }
  
/**
   * Normalize a date to a comparison key for EXDATE matching.
   * - All-day events: compare by local calendar day (YYYY-MM-DD in ISO)
   * - Timed events: compare by exact timestamp in ISO
   */
  private getExceptionKey(date: Date, isAllDay: boolean): string {
    if (isAllDay) {
      // Compare by day only
      return date.toISOString().slice(0, 10); // YYYY-MM-DD
    }
    return date.toISOString();
  }
  private generateCacheKey(
    event: CalendarEvent,
    windowStart: Date,
    windowEnd: Date,
    timezone?: string
  ): string {
    const keyData: CacheKey = {
      eventId: event.id,
      rrule: event.recurrenceRule!,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      timezone,
    };
    
    return JSON.stringify(keyData);
  }
  
  private isCacheValid(
    cached: ExpandedRecurrence,
    windowStart: Date,
    windowEnd: Date
  ): boolean {
    // Check if the cached window covers the requested window
    return cached.windowStart <= windowStart && cached.windowEnd >= windowEnd;
  }
}

// Create a singleton instance
export const recurrenceExpansionService = new RecurrenceExpansionServiceImpl();