// StickyNoteShell.tsx
'use client';

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { noteRegistry } from '../../board/noteRegistry/noteRegistry';
import { useMobile } from '@/hooks/use-mobile';
import type { NotePosition, NoteData } from '@/types/notes';
import { cn } from '@/lib/utils';
import { ResizeHandle } from '../ResizeHandle/ResizeHandle';
import { NoteHeader } from '../NoteHeader/NoteHeader';
import { FloatingNoteAttribution } from '@/components/ui/note-attribution';
import { safeColor, getOptimalTextColor } from '@/utils/colorUtils/colorUtils';
import { useJournal } from '@/contexts/journal-context';

// Throttle utility for color updates
function throttle<T extends (...args: any[]) => void>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;
  
  return ((...args: Parameters<T>) => {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func(...args);
        lastExecTime = Date.now();
        timeoutId = null;
      }, delay - (currentTime - lastExecTime));
    }
  }) as T;
}

interface DragPosition {
  x: number;
  y: number;
}

interface StickyNoteShellProps {
  note: NoteData;
  updateNote: (id: string, updates: Partial<NoteData>) => void;
  deleteNote: (id: string) => void;
  children: React.ReactNode;
  previewColor?: string | null; // For live color preview
  currentUserRole?: 'owner' | 'editor' | 'contributor' | 'viewer';
  currentUserId?: string;
}

