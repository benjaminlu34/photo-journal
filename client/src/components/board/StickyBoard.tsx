'use client';

import React, { useCallback, useMemo } from 'react';
import { NoteContextProvider } from './noteContext';
import { StickyNoteShell } from '../noteShell/StickyNoteShell';
import { noteRegistry } from './noteRegistry';
import { useJournal } from '../../contexts/journal-context';
import { useCollaboration } from '../../hooks/useCollaboration';
import { useAuth } from '../../hooks/useAuth';
import { ErrorBoundary, NoteErrorBoundary } from '../ErrorBoundary';
import type { NoteData } from '../../types/notes';
import type { User } from '@shared/schema';

const getNoteTint = (type: NoteData['type']) => {
  switch (type) {
    case 'text': return 'bg-blue-50'; // noteBlue
    case 'sticky_note': return 'bg-blue-50'; // noteBlue
    case 'checklist': return 'bg-green-50'; // noteGreen
    case 'image': return 'bg-pink-50'; // notePink
    case 'voice': return 'bg-purple-50'; // notePurple
    case 'drawing': return 'bg-yellow-50'; // noteYellow
    default: return 'bg-blue-50'; // default to blue
  }
};

export const StickyBoard: React.FC = () => {
  const {
    legacyNotes,
    updateNote,
    deleteNote,
    gridSnap,
    setGridSnap
  } = useJournal();

  const { user } = useAuth();
  const { onLocalDragEnd } = useCollaboration(
    (user as User)?.id || 'anonymous',
    (user as User)?.firstName || 'Anonymous'
  );

  const handleBoardError = useCallback((error: Error) => {
    console.error('Board error:', error);
    // You could also send this to an error reporting service
  }, []);

  // Memoize note components to prevent unnecessary re-renders
  const noteComponents = useMemo(() => legacyNotes.map(note => {
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
        <StickyNoteShell
          id={note.id}
          position={note.position}
          color={getNoteTint(note.type)}
          onLocalDragEnd={onLocalDragEnd}
        >
          <NoteComponent
            content={note.content}
            onChange={(content: any) => updateNote(note.id, { content })}
          />
        </StickyNoteShell>
      </NoteErrorBoundary>
    );
  }), [legacyNotes, updateNote, deleteNote, onLocalDragEnd]);

  return (
    <ErrorBoundary onError={handleBoardError}>
      <NoteContextProvider
        onUpdate={updateNote}
        onDelete={deleteNote}
      >
        <div className="sticky-board relative w-full h-full overflow-hidden bg-gray-50">
          {/* Grid overlay when grid snap is enabled */}
          {gridSnap && (
            <div 
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #e0e7ff 1px, transparent 1px),
                  linear-gradient(to bottom, #e0e7ff 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px'
              }}
            />
          )}

          {noteComponents}

          {/* Grid snap toggle */}
          <button
            onClick={() => setGridSnap(!gridSnap)}
            className="fixed bottom-8 right-8 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
            title={gridSnap ? 'Disable grid snap' : 'Enable grid snap'}
          >
            <div className={`w-6 h-6 grid grid-cols-3 gap-0.5 ${gridSnap ? 'text-blue-500' : 'text-gray-400'}`}>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="w-1 h-1 bg-current rounded-full" />
              ))}
            </div>
          </button>
        </div>
      </NoteContextProvider>
    </ErrorBoundary>
  );
};
