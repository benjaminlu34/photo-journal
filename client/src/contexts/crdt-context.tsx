'use client';

import React, { createContext, useContext, useCallback } from 'react';
import { useCollaboration } from '../hooks/useCollaboration';
import { useAuth } from '../hooks/useAuth';
import type { NoteData } from '../types/notes';
import type { User } from '@shared/schema';

interface CRDTContextValue {
  createNote: (type: NoteData['type'], position?: { x: number; y: number; width?: number; height?: number; rotation?: number }) => string;
  updateNote: (id: string, updates: Partial<NoteData>) => void;
  deleteNote: (id: string) => void;
  updateCursor: (x: number, y: number) => void;
  isConnected: boolean;
  spaceId: string;
}

const CRDTContext = createContext<CRDTContextValue | null>(null);

export const useCRDT = (): CRDTContextValue => {
  const context = useContext(CRDTContext);
  if (!context) {
    throw new Error('useCRDT must be used within a CRDTProvider');
  }
  return context;
};

interface CRDTProviderProps {
  children: React.ReactNode;
  spaceId?: string;
}

export const CRDTProvider: React.FC<CRDTProviderProps> = ({ 
  children, 
  spaceId = 'default-board' 
}) => {
  const { user } = useAuth();
  
  const { 
    createNote, 
    updateNote, 
    deleteNote, 
    updateCursor, 
    isConnected 
  } = useCollaboration(
    (user as User)?.id || 'anonymous',
    (user as User)?.firstName || 'Anonymous',
    spaceId
  );

  const value = React.useMemo<CRDTContextValue>(() => ({
    createNote,
    updateNote,
    deleteNote,
    updateCursor,
    isConnected,
    spaceId,
  }), [createNote, updateNote, deleteNote, updateCursor, isConnected, spaceId]);

  return (
    <CRDTContext.Provider value={value}>
      {children}
    </CRDTContext.Provider>
  );
}; 