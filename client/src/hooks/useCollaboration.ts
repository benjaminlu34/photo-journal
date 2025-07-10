import { useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { StickyNoteData } from '@/types/notes';

export interface UserPresence {
  id: string;
}

export const useCollaboration = (spaceId: string) => {
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [notes, setNotes] = useState<StickyNoteData[]>([]);

  useEffect(() => {
    const wsProvider = new WebsocketProvider(`ws://${window.location.host}/collab/${spaceId}`, spaceId, ydoc);
    const indexeddb = new IndexeddbPersistence(spaceId, ydoc);
    setProvider(wsProvider);

    const yNotes = ydoc.getArray<StickyNoteData>('notes');
    const updateNotes = () => setNotes(yNotes.toArray());
    yNotes.observe(updateNotes);
    updateNotes();

    return () => {
      yNotes.unobserve(updateNotes);
      wsProvider.destroy();
      indexeddb.destroy();
    };
  }, [spaceId, ydoc]);

  const addNote = useCallback((note: StickyNoteData) => {
    ydoc.getArray<StickyNoteData>('notes').push([note]);
  }, [ydoc]);

  const updateNote = useCallback((id: string, updates: Partial<StickyNoteData>) => {
    const yNotes = ydoc.getArray<StickyNoteData>('notes');
    const arr = yNotes.toArray();
    const index = arr.findIndex(n => n.id === id);
    if (index >= 0) {
      const updated = { ...arr[index], ...updates, updatedAt: new Date().toISOString() };
      yNotes.delete(index, 1);
      yNotes.insert(index, [updated]);
    }
  }, [ydoc]);

  const deleteNote = useCallback((id: string) => {
    const yNotes = ydoc.getArray<StickyNoteData>('notes');
    const arr = yNotes.toArray();
    const index = arr.findIndex(n => n.id === id);
    if (index >= 0) {
      yNotes.delete(index, 1);
    }
  }, [ydoc]);

  const isConnected = provider?.wsconnected ?? false;

  return { notes, addNote, updateNote, deleteNote, isConnected };
};
