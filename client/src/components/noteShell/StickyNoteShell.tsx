import { useState, useRef, useCallback } from "react";
import { useNoteContext } from "@/components/board/noteContext";
import { noteRegistry } from "@/components/board/noteRegistry";
import { snapToGrid } from "@/utils/snapToGrid";
import type { StickyNoteData } from "@/mappers";

interface StickyNoteShellProps {
  note: StickyNoteData;
}

export const StickyNoteShell: React.FC<StickyNoteShellProps> = ({ note }) => {
  const { updateNote, deleteNote, gridSnap } = useNoteContext();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const shellRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return; // Don't drag if clicking on content
    
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !shellRef.current) return;
    
    const workspaceRect = shellRef.current.parentElement?.getBoundingClientRect();
    if (!workspaceRect) return;

    let newX = e.clientX - workspaceRect.left - dragOffset.x;
    let newY = e.clientY - workspaceRect.top - dragOffset.y;

    if (gridSnap) {
      newX = snapToGrid(newX);
      newY = snapToGrid(newY);
    }

    updateNote(note.id, {
      position: {
        ...note.position,
        x: newX,
        y: newY,
      },
    });
  }, [isDragging, dragOffset, gridSnap, note.id, note.position, updateNote]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Attach global mouse events for dragging
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const NoteComponent = noteRegistry[note.kind];
  if (!NoteComponent) {
    console.warn(`Unknown note kind: ${note.kind}`);
    return null;
  }

  return (
    <div
      ref={shellRef}
      className="absolute cursor-move neu-card rounded-xl p-4 shadow-lg hover:shadow-xl transition-shadow duration-200"
      style={{
        left: note.position.x,
        top: note.position.y,
        width: note.position.width,
        height: note.position.height,
        transform: `rotate(${note.position.rotation}deg)`,
        zIndex: isDragging ? 1000 : 1,
      }}
      onMouseDown={handleMouseDown}
    >
      <NoteComponent
        content={note.content}
        onChange={(content: any) => updateNote(note.id, { content })}
      />
    </div>
  );
};