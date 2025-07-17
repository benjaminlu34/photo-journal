// StickyNoteShell.tsx
'use client';

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { noteRegistry } from '../board/noteRegistry';
import { useMobile } from '../../hooks/use-mobile';
import type { NotePosition, NoteData } from '../../types/notes';
import { cn } from '@/lib/utils';
import { ResizeHandle } from './ResizeHandle';
import { NoteHeader } from './NoteHeader';

interface DragPosition {
  x: number;
  y: number;
}

interface StickyNoteShellProps {
  note: NoteData;
  updateNote: (id: string, updates: Partial<NoteData>) => void;
  deleteNote: (id: string) => void;
  children: React.ReactNode;
}

export const StickyNoteShell = React.memo(
  function StickyNoteShell({
    note,
    updateNote,
    deleteNote,
  }: StickyNoteShellProps) {
    const { id, position, type, content } = note;
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const isMobile = useMobile();

    const noteRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef<DragPosition>({ x: 0, y: 0 });
    const livePosRef = useRef<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>({ ...position });
    const rafRef = useRef<number>();
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const touchIdentifierRef = useRef<number | null>(null);

    // Update live position when position prop changes
    useEffect(() => {
      livePosRef.current = { ...position };
    }, [position]);

    // Cleanup on unmount
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

    // Debounced update function
    const debouncedUpdate = useCallback(
      (updates: Partial<NoteData>) => {
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        updateTimeoutRef.current = setTimeout(() => {
          updateNote(id, updates);
        }, 100);
      },
      [id, updateNote],
    );

    const handleDragPointerDown = useCallback(
      (e: React.PointerEvent) => {
        // Only allow drag to start from the drag-handle (6-dot grip)
        if (
          !(e.target as HTMLElement).closest('.drag-handle')
        ) {
          return;
        }

        // Ignore if targeting drag-ignore elements (e.g., menu button)
        if (
          (e.target as HTMLElement).closest('[data-drag-ignore]')
        ) {
          return;
        }

        e.currentTarget.setPointerCapture(e.pointerId);
        document.body.classList.add('user-select-none');

        const board =
          noteRef.current?.closest('.sticky-board');
        const boardRect = board?.getBoundingClientRect();

        if (boardRect) {
          dragStartRef.current = {
            x: e.clientX - position.x - boardRect.left,
            y: e.clientY - position.y - boardRect.top,
          };
        }
        setIsDragging(true);
        touchIdentifierRef.current = e.pointerId;
      },
      [position],
    );

    const handleResizePointerDown = useCallback(
      (e: React.MouseEvent, handle: string) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);

        const startSize = {
          width: position.width,
          height: position.height,
        };
        const startPos = { x: e.clientX, y: e.clientY };
        const startNotePos = { x: position.x, y: position.y };
        const aspectRatio = startSize.width / startSize.height;

        const doResize = (moveEvent: MouseEvent) => {
          let { width, height } = startSize;
          let { x, y } = startNotePos;
          const dx = moveEvent.clientX - startPos.x;
          const dy = moveEvent.clientY - startPos.y;

          if (handle.includes('right')) width += dx;
          if (handle.includes('left')) {
            width -= dx;
            x += dx;
          }
          if (handle.includes('bottom')) height += dy;
          if (handle.includes('top')) {
            height -= dy;
            y += dy;
          }

          if (moveEvent.shiftKey) {
            if (width / height > aspectRatio) {
              height = width / aspectRatio;
            } else {
              width = height * aspectRatio;
            }
          }

          livePosRef.current = {
            width: Math.max(200, width), // Increased minimum width
            height: Math.max(150, height), // Increased minimum height
            x,
            y,
          };

          if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(() => {
              if (noteRef.current) {
                noteRef.current.style.width = `${livePosRef.current.width}px`;
                noteRef.current.style.height = `${livePosRef.current.height}px`;
                noteRef.current.style.transform = `translate(${livePosRef.current.x}px, ${livePosRef.current.y}px)`;
              }
              rafRef.current = undefined;
            });
          }
        };

        const stopResize = () => {
          setIsResizing(false);
          window.removeEventListener('mousemove', doResize);
          window.removeEventListener('mouseup', stopResize);
          debouncedUpdate({
            position: {
              ...position,
              width: livePosRef.current.width,
              height: livePosRef.current.height,
              x: livePosRef.current.x,
              y: livePosRef.current.y,
            },
          });
        };

        window.addEventListener('mousemove', doResize);
        window.addEventListener('mouseup', stopResize);
      },
      [position, debouncedUpdate],
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (
          !isDragging ||
          e.pointerId !== touchIdentifierRef.current
        )
          return;
        e.preventDefault();

        const board =
          noteRef.current?.closest('.sticky-board');
        if (!board) return;
        const boardRect = board.getBoundingClientRect();

        livePosRef.current.x =
          e.clientX - dragStartRef.current.x - boardRect.left;
        livePosRef.current.y =
          e.clientY - dragStartRef.current.y - boardRect.top;

        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            if (noteRef.current) {
              noteRef.current.style.transform = `translate(${livePosRef.current.x}px, ${livePosRef.current.y}px)`;
            }
            rafRef.current = undefined;
          });
        }
      },
      [isDragging],
    );

    const handlePointerUp = useCallback(
      (e: React.PointerEvent) => {
        if (
          !isDragging ||
          e.pointerId !== touchIdentifierRef.current
        )
          return;

        e.currentTarget.releasePointerCapture(e.pointerId);
        document.body.classList.remove('user-select-none');
        setIsDragging(false);
        touchIdentifierRef.current = null;

        // Cancel any pending RAF
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = undefined;
        }

        debouncedUpdate({
          position: {
            ...position,
            x: livePosRef.current.x,
            y: livePosRef.current.y,
          },
        });
      },
      [isDragging, position, debouncedUpdate],
    );

    const handlePointerCancel = useCallback(
      (e: React.PointerEvent) => {
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
      },
      [position],
    );

    return (
      <div
        ref={noteRef}
        className={cn(
          'absolute rounded-lg neu-card p-4 min-w-[200px] min-h-[150px] transition-all duration-200 group',
          'bg-white/40 backdrop-blur-lg border border-white/20',
          isDragging
            ? 'shadow-lg scale-105 cursor-grabbing'
            : 'shadow-md cursor-grab',
          isResizing ? 'select-none' : '',
          isMobile ? 'touch-none' : '',
        )}
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          width: `${position.width}px`,
          height: `${position.height}px`,
          willChange: isDragging || isResizing
            ? 'transform, width, height'
            : 'auto',
          transition: isDragging || isResizing
            ? 'none'
            : undefined,
          touchAction: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          userSelect: 'none',
        }}
        onPointerDown={handleDragPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
         <NoteHeader
          onDelete={() => deleteNote(id)}
          isMobile={isMobile}
        />

        <div className="note-content h-full pt-10 overflow-hidden">  {/* Increased pt-10 from pt-8 to account for header height */}
          {(() => {
            const NoteComponent = noteRegistry[type];
            if (!NoteComponent) return null;
            return (
              <NoteComponent
                content={content}
                onChange={(newContent: any) =>
                  updateNote(id, { content: newContent })
                }
              />
            );
          })()}
        </div>

        {!isDragging && !isMobile && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {([
              'top-left',
              'top-center',
              'top-right',
              'left-center',
              'right-center',
              'bottom-left',
              'bottom-center',
              'bottom-right',
            ] as const).map((pos) => (
              <ResizeHandle
                key={pos}
                position={pos}
                onMouseDown={(e) =>
                  handleResizePointerDown(e, pos)
                }
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);

StickyNoteShell.displayName = 'StickyNoteShell';