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
      // Delay the server call slightly to ensure local state is preserved
      setTimeout(() => {
        updateNote(note.id, { position: localPosition });
      }, 50);
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
      className="absolute group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden border border-gray-100"
      style={{
        left: localPosition.x,
        top: localPosition.y,
        width: localPosition.width,
        height: localPosition.height,
        transform: `rotate(${localPosition.rotation}deg)`,
        zIndex: isDragging || isResizing ? 1000 : 1,
      }}
    >
      {/* Header area for dragging - sleek design like mockup */}
      <div
        className="absolute top-0 left-0 right-0 h-12 cursor-move bg-gradient-to-b from-gray-50 to-white border-b border-gray-100 rounded-t-2xl flex items-center justify-center group-hover:from-gray-100 transition-colors duration-200"
        onMouseDown={handleMouseDown}
      >
        {/* Drag indicator dots - more subtle and refined */}
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
        </div>
      </div>

      {/* Content area - clean padding and spacing */}
      <div className="h-full pt-12 pb-0">
        <NoteComponent
          content={note.content}
          onChange={(content: any) => updateNote(note.id, { content })}
        />
      </div>

      {/* Delete button - sleek design */}
      <button
        className="absolute top-3 right-3 w-7 h-7 bg-red-500 hover:bg-red-600 
                   rounded-full flex items-center justify-center opacity-0 
                   group-hover:opacity-100 transition-all duration-200 shadow-md hover:shadow-lg"
        onClick={() => deleteNote(note.id)}
      >
        <Trash2 className="w-3.5 h-3.5 text-white" />
      </button>

      {/* Resize handles - sleek and refined */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {/* Corner handles - refined design */}
        <div
          className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-md cursor-se-resize flex items-center justify-center shadow-md hover:shadow-lg transition-shadow"
          onMouseDown={(e) => handleResizeStart(e, "bottom-right")}
        >
          <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-white/70"></div>
        </div>
        <div
          className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-md cursor-ne-resize flex items-center justify-center shadow-md hover:shadow-lg transition-shadow"
          onMouseDown={(e) => handleResizeStart(e, "top-right")}
        >
          <div className="w-2.5 h-2.5 border-r-2 border-t-2 border-white/70"></div>
        </div>
        <div
          className="absolute -bottom-1 -left-1 w-5 h-5 bg-blue-500 rounded-md cursor-sw-resize flex items-center justify-center shadow-md hover:shadow-lg transition-shadow"
          onMouseDown={(e) => handleResizeStart(e, "bottom-left")}
        >
          <div className="w-2.5 h-2.5 border-l-2 border-b-2 border-white/70"></div>
        </div>
        <div
          className="absolute -top-1 -left-1 w-5 h-5 bg-blue-500 rounded-md cursor-nw-resize flex items-center justify-center shadow-md hover:shadow-lg transition-shadow"
          onMouseDown={(e) => handleResizeStart(e, "top-left")}
        >
          <div className="w-2.5 h-2.5 border-l-2 border-t-2 border-white/70"></div>
        </div>

        {/* Edge handles - refined sizes */}
        <div
          className="absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-8 bg-blue-500 rounded-md cursor-e-resize shadow-md hover:shadow-lg transition-shadow"
          onMouseDown={(e) => handleResizeStart(e, "right")}
        />
        <div
          className="absolute -left-1 top-1/2 -translate-y-1/2 w-2.5 h-8 bg-blue-500 rounded-md cursor-w-resize shadow-md hover:shadow-lg transition-shadow"
          onMouseDown={(e) => handleResizeStart(e, "left")}
        />
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2.5 bg-blue-500 rounded-md cursor-s-resize shadow-md hover:shadow-lg transition-shadow"
          onMouseDown={(e) => handleResizeStart(e, "bottom")}
        />
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-2.5 bg-blue-500 rounded-md cursor-n-resize shadow-md hover:shadow-lg transition-shadow"
          onMouseDown={(e) => handleResizeStart(e, "top")}
        />
      </div>
    </div>
  );
};
