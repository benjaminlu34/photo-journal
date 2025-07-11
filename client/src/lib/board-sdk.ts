import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';

// Types
import type { NoteData } from '@/types/notes';

export type BoardSDK = ReturnType<typeof createBoardSDK>;

// Singleton registry for BoardSDK instances
const sdkRegistry: Record<string, ReturnType<typeof createBoardSDK>> = {};

export function getBoardSdk(spaceId: string, userId = 'anonymous', userName = 'Anonymous') {
  if (!sdkRegistry[spaceId]) {
    sdkRegistry[spaceId] = createBoardSDK({ spaceId, userId, userName });
  }
  return sdkRegistry[spaceId];
}

export function createBoardSDK({
  spaceId,
  userId,
  userName,
}: {
  spaceId: string;
  userId: string;
  userName: string;
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
  awareness.setLocalStateField('user', {
    id: userId,
    name: userName,
    color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
  });

  // Change listeners
  let changeListeners: Array<(notes: NoteData[]) => void> = [];
  notesMap.observe(() => {
    const notes = Array.from(notesMap.values());
    changeListeners.forEach(cb => cb(notes));
  });

  // API
  return {
    getNotes(): NoteData[] {
      return Array.from(notesMap.values());
    },
    createNote(note: NoteData) {
      notesMap.set(note.id, note);
    },
    updateNote(id: string, updates: Partial<NoteData>) {
      const note = notesMap.get(id);
      if (note) {
        notesMap.set(id, { ...note, ...updates, updatedAt: new Date().toISOString() });
      }
    },
    deleteNote(id: string) {
      notesMap.delete(id);
    },
    presence: awareness,
    undo() {
      undoManager.undo();
    },
    redo() {
      undoManager.redo();
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