import React, { Suspense, useState, useCallback, useMemo } from 'react';
import { useCollaboration } from '@/hooks/useCollaboration';
import { NoteProvider }    from './noteContext';
import { noteRegistry, NoteKind } from './noteRegistry';
import { StickyNoteShell } from '@/components/noteShell/StickyNoteShell';
import Spinner             from '@/components/ui/Spinner'; // any tiny loader you already have
import '@/styles/pinboard.css';     // supplies .pinboard-bg

export const StickyBoard: React.FC<{ spaceId?: string }> = ({ spaceId = 'demo-space' }) => {
  /* ────────────────────────────────
     Collab state (Firm #1’s hook)
  ─────────────────────────────────*/
  const {
    notes,
    currentUser,
    users,
    addNote,
    updateNote,
    deleteNote,
    updateCursor,
    isConnected,
  } = useCollaboration(spaceId);

  /* ────────────────────────────────
     UI state
  ─────────────────────────────────*/
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gridSnap,   setGridSnap]   = useState(true);

  /* ────────────────────────────────
     Handlers
  ─────────────────────────────────*/
  const handleCreate = useCallback((kind: NoteKind) => {
    const newNote = {
      id: `${currentUser.id}-${Date.now()}`,
      type: kind,
      content: kind === 'checklist' ? [] : '',
      position: { x: 80, y: 80, width: 250, height: 200, rotation: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    addNote(newNote);
    setSelectedId(newNote.id);
  }, [addNote, currentUser.id]);

  const boardValue = useMemo(() => ({
    selectedId,
    select: setSelectedId,
    updateNote,
    deleteNote,
    gridSnap,
  }), [selectedId, updateNote, deleteNote, gridSnap]);

  /* ────────────────────────────────
     Render
  ─────────────────────────────────*/
  return (
    <NoteProvider value={boardValue}>
      <div
        className="relative w-full h-full pinboard-bg overflow-hidden"
        onMouseMove={(e) => updateCursor(e.clientX, e.clientY)}
      >
        {/* Toolbar  */}
        <div className="absolute top-4 left-4 z-50 flex gap-2">
          {(['text', 'checklist', 'image', 'voice'] as NoteKind[]).map(k => (
            <button
              key={k}
              onClick={() => handleCreate(k)}
              className="px-3 py-1 rounded-md shadow-neu text-sm bg-surface-elevated"
            >
              + {k}
            </button>
          ))}
          <label className="ml-4 flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={gridSnap}
              onChange={() => setGridSnap(!gridSnap)}
            />
            Grid-snap
          </label>
          <span className="text-xs ml-auto px-2 py-1 rounded bg-surface-elevated">
            {isConnected ? '🟢 online' : '⚪️ offline'}
          </span>
        </div>

        {/* Notes  */}
        <Suspense fallback={<Spinner />}>
          {notes.map(note => {
            const NoteBody = noteRegistry[note.type] ?? (() => null);
            return (
              <StickyNoteShell
                key={note.id}
                data={note}
              >
                <NoteBody
                  {...(note as any)}
                  onChange={(content: any) => updateNote(note.id, { content })}
                />
              </StickyNoteShell>
            );
          })}
        </Suspense>

        {/* Cursor overlay (Firm #1) */}
        <CursorOverlay users={users} />
      </div>
    </NoteProvider>
  );
};

export default StickyBoard;
