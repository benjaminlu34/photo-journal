import React, { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { security } from "@/lib/security";
import { Pencil, Eraser, Trash2, Palette } from "lucide-react";
import type { DrawingNoteContent } from "@/types/notes";

interface DrawingNoteProps {
  content: DrawingNoteContent;
  onChange?: (content: DrawingNoteContent) => void;
}

const DrawingNote: React.FC<DrawingNoteProps> = ({ content, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pencil' | 'eraser'>('pencil');
  const [currentColor, setCurrentColor] = useState('#6366f1');
  const [currentStroke, setCurrentStroke] = useState<{ points: Array<{ x: number; y: number }>; color: string; width: number } | null>(null);

  const colors = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];
  const brushSize = currentTool === 'pencil' ? 2 : 8;

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all strokes
    content.strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });

    // Draw current stroke if exists
    if (currentStroke && currentStroke.points.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = currentStroke.color;
      ctx.lineWidth = currentStroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(currentStroke.points[0].x, currentStroke.points[0].y);
      for (let i = 1; i < currentStroke.points.length; i++) {
        ctx.lineTo(currentStroke.points[i].x, currentStroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [content.strokes, currentStroke]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const coords = getCanvasCoordinates(e);
    setIsDrawing(true);
    
    const strokeColor = currentTool === 'eraser' ? '#ffffff' : currentColor;
    setCurrentStroke({
      points: [coords],
      color: strokeColor,
      width: brushSize
    });
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !currentStroke) return;

    const coords = getCanvasCoordinates(e);
    setCurrentStroke(prev => prev ? {
      ...prev,
      points: [...prev.points, coords]
    } : null);
  };

  const stopDrawing = () => {
    if (!isDrawing || !currentStroke) return;
    
    setIsDrawing(false);
    
    // Add stroke to content
    const newStrokes = [...content.strokes, currentStroke];
    onChange?.({ strokes: newStrokes });
    setCurrentStroke(null);
  };

  const clearDrawing = () => {
    onChange?.({ strokes: [] });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentTool('pencil')}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
              currentTool === 'pencil' 
                ? 'bg-primary text-white' 
                : 'hover:bg-neutral-100 text-neutral-600'
            )}
          >
            <Pencil className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setCurrentTool('eraser')}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
              currentTool === 'eraser' 
                ? 'bg-primary text-white' 
                : 'hover:bg-neutral-100 text-neutral-600'
            )}
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {colors.map(color => (
            <button
              key={color}
              onClick={() => setCurrentColor(color)}
              className={cn(
                'w-6 h-6 rounded-full border-2 transition-transform',
                currentColor === color ? 'border-neutral-400 scale-110' : 'border-neutral-200'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <button
          onClick={clearDrawing}
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
            'hover:bg-red-100 text-red-600'
          )}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          width={280}
          height={180}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        
        {content.strokes.length === 0 && !currentStroke && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-400 pointer-events-none">
            <div className="text-center">
              <Palette className="w-8 h-8 mx-auto mb-2" />
              <div className="text-sm">Start drawing</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DrawingNote;