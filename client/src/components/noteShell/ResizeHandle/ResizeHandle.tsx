// ResizeHandle.tsx
import React from 'react';
import { cn } from '@/lib/utils';

type HandlePosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'left-center'
  | 'right-center'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

interface ResizeHandleProps {
  position: HandlePosition;
  onMouseDown: (e: React.MouseEvent) => void;
}

const positionClasses: Record<HandlePosition, string> = {
  'top-left': 'top-0 left-0 cursor-nwse-resize',
  'top-center': 'top-0 left-1/2 -translate-x-1/2 cursor-ns-resize',
  'top-right': 'top-0 right-0 cursor-nesw-resize',
  'left-center': 'left-0 top-1/2 -translate-y-1/2 cursor-ew-resize',
  'right-center': 'right-0 top-1/2 -translate-y-1/2 cursor-ew-resize',
  'bottom-left': 'bottom-0.5 left-0.5 cursor-nesw-resize',
  'bottom-center': 'bottom-0 left-1/2 -translate-x-1/2 cursor-ns-resize',
  'bottom-right': 'bottom-0.5 right-0.5 cursor-nwse-resize',
};

// Assuming your note has `rounded-xl` or similar for its corners
// We will match the rounding on the handle's relevant corners to the note's rounding.
const handleStyles: Record<HandlePosition, string> = {
  'top-left': 'w-3.5 h-3.5 rounded-br-xl rounded-tl-2xl', // Rounded inner and outer top-left corner
  'top-center': 'w-4 h-2 rounded-b-xl', // Apply note's rounding
  'top-right': 'w-3.5 h-3.5 rounded-bl-xl rounded-tr-2xl', // Rounded inner and outer top-right corner
  'left-center': 'w-2 h-4 rounded-r-xl', // Apply note's rounding
  'right-center': 'w-2 h-4 rounded-l-xl', // Apply note's rounding
  'bottom-left': 'w-3.5 h-3.5 rounded-tr-xl rounded-bl-2xl', // Rounded inner and outer bottom-left corner
  'bottom-center': 'w-4 h-2 rounded-t-xl', // Apply note's rounding
  'bottom-right': 'w-3.5 h-3.5 rounded-tl-xl rounded-br-2xl', // Rounded inner and outer bottom-right corner
};

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  position,
  onMouseDown,
}) => {
  return (
    <div
      className={cn(
        'absolute bg-white/50 hover:bg-purple-500 transition-colors',
        positionClasses[position],
        handleStyles[position],
      )}
      onMouseDown={onMouseDown}
    />
  );
};