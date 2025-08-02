/**
 * Calendar SDK for managing weekly calendar events with CRDT integration
 */

import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { LocalEvent, CalendarEvent, FriendCalendarEvent } from '@/types/calendar';
import { timezoneService } from '@/services/timezone.service';
import { snapshotService } from '@/services/snapshot.service';

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

  // Local events map (CRDT-synced)
  const localEventsMap = doc.getMap<LocalEvent>('localEvents');
  
  // Metadata for the week
  const metadata = doc.getMap<any>('metadata');

  // Undo manager for events
  const undoManager = new Y.UndoManager([localEventsMap]);

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
  localEventsMap.observe(() => {
    const events = Array.from(localEventsMap.values());
    changeListeners.forEach(cb => cb(events));
    
    // Mark pending changes for snapshot service
    snapshotService.markPendingChanges();
  });

  // Conflict resolution strategy (last-writer-wins with timestamps)
  const resolveConflict = <T>(localValue: T, remoteValue: T, localTimestamp: Date, remoteTimestamp: Date): T => {
    return remoteTimestamp > localTimestamp ? remoteValue : localValue;
  };

  // Start snapshot batching
  snapshotService.startSnapshotBatching(weekId, doc);

  // API
  return {
    // Get all local events
    getLocalEvents(): LocalEvent[] {
      return Array.from(localEventsMap.values());
    },
    
    // Create a new local event
    async createLocalEvent(event: Omit<LocalEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'collaborators'>) {
      const eventId = crypto.randomUUID();
      const now = new Date();
      
      const newEvent: LocalEvent = {
        id: eventId,
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        timezone: event.timezone || timezoneService.getUserTimezone(),
        isAllDay: event.isAllDay,
        color: event.color,
        pattern: event.pattern,
        location: event.location,
        attendees: event.attendees,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        linkedJournalEntryId: event.linkedJournalEntryId,
        reminderMinutes: event.reminderMinutes,
        collaborators: [userId], // Initially only the creator
        tags: event.tags || [],
      };
      
      localEventsMap.set(eventId, newEvent);
    },
    
    // Update a local event with conflict resolution
    async updateLocalEvent(id: string, updates: Partial<LocalEvent>) {
      const event = localEventsMap.get(id);
      if (event) {
        const now = new Date();
        const updatedEvent = { 
          ...event, 
          ...updates, 
          updatedAt: now,
          // Ensure collaborators field is preserved
          collaborators: updates.collaborators || event.collaborators
        };
        
        // Handle timezone conversion if needed
        if (updates.timezone && updates.timezone !== event.timezone) {
          const userTimezone = timezoneService.getUserTimezone();
          const convertedEvent = timezoneService.convertToLocalTime(
            updatedEvent as any, 
            userTimezone
          );
          localEventsMap.set(id, convertedEvent as LocalEvent);
        } else {
          localEventsMap.set(id, updatedEvent);
        }
      }
    },
    
    // Delete a local event
    deleteLocalEvent(id: string) {
      const event = localEventsMap.get(id);
      if (event) {
        localEventsMap.delete(id);
      }
    },
    
    // Get metadata
    getMetadata(): any {
      return Object.fromEntries(metadata.entries());
    },
    
    // Update metadata
    updateMetadata(updates: Record<string, any>) {
      Object.entries(updates).forEach(([key, value]) => {
        metadata.set(key, value);
      });
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
      snapshotService.stopSnapshotBatching();
    },
  };
}