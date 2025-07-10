import { useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { StickyNoteData } from '@/components/StickyNote/StickyNote';

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
}

export const useCollaboration = (spaceId: string) => {
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [indexeddbProvider] = useState(() => new IndexeddbPersistence(spaceId, ydoc));
  const [notes, setNotes] = useState<StickyNoteData[]>([]);
  const [users, setUsers] = useState<Map<string, UserPresence>>(new Map());
  const [currentUser] = useState<UserPresence>({
    id: Math.random().toString(36).substr(2, 9),
    name: `User ${Math.floor(Math.random() * 1000)}`,
    color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
  });

  useEffect(() => {
    // Create WebSocket provider (fallback to local if no server)
    const wsProvider = new WebsocketProvider(
      'ws://localhost:1234', 
      spaceId, 
      ydoc,
      { 
        connect: false // Don't auto-connect, we'll handle it manually
      }
    );

    // Try to connect, but don't fail if server is not available
    try {
      wsProvider.connect();
    } catch (error) {
      console.log('WebSocket server not available, working offline');
    }

    setProvider(wsProvider);

    // Get or create the notes array in the shared document
    const yNotes = ydoc.getArray<StickyNoteData>('notes');

    // Subscribe to changes
    const updateNotes = () => {
      setNotes(yNotes.toArray());
    };

    yNotes.observe(updateNotes);
    updateNotes(); // Initial load

    // Handle presence awareness
    const awareness = wsProvider.awareness;
    awareness.setLocalStateField('user', currentUser);

    const updateUsers = () => {
      const states = awareness.getStates();
      const userMap = new Map<string, UserPresence>();
      
      states.forEach((state, clientId) => {
        if (state.user && clientId !== awareness.clientID) {
          userMap.set(clientId.toString(), state.user);
        }
      });
      
      setUsers(userMap);
    };

    awareness.on('change', updateUsers);
    updateUsers();

    return () => {
      yNotes.unobserve(updateNotes);
      awareness.off('change', updateUsers);
      wsProvider.destroy();
    };
  }, [spaceId, ydoc, currentUser]);

  const addNote = useCallback((note: StickyNoteData) => {
    const yNotes = ydoc.getArray<StickyNoteData>('notes');
    yNotes.push([note]);
  }, [ydoc]);

  const updateNote = useCallback((noteId: string, updates: Partial<StickyNoteData>) => {
    const yNotes = ydoc.getArray<StickyNoteData>('notes');
    const noteIndex = yNotes.toArray().findIndex(note => note.id === noteId);
    
    if (noteIndex >= 0) {
      const currentNote = yNotes.get(noteIndex);
      const updatedNote = { ...currentNote, ...updates, updatedAt: new Date() };
      yNotes.delete(noteIndex, 1);
      yNotes.insert(noteIndex, [updatedNote]);
    }
  }, [ydoc]);

  const deleteNote = useCallback((noteId: string) => {
    const yNotes = ydoc.getArray<StickyNoteData>('notes');
    const noteIndex = yNotes.toArray().findIndex(note => note.id === noteId);
    
    if (noteIndex >= 0) {
      yNotes.delete(noteIndex, 1);
    }
  }, [ydoc]);

  const updateCursor = useCallback((x: number, y: number) => {
    if (provider?.awareness) {
      provider.awareness.setLocalStateField('user', {
        ...currentUser,
        cursor: { x, y }
      });
    }
  }, [provider, currentUser]);

  return {
    notes,
    users,
    currentUser,
    addNote,
    updateNote,
    deleteNote,
    updateCursor,
    isConnected: provider?.wsconnected ?? false,
  };
};