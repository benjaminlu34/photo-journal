'use client';

import { useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness';
import { useBoardStore } from '../lib/store';
import type { NoteData, NoteContent } from '../types/notes';

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
  createNote: (type: NoteData['type'], position?: { x: number; y: number; width?: number; height?: number; rotation?: number }) => string;
  updateNote: (id: string, updates: Partial<NoteData>) => void;
  deleteNote: (id: string) => void;
  isConnected: boolean;
}

const SYNC_RETRY_DELAY = 1000;
const MAX_SYNC_RETRIES = 3;
const CRDT_ECHO_THROTTLE = 150; // ms to ignore remote updates after local drag

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * useCollaboration
 *
 * ⚠️ Never call useCollaboration outside CRDTProvider. This hook must only be used inside CRDTProvider to ensure a single Yjs doc/provider per spaceId.
 *
 * Handles Yjs document and WebRTC provider setup for real-time board collaboration.
 */
export const useCollaboration = (userId: string, userName: string, spaceId: string = 'default-board'): CollaborationResult => {
  if (import.meta.env.DEV) {
    (window as any).__yjsRooms = (window as any).__yjsRooms || {};
    if ((window as any).__yjsRooms[spaceId]) {
      throw new Error(`Yjs Doc for room "${spaceId}" already exists in this tab!`);
    }
    (window as any).__yjsRooms[spaceId] = true;
  }

  const {
    notes,
    batchUpdateNotes,
    deleteNote: storeDeleteNote,
    setUserId,
    selectedId,
  } = useBoardStore();

  // Refs to hold Yjs instances
  const docRef = useRef<Y.Doc>();
  const providerRef = useRef<WebrtcProvider>();
  const persistenceRef = useRef<IndexeddbPersistence>();
  const retryCountRef = useRef<number>(0);
  const lastLocalDragRef = useRef<number>(0);
  const isConnectedRef = useRef<boolean>(false);

  // Initialize Yjs document and providers
  const initYjs = useCallback((): void => {
    try {
      // Create Yjs document
      const doc = new Y.Doc();
      docRef.current = doc;

      // Create room name using spaceId to separate boards
      const roomName = `journal-board-${spaceId}`;

      // Initialize WebRTC provider for real-time sync
      const provider = new WebrtcProvider(roomName, doc, {
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
      const persistence = new IndexeddbPersistence(roomName, doc);
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
            storeDeleteNote(key);
          }
        });

        if (updates.length > 0) {
          batchUpdateNotes(updates);
        }
      });

      // Handle awareness changes (cursor positions, selections)
      provider.awareness.on('change', () => {
        // Only log when there are actual changes and not empty states
        if (isDevelopment) {
          const states = Array.from(provider.awareness.getStates().values()) as AwarenessState[];
          if (states.length > 0) {
            console.log('Awareness states:', states);
          }
        }
      });

      // Track connection status
      provider.on('status', ({ connected }: { connected: boolean }) => {
        isConnectedRef.current = connected;
        if (isDevelopment) {
          console.log('Yjs connection status:', connected ? 'connected' : 'disconnected');
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
  }, [userId, userName, notes, batchUpdateNotes, setUserId, storeDeleteNote, spaceId]);

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
      // Remove from __yjsRooms registry (for hot reload/dev)
      if (import.meta.env.DEV && (window as any).__yjsRooms) {
        delete (window as any).__yjsRooms[spaceId];
      }
    };
  }, [initYjs]);

  // Create a new note in the Yjs document
  const createNote = useCallback((type: NoteData['type'], position?: { x: number; y: number; width?: number; height?: number; rotation?: number }): string => {
    if (!docRef.current) {
      throw new Error('Yjs document not initialized');
    }

    const notesMap = docRef.current.getMap('notes');
    const id = `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const basePosition = {
      x: position?.x ?? 50 + Math.random() * 300,
      y: position?.y ?? 50 + Math.random() * 200,
      width: position?.width ?? 200,
      height: position?.height ?? 150,
      rotation: position?.rotation ?? 0
    };
    
    const contentMap: Record<NoteData['type'], NoteContent> = {
      text: { type: 'text' as const, text: 'New text note' },
      sticky_note: { type: 'sticky_note' as const, text: 'New sticky note' },
      checklist: { type: 'checklist' as const, items: [{ id: '1', text: 'New item', completed: false }] },
      image: { type: 'image' as const, imageUrl: undefined, alt: undefined },
      voice: { type: 'voice' as const, audioUrl: undefined, duration: undefined },
      drawing: { type: 'drawing' as const, strokes: [] }
    };

    const newNote: NoteData = {
      id,
      type,
      position: basePosition,
      content: contentMap[type],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add to Yjs document - this will trigger the observer and sync to all clients
    notesMap.set(id, newNote);

    return id;
  }, []);

  // Update a note in the Yjs document
  const updateNote = useCallback((id: string, updates: Partial<NoteData>): void => {
    if (!docRef.current) {
      throw new Error('Yjs document not initialized');
    }

    const notesMap = docRef.current.getMap('notes');
    const existingNote = notesMap.get(id) as NoteData;
    
    if (!existingNote) {
      console.warn(`Note ${id} not found in Yjs document`);
      return;
    }

    const updatedNote: NoteData = {
      ...existingNote,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Update in Yjs document - this will trigger the observer and sync to all clients
    notesMap.set(id, updatedNote);
  }, []);

  // Delete a note from the Yjs document
  const deleteNote = useCallback((id: string): void => {
    if (!docRef.current) {
      throw new Error('Yjs document not initialized');
    }

    const notesMap = docRef.current.getMap('notes');
    
    // Delete from Yjs document - this will trigger the observer and sync to all clients
    notesMap.delete(id);
  }, []);

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
    createNote,
    updateNote,
    deleteNote,
    isConnected: isConnectedRef.current,
  };
}; 