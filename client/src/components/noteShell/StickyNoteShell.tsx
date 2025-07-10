'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useNoteContext } from '../board/noteContext';
import { snapToGrid } from '../../utils/snapToGrid';
import { useMobile } from '../../hooks/use-mobile';
import type { NotePosition } from '../../types/notes';

interface DragPosition {
  x: number;
  y: number;
}

interface StickyNoteShellProps {
  id: string;
  children: React.ReactNode;
  position: NotePosition;
  color?: string;
  onLocalDragEnd?: () => void;
}

export const StickyNoteShell = React.memo(function StickyNoteShell({ 
  id, 
  children, 
  position, 
  color = 'bg-yellow-200',
  onLocalDragEnd
}: StickyNoteShellProps) {
  const { updateNote, deleteNote, gridSnapEnabled } = useNoteContext();
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

    // Apply grid snap BEFORE updating live position to prevent single-frame mismatch
    if (gridSnapEnabled) {
      rawX = snapToGrid(rawX);
      rawY = snapToGrid(rawY);
    }

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

    onLocalDragEnd?.();
  }, [id, isDragging, position, debouncedUpdatePosition, onLocalDragEnd]);

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
        ${color}
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
      {children}
    </div>
  );
});

StickyNoteShell.displayName = 'StickyNoteShell';
