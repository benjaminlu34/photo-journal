/**
 * NoteContext.tsx
 * Provides selection state + CRUD callbacks to any child
 * (Shell, resize handles, context-menu, etc.) without prop chains.
 */

import React, { createContext, useContext } from 'react';
import { StickyNoteData } from '@/components/noteTypes/types'; // adjust path if needed

export interface NoteContextValue {
  selectedId: string | null;
  select:      (id: string | null) => void;

  // CRUD from StickyBoard – wired to Yjs updateNote / deleteNote
  updateNote:  (id: string, data: Partial<StickyNoteData>) => void;
  deleteNote:  (id: string) => void;

  gridSnap: boolean;          // preference toggle
}

const NoteContext = createContext<NoteContextValue | null>(null);

export const useNoteContext = (): NoteContextValue => {
  const ctx = useContext(NoteContext);
  if (!ctx) throw new Error('useNoteContext must be used inside <NoteContext.Provider>');
  return ctx;
};

export const NoteProvider = NoteContext.Provider;
