import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';

// Types
import type { NoteData } from '@/types/notes';



export type BoardSDK = ReturnType<typeof createBoardSDK>;

// Singleton registry for BoardSDK instances
export const sdkRegistry: Record<string, ReturnType<typeof createBoardSDK>> = {};

export function getBoardSdk(spaceId: string, userId = 'anonymous', userName = 'Anonymous', username?: string) {
  // Create user-scoped key to prevent cross-user contamination
  const userScopedKey = `${spaceId}-${userId}`;
  if (!sdkRegistry[userScopedKey]) {
    sdkRegistry[userScopedKey] = createBoardSDK({ spaceId, userId, userName, username });
  }
  return sdkRegistry[userScopedKey];
}

export function createBoardSDK({
  spaceId,
  userId,
  userName,
  username,
}: {
  spaceId: string;
  userId: string;
  userName: string;
  username?: string;
}) {
  // Yjs doc and providers
  const doc = new Y.Doc();
  const provider = new WebrtcProvider(`journal-board-${spaceId}`, doc, {
    signaling: ['wss://signaling.yjs.dev'],
    maxConns: 3,
  });
  const indexeddbProvider = new IndexeddbPersistence(`journal-board-${spaceId}`, doc);

  // Track IndexedDB sync state for conflict resolution
  let indexedDbSynced = false;
  indexeddbProvider.on('synced', () => {
    indexedDbSynced = true;
  });

  // Handle IndexedDB quota exceeded errors
  indexeddbProvider.on('sync', (isSynced: boolean) => {
    if (!isSynced) {
      console.warn('Board SDK: IndexedDB sync failed - possible quota exceeded');
      // Could notify user here via a callback if needed
    }
  });

  // Notes map
  const notesMap = doc.getMap<NoteData>('notes');

  // Undo manager for notes
  const undoManager = new Y.UndoManager(notesMap);

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
  let changeListeners: Array<(notes: NoteData[]) => void> = [];
  notesMap.observe(() => {
    const notes = Array.from(notesMap.values());
    changeListeners.forEach(cb => cb(notes));
  });

  // Connection status tracking for presence indicator
  type ProviderStatus = 'connected' | 'disconnected';
  const connectionListeners = new Set<(status: ProviderStatus) => void>();
  let lastConnectionStatus: ProviderStatus = 'disconnected';
  provider.on('status', (event: { connected: boolean }) => {
    lastConnectionStatus = event.connected ? 'connected' : 'disconnected';
    connectionListeners.forEach(cb => cb(lastConnectionStatus));
  });

  // Helper function to generate signed URLs for image notes
  const generateSignedUrlForImage = async (storagePath: string): Promise<string | undefined> => {
    if (!storagePath) return undefined;
    
    try {
      // Use direct Supabase Storage like ImageNote does
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase.storage
        .from('journal-images')
        .createSignedUrl(storagePath, 3600); // 1 hour TTL
      
      if (error) {
        console.error('Failed to generate signed URL:', error);
        return undefined;
      }
      
      return data?.signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      return undefined;
    }
  };

  // Helper function to process image content
  // Do not persist signed URLs into document content.
  // Image components resolve fresh signed URLs via server + cache at render time.
  const processImageContent = async (content: any): Promise<any> => {
    return content;
  };

  // API
  return {
    getNotes(): NoteData[] {
      return Array.from(notesMap.values());
    },
    async createNote(note: NoteData) {
      // Add creator information to the note
      const noteWithCreator = {
        ...note,
        createdBy: {
          id: userId,
          username: username,
          firstName: userName,
        }
      };

      // Process image content to include signed URLs if needed
      if (noteWithCreator.content.type === 'image') {
        noteWithCreator.content = await processImageContent(noteWithCreator.content);
      }

      // Use transaction for atomic update
      doc.transact(() => {
        notesMap.set(note.id, noteWithCreator);
      }, 'create-note');
    },
    async updateNote(id: string, updates: Partial<NoteData>) {
      const note = notesMap.get(id);
      if (note) {
        // Process image content outside of transaction
        let processedContent = note.content;
        if (updates.content && updates.content.type === 'image') {
          processedContent = await processImageContent(updates.content);
        }

        // Use transaction for atomic update
        doc.transact(() => {
          const updatedNote = {
            ...note,
            ...updates,
            content: processedContent,
            updatedAt: new Date().toISOString()
          };
          notesMap.set(id, updatedNote);
        }, 'update-note');
      }
    },
    deleteNote(id: string) {
      const note = notesMap.get(id);
      if (note) {
        // Use transaction for atomic update
        doc.transact(() => {
          notesMap.delete(id);
        }, 'delete-note');
      }
    },
    presence: awareness,
    undo() {
      undoManager.undo();
    },
    redo() {
      undoManager.redo();
    },
    // Refresh signed URLs for image notes is no longer needed at the document level.
    // Signed URLs are resolved on render via ImageNote with cache and auto-refresh.
    async refreshImageUrls() {
      return;
    },

    // Get notes with fresh signed URLs for friend access
    async getNotesWithFreshUrls(): Promise<NoteData[]> {
      const notes = Array.from(notesMap.values());
      const processedNotes = await Promise.all(
        notes.map(async (note) => {
          if (note.content.type === 'image') {
            const processedContent = await processImageContent(note.content);
            return { ...note, content: processedContent };
          }
          return note;
        })
      );
      return processedNotes;
    },

    // Update note with storage metadata (called after successful upload)
    updateNoteWithStorageMetadata(id: string, storagePath: string, signedUrl: string) {
      const note = notesMap.get(id);
      if (note && note.content.type === 'image') {
        // Use transaction for atomic update
        doc.transact(() => {
          const updatedContent = {
            ...note.content,
            storagePath,
            imageUrl: signedUrl,
            // Remove temporary upload ID if present
            uploadId: undefined,
          };
          notesMap.set(id, {
            ...note,
            content: updatedContent,
            updatedAt: new Date().toISOString()
          });
        }, 'update-note-storage');
      }
    },

    onChange(cb: (notes: NoteData[]) => void) {
      changeListeners.push(cb);
      return () => {
        changeListeners = changeListeners.filter(fn => fn !== cb);
      };
    },

    onConnectionStatusChange(callback: (status: 'connected' | 'disconnected') => void) {
      connectionListeners.add(callback);
      callback(lastConnectionStatus);
      return () => {
        connectionListeners.delete(callback);
      };
    },

    getConnectionStatus(): 'connected' | 'disconnected' {
      return lastConnectionStatus;
    },

    async destroy() {
      // Clear awareness state to prevent ghost collaborators
      try {
        awareness.setLocalStateField('user', null);
      } catch (err) {
        console.warn('Failed to clear awareness state:', err);
      }

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