'use client';

import React, { useCallback, useMemo } from 'react';
import { StickyNoteShell }   from '../../noteShell/StickyNoteShell/StickyNoteShell';
import { noteRegistry }      from '../noteRegistry/noteRegistry';
import { useBoardStore }     from '@/lib/board-store';   // ← path matches the new store
import { useUser }           from '@/hooks/useUser';
import { useCRDT }           from '@/contexts/crdt-context';
import { ErrorBoundary, NoteErrorBoundary } from '../../ErrorBoundary/ErrorBoundary';

import type { NoteData } from '@/types/notes';
import type { User }     from '@shared/schema/schema';

interface StickyBoardProps {
  spaceId?: string;        // kept for future routing / debugging
  currentUserRole?: 'owner' | 'editor' | 'contributor' | 'viewer';
  currentUserId?: string;
}

export const StickyBoard: React.FC<StickyBoardProps> = ({
  spaceId = 'default-board',
  currentUserRole = 'owner',
  currentUserId,
}) => {
  /* ────────────────────────────  state  ──────────────────────────── */

  // Zustand slices
  const notes          = useBoardStore((s) => s.notes);
  const { create, update, remove } = useBoardStore((s) => s.actions);

  // auth / presence
  const { data: user } = useUser();
  const { isConnected } = useCRDT();        // for the "offline" chip

  /* ─────────────────────────── side-effects ───────────────────────── */


  /* ─────────────────────────── handlers ──────────────────────────── */

  const handleBoardError = useCallback((err: Error) => {
    console.error('[StickyBoard] uncaught error', err);
  }, []);

  const handleCreateNote = useCallback(
    async (type: NoteData['type']) => {
      // Check permissions before allowing note creation
      if (currentUserRole === 'viewer' || currentUserRole === undefined) {
        return;
      }

      const id = `note-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // minimal default content per type
      const content: NoteData['content'] = (() => {
        switch (type) {
          case 'checklist':  return { type: 'checklist',  items: [] };
          case 'image':      return { type: 'image',      imageUrl: '', alt: '' };
          default:
            throw new Error(`Unknown note type: ${type}`);
        }
      })();

      try {
        await create({
          id,
          type,
          position : { x: 100, y: 100, width: 200, height: 150, rotation: 0 },
          content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to create note:', error);
      }
    },
    [create, currentUserRole, user?.id],
  );

  /* ─────────────────────────── derived UI ────────────────────────── */

  const renderedNotes = useMemo(
    () =>
      Object.values(notes).map((note) => {
        const NoteComponent = noteRegistry[note.type];
        if (!NoteComponent) {
          console.warn(`Unknown note type: ${note.type}`);
          return null;
        }

        return (
          <NoteErrorBoundary key={note.id} noteId={note.id} onDelete={remove}>
           <StickyNoteShell
             note={note}
             updateNote={update}
             deleteNote={remove}
             currentUserRole={currentUserRole}
             currentUserId={user?.id}
           >
             {/* each note owns its own editor / viewer: */}
             <NoteComponent
               content={note.content as any}
               onChange={(c: any) => update(note.id, { content: c })}
               noteId={note.id}
             />
           </StickyNoteShell>
         </NoteErrorBoundary>
        );
      }),
    [notes, update, remove, currentUserRole, currentUserId],
  );

  /* ─────────────────────────── render ────────────────────────────── */

  return (
    <ErrorBoundary onError={handleBoardError}>
      <div className="sticky-board relative w-full h-full overflow-hidden bg-gray-50">
        {/* connection status chip */}
        {!isConnected && (
          <div className="absolute top-2 right-2 z-50 rounded bg-yellow-100 border border-yellow-400 px-2 py-1 text-xs text-yellow-800">
            Offline mode
          </div>
        )}

        {renderedNotes}
      </div>
    </ErrorBoundary>
  );
};
