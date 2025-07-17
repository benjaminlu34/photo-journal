// NoteHeader.tsx
import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoteHeaderProps {
  onDelete: () => void;
  isMobile: boolean;
}

export const NoteHeader: React.FC<NoteHeaderProps> = ({
  onDelete,
  isMobile,
}) => {
  return (
    <div className="drag-handle absolute top-0 left-0 right-0 h-8 rounded-t-2xl bg-gray-200/30 border-b border-gray-200/50 flex items-center justify-between px-4 backdrop-blur-sm">
      {/* Menu button - might need later, change icon if need */}
      {/* <button
        className="text-gray-500 hover:text-gray-700 transition-colors"
        data-drag-ignore
      >
        <MoreHorizontal className="w-4 h-4" />
      </button> */}
      <div className="absolute left-1/2 -translate-x-1/2 grid grid-cols-3 gap-0.5 cursor-grab">
        <div className="w-1 h-1 rounded-full bg-gray-500" />
        <div className="w-1 h-1 rounded-full bg-gray-500" />
        <div className="w-1 h-1 rounded-full bg-gray-500" />
        <div className="w-1 h-1 rounded-full bg-gray-500" />
        <div className="w-1 h-1 rounded-full bg-gray-500" />
        <div className="w-1 h-1 rounded-full bg-gray-500" />
      </div>

      {/* Delete button - only visible on hover */}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 transition-all duration-200 text-lg font-bold"
      >
        ✕
      </button>
    </div>
  );
};