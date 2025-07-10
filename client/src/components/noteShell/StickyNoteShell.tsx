'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useNoteContext } from '../board/noteContext';
import { noteRegistry } from '../board/noteRegistry';
import { snapToGrid } from '../../utils/snapToGrid';
import { useMobile } from '../../hooks/use-mobile';
import { cn } from '../../lib/utils';
import { Trash2 } from 'lucide-react';
import type { NotePosition, NoteData } from '../../types/notes';

interface DragPosition {
  x: number;
  y: number;
}

interface StickyNoteShellProps {
  note: NoteData;
}

// Utility function to get note background color based on type (matching mockup)
const getNoteTint = (noteType: string) => {
  switch (noteType) {
    case 'text': return '#E7EEFF'; // noteBlue
    case 'checklist': return '#E7F8F1'; // noteGreen
    case 'image': return '#F5E1F5'; // notePink
    case 'voice': return '#ECE7FF'; // notePurple
    case 'drawing': return '#FFF4E6'; // noteYellow
    default: return '#E7EEFF'; // default to blue
  }
};

export const StickyNoteShell = React.memo(function StickyNoteShell({ 
  note
}: StickyNoteShellProps) {
  const { updateNote, deleteNote, gridSnapEnabled, selectedId, select } = useNoteContext();
  const { id, position, type, content } = note;
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const isMobile = useMobile();
  
  const noteRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<DragPosition>({ x: 0, y: 0 });
  const livePosRef = useRef<DragPosition>({ x: position.x, y: position.y });
  const rafRef = useRef<number>();
  const touchIdentifierRef = useRef<number | null>(null);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Ignore if clicking on content that shouldn't trigger drag
    if ((e.target as HTMLElement).closest('[data-drag-ignore]')) {
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.classList.add('user-select-none');
    
    const board = noteRef.current?.closest('.sticky-board');
    const boardRect = board?.getBoundingClientRect();
    
    if (boardRect) {
      dragStartRef.current = {
        x: e.clientX - position.x - boardRect.left,
        y: e.clientY - position.y - boardRect.top
      };
    }

    setIsDragging(true);
    touchIdentifierRef.current = e.pointerId;
  }, [position]);

  const moveNote = useCallback((e: React.PointerEvent) => {
    if (!isDragging || e.pointerId !== touchIdentifierRef.current) return;
    e.preventDefault();

    const board = noteRef.current?.closest('.sticky-board');
    const boardRect = board?.getBoundingClientRect();
    
    if (!boardRect) return;

    // Calculate new position
    let newX = e.clientX - dragStartRef.current.x - boardRect.left;
    let newY = e.clientY - dragStartRef.current.y - boardRect.top;

    // Apply grid snap if enabled
    if (gridSnapEnabled) {
      newX = snapToGrid(newX);
      newY = snapToGrid(newY);
    }

    // Update live position with RAF
    livePosRef.current = { x: newX, y: newY };
    
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        if (noteRef.current) {
          noteRef.current.style.transform = `translate(${livePosRef.current.x}px, ${livePosRef.current.y}px)`;
        }
        rafRef.current = undefined;
      });
    }
  }, [isDragging, gridSnapEnabled]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging || e.pointerId !== touchIdentifierRef.current) return;
    
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.classList.remove('user-select-none');
    setIsDragging(false);
    touchIdentifierRef.current = null;

    // Cancel any pending RAF
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }

    // Final position update - preserve other position properties
    updateNote(id, { 
      position: {
        ...position,
        x: livePosRef.current.x,
        y: livePosRef.current.y
      }
    });
  }, [id, isDragging, updateNote, position]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== touchIdentifierRef.current) return;

    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.classList.remove('user-select-none');
    setIsDragging(false);
    touchIdentifierRef.current = null;

    // Cancel any pending RAF
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }

    // Revert to original position
    if (noteRef.current) {
      noteRef.current.style.transform = `translate(${position.x}px, ${position.y}px)`;
    }
  }, [position]);

  // Get the appropriate component for this note type
  const NoteComponent = noteRegistry[type];
  if (!NoteComponent) {
    console.warn(`Unknown note type: ${type}`);
    return null;
  }

  return (
    <div
      ref={noteRef}
      className={cn(
        "absolute select-none group overflow-hidden cursor-pointer",
        "rounded-[16px]", // 12px large rounded corners as per mockup
        "shadow-note hover:shadow-noteHover transition-all duration-300",
        selectedId === id && "ring-1 ring-purple-500 shadow-noteSelected"
      )}
      style={{
        backgroundColor: getNoteTint(type), // Solid pastel body matching mockup
        left: position.x,
        top: position.y,
        width: position.width,
        height: position.height,
        transform: `rotate(${position.rotation || 0}deg)`,
        zIndex: isDragging ? 1000 : 1,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={moveNote}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={() => select?.(id)}
    >
      {/* White 32px top bar with 6-dot grip - exactly like mockup */}
      <div
        className="absolute top-0 left-0 right-0 h-8 cursor-move bg-white border-b border-gray-100 rounded-t-[16px] flex items-center justify-center"
        data-drag-handle
      >
        {/* 6-dot grip pattern exactly like mockup */}
        <div className="grid grid-cols-3 gap-1">
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
        </div>
      </div>

      {/* Content area - starts below white header */}
      <div className="h-full pt-8 pb-0">
        <NoteComponent
          content={content}
          onChange={(content: any) => updateNote(id, { content })}
        />
      </div>

      {/* Delete button - positioned in white header area */}
      <button
        className="absolute top-1 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 
                   rounded-full flex items-center justify-center opacity-0 
                   group-hover:opacity-100 transition-all duration-200 shadow-sm"
        onClick={(e) => {
          e.stopPropagation();
          deleteNote(id);
        }}
        data-drag-ignore
      >
        <Trash2 className="w-3 h-3 text-white" />
      </button>

      {/* Resize handles - 4mm lilac dots exactly like mockup */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {/* Corner handles - 4mm lilac dots */}
        <div
          className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-300 rounded-full cursor-se-resize"
          data-drag-ignore
        />
        <div
          className="absolute -top-1 -right-1 w-4 h-4 bg-purple-300 rounded-full cursor-ne-resize"
          data-drag-ignore
        />
        <div
          className="absolute -bottom-1 -left-1 w-4 h-4 bg-purple-300 rounded-full cursor-sw-resize"
          data-drag-ignore
        />
        <div
          className="absolute -top-1 -left-1 w-4 h-4 bg-purple-300 rounded-full cursor-nw-resize"
          data-drag-ignore
        />

        {/* Edge handles - smaller lilac dots */}
        <div
          className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-purple-300 rounded-full cursor-e-resize"
          data-drag-ignore
        />
        <div
          className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-purple-300 rounded-full cursor-w-resize"
          data-drag-ignore
        />
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-purple-300 rounded-full cursor-s-resize"
          data-drag-ignore
        />
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-purple-300 rounded-full cursor-n-resize"
          data-drag-ignore
        />
      </div>
    </div>
  );
});

StickyNoteShell.displayName = 'StickyNoteShell';
