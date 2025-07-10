import React, { useState, useCallback, useMemo } from 'react';
import { useCollaboration } from '@/hooks/useCollaboration';
import { NoteProvider } from './noteContext';
import { StickyNoteShell } from '@/components/noteShell/StickyNoteShell';
import { noteRegistry } from './noteRegistry';
import type { NoteKind } from '@/types/notes';
import type { StickyNoteData } from '@/types/notes';
import { nanoid } from 'nanoid';

interface BoardProps { spaceId?: string; }

export const CollabStickyBoard: React.FC<BoardProps> = ({ spaceId = 'demo-space' }) => {
  const { notes, addNote, updateNote, deleteNote, isConnected } = useCollaboration(spaceId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gridSnap, setGridSnap] = useState(true);

  const handleCreate = useCallback((kind: NoteKind) => {
    const newNote: StickyNoteData = {
      id: nanoid(),
      type: kind,
      content: kind === 'checklist' ? { items: [] } : {},
      position: { x: 80, y: 80, width: 250, height: 200, rotation: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addNote(newNote);
    setSelectedId(newNote.id);
  }, [addNote]);

  const ctxValue = useMemo(() => ({
    selectedId,
    select: setSelectedId,
    updateNote,
    deleteNote,
    gridSnap,
  }), [selectedId, updateNote, deleteNote, gridSnap]);

  return (
    <NoteProvider value={ctxValue}>
      <div className="relative w-full h-full pinboard-bg overflow-hidden">
        <div className="absolute top-4 left-4 z-50 flex gap-2 pointer-events-auto">
          {(['text','checklist','image','voice','drawing'] as NoteKind[]).map(k => (
            <button
              key={k}
              onClick={() => handleCreate(k)}
              className="px-3 py-1 rounded-md shadow-neu text-sm bg-white/80"
            >
              + {k}
            </button>
          ))}
          <label className="ml-4 flex items-center gap-1 text-xs">
            <input type="checkbox" checked={gridSnap} onChange={() => setGridSnap(!gridSnap)} />
            Grid
          </label>
          <span className="text-xs ml-auto px-2 py-1 rounded bg-white/80">
            {isConnected ? 'online' : 'offline'}
          </span>
        </div>
        {notes.map(note => (
          <StickyNoteShell key={note.id} note={note} />
        ))}
      </div>
    </NoteProvider>
  );
};
