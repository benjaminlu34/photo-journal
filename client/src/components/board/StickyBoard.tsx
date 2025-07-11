'use client';

import React, { useCallback, useMemo } from 'react';
import { NoteContextProvider } from './noteContext';
import { StickyNoteShell } from '../noteShell/StickyNoteShell';
import { noteRegistry } from './noteRegistry';
import { useBoardStore } from '../../lib/store';
import { useCollaboration } from '../../hooks/useCollaboration';
import { useAuth } from '../../hooks/useAuth';
import { ErrorBoundary, NoteErrorBoundary } from '../ErrorBoundary';
import { FileText, CheckSquare, Image, Mic, PenTool, Grid3X3 } from 'lucide-react';
import type { NoteData } from '../../types/notes';
import type { User } from '@shared/schema';

//

export const StickyBoard: React.FC<{ spaceId?: string }> = ({ spaceId = 'default-board' }) => {
  const {
    notes,
    addNote,
    updateNote,
    deleteNote,
    setUserId
  } = useBoardStore();

  const { user } = useAuth();
  const { updateCursor } = useCollaboration(
    (user as User)?.id || 'anonymous',
    (user as User)?.firstName || 'Anonymous',
    spaceId
  );

  // Set user ID for rate limiting
  React.useEffect(() => {
    setUserId(user?.id || null);
  }, [user?.id, setUserId]);

  const handleBoardError = useCallback((error: Error) => {
    console.error('Board error:', error);
    // You could also send this to an error reporting service
  }, []);

  // Convert notes object to array
  const notesList = useMemo(() => Object.values(notes), [notes]);

  // Function to create a new note
  const createNote = useCallback((type: NoteData['type']) => {
    const id = `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const basePosition = { x: 50 + Math.random() * 300, y: 50 + Math.random() * 200, width: 200, height: 150, rotation: 0 };
    
    const contentMap = {
      text: { type: 'text' as const, text: 'New text note' },
      checklist: { type: 'checklist' as const, items: [{ id: '1', text: 'New item', completed: false }] },
      image: { type: 'image' as const, imageUrl: null, alt: 'New image note' },
      voice: { type: 'voice' as const, audioUrl: null, duration: 0 },
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
      >
        <div className="sticky-board relative w-full h-full overflow-hidden bg-gray-50">
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
          </div>
        </div>
      </NoteContextProvider>
    </ErrorBoundary>
  );
};
