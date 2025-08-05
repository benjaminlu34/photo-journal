/**
 * Calendar event validation utilities
 */

import type { LocalEvent } from '@/types/calendar';
import { CALENDAR_CONFIG } from '@shared/config/calendar-config';
import { validateHexColor } from '@/utils/colorUtils/colorUtils';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Validate a CRDT event before storing
export function validateCRDTEvent(event: LocalEvent): ValidationResult {
  const errors: string[] = [];
  
  // Required fields
  if (!event.id || typeof event.id !== 'string') {
    errors.push('Event ID is required and must be a string');
  }
  
  if (!event.title || typeof event.title !== 'string' || !event.title.trim()) {
    errors.push('Event title is required');
  }
  
  if (event.title && event.title.length > CALENDAR_CONFIG.EVENTS.MAX_TITLE_LENGTH) {
    errors.push(`Event title cannot exceed ${CALENDAR_CONFIG.EVENTS.MAX_TITLE_LENGTH} characters`);
  }
  
  if (event.description && event.description.length > CALENDAR_CONFIG.EVENTS.MAX_DESCRIPTION_LENGTH) {
    errors.push(`Event description cannot exceed ${CALENDAR_CONFIG.EVENTS.MAX_DESCRIPTION_LENGTH} characters`);
  }
  
  // Date validation
  if (!event.startTime || !(event.startTime instanceof Date)) {
    errors.push('Event start time is required and must be a Date object');
  }
  
  if (!event.endTime || !(event.endTime instanceof Date)) {
    errors.push('Event end time is required and must be a Date object');
  }
  
  if (event.startTime && event.endTime && event.endTime <= event.startTime) {
    errors.push('Event end time must be after start time');
  }
  
  // Duration validation
  if (event.startTime && event.endTime && !event.isAllDay) {
    const durationMinutes = (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60);
    if (durationMinutes < CALENDAR_CONFIG.EVENTS.MIN_DURATION) {
      errors.push(`Event duration must be at least ${CALENDAR_CONFIG.EVENTS.MIN_DURATION} minutes`);
    }
  }
  
  // Color validation
  if (event.color) {
    const colorValidation = validateHexColor(event.color);
    if (!colorValidation.isValid) {
      errors.push(`Invalid event color: ${colorValidation.error}`);
    }
  }
  
  // Boolean fields
  if (typeof event.isAllDay !== 'boolean') {
    errors.push('isAllDay must be a boolean value');
  }
  
  // User fields
  if (!event.createdBy || typeof event.createdBy !== 'string') {
    errors.push('createdBy is required and must be a string');
  }
  
  if (!event.createdAt || !(event.createdAt instanceof Date)) {
    errors.push('createdAt is required and must be a Date object');
  }
  
  if (!event.updatedAt || !(event.updatedAt instanceof Date)) {
    errors.push('updatedAt is required and must be a Date object');
  }
  
  // Array fields
  if (!Array.isArray(event.collaborators)) {
    errors.push('collaborators must be an array');
  }
  
  if (!Array.isArray(event.tags)) {
    errors.push('tags must be an array');
  }
  
  if (!Array.isArray(event.attendees)) {
    errors.push('attendees must be an array');
  }
  
  // Optional numeric fields
  if (event.reminderMinutes !== undefined && (typeof event.reminderMinutes !== 'number' || event.reminderMinutes < 0)) {
    errors.push('reminderMinutes must be a non-negative number');
  }
  
  // Pattern validation
  if (event.pattern && !['stripe', 'dot', 'plain'].includes(event.pattern)) {
    errors.push('pattern must be one of: stripe, dot, plain');
  }
  
  // Timezone validation
  if (event.timezone && typeof event.timezone !== 'string') {
    errors.push('timezone must be a string');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Create a CRDT-compatible event from partial data
export function createCRDTCompatibleEvent(
  eventData: Omit<LocalEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'collaborators'>,
  userId: string
): Omit<LocalEvent, 'id'> {
  const now = new Date();
  
  return {
    ...eventData,
    title: eventData.title.trim(),
    description: eventData.description?.trim() || undefined,
    color: eventData.color || CALENDAR_CONFIG.COLORS.DEFAULT_EVENT_COLOR,
    pattern: eventData.pattern || 'plain',
    attendees: eventData.attendees || [],
    tags: eventData.tags || [],
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    collaborators: [userId], // Creator is automatically a collaborator
    reminderMinutes: eventData.reminderMinutes || undefined,
    linkedJournalEntryId: eventData.linkedJournalEntryId || undefined,
    location: eventData.location?.trim() || undefined,
    timezone: eventData.timezone || undefined,
  };
}

// Sanitize event input to prevent XSS and other security issues
export function sanitizeEventInput(input: Partial<LocalEvent>): Partial<LocalEvent> {
  const sanitized: Partial<LocalEvent> = {};
  
  // Sanitize string fields
  if (input.title !== undefined) {
    sanitized.title = input.title.toString().trim().slice(0, CALENDAR_CONFIG.EVENTS.MAX_TITLE_LENGTH);
  }
  
  if (input.description !== undefined) {
    sanitized.description = input.description.toString().trim().slice(0, CALENDAR_CONFIG.EVENTS.MAX_DESCRIPTION_LENGTH);
  }
  
  if (input.location !== undefined) {
    sanitized.location = input.location.toString().trim();
  }
  
  // Sanitize and validate color
  if (input.color !== undefined) {
    const colorValidation = validateHexColor(input.color);
    sanitized.color = colorValidation.isValid ? input.color : CALENDAR_CONFIG.COLORS.DEFAULT_EVENT_COLOR;
  }
  
  // Copy safe fields directly
  if (input.startTime !== undefined) sanitized.startTime = input.startTime;
  if (input.endTime !== undefined) sanitized.endTime = input.endTime;
  if (input.isAllDay !== undefined) sanitized.isAllDay = Boolean(input.isAllDay);
  if (input.reminderMinutes !== undefined) {
    sanitized.reminderMinutes = Math.max(0, Math.floor(Number(input.reminderMinutes) || 0));
  }
  if (input.pattern !== undefined && ['stripe', 'dot', 'plain'].includes(input.pattern)) {
    sanitized.pattern = input.pattern;
  }
  if (input.timezone !== undefined) sanitized.timezone = input.timezone;
  
  // Sanitize arrays
  if (input.tags !== undefined && Array.isArray(input.tags)) {
    sanitized.tags = input.tags.map(tag => tag.toString().trim()).filter(Boolean);
  }
  
  if (input.attendees !== undefined && Array.isArray(input.attendees)) {
    sanitized.attendees = input.attendees.map(attendee => attendee.toString().trim()).filter(Boolean);
  }
  
  return sanitized;
}