import { useCallback, useState } from 'react';
import { useJournal } from '@/contexts/journal-context';
import { noteRegistry, type NoteKind } from './noteRegistry';
import { NoteProvider } from './noteContext';
import { StickyNoteShell } from '@/components/noteShell/StickyNoteShell';
import type { StickyNoteData } from '@/mappers';
import type { ContentBlockType, Position } from '@/types/journal';
import { Plus } from 'lucide-react';

interface StickyBoardProps {
  spaceId?: string;
}

export const StickyBoard: React.FC<StickyBoardProps> = ({ spaceId = 'demo-space' }) => {
  const {
    legacyNotes,
    createContentBlock,
    updateNote,
    deleteNote,
    gridSnap,
    setGridSnap,
  } = useJournal();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleCreate = useCallback(
    (kind: NoteKind) => {
      const position: Position = {
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 100,
        width: 240,
        height: 180,
        rotation: Math.random() * 6 - 3,
      };

      const typeMap: Record<NoteKind, ContentBlockType> = {
        text: 'text',
        checklist: 'checklist',
        image: 'photo',
        voice: 'audio',
        drawing: 'drawing',
      };

      let content: any;
      switch (kind) {
        case 'text':
          content = { text: '' };
          break;
        case 'checklist':
          content = { items: [] };
          break;
        case 'image':
          content = { imageUrl: undefined, alt: undefined };
          break;
        case 'voice':
          content = { audioUrl: undefined, duration: undefined };
          break;
        case 'drawing':
          content = { strokes: [] };
          break;
        default:
          content = {};
      }

      createContentBlock(typeMap[kind], content, position);
    },
    [createContentBlock]
  );

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

        {/* Add note button */}
        <button
          onClick={() => handleCreate('text')}
          className="fixed bottom-8 right-24 w-12 h-12 gradient-button rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 pointer-events-auto"
          title="Add note"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>
    </NoteProvider>
  );
};