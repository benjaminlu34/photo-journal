'use client';

import React, { useCallback, useMemo } from 'react';
import { NoteContextProvider } from './noteContext';
import { StickyNoteShell } from '../noteShell/StickyNoteShell';
import { noteRegistry } from './noteRegistry';
import { useBoardStore } from '../../lib/store';
import { ErrorBoundary, NoteErrorBoundary } from '../ErrorBoundary';
import { Plus, FileText, CheckSquare, Image, Mic, PenTool } from 'lucide-react';
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
    addNote,
    updateNote,
    deleteNote,
    gridSnapEnabled,
    setGridSnapEnabled
  } = useBoardStore();

  // Function to create a new note
  const createNote = useCallback((type: NoteData['type']) => {
    const id = `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const basePosition = { x: 50 + Math.random() * 300, y: 50 + Math.random() * 200, width: 200, height: 150, rotation: 0 };
    
    const contentMap = {
      text: { type: 'text' as const, text: 'New text note' },
      checklist: { type: 'checklist' as const, items: [{ id: '1', text: 'New item', completed: false }] },
      image: { type: 'image' as const, imageUrl: '', alt: 'New image note' },
      voice: { type: 'voice' as const, audioUrl: '', duration: 0 },
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

    addNote(newNote);
  }, [addNote]);

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
        <StickyNoteShell note={note} />
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

          {/* Floating action buttons */}
          <div className="fixed bottom-8 right-8 flex flex-col gap-3">
            {/* Create note buttons */}
            <div className="flex flex-col gap-2 opacity-80 hover:opacity-100 transition-opacity">
              <button
                onClick={() => createNote('text')}
                className="w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
                title="Add text note"
              >
                <FileText className="w-5 h-5" />
              </button>
              <button
                onClick={() => createNote('checklist')}
                className="w-12 h-12 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
                title="Add checklist"
              >
                <CheckSquare className="w-5 h-5" />
              </button>
              <button
                onClick={() => createNote('image')}
                className="w-12 h-12 bg-pink-500 hover:bg-pink-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
                title="Add image note"
              >
                <Image className="w-5 h-5" />
              </button>
              <button
                onClick={() => createNote('voice')}
                className="w-12 h-12 bg-purple-500 hover:bg-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
                title="Add voice note"
              >
                <Mic className="w-5 h-5" />
              </button>
              <button
                onClick={() => createNote('drawing')}
                className="w-12 h-12 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
                title="Add drawing"
              >
                <PenTool className="w-5 h-5" />
              </button>
            </div>

            {/* Grid snap toggle */}
            <button
              onClick={() => setGridSnapEnabled(!gridSnapEnabled)}
              className="w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
              title={gridSnapEnabled ? 'Disable grid snap' : 'Enable grid snap'}
            >
              <div className={`w-6 h-6 grid grid-cols-3 gap-0.5 ${gridSnapEnabled ? 'text-blue-500' : 'text-gray-400'}`}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="w-1 h-1 bg-current rounded-full" />
                ))}
              </div>
            </button>
          </div>
        </div>
      </NoteContextProvider>
    </ErrorBoundary>
  );
};
