/**
 * Calendar event validation and sanitization utilities
 */

import { CALENDAR_CONFIG } from '@shared/config/calendar-config';
import type { BaseEvent, LocalEvent, CalendarEvent } from '@/types/calendar';
import { timezoneService } from '@/services/timezone.service';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface SanitizedEventData {
  title: string;
  description?: string;
  location?: string;
  attendees?: string[];
  tags?: string[];
}

/**
 * Validates a base event structure
 */
export function validateBaseEvent(event: Partial<BaseEvent>): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!event.title || typeof event.title !== 'string') {
    errors.push('Title is required and must be a string');
  } else if (event.title.length > CALENDAR_CONFIG.EVENTS.MAX_TITLE_LENGTH) {
    errors.push(`Title must be ${CALENDAR_CONFIG.EVENTS.MAX_TITLE_LENGTH} characters or less`);
  }

  if (!event.startTime || !(event.startTime instanceof Date)) {
    errors.push('Start time is required and must be a valid Date');
  }

  if (!event.endTime || !(event.endTime instanceof Date)) {
    errors.push('End time is required and must be a valid Date');
  }

  // Validate date range
  if (event.startTime && event.endTime && event.startTime instanceof Date && event.endTime instanceof Date) {
    if (event.startTime >= event.endTime) {
      errors.push('End time must be after start time');
    }

    const durationMinutes = (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60);
    if (durationMinutes < CALENDAR_CONFIG.EVENTS.MIN_DURATION) {
      errors.push(`Event duration must be at least ${CALENDAR_CONFIG.EVENTS.MIN_DURATION} minutes`);
    }
  }

  // Validate timezone if provided
  if (event.timezone && typeof event.timezone !== 'string') {
    errors.push('Timezone must be a valid IANA timezone string');
  }

  // Validate color
  if (event.color && (typeof event.color !== 'string' || !isValidColor(event.color))) {
    errors.push('Color must be a valid hex color string');
  }

  // Validate pattern for accessibility
  if (event.pattern && !['stripe', 'dot', 'plain'].includes(event.pattern)) {
    errors.push('Pattern must be one of: stripe, dot, plain');
  }

  // Validate description length
  if (event.description && event.description.length > CALENDAR_CONFIG.EVENTS.MAX_DESCRIPTION_LENGTH) {
    errors.push(`Description must be ${CALENDAR_CONFIG.EVENTS.MAX_DESCRIPTION_LENGTH} characters or less`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates a local event structure
 */
export function validateLocalEvent(event: Partial<LocalEvent>): ValidationResult {
  const baseValidation = validateBaseEvent(event);
  const errors = [...baseValidation.errors];

  // Validate local event specific fields
  if (!event.createdBy || typeof event.createdBy !== 'string') {
    errors.push('CreatedBy is required and must be a string');
  }

  if (event.reminderMinutes !== undefined && (typeof event.reminderMinutes !== 'number' || event.reminderMinutes < 0)) {
    errors.push('Reminder minutes must be a non-negative number');
  }

  if (event.collaborators && !Array.isArray(event.collaborators)) {
    errors.push('Collaborators must be an array of user IDs');
  }

  if (event.tags && !Array.isArray(event.tags)) {
    errors.push('Tags must be an array of strings');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates a calendar event structure
 */
export function validateCalendarEvent(event: Partial<CalendarEvent>): ValidationResult {
  const baseValidation = validateBaseEvent(event);
  const errors = [...baseValidation.errors];

  // Validate calendar event specific fields
  if (!event.feedId || typeof event.feedId !== 'string') {
    errors.push('FeedId is required and must be a string');
  }

  if (!event.feedName || typeof event.feedName !== 'string') {
    errors.push('FeedName is required and must be a string');
  }

  if (!event.externalId || typeof event.externalId !== 'string') {
    errors.push('ExternalId is required and must be a string');
  }

  if (event.sequence !== undefined && (typeof event.sequence !== 'number' || event.sequence < 0)) {
    errors.push('Sequence must be a non-negative number');
  }

  if (!event.source || !['google', 'ical'].includes(event.source)) {
    errors.push('Source must be either "google" or "ical"');
  }

  if (!event.lastModified || !(event.lastModified instanceof Date)) {
    errors.push('LastModified is required and must be a valid Date');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitizes event data to prevent XSS and ensure data integrity
 */
export function sanitizeEventData(data: Partial<BaseEvent>): SanitizedEventData {
  const sanitized: SanitizedEventData = {
    title: sanitizeString(data.title || ''),
  };

  if (data.description) {
    sanitized.description = sanitizeString(data.description);
  }

  if (data.location) {
    sanitized.location = sanitizeString(data.location);
  }

  if (data.attendees && Array.isArray(data.attendees)) {
    sanitized.attendees = data.attendees.map(attendee => sanitizeString(attendee)).filter(Boolean);
  }

  if ('tags' in data && data.tags && Array.isArray(data.tags)) {
    sanitized.tags = (data.tags as string[]).map(tag => sanitizeString(tag)).filter(Boolean);
  }

  return sanitized;
}

/**
 * Sanitizes a string by removing potentially dangerous content
 */
function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/on\w+=\w+/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove data: URLs (except images)
    .replace(/data:(?!image\/)/gi, '')
    // Trim whitespace
    .trim();
}

/**
 * Validates if a color string is a valid hex color
 */
function isValidColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Validates timezone string using browser's Intl API
 */
export function validateTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures event has proper timezone handling for accessibility
 */
export function normalizeEventTimezone(event: Partial<BaseEvent>): Partial<BaseEvent> {
  const normalized = { ...event };

  // If no timezone specified, treat as floating time
  if (!normalized.timezone) {
    // For floating times, we don't set a timezone - this indicates it should be
    // interpreted in the viewer's local timezone
    return normalized;
  }

  // Validate the timezone
  if (!validateTimezone(normalized.timezone)) {
    console.warn(`Invalid timezone "${normalized.timezone}", falling back to user timezone`);
    normalized.timezone = timezoneService.getUserTimezone();
  }

  return normalized;
}

/**
 * Creates a CRDT-compatible event structure with proper timestamps
 */
export function createCRDTCompatibleEvent(
  event: Omit<LocalEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'collaborators'>,
  userId: string
): Omit<LocalEvent, 'id'> {
  const now = new Date();
  
  return {
    ...event,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    // Ensure required arrays exist
    collaborators: [userId],
    tags: event.tags || [],
    attendees: event.attendees || [],
    // Normalize timezone
    timezone: event.timezone || timezoneService.getUserTimezone(),
    // Ensure pattern is set for accessibility
    pattern: event.pattern || 'plain',
  };
}

/**
 * Validates event data for CRDT operations
 */
export function validateCRDTEvent(event: any): ValidationResult {
  const errors: string[] = [];

  // Check for required CRDT fields
  if (!event.createdAt || !(event.createdAt instanceof Date)) {
    errors.push('CreatedAt timestamp is required for CRDT operations');
  }

  if (!event.updatedAt || !(event.updatedAt instanceof Date)) {
    errors.push('UpdatedAt timestamp is required for CRDT operations');
  }

  if (!event.createdBy || typeof event.createdBy !== 'string') {
    errors.push('CreatedBy user ID is required for CRDT operations');
  }

  // Validate the base event structure
  const baseValidation = validateLocalEvent(event);
  errors.push(...baseValidation.errors);

  return {
    isValid: errors.length === 0,
    errors
  };
}