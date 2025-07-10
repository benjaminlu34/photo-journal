/**
 * NoteContext.tsx
 * Provides selection state + CRUD callbacks to any child
 * (Shell, resize handles, context-menu, etc.) without prop chains.
 */

import { createContext, useContext } from 'react';
import type { StickyNoteData } from '@/mappers';

export interface NoteContextValue {
  selectedId: string | null;
  select: (id: string | null) => void;

  // CRUD from StickyBoard – wired to updateNote / deleteNote
  updateNote: (id: string, data: Partial<StickyNoteData>) => void;
  deleteNote: (id: string) => void;

  gridSnap: boolean; // preference toggle
}

const NoteContext = createContext<NoteContextValue | undefined>(undefined);

export const useNoteContext = (): NoteContextValue => {
  const context = useContext(NoteContext);
  if (context === undefined) {
    throw new Error('useNoteContext must be used within a NoteProvider');
  }
  return context;
};

export const NoteProvider = NoteContext.Provider;