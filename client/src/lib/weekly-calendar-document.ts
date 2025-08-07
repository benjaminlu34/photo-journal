/**
 * Weekly Calendar CRDT Document structure and utilities
 */

import * as Y from 'yjs';
import type { LocalEvent } from '@/types/calendar';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';

// CRDT document structure for weekly calendar data
export interface WeeklyCalendarDocument {
  weekId: string;
  localEvents: Y.Map<LocalEvent>;
  metadata: Y.Map<any>;
}

// Permission levels for collaboration
export type PermissionLevel = 'viewer' | 'editor' | 'owner';

// Permission map type
export type PermissionMap = Record<string, PermissionLevel>;

// Create a new weekly calendar document
export function createWeeklyCalendarDocument(weekId: string): WeeklyCalendarDocument {
  const doc = new Y.Doc();
  
  return {
    weekId,
    localEvents: doc.getMap<LocalEvent>('localEvents'),
    metadata: doc.getMap<any>('metadata'),
  };
}

// CRDT garbage collection configuration
// We store a tombstone timestamp under this metadata key on the event object.
const DELETION_TOMBSTONE_KEY = 'deletedAt' as const;
// Grace period before we hard-delete tombstoned events.
// Caller can tune; we keep a conservative default to allow sync propagation.
const DELETION_GRACE_MS = 60 * 1000; // 1 minute

// Narrowing helper for tombstoned events (type-safe, no any)
type TombstonedEvent = LocalEvent & { deletedAt?: string };
function hasTombstone(event: LocalEvent): event is TombstonedEvent {
  return DELETION_TOMBSTONE_KEY in (event as object);
}

// CRDT conflict resolution utilities
export class CRDTConflictResolver {
  // Resolve field conflicts using last-writer-wins with timestamp
  static resolveFieldConflict<T>(
    field: keyof LocalEvent,
    localValue: T,
    remoteValue: T,
    localTimestamp: Date,
    remoteTimestamp: Date
  ): T {
    // Last-writer-wins based on timestamp
    return remoteTimestamp > localTimestamp ? remoteValue : localValue;
  }
  
  // Handle event deletion with timestamp tracking (tombstone + GC)
  static handleEventDeletion(
    eventId: string,
    deletedBy: string,
    deletedAt: Date,
    eventsMap: Y.Map<LocalEvent>
  ): void {
    const event = eventsMap.get(eventId);
    if (!event) return;

    // Mark as deleted (soft delete) and add tombstone timestamp for GC
    const deletedEvent: TombstonedEvent = {
      ...event,
      title: '[DELETED]',
      description: `Deleted by ${deletedBy} at ${deletedAt.toISOString()}`,
      updatedAt: deletedAt,
      // store tombstone in a stable optional field so we can GC later
      [DELETION_TOMBSTONE_KEY]: deletedAt.toISOString(),
    };

    eventsMap.set(eventId, deletedEvent);
  }
  
  // Handle concurrent event creation
  static handleDuplicateCreation(
    event1: LocalEvent,
    event2: LocalEvent,
    eventsMap: Y.Map<LocalEvent>
  ): LocalEvent {
    // Keep the event with the earlier creation timestamp
    const winningEvent = event1.createdAt <= event2.createdAt ? event1 : event2;
    eventsMap.set(winningEvent.id, winningEvent);
    return winningEvent;
  }
  
  // Validate event update permissions and data
  static validateEventUpdate(
    eventId: string,
    updates: Partial<LocalEvent>,
    currentEvent: LocalEvent | undefined,
    userId: string
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!currentEvent) {
      errors.push('Event not found');
      return { isValid: false, errors };
    }
    
    // Check if user has permission to edit
    if (currentEvent.createdBy !== userId && !currentEvent.collaborators.includes(userId)) {
      errors.push('User does not have permission to edit this event');
    }
    
    // Validate required fields
    if (updates.title !== undefined && !updates.title.trim()) {
      errors.push('Event title cannot be empty');
    }
    
    // Validate date range
    if (updates.startTime && updates.endTime) {
      if (updates.endTime <= updates.startTime) {
        errors.push('End time must be after start time');
      }
    }
    
    return { isValid: errors.length === 0, errors };
  }
}

// Utility functions for working with WeeklyCalendarDocument
export class WeeklyCalendarDocumentUtils {
  // Update metadata helper to set fields and bump lastModified
  static updateMetadata(
    document: WeeklyCalendarDocument,
    patch: Record<string, any>
  ): void {
    const metadata = document.metadata;
    for (const [key, value] of Object.entries(patch)) {
      metadata.set(key, value);
    }
    metadata.set('lastModified', new Date());
  }

