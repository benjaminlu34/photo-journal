/**
 * Weekly Calendar Document structure for CRDT integration
 */

import * as Y from 'yjs';
import type { LocalEvent } from '@/types/calendar';

export interface WeeklyCalendarDocument {
  weekId: string; // ISO week identifier (e.g., "2024-W03")
  localEvents: Y.Map<LocalEvent>; // eventId -> event (efficient updates)
  metadata: Y.Map<any>; // Flexible metadata storage
}

export interface PermissionMap {
  [userId: string]: 'viewer' | 'editor' | 'owner';
}

export interface ConflictResolutionContext {
  field: keyof LocalEvent;
  localValue: any;
  remoteValue: any;
  localTimestamp: Date;
  remoteTimestamp: Date;
  userId: string;
  eventId: string;
}

/**
 * Creates a new WeeklyCalendarDocument with proper CRDT structure
 */
export function createWeeklyCalendarDocument(weekId: string): WeeklyCalendarDocument {
  const doc = new Y.Doc();
  
  // Create the main data structures
  const localEvents = doc.getMap<LocalEvent>('localEvents');
  const metadata = doc.getMap<any>('metadata');
  
  // Initialize metadata
  metadata.set('weekId', weekId);
  metadata.set('lastModified', new Date());
  metadata.set('collaborators', []);
  metadata.set('permissions', {});
  
  return {
    weekId,
    localEvents,
    metadata,
  };
}

/**
 * CRDT conflict resolution using last-writer-wins with timestamps
 */
export class CRDTConflictResolver {
  /**
   * Resolves field-level conflicts using last-writer-wins with timestamp
   */
  static resolveFieldConflict<T>(context: ConflictResolutionContext): T {
    const { localValue, remoteValue, localTimestamp, remoteTimestamp, field, userId, eventId } = context;
    
    // Last-writer-wins based on timestamp
    const winner = remoteTimestamp > localTimestamp ? remoteValue : localValue;
    
    // Log conflict resolution for debugging
    console.debug(`CRDT conflict resolved for event ${eventId}, field ${field}:`, {
      localValue,
      remoteValue,
      localTimestamp,
      remoteTimestamp,
      winner,
      userId
    });
    
    return winner;
  }
  
  /**
   * Handles event deletion conflicts
   */
  static handleEventDeletion(
    eventId: string,
    deletedBy: string,
    deletedAt: Date,
    localEvents: Y.Map<LocalEvent>
  ): void {
    const event = localEvents.get(eventId);
    
    if (event) {
      // Check if the event was modified after deletion timestamp
      if (event.updatedAt > deletedAt) {
        console.debug(`Event ${eventId} was modified after deletion, keeping event`);
        return;
      }
      
      // Delete the event
      localEvents.delete(eventId);
      console.debug(`Event ${eventId} deleted by ${deletedBy} at ${deletedAt}`);
    }
  }
  
  /**
   * Handles concurrent event creation (duplicate IDs)
   */
  static handleDuplicateCreation(
    event1: LocalEvent,
    event2: LocalEvent,
    localEvents: Y.Map<LocalEvent>
  ): LocalEvent {
    // Use the event with the earlier creation timestamp
    const winner = event1.createdAt <= event2.createdAt ? event1 : event2;
    const loser = winner === event1 ? event2 : event1;
    
    // If the loser has a later update timestamp, merge some fields
    if (loser.updatedAt > winner.updatedAt) {
      const merged: LocalEvent = {
        ...winner,
        // Keep the winner's core identity but merge newer content
        title: loser.title,
        description: loser.description,
        startTime: loser.startTime,
        endTime: loser.endTime,
        updatedAt: loser.updatedAt,
        // Merge collaborators
        collaborators: Array.from(new Set([...winner.collaborators, ...loser.collaborators])),
        // Merge tags
        tags: Array.from(new Set([...winner.tags, ...loser.tags])),
      };
      
      localEvents.set(winner.id, merged);
      console.debug(`Merged duplicate events ${event1.id} and ${event2.id}`);
      return merged;
    }
    
    // Keep the winner as-is
    localEvents.set(winner.id, winner);
    console.debug(`Resolved duplicate creation, kept event ${winner.id}`);
    return winner;
  }
  
