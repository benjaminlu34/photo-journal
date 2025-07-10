import { useCallback, useState } from 'react';
import { useJournal } from '@/contexts/journal-context';
import { noteRegistry, type NoteKind } from './noteRegistry';
import { NoteProvider } from './noteContext';
import { StickyNoteShell } from '@/components/noteShell/StickyNoteShell';
import type { StickyNoteData } from '@/mappers';

interface StickyBoardProps {
  spaceId?: string;
}

export const StickyBoard: React.FC<StickyBoardProps> = ({ spaceId = 'demo-space' }) => {
  const { legacyNotes, updateNote, deleteNote, gridSnap, setGridSnap } = useJournal();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleCreate = useCallback((kind: NoteKind) => {
    // For now, just create a simple note via the existing system
    // This will be enhanced later with proper note creation
    console.log('Creating note of type:', kind);
  }, []);

  const handleUpdateNote = useCallback((id: string, data: Partial<StickyNoteData>) => {
    updateNote(id, data);
  }, [updateNote]);

  const handleDeleteNote = useCallback((id: string) => {
    deleteNote(id);
  }, [deleteNote]);

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const contextValue = {
    selectedId,
    select: handleSelect,
    updateNote: handleUpdateNote,
    deleteNote: handleDeleteNote,
    gridSnap,
  };

  return (
    <NoteProvider value={contextValue}>
      <div className="absolute inset-0 pointer-events-none">
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
        
        {/* Render notes */}
        {legacyNotes.map((note) => (
          <StickyNoteShell key={note.id} note={note} />
        ))}
        
        {/* Grid snap toggle button */}
        <button
          onClick={() => setGridSnap(!gridSnap)}
          className="fixed bottom-8 right-8 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50 pointer-events-auto"
          title={gridSnap ? 'Disable grid snap' : 'Enable grid snap'}
        >
          <div className={`w-6 h-6 grid grid-cols-3 gap-0.5 ${gridSnap ? 'text-blue-500' : 'text-gray-400'}`}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="w-1 h-1 bg-current rounded-full" />
            ))}
          </div>
        </button>
      </div>
    </NoteProvider>
  );
};