import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  MouseEvent as ReactMouseEvent,
} from "react";
import { useNoteContext } from "@/components/board/noteContext";
import { noteRegistry } from "@/components/board/noteRegistry";
import { snapToGrid } from "@/utils/snapToGrid";
import { Trash2 } from "lucide-react";
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
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const dragOffset = useRef({ x: 0, y: 0 });
  const shellRef = useRef<HTMLDivElement>(null);
  const initialPosition = useRef({ x: 0, y: 0, width: 0, height: 0 });

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
    e.preventDefault();
  }, []);

  const handleResizeStart = useCallback((e: ReactMouseEvent<HTMLDivElement>, direction: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    setIsResizing(true);
    setResizeDirection(direction);
    
    initialPosition.current = {
      x: note.position.x,
      y: note.position.y,
      width: note.position.width,
      height: note.position.height,
    };
  }, [note.position]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if ((!isDragging && !isResizing) || !shellRef.current) return;

      const workspaceRect =
        shellRef.current.parentElement?.getBoundingClientRect();
      if (!workspaceRect) return;

      if (isDragging) {
        let newX = e.clientX - workspaceRect.left - dragOffset.current.x;
        let newY = e.clientY - workspaceRect.top - dragOffset.current.y;

        if (gridSnap) {
          newX = snapToGrid(newX);
          newY = snapToGrid(newY);
        }

        updateNote(note.id, {
          position: { ...note.position, x: newX, y: newY },
        });
      } else if (isResizing) {
        const mouseX = e.clientX - workspaceRect.left;
        const mouseY = e.clientY - workspaceRect.top;
        
        let newWidth = initialPosition.current.width;
        let newHeight = initialPosition.current.height;
        let newX = initialPosition.current.x;
        let newY = initialPosition.current.y;

        if (resizeDirection.includes('right')) {
          newWidth = Math.max(120, mouseX - initialPosition.current.x);
        }
        if (resizeDirection.includes('bottom')) {
          newHeight = Math.max(80, mouseY - initialPosition.current.y);
        }
        if (resizeDirection.includes('left')) {
          const deltaX = mouseX - initialPosition.current.x;
          newWidth = Math.max(120, initialPosition.current.width - deltaX);
          newX = mouseX;
        }
        if (resizeDirection.includes('top')) {
          const deltaY = mouseY - initialPosition.current.y;
          newHeight = Math.max(80, initialPosition.current.height - deltaY);
          newY = mouseY;
        }

        if (gridSnap) {
          newWidth = snapToGrid(newWidth);
          newHeight = snapToGrid(newHeight);
          newX = snapToGrid(newX);
          newY = snapToGrid(newY);
        }

        updateNote(note.id, {
          position: { 
            ...note.position, 
            x: newX, 
            y: newY, 
            width: newWidth, 
            height: newHeight 
          },
        });
      }
    },
    [isDragging, isResizing, gridSnap, note.id, note.position, updateNote, resizeDirection],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeDirection('');
  }, []);

  /* ---------------- global listeners while dragging/resizing ---------------- */
  useEffect(() => {
    if (!isDragging && !isResizing) return;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

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
      className="absolute group neu-card rounded-xl shadow-lg
                 hover:shadow-xl transition-shadow duration-200"
      style={{
        left: note.position.x,
        top: note.position.y,
        width: note.position.width,
        height: note.position.height,
        transform: `rotate(${note.position.rotation}deg)`,
        zIndex: isDragging || isResizing ? 1000 : 1,
      }}
    >
      {/* Header area for dragging */}
      <div 
        className="absolute top-0 left-0 right-0 h-8 cursor-move bg-transparent rounded-t-xl"
        onMouseDown={handleMouseDown}
      />
      
      {/* Content area */}
      <div className="h-full p-4 pt-8">
        <NoteComponent
          content={note.content}
          onChange={(content: any) => updateNote(note.id, { content })}
        />
      </div>

      {/* Delete button */}
      <button
        className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 
                   rounded-full flex items-center justify-center opacity-0 
                   group-hover:opacity-100 transition-opacity duration-200"
        onClick={() => deleteNote(note.id)}
      >
        <Trash2 className="w-3 h-3 text-white" />
      </button>

      {/* Resize handles */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {/* Corner handles */}
        <div 
          className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-se-resize"
          onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
        />
        <div 
          className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-ne-resize"
          onMouseDown={(e) => handleResizeStart(e, 'top-right')}
        />
        <div 
          className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-sw-resize"
          onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
        />
        <div 
          className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-nw-resize"
          onMouseDown={(e) => handleResizeStart(e, 'top-left')}
        />
        
        {/* Edge handles */}
        <div 
          className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-8 bg-blue-500 rounded cursor-e-resize"
          onMouseDown={(e) => handleResizeStart(e, 'right')}
        />
        <div 
          className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-8 bg-blue-500 rounded cursor-w-resize"
          onMouseDown={(e) => handleResizeStart(e, 'left')}
        />
        <div 
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-3 bg-blue-500 rounded cursor-s-resize"
          onMouseDown={(e) => handleResizeStart(e, 'bottom')}
        />
        <div 
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-3 bg-blue-500 rounded cursor-n-resize"
          onMouseDown={(e) => handleResizeStart(e, 'top')}
        />
      </div>
    </div>
  );
};

