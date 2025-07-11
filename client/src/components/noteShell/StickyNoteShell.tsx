'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useNoteContext } from '../board/noteContext';
import { noteRegistry } from '../board/noteRegistry';
import { useMobile } from '../../hooks/use-mobile';
import type { NotePosition, NoteData } from '../../types/notes';

interface DragPosition {
  x: number;
  y: number;
}

interface StickyNoteShellProps {
  note: NoteData;
}

const getNoteTint = (type: NoteData['type']) => {
  switch (type) {
    case 'text': return 'bg-blue-50';
    case 'checklist': return 'bg-green-50';
    case 'image': return 'bg-pink-50';
    case 'voice': return 'bg-purple-50';
    case 'drawing': return 'bg-yellow-50';
    default: return 'bg-blue-50';
  }
};

export const StickyNoteShell = React.memo(function StickyNoteShell({ 
  note
}: StickyNoteShellProps) {
  const { updateNote, deleteNote } = useNoteContext();
  const { id, position, type, content } = note;
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const isMobile = useMobile();
  
  const noteRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<DragPosition>({ x: 0, y: 0 });
  const livePosRef = useRef<DragPosition>({ x: position.x, y: position.y });
  const optimisticPosRef = useRef<DragPosition>({ x: position.x, y: position.y }); // Single writer: optimistic position
  const rafRef = useRef<number>();
  const touchIdentifierRef = useRef<number | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update optimistic position when prop changes
  useEffect(() => {
    optimisticPosRef.current = { x: position.x, y: position.y };
  }, [position.x, position.y]);

  // Cleanup RAF and timeout on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Debounced position update function - only for final commit
  const debouncedUpdatePosition = useCallback((newPosition: NotePosition) => {
    // Clear any pending update
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    // Set a new debounced update
    updateTimeoutRef.current = setTimeout(() => {
      updateNote(id, { position: newPosition });
    }, 100); // 100ms debounce
  }, [id, updateNote]);

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

    // Calculate raw position
    let rawX = e.clientX - dragStartRef.current.x - boardRect.left;
    let rawY = e.clientY - dragStartRef.current.y - boardRect.top;

    // No grid snapping - removed as requested

    // Single writer: update optimistic position ref (not store)
    optimisticPosRef.current = { x: rawX, y: rawY };
    
    // Update live position for visual updates
    livePosRef.current = { x: rawX, y: rawY };
    
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        if (noteRef.current) {
          noteRef.current.style.transform = `translate(${livePosRef.current.x}px, ${livePosRef.current.y}px)`;
        }
        rafRef.current = undefined;
      });
    }
  }, [isDragging]);

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

    // Clear any pending debounced update
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    // Single writer: commit optimistic position to store
    const finalPosition: NotePosition = {
      ...position,
      x: optimisticPosRef.current.x,
      y: optimisticPosRef.current.y
    };
    
    // Use debounced update to prevent rapid successive calls
    debouncedUpdatePosition(finalPosition);

  }, [id, isDragging, position, debouncedUpdatePosition]);

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

    // Clear any pending debounced update
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    // Revert to original position
    if (noteRef.current) {
      noteRef.current.style.transform = `translate(${position.x}px, ${position.y}px)`;
    }
  }, [position]);

  return (
    <div
      ref={noteRef}
      className={`
        absolute rounded-2xl p-4 min-w-[200px] min-h-[150px]
        ${getNoteTint(type)}
        ${!isDragging && !isResizing ? 'transition-shadow duration-200' : ''}
        ${isDragging ? 'opacity-90 cursor-grabbing shadow-lg' : 'cursor-grab shadow-md hover:shadow-lg'}
        ${isResizing ? 'select-none' : ''}
        ${isMobile ? 'touch-none' : ''}
      `}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        willChange: isDragging ? 'transform' : 'auto',
        transition: isDragging ? 'none' : undefined,
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        userSelect: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={moveNote}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => deleteNote(id)}
          className={`
            p-1 hover:bg-black/10 rounded
            ${isMobile ? 'opacity-100 p-3' : ''}
          `}
          data-drag-ignore="true"
        >
          ✕
        </button>
      </div>
      {(() => {
        const NoteComponent = noteRegistry[type];
        if (!NoteComponent) return null;
        return (
          <NoteComponent
            content={content}
            onChange={(newContent: any) => updateNote(id, { content: newContent })}
          />
        );
      })()}
    </div>
  );
});

StickyNoteShell.displayName = 'StickyNoteShell';
