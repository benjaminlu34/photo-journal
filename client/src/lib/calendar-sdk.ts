/**
 * Calendar SDK for managing weekly calendar events with CRDT integration
 */

import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { LocalEvent, CalendarEvent, FriendCalendarEvent } from '@/types/calendar';
import { timezoneService } from '@/services/timezone.service';
import { snapshotService } from '@/services/snapshot.service';
import { 
  createWeeklyCalendarDocument, 
  CRDTConflictResolver, 
  WeeklyCalendarDocumentUtils,
  type WeeklyCalendarDocument 
} from './weekly-calendar-document';
import { validateCRDTEvent, createCRDTCompatibleEvent } from './calendar-validation';

export type CalendarSDK = ReturnType<typeof createCalendarSDK>;

// Singleton registry for CalendarSDK instances
export const calendarSdkRegistry: Record<string, ReturnType<typeof createCalendarSDK>> = {};

export function getCalendarSdk(weekId: string, userId = 'anonymous', userName = 'Anonymous', username?: string) {
  // Create user-scoped key to prevent cross-user contamination
  const userScopedKey = `${weekId}-${userId}`;
  if (!calendarSdkRegistry[userScopedKey]) {
    calendarSdkRegistry[userScopedKey] = createCalendarSDK({ weekId, userId, userName, username });
  }
  return calendarSdkRegistry[userScopedKey];
}