  // Get events for a specific date
  static getEventsForDate(document: WeeklyCalendarDocument, date: Date): LocalEvent[] {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    
    return Array.from(document.localEvents.values()).filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      
      // Check if event overlaps with the day
      return isWithinInterval(eventStart, { start: dayStart, end: dayEnd }) ||
             isWithinInterval(eventEnd, { start: dayStart, end: dayEnd }) ||
             (eventStart <= dayStart && eventEnd >= dayEnd);
    });
  }
  
  // Get events in a date range
  static getEventsInRange(document: WeeklyCalendarDocument, startDate: Date, endDate: Date): LocalEvent[] {
    return Array.from(document.localEvents.values()).filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      
      // Check if event overlaps with the range
      return isWithinInterval(eventStart, { start: startDate, end: endDate }) ||
             isWithinInterval(eventEnd, { start: startDate, end: endDate }) ||
             (eventStart <= startDate && eventEnd >= endDate);
    });
  }
  
  // Check user permissions
  static hasPermission(
    document: WeeklyCalendarDocument,
    userId: string,
    requiredPermission: PermissionLevel
  ): boolean {
    const permissions = document.metadata.get('permissions') as PermissionMap || {};
    const userPermission = permissions[userId];
    
    if (!userPermission) {
      return false;
    }
    
    const permissionLevels: PermissionLevel[] = ['viewer', 'editor', 'owner'];
    const userLevel = permissionLevels.indexOf(userPermission);
    const requiredLevel = permissionLevels.indexOf(requiredPermission);
    
    return userLevel >= requiredLevel;
  }
  
  // Add collaborator with permission
  static addCollaborator(
    document: WeeklyCalendarDocument,
    userId: string,
    permission: PermissionLevel
  ): void {
    const permissions = document.metadata.get('permissions') as PermissionMap || {};
    const collaborators = document.metadata.get('collaborators') as string[] || [];
    
    permissions[userId] = permission;
    if (!collaborators.includes(userId)) {
      collaborators.push(userId);
    }
    
    document.metadata.set('permissions', permissions);
    document.metadata.set('collaborators', collaborators);
    document.metadata.set('lastModified', new Date());
  }
  
  // Remove collaborator
  static removeCollaborator(document: WeeklyCalendarDocument, userId: string): void {
    const permissions = document.metadata.get('permissions') as PermissionMap || {};
    const collaborators = document.metadata.get('collaborators') as string[] || [];
    
    delete permissions[userId];
    const updatedCollaborators = collaborators.filter(id => id !== userId);
    
    document.metadata.set('permissions', permissions);
    document.metadata.set('collaborators', updatedCollaborators);
    document.metadata.set('lastModified', new Date());
  }

  // Get document statistics
  static getDocumentStats(document: WeeklyCalendarDocument): {
    eventCount: number;
    collaboratorCount: number;
    lastModified: Date | null;
    weekId: string;
    tombstoneCount: number;
  } {
    const events = Array.from(document.localEvents.values());
    const collaborators = document.metadata.get('collaborators') as string[] || [];
    const lastModified = document.metadata.get('lastModified') as Date || null;
    const weekId = document.metadata.get('weekId') as string || document.weekId;
    
    const tombstoneCount = events.filter(hasTombstone).length;
    
    return {
      eventCount: events.length - tombstoneCount, // Active events only
      collaboratorCount: collaborators.length,
      lastModified,
      weekId,
      tombstoneCount,
    };
  }

  // Garbage collection for tombstoned (soft-deleted) events.
  // Intended to be invoked:
  // - on document load
  // - periodically (caller can schedule, e.g., every minute)
  static garbageCollectDeletedEvents(
    eventsMap: Y.Map<LocalEvent>,
    now: Date = new Date()
  ): number {
    let removed = 0;
    const cutoff = now.getTime() - DELETION_GRACE_MS;

    for (const [id, ev] of eventsMap.entries()) {
      // We only consider entries that contain our tombstone marker
      if (!hasTombstone(ev) || typeof ev.deletedAt !== 'string') continue;

      const deletedAtMs = Date.parse(ev.deletedAt);
      if (!Number.isFinite(deletedAtMs)) continue;

      // If the tombstone is older than the grace period, hard-delete it
      if (deletedAtMs <= cutoff) {
        eventsMap.delete(id);
        removed++;
      }
    }
    return removed;
  }
}