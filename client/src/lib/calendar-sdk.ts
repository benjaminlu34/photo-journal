/**
 * Calendar SDK for managing weekly calendar events with CRDT integration
 */

import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { LocalEvent } from '@/types/calendar';
import { timezoneService } from '@/services/timezone.service';
import { snapshotService } from '@/services/snapshot.service';
import {
  CRDTConflictResolver,
  WeeklyCalendarDocumentUtils,
  filterActiveEvents,
  type WeeklyCalendarDocument
} from './weekly-calendar-document';
import { validateCRDTEvent, createCRDTCompatibleEvent } from './calendar-validation';

type ProviderStatus = 'connected' | 'disconnected';

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
    maxConns: 3,
  });
  const indexeddbProvider = new IndexeddbPersistence(`journal-calendar-${weekId}`, doc);

  // Track IndexedDB sync state for conflict resolution
  let indexedDbSynced = false;
  indexeddbProvider.on('synced', () => {
    indexedDbSynced = true;
  });

  // Handle IndexedDB quota exceeded errors
  indexeddbProvider.on('sync', (isSynced: boolean) => {
    if (!isSynced) {
      console.warn('Calendar SDK: IndexedDB sync failed - possible quota exceeded');
      // Could notify user here via a callback if needed
    }
  });

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
    const allEvents = Array.from(calendarDocument.localEvents.values());
    // Only notify listeners about active (non-deleted) events
    const activeEvents = filterActiveEvents(allEvents);
    changeListeners.forEach(cb => cb(activeEvents));

    // Update last modified timestamp
    WeeklyCalendarDocumentUtils.updateMetadata(calendarDocument, {
      lastModified: new Date(),
    });

    // Mark pending changes for snapshot service with weekId and doc
    snapshotService.markPendingChanges(weekId, doc);
  });

  // Start snapshot batching with proper debounce and batch size
  snapshotService.startSnapshotBatching(weekId, doc);

  // Run initial garbage collection to clean up old tombstoned events
  WeeklyCalendarDocumentUtils.garbageCollectDeletedEvents(calendarDocument.localEvents);

  // Connection status tracking for presence indicator
  const connectionListeners = new Set<(status: ProviderStatus) => void>();
  let lastConnectionStatus: ProviderStatus = 'disconnected';
  provider.on('status', (event: { connected: boolean }) => {
    lastConnectionStatus = event.connected ? 'connected' : 'disconnected';
    connectionListeners.forEach(cb => cb(lastConnectionStatus));
  });

  // Helper function to filter out tombstoned (deleted) events
  const filterActivEvents = filterActiveEvents;

  // API
  // Helper method to check create permissions
  const hasCreatePermission = (userId: string): boolean => {
    // Anonymous users always have permission (for demo/testing)
    if (userId === 'anonymous') return true;
    
    const permissions = calendarDocument.metadata.get('permissions');
    
    // No permissions set = owner access (user's own calendar)
    if (!permissions) return true;
    
    // Check explicit permissions
    return WeeklyCalendarDocumentUtils.hasPermission(calendarDocument, userId, 'editor');
  };

  return {
    // Get all local events (excluding deleted ones)
    getLocalEvents(): LocalEvent[] {
      const allEvents = Array.from(calendarDocument.localEvents.values());
      return filterActivEvents(allEvents);
    },

    // Get events for a specific date (excluding deleted ones)
    getEventsForDate(date: Date): LocalEvent[] {
      const allEvents = WeeklyCalendarDocumentUtils.getEventsForDate(calendarDocument, date);
      return filterActivEvents(allEvents);
    },

    // Get events in a date range (excluding deleted ones)
    getEventsInRange(startDate: Date, endDate: Date): LocalEvent[] {
      const allEvents = WeeklyCalendarDocumentUtils.getEventsInRange(calendarDocument, startDate, endDate);
      return filterActivEvents(allEvents);
    },

    // Create a new local event with proper validation
    async createLocalEvent(event: Omit<LocalEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'collaborators'>) {
      // Check permissions
      if (!hasCreatePermission(userId)) {
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

      // Check for duplicate creation with transaction for atomicity
      const existingEvent = calendarDocument.localEvents.get(eventId);
      doc.transact(() => {
        if (existingEvent) {
          CRDTConflictResolver.handleDuplicateCreation(
            existingEvent,
            eventWithId,
            calendarDocument.localEvents
          );
        } else {
          calendarDocument.localEvents.set(eventId, eventWithId);
        }
      }, 'create-event');
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
        doc.transact(() => {
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
        }, 'update-event');
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
        // Use CRDT-safe deletion with tombstone to ensure proper sync
        doc.transact(() => {
          CRDTConflictResolver.handleEventDeletion(
            id,
            userId,
            new Date(),
            calendarDocument.localEvents
          );
        }, 'delete-event');
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

    onConnectionStatusChange(callback: (status: ProviderStatus) => void) {
      connectionListeners.add(callback);
      callback(lastConnectionStatus);
      return () => {
        connectionListeners.delete(callback);
      };
    },

    getConnectionStatus(): ProviderStatus {
      return lastConnectionStatus;
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

    // Garbage collect old tombstoned events
    garbageCollectDeletedEvents(): number {
      return WeeklyCalendarDocumentUtils.garbageCollectDeletedEvents(calendarDocument.localEvents);
    },

    // Cleanup function with proper race condition handling
    async destroy() {
      // Clear awareness state to prevent ghost collaborators
      try {
        awareness.setLocalStateField('user', null);
      } catch (err) {
        console.warn('Failed to clear awareness state:', err);
      }

      // First, flush any pending snapshots while the document is still valid
      await snapshotService.stopSnapshotBatching(weekId);

      // Wait for provider to finish connecting if in progress to avoid race condition
      if (lastConnectionStatus === 'disconnected') {
        // Provider is currently connecting, wait a brief moment for connection to stabilize
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => resolve(), 100); // Short timeout
          resolve();
        });
      }

      // Clean up provider event listeners before destroying
      provider.off('status', (event: { connected: boolean }) => {
        lastConnectionStatus = event.connected ? 'connected' : 'disconnected';
        connectionListeners.forEach(cb => cb(lastConnectionStatus));
      });

      // Then tear down providers and the document
      try {
        provider.destroy();
      } catch (err) {
        console.warn('Error destroying WebRTC provider:', err);
      }

      try {
        indexeddbProvider.destroy?.();
      } catch (err) {
        console.warn('Error destroying IndexedDB provider:', err);
      }

      doc.destroy();
      connectionListeners.clear();
    },
  };
}