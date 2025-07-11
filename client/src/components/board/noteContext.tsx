'use client';

import React, { createContext, useContext, useCallback, useRef } from 'react';
import type { NotePosition, NoteData } from '../../types/notes';

interface NoteContextValue {
  updateNote: (id: string, updates: Partial<NoteData>) => void;
  deleteNote: (id: string) => void;
  createNote: (type: NoteData['type']) => void;
  gridSnapEnabled: boolean;
  setGridSnapEnabled: (enabled: boolean) => void;
  selectedId: string | null;
  select: (id: string | null) => void;
}

const NoteContext = createContext<NoteContextValue | null>(null);

export const useNoteContext = (): NoteContextValue => {
  const context = useContext(NoteContext);
  if (!context) {
    throw new Error('useNoteContext must be used within a NoteContextProvider');
  }
  return context;
};

interface NoteContextProviderProps {
  children: React.ReactNode;
  onUpdate: (id: string, updates: Partial<NoteData>) => void;
  onDelete: (id: string) => void;
  onCreate: (type: NoteData['type']) => void;
}

export const NoteContextProvider: React.FC<NoteContextProviderProps> = ({
  children,
  onUpdate,
  onDelete,
  onCreate,
}) => {
  const [gridSnapEnabled, setGridSnapEnabled] = React.useState<boolean>(true);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const updateQueueRef = useRef<Map<string, Partial<NoteData>>>(new Map());
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  // Batched updates with debounce
  const updateNote = useCallback((id: string, updates: Partial<NoteData>): void => {
    updateQueueRef.current.set(id, {
      ...updateQueueRef.current.get(id),
      ...updates,
    });

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      const updates = Array.from(updateQueueRef.current.entries());
      updateQueueRef.current.clear();
      
      updates.forEach(([noteId, noteUpdates]) => {
        onUpdate(noteId, noteUpdates);
      });
    }, 100); // Debounce time
  }, [onUpdate]);

  const deleteNote = useCallback((id: string): void => {
    // Clear any pending updates for this note
    updateQueueRef.current.delete(id);
    if (selectedId === id) {
      setSelectedId(null);
    }
    onDelete(id);
  }, [onDelete, selectedId]);

  const select = useCallback((id: string | null): void => {
    setSelectedId(id);
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const value = React.useMemo<NoteContextValue>(() => ({
    updateNote,
    deleteNote,
    createNote: onCreate,
    gridSnapEnabled,
    setGridSnapEnabled,
    selectedId,
    select,
  }), [updateNote, deleteNote, onCreate, gridSnapEnabled, selectedId, select]);

  return (
    <NoteContext.Provider value={value}>
      {children}
    </NoteContext.Provider>
  );
};