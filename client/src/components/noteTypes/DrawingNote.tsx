import React from 'react';
import { cn } from '@/lib/utils';

interface DrawingNoteProps {
  content: { strokes?: any[] };
  onChange?: (content: { strokes: any[] }) => void;
}

export const DrawingNote: React.FC<DrawingNoteProps> = ({
  content,
  onChange
}) => {
  const strokes = content.strokes || [];

  const handleCreateSample = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Create a simple drawing placeholder
    const sampleStrokes = [
      { path: "M50,150 Q150,50 250,150 T350,150", color: "#10b981", width: 3 },
      { path: "M100,200 L150,100 L200,200 L250,100 L300,200", color: "#3b82f6", width: 2 }
    ];
    onChange?.({ strokes: sampleStrokes });
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.({ strokes: [] });
  };

  if (strokes.length > 0) {
    return (
      <div className="h-full neu-card rounded-lg overflow-hidden group/drawing relative">
        <svg className="w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
          {strokes.map((stroke: any, index: number) => (
            <path
              key={index}
              d={stroke.path}
              stroke={stroke.color || "#4f46e5"}
              strokeWidth={stroke.width || 2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 bg-black/0 group-hover/drawing:bg-black/10 transition-all duration-200 flex items-center justify-center">
          <button
            onClick={handleClear}
            className="opacity-0 group-hover/drawing:opacity-100 transition-opacity bg-white/90 hover:bg-white text-black text-xs py-1 px-3 rounded"
          >
            Clear Drawing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-full border-2 border-dashed border-green-300 rounded-lg flex flex-col justify-center items-center cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors group"
      onClick={handleCreateSample}
    >
      <div className="text-green-500 text-5xl mb-3 group-hover:scale-110 transition-transform">🎨</div>
      <p className="text-sm font-semibold text-green-700 mb-1">Create Drawing</p>
      <p className="text-xs text-secondary-500 mb-2">Sketch, doodle, or diagram</p>
      <p className="text-xs text-secondary-400">Click to start drawing</p>
    </div>
  );
};

export default DrawingNote;