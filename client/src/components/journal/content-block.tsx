import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useJournal } from "@/contexts/journal-context";
import type { ContentBlockData, Position } from "@/types/journal";
import { Trash2, GripVertical, RotateCcw, Play, Pause } from "lucide-react";

interface ContentBlockProps {
  block: ContentBlockData;
}

export function ContentBlock({ block }: ContentBlockProps) {
  const { updateContentBlock, deleteContentBlock, updateBlockPosition } = useJournal();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(block.content);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Performance optimization: use refs for live drag state
  const blockRef = useRef<HTMLDivElement>(null);
  const livePosition = useRef(block.position);
  const dragOffset = useRef({ x: 0, y: 0 });
  const moveRAF = useRef<number>(0);
  const workspaceRect = useRef<DOMRect | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // GPU-accelerated visual update system
  const updateVisualPosition = useCallback(() => {
    if (!blockRef.current) return;
    
    if (!moveRAF.current) {
      moveRAF.current = requestAnimationFrame(() => {
        if (blockRef.current) {
          const pos = livePosition.current;
          blockRef.current.style.transform = 
            `translate3d(${pos.x}px, ${pos.y}px, 0) rotate(${pos.rotation}deg)`;
        }
        moveRAF.current = 0;
      });
    }
  }, []);

  // Update live position when block position changes from server
  useEffect(() => {
    livePosition.current = block.position;
    updateVisualPosition();
  }, [block.position, updateVisualPosition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      if (moveRAF.current) {
        cancelAnimationFrame(moveRAF.current);
      }
    };
  }, []);

  // Dedicated move grip system (prevents move/resize conflicts)
  const startMove = (e: React.PointerEvent) => {
    if (e.button !== 0 || isEditing || isResizing) return;
    
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    
    // Cache workspace geometry once per drag
    const workspace = document.querySelector('[data-workspace="true"]');
    if (!workspace) return;
    workspaceRect.current = workspace.getBoundingClientRect();
    
    dragOffset.current = {
      x: e.clientX - livePosition.current.x,
      y: e.clientY - livePosition.current.y
    };
  };

  const moveBlock = (e: React.PointerEvent) => {
    if (!isDragging || !workspaceRect.current) return;
    
    const newX = e.clientX - workspaceRect.current.left - dragOffset.current.x;
    const newY = e.clientY - workspaceRect.current.top - dragOffset.current.y;
    
    // Update live position immediately
    livePosition.current = {
      ...livePosition.current,
      x: Math.max(0, Math.min(newX, workspaceRect.current.width - livePosition.current.width)),
      y: Math.max(0, Math.min(newY, workspaceRect.current.height - livePosition.current.height))
    };
    
    // GPU-accelerated visual update
    updateVisualPosition();
  };

  const endMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
    workspaceRect.current = null;
    
    // Single server update per drag
    updateBlockPosition(block.id, livePosition.current);
  };

  // Dedicated resize system with direction-specific handles
  const startResize = (e: React.PointerEvent, direction: string) => {
    if (e.button !== 0 || isEditing || isDragging) return;
    
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsResizing(true);
    
    // Cache workspace geometry once per resize
    const workspace = document.querySelector('[data-workspace="true"]');
    if (!workspace) return;
    workspaceRect.current = workspace.getBoundingClientRect();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...livePosition.current };
    
    const handleResize = (e: PointerEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newPos = { ...startPos };
      
      // Apply deltas based on resize direction
      if (direction.includes('e')) newPos.width = Math.max(150, startPos.width + deltaX);
      if (direction.includes('w')) {
        newPos.width = Math.max(150, startPos.width - deltaX);
        newPos.x = Math.max(0, startPos.x + deltaX);
      }
      if (direction.includes('s')) newPos.height = Math.max(100, startPos.height + deltaY);
      if (direction.includes('n')) {
        newPos.height = Math.max(100, startPos.height - deltaY);
        newPos.y = Math.max(0, startPos.y + deltaY);
      }
      
      livePosition.current = newPos;
      updateVisualPosition();
    };
    
    const handleResizeEnd = () => {
      document.removeEventListener('pointermove', handleResize);
      document.removeEventListener('pointerup', handleResizeEnd);
      setIsResizing(false);
      workspaceRect.current = null;
      
      // Single server update per resize
      updateBlockPosition(block.id, livePosition.current);
    };
    
    document.addEventListener('pointermove', handleResize);
    document.addEventListener('pointerup', handleResizeEnd);
  };

  // Get appropriate cursor for resize direction
  const getResizeCursor = (direction: string) => {
    const cursors: Record<string, string> = {
      'n': 'ns-resize',
      'e': 'ew-resize',
      's': 'ns-resize',
      'w': 'ew-resize',
      'ne': 'nesw-resize',
      'nw': 'nwse-resize',
      'se': 'nwse-resize',
      'sw': 'nesw-resize'
    };
    return cursors[direction] || 'default';
  };

  const saveContent = () => {
    updateContentBlock(block.id, { content: editContent });
    setIsEditing(false);
  };

  const resetRotation = () => {
    livePosition.current = { ...livePosition.current, rotation: 0 };
    updateVisualPosition();
    updateBlockPosition(block.id, livePosition.current);
  };

  const getBlockColor = () => {
    switch (block.type) {
      case "sticky_note":
        return "content-block-sticky";
      case "photo":
        return "glass-card";
      case "text":
        return "glass-card";
      case "checklist":
        return "content-block-lavender";
      case "audio":
        return "content-block-coral";
      case "drawing":
        return "glass-card";
      default:
        return "glass-card";
    }
  };

  const getBlockIcon = () => {
    switch (block.type) {
      case "sticky_note":
        return "📝";
      case "photo":
        return "📸";
      case "text":
        return "✏️";
      case "checklist":
        return "✅";
      case "audio":
        return "🎤";
      case "drawing":
        return "🎨";
      default:
        return "📄";
    }
  };

  const renderContent = () => {
    switch (block.type) {
      case "sticky_note":
      case "text":
        return isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent.text || ""}
              onChange={(e) => setEditContent({ ...editContent, text: e.target.value })}
              className="resize-none border-none bg-transparent text-sm"
              placeholder="Write your thoughts..."
            />
            <div className="flex space-x-2">
              <Button size="sm" onClick={saveContent}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div 
            className="text-sm cursor-pointer" 
            onClick={() => setIsEditing(true)}
          >
            {block.content.text || "Click to edit..."}
          </div>
        );

      case "checklist":
        return (
          <div className="space-y-2">
            {(block.content.items || []).map((item: any, index: number) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={(checked) => {
                    const newItems = [...block.content.items];
                    newItems[index] = { ...item, completed: checked };
                    updateContentBlock(block.id, { 
                      content: { ...block.content, items: newItems } 
                    });
                  }}
                />
                <span className={`text-sm ${item.completed ? "line-through text-secondary-500" : ""}`}>
                  {item.text}
                </span>
              </div>
            ))}
            {isEditing && (
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Add item..."
                  className="flex-1 text-sm border-none bg-transparent"
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && e.currentTarget.value.trim()) {
                      const newItems = [
                        ...block.content.items,
                        { text: e.currentTarget.value.trim(), completed: false }
                      ];
                      updateContentBlock(block.id, {
                        content: { ...block.content, items: newItems }
                      });
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </div>
            )}
          </div>
        );

      case "photo":
        return (
          <div className="space-y-2">
            {block.content.url ? (
              <div className="space-y-2">
                <img 
                  src={block.content.url} 
                  alt={block.content.caption || "Photo"} 
                  className="w-full h-32 object-cover rounded-lg shadow-soft"
                />
                {isEditing && (
                  <input
                    type="text"
                    placeholder="Add caption..."
                    value={editContent.caption || ""}
                    onChange={(e) => setEditContent({ ...editContent, caption: e.target.value })}
                    className="w-full text-xs p-1 border rounded"
                  />
                )}
                {!isEditing && block.content.caption && (
                  <p className="text-xs text-secondary-600">{block.content.caption}</p>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-primary-300 rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      updateContentBlock(block.id, { 
                        content: { ...block.content, url, fileName: file.name } 
                      });
                    }
                  }}
                  className="hidden"
                  id={`photo-upload-${block.id}`}
                />
                <label htmlFor={`photo-upload-${block.id}`} className="cursor-pointer">
                  <div className="text-primary-500 text-2xl mb-2">📸</div>
                  <p className="text-xs text-secondary-500">Click to upload photo</p>
                </label>
              </div>
            )}
          </div>
        );

      case "audio":
        return (
          <div className="space-y-2">
            {block.content.url ? (
              <div className="flex items-center space-x-3">
                <Button size="sm" variant="outline" className="w-8 h-8 p-0 neumorphic-button">
                  <Play className="w-3 h-3" />
                </Button>
                <div className="flex-1">
                  <div className="bg-primary-200 h-2 rounded-full overflow-hidden shadow-soft-inset">
                    <div className="bg-primary-500 h-full w-1/3 rounded-full"></div>
                  </div>
                  <p className="text-xs text-primary-700 mt-1">
                    {block.content.duration || "0:00"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-primary-300 rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      updateContentBlock(block.id, { 
                        content: { ...block.content, url, fileName: file.name, duration: "0:00" } 
                      });
                    }
                  }}
                  className="hidden"
                  id={`audio-upload-${block.id}`}
                />
                <label htmlFor={`audio-upload-${block.id}`} className="cursor-pointer">
                  <div className="text-primary-500 text-2xl mb-2">🎤</div>
                  <p className="text-xs text-secondary-500">Click to upload audio</p>
                </label>
              </div>
            )}
          </div>
        );

      default:
        return <div className="text-sm text-secondary-500">Unsupported content type</div>;
    }
  };

  return (
    <div
      ref={blockRef}
      className={`absolute rounded-2xl transition-all group interactive ${getBlockColor()} ${
        isDragging ? "opacity-80 scale-105" : ""
      } ${isResizing ? "select-none" : ""}`}
      style={{
        width: livePosition.current.width,
        height: livePosition.current.height,
        zIndex: isDragging || isResizing ? 1000 : 1,
        // Initial position - will be overridden by transform in updateVisualPosition
        left: 0,
        top: 0,
        transform: `translate3d(${livePosition.current.x}px, ${livePosition.current.y}px, 0) rotate(${livePosition.current.rotation}deg)`,
      }}
    >
      {/* Dedicated Move Grip - Top Bar */}
      <div
        onPointerDown={startMove}
        onPointerMove={moveBlock}
        onPointerUp={endMove}
        className={`absolute top-0 left-0 w-full h-8 rounded-t-2xl cursor-grab transition-all ${
          isDragging ? "cursor-grabbing" : ""
        }`}
        style={{
          background: `linear-gradient(135deg, 
            ${getBlockColor().includes('red') ? 'rgba(239, 68, 68, 0.1)' : 
              getBlockColor().includes('blue') ? 'rgba(59, 130, 246, 0.1)' : 
              getBlockColor().includes('green') ? 'rgba(34, 197, 94, 0.1)' : 
              getBlockColor().includes('yellow') ? 'rgba(245, 158, 11, 0.1)' : 
              getBlockColor().includes('purple') ? 'rgba(168, 85, 247, 0.1)' : 
              'rgba(107, 114, 128, 0.1)'} 0%, 
            rgba(0, 0, 0, 0.02) 100%)`
        }}
      />

      {/* Resize Handles - 8 directional handles */}
      {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((direction) => (
        <div
          key={direction}
          className={`absolute w-2 h-2 bg-purple-500 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 ${
            isResizing ? 'opacity-100' : ''
          }`}
          style={{
            cursor: getResizeCursor(direction),
            ...(direction === 'nw' && { top: -4, left: -4 }),
            ...(direction === 'n' && { top: -4, left: '50%', transform: 'translateX(-50%)' }),
            ...(direction === 'ne' && { top: -4, right: -4 }),
            ...(direction === 'e' && { top: '50%', right: -4, transform: 'translateY(-50%)' }),
            ...(direction === 'se' && { bottom: -4, right: -4 }),
            ...(direction === 's' && { bottom: -4, left: '50%', transform: 'translateX(-50%)' }),
            ...(direction === 'sw' && { bottom: -4, left: -4 }),
            ...(direction === 'w' && { top: '50%', left: -4, transform: 'translateY(-50%)' }),
          }}
          onPointerDown={(e) => startResize(e, direction)}
        />
      ))}

      {/* Content Area */}
      <div className="p-4 pt-12 h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg filter drop-shadow-lg">{getBlockIcon()}</span>
          <span className="text-xs text-muted-foreground font-medium">
            {new Date(block.createdAt).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
          <Button
            size="sm"
            variant="ghost"
            className="w-7 h-7 p-0 glass-button text-foreground hover:text-primary"
            onClick={resetRotation}
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="w-7 h-7 p-0 glass-button text-foreground hover:text-destructive"
            onClick={() => deleteContentBlock(block.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

        {/* Content */}
        <div className="flex-1">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
