"use client";

import React, { useRef, useState, useCallback } from "react";
import { useNoteContext } from "@/components/board/noteContext";
import { snapToGrid } from "@/utils/snapToGrid";
import { cn } from "@/lib/utils";
import { GripHorizontal, X } from "lucide-react";
import type { ContentBlockData } from "@/types/journal";

/*───────────────────────────────────────────────────────────
  Types
───────────────────────────────────────────────────────────*/
export interface StickyNoteShellProps {
  data: ContentBlockData;
  children: React.ReactNode;
}

/*───────────────────────────────────────────────────────────
  Component
───────────────────────────────────────────────────────────*/
export const StickyNoteShell: React.FC<StickyNoteShellProps> = ({
  data,
  children,
}) => {
  /* ------- context ------- */
  const { selectedId, select, updateNote, deleteNote, gridSnap } = useNoteContext();
  const isSelected = selectedId === data.id;

  /* ------- refs / state ------- */
  const shellRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const livePos = useRef({ x: data.position.x, y: data.position.y });
  const rafId = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  /* ------- helpers ------- */
  const applyTransform = (x: number, y: number) => {
    if (shellRef.current) {
      shellRef.current.style.transform = `translate3d(${x}px,${y}px,0) rotate(${data.position.rotation}deg)`;
    }
  };

  const getBlockColor = () => {
    switch (data.type) {
      case 'sticky_note':
        return 'sticky-note yellow';
      case 'photo':
        return 'sticky-note blue';
      case 'audio':
        return 'sticky-note purple';
      case 'drawing':
        return 'sticky-note green';
      case 'checklist':
        return 'sticky-note rose';
      default:
        return 'sticky-note yellow';
    }
  };

  /* ------- drag logic ------- */
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only start drag if hitting the grip bar or drag-enabled area
      const target = e.target as HTMLElement;
      if (!target.closest("[data-grip]") && !target.hasAttribute("data-drag-handle")) return;

      e.preventDefault();
      e.stopPropagation();

      // Add anti-selection during drag
      document.body.classList.add('user-select-none');
      setIsDragging(true);

      // Board offset - find the workspace container
      const board = document.querySelector('[data-workspace="true"]') as HTMLElement || shellRef.current?.offsetParent as HTMLElement || document.body;
      const boardRect = board.getBoundingClientRect();

      dragStart.current = {
        dx: e.clientX - boardRect.left - data.position.x,
        dy: e.clientY - boardRect.top - data.position.y,
      };

      // Capture pointer first so we never miss the first move
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      select(data.id);

      const handleMove = (ev: PointerEvent) => {
        ev.preventDefault();
        const boardRectMove = board.getBoundingClientRect();
        let newX = ev.clientX - boardRectMove.left - dragStart.current.dx;
        let newY = ev.clientY - boardRectMove.top - dragStart.current.dy;

        if (gridSnap) {
          newX = snapToGrid(newX);
          newY = snapToGrid(newY);
        }
        livePos.current = { x: newX, y: newY };

        if (!rafId.current) {
          rafId.current = requestAnimationFrame(() => {
            applyTransform(livePos.current.x, livePos.current.y);
            rafId.current = 0;
          });
        }
      };

      const handleUp = () => {
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
        document.body.classList.remove('user-select-none');
        setIsDragging(false);
        
        updateNote(data.id, {
          position: { ...data.position, ...livePos.current },
        });
      };

      document.addEventListener("pointermove", handleMove, { passive: false });
      document.addEventListener("pointerup", handleUp);
    },
    [data, gridSnap, select, updateNote]
  );

  /*───────────────────────────────────────────────────────────*/

  return (
    <article
      ref={shellRef}
      role="group"
      tabIndex={0}
      aria-roledescription="sticky note"
      className={cn(
        "absolute select-none rounded-2xl shadow-neu overflow-hidden group interactive",
        getBlockColor(),
        "transition-all duration-200 will-change-transform",
        isDragging && "opacity-80 scale-105",
        isSelected && "ring-2 ring-primary/50"
      )}
      style={{
        width: data.position.width,
        height: data.position.height,
        transform: `translate3d(${data.position.x}px,${data.position.y}px,0) rotate(${data.position.rotation}deg)`,
        zIndex: isDragging || isSelected ? 1000 : 1,
      }}
      onPointerDown={onPointerDown}
      onClick={() => select(data.id)}
    >
      {/* Grip bar */}
      <div
        data-grip
        className={cn(
          "h-8 w-full rounded-t-2xl cursor-grab transition-all",
          isDragging ? "cursor-grabbing" : "",
          "flex items-center justify-between px-3",
          "border-b border-white/20"
        )}
        style={{
          background: `linear-gradient(135deg, 
            ${getBlockColor().includes('rose') ? 'rgba(251, 207, 232, 0.3)' : 
              getBlockColor().includes('blue') ? 'rgba(219, 234, 254, 0.3)' : 
              getBlockColor().includes('green') ? 'rgba(209, 250, 229, 0.3)' : 
              getBlockColor().includes('yellow') ? 'rgba(254, 243, 199, 0.3)' : 
              getBlockColor().includes('purple') ? 'rgba(233, 213, 255, 0.3)' : 
              'rgba(243, 244, 246, 0.3)'} 0%, 
            rgba(255, 255, 255, 0.15) 100%)`
        }}
      >
        <GripHorizontal className="w-4 h-4 text-muted-foreground pointer-events-none" />
        
        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteNote(data.id);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center text-xs"
          title="Delete note"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Content slot */}
      <div className="p-4 h-[calc(100%-2rem)] overflow-hidden">{children}</div>
    </article>
  );
};

export default StickyNoteShell;