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
  });
  const indexeddbProvider = new IndexeddbPersistence(`journal-board-${spaceId}`, doc);

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

      notesMap.set(note.id, noteWithCreator);
    },
    async updateNote(id: string, updates: Partial<NoteData>) {
      const note = notesMap.get(id);
      if (note) {
        const updatedNote = { ...note, ...updates, updatedAt: new Date().toISOString() };
        
        // Process image content to include signed URLs if needed
        if (updatedNote.content.type === 'image' && updates.content) {
          updatedNote.content = await processImageContent(updatedNote.content);
        }

        notesMap.set(id, updatedNote);
      }
    },
    deleteNote(id: string) {
      const note = notesMap.get(id);
      if (note) {
        notesMap.delete(id);
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
      }
    },

    onChange(cb: (notes: NoteData[]) => void) {
      changeListeners.push(cb);
      return () => {
        changeListeners = changeListeners.filter(fn => fn !== cb);
      };
    },
    destroy() {
      provider.destroy();
      indexeddbProvider.destroy?.();
      doc.destroy();
    },
  };
}