'use client';

import React, { useCallback, useMemo } from 'react';
import { NoteContextProvider } from './noteContext';
import { StickyNoteShell } from '../noteShell/StickyNoteShell';
import { noteRegistry } from './noteRegistry';
import { useBoardStore } from '../../lib/store';
import { useCollaboration } from '../../hooks/useCollaboration';
import { useAuth } from '../../hooks/useAuth';
import { ErrorBoundary, NoteErrorBoundary } from '../ErrorBoundary';
import { FileText, CheckSquare, Image, Mic, PenTool } from 'lucide-react';
import type { NoteData } from '../../types/notes';
import type { User } from '@shared/schema';

//

export const StickyBoard: React.FC<{ spaceId?: string }> = ({ spaceId = 'default-board' }) => {
  console.log('[StickyBoard] using spaceId:', spaceId);
  const {
    notes,
    setUserId
  } = useBoardStore();

  const { user } = useAuth();
  const { 
    updateCursor, 
    createNote, 
    updateNote, 
    deleteNote,
    isConnected 
  } = useCollaboration(
    (user as User)?.id || 'anonymous',
    (user as User)?.firstName || 'Anonymous',
    spaceId
  );

  // Set user ID for rate limiting
  React.useEffect(() => {
    setUserId((user as User)?.id || null);
  }, [(user as User)?.id, setUserId]);

  const handleBoardError = useCallback((error: Error) => {
    console.error('Board error:', error);
    // You could also send this to an error reporting service
  }, []);

  // Convert notes object to array
  const notesList = useMemo(() => Object.values(notes), [notes]);

  // Function to create a new note - now uses CRDT-first approach
  const handleCreateNote = useCallback((type: NoteData['type']) => {
    try {
      createNote(type);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  }, [createNote]);

  // Memoize note components to prevent unnecessary re-renders
  const noteComponents = useMemo(() => notesList.map(note => {
    const NoteComponent = noteRegistry[note.type];
    if (!NoteComponent) {
      console.warn(`Unknown note type: ${note.type}`);
      return null;
    }

    return (
      <NoteErrorBoundary
        key={note.id}
        noteId={note.id}
        onDelete={deleteNote}
      >
        <StickyNoteShell note={note} />
      </NoteErrorBoundary>
    );
  }), [notesList, deleteNote]);

  return (
    <ErrorBoundary onError={handleBoardError}>
      <NoteContextProvider
        onUpdate={updateNote}
        onDelete={deleteNote}
        onCreate={handleCreateNote}
      >
        <div className="sticky-board relative w-full h-full overflow-hidden bg-gray-50">
          {/* Connection status indicator */}
          {!isConnected && (
            <div className="absolute top-2 right-2 z-50 bg-yellow-100 border border-yellow-400 text-yellow-800 px-2 py-1 rounded text-xs">
              Offline Mode
            </div>
          )}
          {noteComponents}
        </div>
      </NoteContextProvider>
    </ErrorBoundary>
  );
};
