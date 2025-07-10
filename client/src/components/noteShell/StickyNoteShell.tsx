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
  const [resizeDirection, setResizeDirection] = useState<string>("");
  const [localPosition, setLocalPosition] = useState(note.position);
  const dragOffset = useRef({ x: 0, y: 0 });
  const shellRef = useRef<HTMLDivElement>(null);
  const initialPosition = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Sync local position when note.position changes from external updates
  useEffect(() => {
    if (!isDragging && !isResizing) {
      setLocalPosition(note.position);
    }
  }, [note.position, isDragging, isResizing]);

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

  const handleResizeStart = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>, direction: string) => {
      e.stopPropagation();
      e.preventDefault();

      setIsResizing(true);
      setResizeDirection(direction);

      initialPosition.current = {
        x: localPosition.x,
        y: localPosition.y,
        width: localPosition.width,
        height: localPosition.height,
      };
    },
    [localPosition],
  );

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

        // Update local position immediately for smooth 60fps dragging
        const newPosition = { ...localPosition, x: newX, y: newY };
        setLocalPosition(newPosition);
      } else if (isResizing) {
        const mouseX = e.clientX - workspaceRect.left;
        const mouseY = e.clientY - workspaceRect.top;

        let newWidth = initialPosition.current.width;
        let newHeight = initialPosition.current.height;
        let newX = initialPosition.current.x;
        let newY = initialPosition.current.y;

        if (resizeDirection.includes("right")) {
          newWidth = Math.max(120, mouseX - initialPosition.current.x);
        }
        if (resizeDirection.includes("bottom")) {
          newHeight = Math.max(80, mouseY - initialPosition.current.y);
        }
        if (resizeDirection.includes("left")) {
          const deltaX = mouseX - initialPosition.current.x;
          newWidth = Math.max(120, initialPosition.current.width - deltaX);
          newX = mouseX;
        }
        if (resizeDirection.includes("top")) {
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

        // Update local position immediately for smooth resizing
        const newPosition = {
          ...localPosition,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        };
        setLocalPosition(newPosition);
      }
    },
    [isDragging, isResizing, gridSnap, localPosition, resizeDirection],
  );

  const handleMouseUp = useCallback(() => {
    // Only persist to server when drag/resize ends (one network call)
    if (isDragging || isResizing) {
      updateNote(note.id, { position: localPosition });
    }

    setIsDragging(false);
    setIsResizing(false);
    setResizeDirection("");
  }, [isDragging, isResizing, localPosition, note.id, updateNote]);

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
                 hover:shadow-xl transition-shadow duration-200 overflow-hidden"
      style={{
        left: localPosition.x,
        top: localPosition.y,
        width: localPosition.width,
        height: localPosition.height,
        transform: `rotate(${localPosition.rotation}deg)`,
        zIndex: isDragging || isResizing ? 1000 : 1,
      }}
    >
      {/* Header area for dragging - like the mockup */}
      <div
        className="absolute top-0 left-0 right-0 h-10 cursor-move bg-gradient-to-b from-black/8 to-black/3 rounded-t-xl group-hover:from-black/12 group-hover:to-black/5 transition-colors duration-200 flex items-center justify-center"
        onMouseDown={handleMouseDown}
      >
        {/* Drag indicator dots like in mockup */}
        <div className="flex items-center gap-1">
          <div className="w-1 h-1 bg-black/20 rounded-full"></div>
          <div className="w-1 h-1 bg-black/20 rounded-full"></div>
          <div className="w-1 h-1 bg-black/20 rounded-full"></div>
        </div>
      </div>

      {/* Content area - preserve content during drag/resize */}
      <div className="h-full pt-10 pb-0">
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
        {/* Corner handles - better than simple balls */}
        <div
          className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-sm cursor-se-resize flex items-center justify-center"
          onMouseDown={(e) => handleResizeStart(e, "bottom-right")}
        >
          <div className="w-2 h-2 border-r-2 border-b-2 border-white/60"></div>
        </div>
        <div
          className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-sm cursor-ne-resize flex items-center justify-center"
          onMouseDown={(e) => handleResizeStart(e, "top-right")}
        >
          <div className="w-2 h-2 border-r-2 border-t-2 border-white/60"></div>
        </div>
        <div
          className="absolute -bottom-1 -left-1 w-4 h-4 bg-blue-500 rounded-sm cursor-sw-resize flex items-center justify-center"
          onMouseDown={(e) => handleResizeStart(e, "bottom-left")}
        >
          <div className="w-2 h-2 border-l-2 border-b-2 border-white/60"></div>
        </div>
        <div
          className="absolute -top-1 -left-1 w-4 h-4 bg-blue-500 rounded-sm cursor-nw-resize flex items-center justify-center"
          onMouseDown={(e) => handleResizeStart(e, "top-left")}
        >
          <div className="w-2 h-2 border-l-2 border-t-2 border-white/60"></div>
        </div>

        {/* Edge handles */}
        <div
          className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-6 bg-blue-500 rounded cursor-e-resize"
          onMouseDown={(e) => handleResizeStart(e, "right")}
        />
        <div
          className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-6 bg-blue-500 rounded cursor-w-resize"
          onMouseDown={(e) => handleResizeStart(e, "left")}
        />
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-blue-500 rounded cursor-s-resize"
          onMouseDown={(e) => handleResizeStart(e, "bottom")}
        />
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-blue-500 rounded cursor-n-resize"
          onMouseDown={(e) => handleResizeStart(e, "top")}
        />
      </div>
    </div>
  );
};
