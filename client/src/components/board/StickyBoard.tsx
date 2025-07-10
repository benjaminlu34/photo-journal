'use client';

import React, { useCallback, useMemo } from 'react';
import { NoteContextProvider } from './noteContext';
import { StickyNoteShell } from '../noteShell/StickyNoteShell';
import { noteRegistry } from './noteRegistry';
import { useBoardStore } from '../../lib/store';
import { ErrorBoundary, NoteErrorBoundary } from '../ErrorBoundary';
import type { NoteData } from '../../types/notes';

const getNoteTint = (type: NoteData['type']) => {
  switch (type) {
    case 'text': return 'bg-blue-50'; // noteBlue
    case 'checklist': return 'bg-green-50'; // noteGreen
    case 'image': return 'bg-pink-50'; // notePink
    case 'voice': return 'bg-purple-50'; // notePurple
    case 'drawing': return 'bg-yellow-50'; // noteYellow
    default: return 'bg-blue-50'; // default to blue
  }
};

export const StickyBoard: React.FC = () => {
  const {
    notes,
    updateNote,
    deleteNote,
    gridSnapEnabled,
    setGridSnapEnabled
  } = useBoardStore();

  // Convert notes object to array
  const notesList = useMemo(() => Object.values(notes), [notes]);

  const handleBoardError = useCallback((error: Error) => {
    console.error('Board error:', error);
    // You could also send this to an error reporting service
  }, []);

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
        <StickyNoteShell
          id={note.id}
          position={note.position}
          color={getNoteTint(note.type)}
        >
          <NoteComponent
            content={note.content}
            onChange={(content: any) => updateNote(note.id, { content })}
          />
        </StickyNoteShell>
      </NoteErrorBoundary>
    );
  }), [notesList, updateNote, deleteNote]);

  return (
    <ErrorBoundary onError={handleBoardError}>
      <NoteContextProvider
        onUpdate={updateNote}
        onDelete={deleteNote}
      >
        <div className="sticky-board relative w-full h-full overflow-hidden bg-gray-50">
          {/* Grid overlay when grid snap is enabled */}
          {gridSnapEnabled && (
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
            onClick={() => setGridSnapEnabled(!gridSnapEnabled)}
            className="fixed bottom-8 right-8 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
            title={gridSnapEnabled ? 'Disable grid snap' : 'Enable grid snap'}
          >
            <div className={`w-6 h-6 grid grid-cols-3 gap-0.5 ${gridSnapEnabled ? 'text-blue-500' : 'text-gray-400'}`}>
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