  /**
   * Validates event update before applying to CRDT
   */
  static validateEventUpdate(
    eventId: string,
    updates: Partial<LocalEvent>,
    currentEvent: LocalEvent | undefined,
    userId: string
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check if event exists
    if (!currentEvent) {
      errors.push(`Event ${eventId} does not exist`);
      return { isValid: false, errors };
    }
    
    // Check if user has permission to edit
    if (!currentEvent.collaborators.includes(userId)) {
      errors.push(`User ${userId} does not have permission to edit event ${eventId}`);
    }
    
    // Validate timestamp ordering
    if (updates.updatedAt && currentEvent.updatedAt > updates.updatedAt) {
      errors.push(`Update timestamp is older than current event timestamp`);
    }
    
    // Validate required fields if being updated
    if (updates.title !== undefined && (!updates.title || updates.title.trim().length === 0)) {
      errors.push('Event title cannot be empty');
    }
    
    if (updates.startTime && updates.endTime && updates.startTime >= updates.endTime) {
      errors.push('Event end time must be after start time');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Utility functions for working with WeeklyCalendarDocument
 */
export class WeeklyCalendarDocumentUtils {
  /**
   * Gets all events for a specific date
   */
  static getEventsForDate(
    document: WeeklyCalendarDocument,
    date: Date
  ): LocalEvent[] {
    const events = Array.from(document.localEvents.values());
    
    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      const targetDate = new Date(date);
      
      // Compare year, month, and day only (ignore time)
      return eventDate.getFullYear() === targetDate.getFullYear() &&
             eventDate.getMonth() === targetDate.getMonth() &&
             eventDate.getDate() === targetDate.getDate();
    });
  }
  
  /**
   * Gets events within a time range
   */
  static getEventsInRange(
    document: WeeklyCalendarDocument,
    startDate: Date,
    endDate: Date
  ): LocalEvent[] {
    const events = Array.from(document.localEvents.values());
    
    return events.filter(event => {
      return event.startTime >= startDate && event.startTime <= endDate;
    });
  }
  
  /**
   * Updates document metadata
   */
  static updateMetadata(
    document: WeeklyCalendarDocument,
    updates: Record<string, any>
  ): void {
    Object.entries(updates).forEach(([key, value]) => {
      document.metadata.set(key, value);
    });
  }
  
  /**
   * Adds a collaborator to the document
   */
  static addCollaborator(
    document: WeeklyCalendarDocument,
    userId: string,
    permission: 'viewer' | 'editor' | 'owner' = 'editor'
  ): void {
    const collaborators: string[] = document.metadata.get('collaborators') || [];
    const permissions: PermissionMap = document.metadata.get('permissions') || {};
    
    if (!collaborators.includes(userId)) {
      collaborators.push(userId);
      document.metadata.set('collaborators', collaborators);
    }
    
    permissions[userId] = permission;
    document.metadata.set('permissions', permissions);
    document.metadata.set('lastModified', new Date());
  }
  
  /**
   * Removes a collaborator from the document
   */
  static removeCollaborator(
    document: WeeklyCalendarDocument,
    userId: string
  ): void {
    const collaborators: string[] = document.metadata.get('collaborators') || [];
    const permissions: PermissionMap = document.metadata.get('permissions') || {};
    
    const updatedCollaborators = collaborators.filter((id: string) => id !== userId);
    document.metadata.set('collaborators', updatedCollaborators);
    
    delete permissions[userId];
    document.metadata.set('permissions', permissions);
    document.metadata.set('lastModified', new Date());
  }
  
  /**
   * Checks if a user has permission to perform an action
   */
  static hasPermission(
    document: WeeklyCalendarDocument,
    userId: string,
    requiredPermission: 'viewer' | 'editor' | 'owner'
  ): boolean {
    const permissions: PermissionMap = document.metadata.get('permissions') || {};
    const userPermission = permissions[userId];
    
    if (!userPermission) return false;
    
    const permissionLevels = { viewer: 1, editor: 2, owner: 3 };
    return permissionLevels[userPermission] >= permissionLevels[requiredPermission];
  }
  
  /**
   * Gets document statistics
   */
  static getDocumentStats(document: WeeklyCalendarDocument): {
    eventCount: number;
    collaboratorCount: number;
    lastModified: Date;
    weekId: string;
  } {
    const collaborators: string[] = document.metadata.get('collaborators') || [];
    const lastModified: Date = document.metadata.get('lastModified') || new Date();
    
    return {
      eventCount: document.localEvents.size,
      collaboratorCount: collaborators.length,
      lastModified,
      weekId: document.weekId,
    };
  }
}