/**
 * Calendar feed service for handling external calendar integration
 */

import type { CalendarEvent, CalendarFeed } from '@/types/calendar';

export interface CalendarFeedService {
  // Fetch events from a calendar feed
  fetchFeedEvents(feed: CalendarFeed): Promise<CalendarEvent[]>;
  
  // Validate iCal URL with length limits (prevent DoS)
  validateICalUrl(url: string): boolean;
  
  // Validate iCal content
  validateICalContent(content: string): boolean;
  
  // Sanitize HTML in descriptions
  sanitizeDescription(description: string): string;
  
  // Validate date ranges
  validateDateRange(start: Date, end: Date): boolean;
}

export class CalendarFeedServiceImpl implements CalendarFeedService {
  private readonly MAX_FEED_SIZE = 10 * 1024 * 1024; // 10MB max feed size
  private readonly VALID_URL_PATTERN = /^https?:\/\/.+/;
  
  // Fetch events from a calendar feed
  async fetchFeedEvents(feed: CalendarFeed): Promise<CalendarEvent[]> {
    try {
      // In a real implementation, this would:
      // 1. For iCal feeds: Fetch the .ics file from the URL
      // 2. For Google Calendar: Use OAuth to access the Google Calendar API
      // 3. Parse the events using a library like ical.js
      // 4. Convert to our CalendarEvent format
      // 5. Handle recurring events, timezones, etc.
      
      // For now, we'll return an empty array to demonstrate the structure
      console.log(`Fetching events for feed: ${feed.name}`);
      return [];
    } catch (error) {
      console.error(`Failed to fetch events for feed ${feed.name}:`, error);
      throw error;
    }
  }
  
  // Validate iCal URL with length limits (prevent DoS)
  validateICalUrl(url: string): boolean {
    // Check if URL is valid and within size limits
    return this.VALID_URL_PATTERN.test(url) && url.length <= 2048;
  }
  
  // Validate iCal content
  validateICalContent(content: string): boolean {
    // Check if content is within size limits and has basic iCal structure
    return content.length <= this.MAX_FEED_SIZE && 
           (content.includes('BEGIN:VCALENDAR') && content.includes('END:VCALENDAR'));
  }
  
  // Sanitize HTML in descriptions
  sanitizeDescription(description: string): string {
    // In a real implementation, this would use a library like DOMPurify
    // For now, we'll do basic sanitization
    if (!description) return '';
    
    // Remove script tags and other dangerous elements
    return description
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/on\w+=\w+/gi, '');
  }
  
  // Validate date ranges
  validateDateRange(start: Date, end: Date): boolean {
    // Check if dates are valid and in the correct order
    return start instanceof Date && 
           end instanceof Date && 
           !isNaN(start.getTime()) && 
           !isNaN(end.getTime()) && 
           start <= end;
  }
}

// Create a singleton instance
export const calendarFeedService = new CalendarFeedServiceImpl();