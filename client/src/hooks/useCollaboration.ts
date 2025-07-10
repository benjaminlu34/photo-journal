'use client';

import { useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness';
import { useBoardStore } from '../lib/store';
import type { NoteData } from '../types/notes';

// Types for awareness (cursor positions, selections, etc.)
export interface AwarenessState {
  user: {
    id: string;
    name: string;
    color: string;
  };
  cursor?: {
    x: number;
    y: number;
  };
  selectedNoteId?: string | null;
}

interface YjsChangeEvent {
  changes: {
    keys: Map<string, { action: 'add' | 'update' | 'delete' }>;
  };
  origin?: any; // Yjs origin for tracking local vs remote changes
}

interface CollaborationResult {
  updateCursor: (x: number, y: number) => void;
  onLocalDragEnd: () => void; // Signal when local drag ends
}

const ROOM_NAME = 'photo-journal-board';
const SYNC_RETRY_DELAY = 1000;
const MAX_SYNC_RETRIES = 3;
const CRDT_ECHO_THROTTLE = 150; // ms to ignore remote updates after local drag

const isDevelopment = process.env.NODE_ENV === 'development';

export const useCollaboration = (userId: string, userName: string): CollaborationResult => {
  const {
    notes,
    batchUpdateNotes,
    deleteNote,
    setUserId,
    selectedId,
  } = useBoardStore();

  // Refs to hold Yjs instances
  const docRef = useRef<Y.Doc>();
  const providerRef = useRef<WebrtcProvider>();
  const persistenceRef = useRef<IndexeddbPersistence>();
  const retryCountRef = useRef<number>(0);
  const lastLocalDragRef = useRef<number>(0);

  // Initialize Yjs document and providers
  const initYjs = useCallback((): void => {
    try {
      // Create Yjs document
      const doc = new Y.Doc();
      docRef.current = doc;

      // Initialize WebRTC provider for real-time sync
      const provider = new WebrtcProvider(ROOM_NAME, doc, {
        signaling: ['wss://signaling.yjs.dev'],
        awareness: new Awareness(doc),
      });

      // Set initial awareness state
      provider.awareness.setLocalState({
        user: {
          id: userId,
          name: userName,
          color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        },
      });

      providerRef.current = provider;

      // Initialize IndexedDB provider for offline persistence
      const persistence = new IndexeddbPersistence(ROOM_NAME, doc);
      persistenceRef.current = persistence;

      // Set up the notes map
      const notesMap = doc.getMap('notes');

      // Initial sync
      const initialNotes = Object.entries(notes).reduce<Record<string, NoteData>>((acc, [id, note]) => {
        acc[id] = note;
        return acc;
      }, {});

      notesMap.forEach((_: unknown, key: string) => {
        if (!initialNotes[key]) {
          notesMap.delete(key);
        }
      });

      Object.entries(initialNotes).forEach(([id, note]) => {
        notesMap.set(id, note);
      });

      // Listen for changes with CRDT echo throttling
      notesMap.observe((event: YjsChangeEvent) => {
        // Throttle CRDT echo - ignore remote updates from this client for 150ms after local drag
        const now = Date.now();
        if (event.origin && event.origin.clientID === doc.clientID && 
            now - lastLocalDragRef.current < CRDT_ECHO_THROTTLE) {
          return;
        }

        const updates: Array<[string, Partial<NoteData>]> = [];

        event.changes.keys.forEach((change, key) => {
          if (change.action === 'add' || change.action === 'update') {
            const note = notesMap.get(key) as NoteData;
            if (note) {
              updates.push([key, note]);
            }
          } else if (change.action === 'delete') {
            // Handle remote deletes through the store action
            deleteNote(key);
          }
        });

        if (updates.length > 0) {
          batchUpdateNotes(updates);
        }
      });

      // Handle awareness changes (cursor positions, selections)
      provider.awareness.on('change', () => {
        if (isDevelopment) {
          const states = Array.from(provider.awareness.getStates().values()) as AwarenessState[];
          console.log('Awareness states:', states);
        }
      });

      // Set userId in store
      setUserId(userId);

      // Reset retry count on successful connection
      retryCountRef.current = 0;
    } catch (error) {
      console.error('Failed to initialize Yjs:', error);
      
      // Retry initialization with backoff
      if (retryCountRef.current < MAX_SYNC_RETRIES) {
        retryCountRef.current++;
        setTimeout(initYjs, SYNC_RETRY_DELAY * retryCountRef.current);
      }
    }
  }, [userId, userName, notes, batchUpdateNotes, setUserId, deleteNote]);

  // Update awareness state when selection changes
  useEffect(() => {
    if (providerRef.current) {
      const currentState = providerRef.current.awareness.getLocalState() || {};
      providerRef.current.awareness.setLocalState({
        ...currentState,
        selectedNoteId: selectedId,
      });
    }
  }, [selectedId]);

  // Initialize on mount
  useEffect(() => {
    initYjs();

    // Cleanup on unmount
    return () => {
      if (docRef.current) {
        docRef.current.destroy();
      }
      if (providerRef.current) {
        providerRef.current.destroy();
      }
      if (persistenceRef.current) {
        persistenceRef.current.destroy();
      }
    };
  }, [initYjs]);

  // Update remote cursor position
  const updateCursor = useCallback((x: number, y: number): void => {
    if (providerRef.current) {
      const currentState = providerRef.current.awareness.getLocalState() || {};
      providerRef.current.awareness.setLocalState({
        ...currentState,
        cursor: { x, y },
      });
    }
  }, []);

  // Signal when local drag ends to start CRDT echo throttling
  const onLocalDragEnd = useCallback((): void => {
    lastLocalDragRef.current = Date.now();
  }, []);

  return {
    updateCursor,
    onLocalDragEnd,
  };
}; 