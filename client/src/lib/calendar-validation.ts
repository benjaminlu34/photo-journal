/**
 * Calendar validation utilities for CRDT event validation
 */

import type { LocalEvent, BaseEvent } from '@/types/calendar';
import { CALENDAR_CONFIG } from '@shared/config/calendar-config';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a CRDT event before insertion/update
 */
export function validateCRDTEvent(event: LocalEvent): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!event.id || event.id.trim().length === 0) {
    errors.push('Event ID is required');
  }

  if (!event.title || event.title.trim().length === 0) {
    errors.push('Event title is required');
  }

  if (event.title && event.title.length > CALENDAR_CONFIG.EVENTS.MAX_TITLE_LENGTH) {
    errors.push(`Event title must be ${CALENDAR_CONFIG.EVENTS.MAX_TITLE_LENGTH} characters or less`);
  }

  if (event.description && event.description.length > CALENDAR_CONFIG.EVENTS.MAX_DESCRIPTION_LENGTH) {
    errors.push(`Event description must be ${CALENDAR_CONFIG.EVENTS.MAX_DESCRIPTION_LENGTH} characters or less`);
  }

  // Validate dates
  if (!event.startTime || !(event.startTime instanceof Date) || isNaN(event.startTime.getTime())) {
    errors.push('Valid start time is required');
  }

  if (!event.endTime || !(event.endTime instanceof Date) || isNaN(event.endTime.getTime())) {
    errors.push('Valid end time is required');
  }

  if (event.startTime && event.endTime && event.startTime >= event.endTime) {
    errors.push('End time must be after start time');
  }

  // Validate duration
  if (event.startTime && event.endTime && !event.isAllDay) {
    const durationMs = event.endTime.getTime() - event.startTime.getTime();
    const durationMinutes = durationMs / (1000 * 60);
    
    if (durationMinutes < CALENDAR_CONFIG.EVENTS.MIN_DURATION) {
      errors.push(`Event duration must be at least ${CALENDAR_CONFIG.EVENTS.MIN_DURATION} minutes`);
    }
  }

  // Validate user fields
  if (!event.createdBy || event.createdBy.trim().length === 0) {
    errors.push('Created by field is required');
  }

  if (!event.createdAt || !(event.createdAt instanceof Date) || isNaN(event.createdAt.getTime())) {
    errors.push('Valid created at timestamp is required');
  }

  if (!event.updatedAt || !(event.updatedAt instanceof Date) || isNaN(event.updatedAt.getTime())) {
    errors.push('Valid updated at timestamp is required');
  }

  // Validate arrays
  if (!Array.isArray(event.collaborators)) {
    errors.push('Collaborators must be an array');
  }

  if (!Array.isArray(event.tags)) {
    errors.push('Tags must be an array');
  }

  // Validate color
  if (!event.color || !isValidColor(event.color)) {
    errors.push('Valid color is required');
  }

  // Validate timezone if present
  if (event.timezone && !isValidTimezone(event.timezone)) {
    warnings.push('Invalid timezone specified, will default to user timezone');
  }

  // Validate reminder
  if (event.reminderMinutes !== undefined && (event.reminderMinutes < 0 || event.reminderMinutes > 10080)) {
    warnings.push('Reminder should be between 0 and 10080 minutes (1 week)');
  }

  // Validate attendees
  if (event.attendees && event.attendees.length > 100) {
    warnings.push('Large number of attendees may affect performance');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Creates a CRDT-compatible event from input data
 */
export function createCRDTCompatibleEvent(
  eventData: Omit<LocalEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'collaborators'>,
  userId: string
): Omit<LocalEvent, 'id'> {
  const now = new Date();

  return {
    title: sanitizeTitle(eventData.title),
    description: sanitizeDescription(eventData.description || ''),
    startTime: new Date(eventData.startTime),
    endTime: new Date(eventData.endTime),
    timezone: eventData.timezone || undefined,
    isAllDay: Boolean(eventData.isAllDay),
    color: sanitizeColor(eventData.color),
    pattern: eventData.pattern || 'plain',
    location: sanitizeLocation(eventData.location || ''),
    attendees: sanitizeAttendees(eventData.attendees || []),
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    linkedJournalEntryId: eventData.linkedJournalEntryId,
    reminderMinutes: validateReminderMinutes(eventData.reminderMinutes),
    collaborators: [userId], // Creator is always a collaborator
    tags: sanitizeTags(eventData.tags || [])
  };
}

/**
 * Validates update data before applying to existing event
 */
export function validateEventUpdate(
  currentEvent: LocalEvent,
  updates: Partial<LocalEvent>,
  userId: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if user has permission to update
  if (!currentEvent.collaborators.includes(userId)) {
    errors.push('User does not have permission to update this event');
  }

  // Validate title if being updated
  if (updates.title !== undefined) {
    if (!updates.title || updates.title.trim().length === 0) {
      errors.push('Event title cannot be empty');
    } else if (updates.title.length > CALENDAR_CONFIG.EVENTS.MAX_TITLE_LENGTH) {
      errors.push(`Event title must be ${CALENDAR_CONFIG.EVENTS.MAX_TITLE_LENGTH} characters or less`);
    }
  }

  // Validate description if being updated
  if (updates.description !== undefined && updates.description.length > CALENDAR_CONFIG.EVENTS.MAX_DESCRIPTION_LENGTH) {
    errors.push(`Event description must be ${CALENDAR_CONFIG.EVENTS.MAX_DESCRIPTION_LENGTH} characters or less`);
  }

  // Validate time changes
  const startTime = updates.startTime || currentEvent.startTime;
  const endTime = updates.endTime || currentEvent.endTime;
  
  if (startTime >= endTime) {
    errors.push('End time must be after start time');
  }

  // Validate duration for non-all-day events
  const isAllDay = updates.isAllDay !== undefined ? updates.isAllDay : currentEvent.isAllDay;
  if (!isAllDay) {
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = durationMs / (1000 * 60);
    
    if (durationMinutes < CALENDAR_CONFIG.EVENTS.MIN_DURATION) {
      errors.push(`Event duration must be at least ${CALENDAR_CONFIG.EVENTS.MIN_DURATION} minutes`);
    }
  }

  // Validate color if being updated
  if (updates.color !== undefined && !isValidColor(updates.color)) {
    errors.push('Invalid color specified');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Helper functions

function sanitizeTitle(title: string): string {
  return title.trim().substring(0, CALENDAR_CONFIG.EVENTS.MAX_TITLE_LENGTH);
}

function sanitizeDescription(description: string): string {
  return description.trim().substring(0, CALENDAR_CONFIG.EVENTS.MAX_DESCRIPTION_LENGTH);
}

function sanitizeLocation(location: string): string {
  return location.trim().substring(0, 100); // Reasonable location limit
}

function sanitizeColor(color: string): string {
  // Basic hex color validation and default fallback
  const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexPattern.test(color) ? color : CALENDAR_CONFIG.COLORS.DEFAULT_EVENT_COLOR;
}

function sanitizeAttendees(attendees: string[]): string[] {
  return attendees
    .filter(email => email && email.trim().length > 0)
    .map(email => email.trim())
    .slice(0, 100); // Limit to 100 attendees
}

function sanitizeTags(tags: string[]): string[] {
  return tags
    .filter(tag => tag && tag.trim().length > 0)
    .map(tag => tag.trim().toLowerCase())
    .slice(0, 20); // Limit to 20 tags
}

function validateReminderMinutes(reminderMinutes?: number): number | undefined {
  if (reminderMinutes === undefined) return undefined;
  if (reminderMinutes < 0) return 0;
  if (reminderMinutes > 10080) return 10080; // 1 week max
  return reminderMinutes;
}

function isValidColor(color: string): boolean {
  const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexPattern.test(color);
}

function isValidTimezone(timezone: string): boolean {
  try {
    // Simple timezone validation - check if it's a valid IANA timezone
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
