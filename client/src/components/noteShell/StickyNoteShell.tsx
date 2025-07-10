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
}

export const StickyNoteShell = React.memo(function StickyNoteShell({ 
  id, 
  children, 
  position, 
  color = 'bg-yellow-200' 
}: StickyNoteShellProps) {
  const { updateNote, deleteNote, gridSnapEnabled } = useNoteContext();
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