export function createCalendarSDK({
  weekId,
  userId,
  userName,
  username,
}: {
  weekId: string;
  userId: string;
  userName: string;
  username?: string;
}) {
  // Yjs doc and providers
  const doc = new Y.Doc();
  const provider = new WebrtcProvider(`journal-calendar-${weekId}`, doc, {
    signaling: ['wss://signaling.yjs.dev'],
  });
  const indexeddbProvider = new IndexeddbPersistence(`journal-calendar-${weekId}`, doc);

  // Create WeeklyCalendarDocument structure
  const calendarDocument: WeeklyCalendarDocument = {
    weekId,
    localEvents: doc.getMap<LocalEvent>('localEvents'),
    metadata: doc.getMap<any>('metadata'),
  };

  // Initialize metadata if not exists
  if (!calendarDocument.metadata.has('weekId')) {
    calendarDocument.metadata.set('weekId', weekId);
    calendarDocument.metadata.set('lastModified', new Date());
    calendarDocument.metadata.set('collaborators', [userId]);
    calendarDocument.metadata.set('permissions', { [userId]: 'owner' });
  }

  // Add current user as collaborator if not already present
  if (!WeeklyCalendarDocumentUtils.hasPermission(calendarDocument, userId, 'viewer')) {
    WeeklyCalendarDocumentUtils.addCollaborator(calendarDocument, userId, 'editor');
  }

  // Undo manager for events
  const undoManager = new Y.UndoManager([calendarDocument.localEvents]);

  // Presence (awareness)
  const awareness = provider.awareness;
  const currentUser = {
    id: userId,
    name: userName,
    username: username, // Add username field for display
    displayName: username ? `@${username}` : userName, // Prefer @username over name
    color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
  };
  awareness.setLocalStateField('user', currentUser);

  // Change listeners
  let changeListeners: Array<(events: LocalEvent[]) => void> = [];
  calendarDocument.localEvents.observe(() => {
    const events = Array.from(calendarDocument.localEvents.values());
    changeListeners.forEach(cb => cb(events));
    
    // Update last modified timestamp
    WeeklyCalendarDocumentUtils.updateMetadata(calendarDocument, {
      lastModified: new Date(),
    });
    
    // Mark pending changes for snapshot service with weekId and doc
    snapshotService.markPendingChanges(weekId, doc);
  });

  // Start snapshot batching with proper debounce and batch size
  snapshotService.startSnapshotBatching(weekId, doc);

  // API
  return {
    // Get all local events
    getLocalEvents(): LocalEvent[] {
      return Array.from(calendarDocument.localEvents.values());
    },
    
    // Get events for a specific date
    getEventsForDate(date: Date): LocalEvent[] {
      return WeeklyCalendarDocumentUtils.getEventsForDate(calendarDocument, date);
    },
    
    // Get events in a date range
    getEventsInRange(startDate: Date, endDate: Date): LocalEvent[] {
      return WeeklyCalendarDocumentUtils.getEventsInRange(calendarDocument, startDate, endDate);
    },
    
    // Create a new local event with proper validation
    async createLocalEvent(event: Omit<LocalEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'collaborators'>) {
      // Check permissions
      if (!WeeklyCalendarDocumentUtils.hasPermission(calendarDocument, userId, 'editor')) {
        throw new Error('User does not have permission to create events');
      }
      
      const eventId = crypto.randomUUID();
      
      // Create CRDT-compatible event with validation
      const newEvent = createCRDTCompatibleEvent(event, userId);
      const eventWithId = { ...newEvent, id: eventId };
      
      // Validate the event
      const validation = validateCRDTEvent(eventWithId);
      if (!validation.isValid) {
        throw new Error(`Invalid event data: ${validation.errors.join(', ')}`);
      }
      
      // Check for duplicate creation
      const existingEvent = calendarDocument.localEvents.get(eventId);
      if (existingEvent) {
        CRDTConflictResolver.handleDuplicateCreation(
          existingEvent,
          eventWithId,
          calendarDocument.localEvents
        );
      } else {
        calendarDocument.localEvents.set(eventId, eventWithId);
      }
    },
    
    // Update a local event with conflict resolution
    async updateLocalEvent(id: string, updates: Partial<LocalEvent>) {
      const currentEvent = calendarDocument.localEvents.get(id);
      
      // Validate the update
      const validation = CRDTConflictResolver.validateEventUpdate(
        id,
        updates,
        currentEvent,
        userId
      );
      
      if (!validation.isValid) {
        throw new Error(`Invalid event update: ${validation.errors.join(', ')}`);
      }
      
      if (currentEvent) {
        const now = new Date();
        const updatedEvent = { 
          ...currentEvent, 
          ...updates, 
          updatedAt: now,
          collaborators: updates.collaborators || currentEvent.collaborators
        };
        
        if (updates.timezone && updates.timezone !== currentEvent.timezone) {
          const userTimezone = timezoneService.getUserTimezone();
          // Use safe conversion method with DST handling
          const convertedEvent = timezoneService.convertToLocalTimeSafe(
            updatedEvent,
            userTimezone
          );
          calendarDocument.localEvents.set(id, convertedEvent);
        } else {
          calendarDocument.localEvents.set(id, updatedEvent);
        }
      }
    },
    
    // Delete a local event with proper conflict handling
    deleteLocalEvent(id: string) {
      // Check permissions
      if (!WeeklyCalendarDocumentUtils.hasPermission(calendarDocument, userId, 'editor')) {
        throw new Error('User does not have permission to delete events');
      }
      
      const event = calendarDocument.localEvents.get(id);
      if (event) {
        // Handle deletion with timestamp for conflict resolution
        CRDTConflictResolver.handleEventDeletion(
          id,
          userId,
          new Date(),
          calendarDocument.localEvents
        );
      }
    },
    
    // Get document metadata
    getMetadata(): any {
      return Object.fromEntries(calendarDocument.metadata.entries());
    },
    
    // Get document statistics
    getDocumentStats() {
      return WeeklyCalendarDocumentUtils.getDocumentStats(calendarDocument);
    },
    
    // Add collaborator
    addCollaborator(collaboratorId: string, permission: 'viewer' | 'editor' | 'owner' = 'editor') {
      if (!WeeklyCalendarDocumentUtils.hasPermission(calendarDocument, userId, 'owner')) {
        throw new Error('Only owners can add collaborators');
      }
      WeeklyCalendarDocumentUtils.addCollaborator(calendarDocument, collaboratorId, permission);
    },
    
    // Remove collaborator
    removeCollaborator(collaboratorId: string) {
      if (!WeeklyCalendarDocumentUtils.hasPermission(calendarDocument, userId, 'owner')) {
        throw new Error('Only owners can remove collaborators');
      }
      WeeklyCalendarDocumentUtils.removeCollaborator(calendarDocument, collaboratorId);
    },
    
    // Check user permissions
    hasPermission(requiredPermission: 'viewer' | 'editor' | 'owner'): boolean {
      return WeeklyCalendarDocumentUtils.hasPermission(calendarDocument, userId, requiredPermission);
    },
    
    // Presence information
    presence: awareness,
    
    // Undo/redo functionality
    undo() {
      undoManager.undo();
    },
    redo() {
      undoManager.redo();
    },
    
    // Subscribe to changes
    onChange(cb: (events: LocalEvent[]) => void) {
      changeListeners.push(cb);
      return () => {
        changeListeners = changeListeners.filter(fn => fn !== cb);
      };
    },
    
    // Cleanup function
    destroy() {
      provider.destroy();
      indexeddbProvider.destroy?.();
      doc.destroy();
      snapshotService.stopSnapshotBatching(weekId);
    },
  };
}