export const StickyNoteShell = React.memo(
  function StickyNoteShell({
    note,
    updateNote,
    deleteNote,
    previewColor,
    currentUserRole = 'owner',
    currentUserId,
  }: StickyNoteShellProps) {
    const { id, position, type, content } = note;
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [localPreviewColor, setLocalPreviewColor] = useState<string | null>(null);
    const isMobile = useMobile();
    
    // Permission enforcement based on role
    // Updated permission matrix:
    // - owner: full access to all notes (move, resize, edit, delete) - can delete any note on their board
    // - editor: full access to all notes (move, resize, edit, delete) - can delete any note
    // - contributor: can only move and edit notes THEY created, cannot delete
    // - viewer: read-only access to all notes
    
    // Ownership check - handle legacy notes where createdBy is undefined
    // For legacy notes with undefined createdBy, treat as owner-editable
    const isNoteOwner = note.createdBy?.id === currentUserId || note.createdBy?.id === undefined;
    
    const canMove = currentUserRole === 'owner' ||
                   currentUserRole === 'editor' ||
                   (currentUserRole === 'contributor' && isNoteOwner);
    
    const canResize = currentUserRole === 'owner' || currentUserRole === 'editor';
    
    const canEdit = currentUserRole === 'owner' ||
                   currentUserRole === 'editor' ||
                   (currentUserRole === 'contributor' && isNoteOwner);
    
    const canDelete = currentUserRole === 'owner' || currentUserRole === 'editor';
    
    // Permission calculation complete

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
        // Check permissions before allowing drag
        if (!canMove) {
          return;
        }

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
      [position, canMove],
    );

    const handleResizePointerDown = useCallback(
      (e: React.MouseEvent, handle: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Check permissions before allowing resize
        if (!canResize) {
          return;
        }
        
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
      [position, debouncedUpdate, canResize],
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

        // Calculate raw new position
        let newX = e.clientX - dragStartRef.current.x - boardRect.left;
        let newY = e.clientY - dragStartRef.current.y - boardRect.top;

        // Define boundary constraints to keep header accessible
        const headerHeight = 32; // Height of note header (h-8 = 32px)
        const minMargin = 16; // Minimum margin from edges for better UX
        const noteWidth = livePosRef.current.width;
        const noteHeight = livePosRef.current.height;

        // Get viewport dimensions relative to the board
        const viewportWidth = Math.min(boardRect.width, window.innerWidth);
        const viewportHeight = Math.min(boardRect.height, window.innerHeight);

        // Apply boundary constraints
        // Left boundary: ensure note doesn't go completely off-screen
        newX = Math.max(-noteWidth + minMargin * 2, newX);
        
        // Right boundary: ensure note doesn't go completely off-screen
        newX = Math.min(viewportWidth - minMargin * 2, newX);
        
        // Top boundary: ensure header stays visible (most important)
        newY = Math.max(headerHeight + minMargin, newY);
        
        // Bottom boundary: allow note to go partially off-screen but keep some visible
        newY = Math.min(viewportHeight - minMargin * 2, newY);

        // Update position with constraints applied
        livePosRef.current.x = newX;
        livePosRef.current.y = newY;

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

    // Handle color preview callback
    const handleColorPreview = useCallback((color: string | null) => {
      setLocalPreviewColor(color);
    }, []);

    // Throttled color change handler to prevent flooding Yjs with rapid updates
    const throttledColorChange = useMemo(() => {
      return throttle((color: string) => {
        // Enable color picker for all note types
        updateNote(id, {
          content: {
            ...content,
            backgroundColor: color,
          }
        });
      }, 50); // 50ms throttle as specified in requirements
    }, [id, updateNote, content]);

    // Memoized color calculations for performance
    const colorStyles = useMemo(() => {
      // Apply colors to all note types
      const actualBackgroundColor = content.backgroundColor;
      const effectiveColor = localPreviewColor || previewColor || actualBackgroundColor;
      
      // Use safeColor utility with default fallback
      const safeBackgroundColor = safeColor(effectiveColor, '#F4F7FF');
      const hasCustomColor = Boolean(effectiveColor || localPreviewColor || previewColor);
      
      // Calculate optimal text color for accessibility
      const optimalTextColor = getOptimalTextColor(safeBackgroundColor);
      
      return {
        backgroundColor: safeBackgroundColor,
        // Maintain glassmorphism with color overlay - use a more subtle approach
        backgroundImage: hasCustomColor 
          ? `linear-gradient(${safeBackgroundColor}E6, ${safeBackgroundColor}D9)`
          : undefined,
        color: optimalTextColor || undefined,
        hasCustomColor,
      };
    }, [content.backgroundColor, localPreviewColor, previewColor]);
    
    return (
      <div
        ref={noteRef}
        className={cn(
          'absolute rounded-lg neu-card p-4 min-w-[200px] min-h-[150px] group',
          // Use conditional background based on whether we have a custom color
          colorStyles.hasCustomColor ? '' : 'bg-white/40',
          'backdrop-blur-lg border border-white/20',
          // Add smooth color transition for preview
          'transition-all duration-200',
          isDragging
            ? 'shadow-lg scale-105 cursor-grabbing'
            : 'shadow-md cursor-grab',
          isResizing ? 'select-none' : '',
          isMobile ? 'touch-none' : '',
          !canMove ? 'cursor-not-allowed' : '',
        )}
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          width: `${position.width}px`,
          height: `${position.height}px`,
          // Apply custom background color while maintaining glassmorphism
          backgroundColor: colorStyles.backgroundColor,
          backgroundImage: colorStyles.backgroundImage,
          color: colorStyles.color,
          willChange: isDragging || isResizing
            ? 'transform, width, height'
            : 'auto',
          transition: isDragging || isResizing
            ? 'none'
            : 'background-color 200ms ease, color 200ms ease',
          touchAction: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          userSelect: 'none',
        }}
        onPointerDown={canMove ? handleDragPointerDown : undefined}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
         <NoteHeader
          onDelete={() => {
            if (canDelete) {
              deleteNote(id);
            }
          }}
          isMobile={isMobile}
          currentColor={content.backgroundColor}
          onColorChange={canEdit ? throttledColorChange : undefined}
          onColorPreview={canEdit ? handleColorPreview : undefined}
        />

        {/* Note attribution showing creator username */}
        <FloatingNoteAttribution
          creator={note.createdBy}
          createdAt={note.createdAt}
        />

        <div className={cn(
          "note-content h-full pt-10 overflow-hidden",
          !canEdit && "pointer-events-none opacity-75"
        )} title={!canEdit ? "Read-only: You don't have permission to edit this note" : undefined}>
         {(() => {
           const NoteComponent = noteRegistry[type];
           if (!NoteComponent) return null;
           return (
             <NoteComponent
               content={content}
               onChange={(newContent: any) => {
                 if (!canEdit) {
                   return;
                 }
                 updateNote(id, { content: newContent });
               }}
               readOnly={!canEdit}
             />
           );
         })()}
       </div>

        {!isDragging && !isMobile && canResize && (
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