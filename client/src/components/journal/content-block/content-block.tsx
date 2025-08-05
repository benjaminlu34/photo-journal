import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FloatingTextarea } from "@/components/ui/floating-textarea";
import { FloatingInput } from "@/components/ui/floating-input";
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
    document.body.classList.add('user-select-none');
    setIsDragging(true);

    // Cache workspace geometry once per drag
    const workspace = document.querySelector('[data-workspace="true"]');
    if (!workspace) return;
    workspaceRect.current = workspace.getBoundingClientRect();

    dragOffset.current = {
      x: e.clientX - workspaceRect.current!.left - livePosition.current.x,
      y: e.clientY - workspaceRect.current!.top - livePosition.current.y
    };

    document.addEventListener('pointermove', moveBlock as any);
    document.addEventListener('pointerup', endMove as any);
  };

  const moveBlock = (e: PointerEvent) => {
    if (!isDragging || !workspaceRect.current) return;

    e.preventDefault(); // suppress browser drag-select fallback
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

  const endMove = (e: PointerEvent) => {
    if (!isDragging) return;

    document.removeEventListener('pointermove', moveBlock as any);
    document.removeEventListener('pointerup', endMove as any);
    document.body.classList.remove('user-select-none');
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
        const clamped = Math.min(deltaX, startPos.width - 150);
        newPos.width = startPos.width - clamped;
        newPos.x = Math.max(0, startPos.x + clamped);
      }
      if (direction.includes('s')) newPos.height = Math.max(100, startPos.height + deltaY);
      if (direction.includes('n')) {
        const clamped = Math.min(deltaY, startPos.height - 100);
        newPos.height = startPos.height - clamped;
        newPos.y = Math.max(0, startPos.y + clamped);
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
        return "sticky-note rose";
      case "photo":
        return "sticky-note blue";
      case "text" as any:
        return "sticky-note purple";
      case "checklist":
        return "sticky-note green";
      case "audio" as any:
        return "sticky-note yellow";
      case "drawing" as any:
        return "sticky-note rose";
      default:
        return "sticky-note purple";
    }
  };

  const getBlockIcon = () => {
    switch (block.type) {
      case "sticky_note":
        return "📝";
      case "photo":
        return "📸";
      case "text" as any:
        return "✏️";
      case "checklist":
        return "✅";
      case "audio" as any:
        return "🎤";
      case "drawing" as any:
        return "🎨";
      default:
        return "📄";
    }
  };

  const renderContent = () => {
    switch (block.type) {
      case "sticky_note":
      case "text" as any:
        return isEditing ? (
          <div className="space-y-2">
            <FloatingTextarea
              label="Write your thoughts..."
              value={editContent.text || ""}
              onChange={(e) => setEditContent({ ...editContent, text: e.target.value })}
              className="resize-none border-none bg-transparent text-sm"
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
                <FloatingInput
                  type="text"
                  label="Add item..."
                  className="flex-1 text-sm border-none bg-transparent"
                  onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
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
          <div className="h-full relative">
            {block.content.url ? (
              <div className="relative h-full group/photo overflow-hidden rounded-lg">
                <img
                  src={block.content.url}
                  alt={block.content.caption || "Photo"}
                  className="w-full h-full object-cover"
                />
                {isEditing ? (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-3">
                    <FloatingInput
                      type="text"
                      label="Add caption..."
                      value={editContent.caption || ""}
                      onChange={(e) => setEditContent({ ...editContent, caption: e.target.value })}
                      className="w-full bg-transparent text-white text-sm placeholder-gray-300 border-none outline-none mb-2"
                      autoFocus
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter') saveContent();
                        if (e.key === 'Escape') setIsEditing(false);
                      }}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button size="sm" onClick={saveContent} className="text-xs py-1 px-3 neu-button">Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="text-xs py-1 px-3">Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {block.content.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white p-3">
                        <p className="text-sm font-medium">{block.content.caption}</p>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover/photo:bg-black/20 transition-all duration-200 flex items-center justify-center">
                      <div className="opacity-0 group-hover/photo:opacity-100 transition-opacity duration-200 flex space-x-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="bg-white/90 hover:bg-white text-black text-xs py-1 px-3"
                          onClick={() => setIsEditing(true)}
                        >
                          {block.content.caption ? "Edit" : "Caption"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="bg-white/90 hover:bg-white text-black text-xs py-1 px-3"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) {
                                const url = URL.createObjectURL(file);
                                updateContentBlock(block.id, {
                                  content: { ...block.content, url, fileName: file.name }
                                });
                              }
                            };
                            input.click();
                          }}
                        >
                          Replace
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-primary-300 rounded-lg h-full flex flex-col justify-center items-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors group"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      updateContentBlock(block.id, {
                        content: { ...block.content, url, fileName: file.name }
                      });
                    }
                  };
                  input.click();
                }}
              >
                <div className="text-primary-500 text-5xl mb-3 group-hover:scale-110 transition-transform">📸</div>
                <p className="text-sm font-semibold text-primary-700 mb-1">Upload Photo</p>
                <p className="text-xs text-secondary-500">JPG, PNG, or GIF</p>
                <p className="text-xs text-secondary-400 mt-2">Click to browse files</p>
              </div>
            )}
          </div>
        );

      case "audio" as any:
        return (
          <div className="h-full flex flex-col">
            {block.content.url ? (
              <div className="flex-1 flex flex-col justify-center space-y-4 p-2">
                <div className="flex items-center justify-center">
                  <div className="neu-card p-4 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100">
                    <div className="text-4xl mb-2 text-center">🎤</div>
                    <p className="text-sm font-semibold text-center text-purple-700">
                      {block.content.fileName || "Audio Recording"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-10 h-10 p-0 neu-button rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white border-none hover:scale-110 transition-transform"
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                  <div className="flex-1">
                    <div className="bg-gradient-to-r from-orange-200 to-amber-200 h-3 rounded-full overflow-hidden shadow-neu-inset">
                      <div className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] h-full w-1/3 rounded-full transition-all duration-300"></div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <p className="text-xs text-purple-600 font-medium">0:23</p>
                      <p className="text-xs text-gray-500">{block.content.duration || "1:45"}</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-gray-500 hover:text-purple-600"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'audio/*';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const url = URL.createObjectURL(file);
                          updateContentBlock(block.id, {
                            content: { ...block.content, url, fileName: file.name, duration: "0:00" }
                          });
                        }
                      };
                      input.click();
                    }}
                  >
                    Replace Audio
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="h-full border-2 border-dashed border-purple-300 rounded-lg flex flex-col justify-center items-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition-colors group"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'audio/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      const audio = new Audio(url);
                      audio.addEventListener('loadedmetadata', () => {
                        const minutes = Math.floor(audio.duration / 60);
                        const seconds = Math.floor(audio.duration % 60);
                        const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                        updateContentBlock(block.id, {
                          content: { ...block.content, url, fileName: file.name, duration }
                        });
                      });
                    }
                  };
                  input.click();
                }}
              >
                <div className="text-purple-500 text-5xl mb-3 group-hover:scale-110 transition-transform">🎤</div>
                <p className="text-sm font-semibold text-purple-700 mb-1">Upload Audio</p>
                <p className="text-xs text-secondary-500 mb-2">MP3, WAV, or M4A</p>
                <div className="flex items-center space-x-2 text-xs text-secondary-400">
                  <span>Record or upload</span>
                </div>
              </div>
            )}
          </div>
        );

      case "drawing" as any:
        return (
          <div className="h-full relative">
            {block.content.strokes && block.content.strokes.length > 0 ? (
              <div className="h-full neu-card rounded-lg overflow-hidden group/drawing">
                <svg className="w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
                  {block.content.strokes.map((stroke: any, index: number) => (
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
                  <Button
                    size="sm"
                    variant="secondary"
                    className="opacity-0 group-hover/drawing:opacity-100 transition-opacity bg-white/90 hover:bg-white text-black text-xs py-1 px-3"
                    onClick={() => {
                      // Placeholder for drawing editor
                      updateContentBlock(block.id, {
                        content: { ...block.content, strokes: [] }
                      });
                    }}
                  >
                    Edit Drawing
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="h-full border-2 border-dashed border-green-300 rounded-lg flex flex-col justify-center items-center cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors group"
                onClick={() => {
                  // Create a simple drawing placeholder
                  const sampleStrokes = [
                    { path: "M50,150 Q150,50 250,150 T350,150", color: "#10b981", width: 3 },
                    { path: "M100,200 L150,100 L200,200 L250,100 L300,200", color: "#3b82f6", width: 2 }
                  ];
                  updateContentBlock(block.id, {
                    content: { ...block.content, strokes: sampleStrokes }
                  });
                }}
              >
                <div className="text-green-500 text-5xl mb-3 group-hover:scale-110 transition-transform">🎨</div>
                <p className="text-sm font-semibold text-green-700 mb-1">Create Drawing</p>
                <p className="text-xs text-secondary-500 mb-2">Sketch, doodle, or diagram</p>
                <p className="text-xs text-secondary-400">Click to start drawing</p>
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
      className={`absolute rounded-2xl group interactive ${getBlockColor()} hover:sticky-note ${isDragging ? "opacity-80 scale-105" : ""
        } ${isResizing ? "select-none" : ""} ${!isDragging && !isResizing ? "transition-shadow duration-200" : ""
        }`}
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
        className={`absolute top-0 left-0 w-full h-8 rounded-t-2xl cursor-grab transition-all ${isDragging ? "cursor-grabbing" : ""
          }`}
        style={{
          background: `linear-gradient(135deg, 
            ${getBlockColor().includes('rose') ? 'rgba(251, 207, 232, 0.3)' :
              getBlockColor().includes('blue') ? 'rgba(219, 234, 254, 0.3)' :
                getBlockColor().includes('green') ? 'rgba(209, 250, 229, 0.3)' :
                  getBlockColor().includes('yellow') ? 'rgba(254, 243, 199, 0.3)' :
                    getBlockColor().includes('purple') ? 'rgba(233, 213, 255, 0.3)' :
                      'rgba(243, 244, 246, 0.3)'} 0%, 
            rgba(255, 255, 255, 0.15) 100%)`
        }}
      />

      {/* Resize Handles - 8 directional handles */}
      {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((direction) => (
        <div
          key={direction}
          className={`absolute w-2 h-2 bg-purple-500 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 ${isResizing ? 'opacity-100' : ''
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
