import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  MouseEvent as ReactMouseEvent,
} from "react";
import { useNoteContext } from "@/contexts/journal-context";
import { noteRegistry } from "@/components/board/noteRegistry";
import { snapToGrid } from "@/utils/snapToGrid";
import type { StickyNoteData } from "@/types/notes";

interface StickyNoteShellProps {
  note: StickyNoteData;
}

/**
 * Drag-&-resize shell – visual chrome only.
 * Children (rendered through noteRegistry) own their own content.
 */
export const StickyNoteShell: React.FC<StickyNoteShellProps> = ({ note }) => {
  const { updateNote, deleteNote, gridSnap } = useNoteContext();

  /* ---------------- state / refs ---------------- */
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const shellRef = useRef<HTMLDivElement>(null);

  /* ---------------- handlers ---------------- */
  const handleMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    // ignore clicks that bubble from inner content
    if (e.target !== e.currentTarget) return;

    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !shellRef.current) return;

      const workspaceRect =
        shellRef.current.parentElement?.getBoundingClientRect();
      if (!workspaceRect) return;

      let newX = e.clientX - workspaceRect.left - dragOffset.current.x;
      let newY = e.clientY - workspaceRect.top - dragOffset.current.y;

      if (gridSnap) {
        newX = snapToGrid(newX);
        newY = snapToGrid(newY);
      }

      /* 💡 Only update position here; onMouseUp you might persist. */
      updateNote(note.id, {
        position: { ...note.position, x: newX, y: newY },
        /* updatedAt will be set in updateNote implementation */
      });
    },
    [isDragging, gridSnap, note.id, note.position, updateNote],
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  /* ---------------- global listeners while dragging ---------------- */
  useEffect(() => {
    if (!isDragging) return;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  /* ---------------- dynamic note body ---------------- */
  const NoteComponent = noteRegistry[note.type]; // 🔑 property is `type`, not `kind`
  if (!NoteComponent) {
    console.warn(`Unknown note type: ${note.type}`);
    return null;
  }

  /* ---------------- render shell ---------------- */
  return (
    <div
      ref={shellRef}
      className="absolute cursor-move neu-card rounded-xl p-4 shadow-lg
                 hover:shadow-xl transition-shadow duration-200"
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
        {...note}
        onChange={(content: any) => updateNote(note.id, { content })}
        onDelete={() => deleteNote(note.id)}
      />
    </div>
  );
};
