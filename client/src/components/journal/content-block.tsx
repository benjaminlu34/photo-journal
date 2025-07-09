import { useState, useRef, useEffect } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useJournal } from "@/contexts/journal-context";
import type { ContentBlockData, Position, DragItem } from "@/types/journal";
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
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const blockRef = useRef<HTMLDivElement>(null);

  const [{ isDragging: dragMonitor }, drag] = useDrag({
    type: "content-block",
    item: (): DragItem => ({ type: "content-block", id: block.id }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: "content-block",
    drop: (item: DragItem, monitor) => {
      if (item.id === block.id) return;
      
      const workspaceElement = document.querySelector('[data-workspace="true"]');
      if (!workspaceElement) return;
      
      const workspaceRect = workspaceElement.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      // Calculate new position relative to workspace
      const newPosition: Position = {
        ...block.position,
        x: clientOffset.x - workspaceRect.left - block.position.width / 2,
        y: clientOffset.y - workspaceRect.top - block.position.height / 2,
      };

      updateBlockPosition(item.id, newPosition);
    },
  });

  useEffect(() => {
    setIsDragging(dragMonitor);
  }, [dragMonitor]);

  // Handle manual dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing || isResizing) return;
    
    const rect = blockRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    
    const handleMouseMove = (e: MouseEvent) => {
      const workspace = document.querySelector('[data-workspace="true"]');
      if (!workspace) return;
      
      const workspaceRect = workspace.getBoundingClientRect();
      const newX = e.clientX - workspaceRect.left - dragOffset.x;
      const newY = e.clientY - workspaceRect.top - dragOffset.y;
      
      updateBlockPosition(block.id, {
        ...block.position,
        x: Math.max(0, Math.min(newX, workspaceRect.width - block.position.width)),
        y: Math.max(0, Math.min(newY, workspaceRect.height - block.position.height))
      });
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setIsDragging(false);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    setIsDragging(true);
  };

  // Handle resizing
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = block.position.width;
    const startHeight = block.position.height;
    
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(150, startWidth + (e.clientX - startX));
      const newHeight = Math.max(100, startHeight + (e.clientY - startY));
      
      updateBlockPosition(block.id, {
        ...block.position,
        width: newWidth,
        height: newHeight
      });
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setIsResizing(false);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    setIsResizing(true);
  };

  const saveContent = () => {
    updateContentBlock(block.id, { content: editContent });
    setIsEditing(false);
  };

  const resetRotation = () => {
    updateBlockPosition(block.id, { ...block.position, rotation: 0 });
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
      ref={(node) => {
        blockRef.current = node;
        drag(drop(node));
      }}
      onMouseDown={handleMouseDown}
      className={`absolute p-4 rounded-2xl transition-all group interactive ${getBlockColor()} ${
        isDragging ? "opacity-80 scale-105 cursor-grabbing" : "cursor-grab"
      } ${isResizing ? "select-none" : ""}`}
      style={{
        left: block.position.x,
        top: block.position.y,
        width: block.position.width,
        height: block.position.height,
        transform: `rotate(${block.position.rotation}deg)`,
        zIndex: isDragging || isResizing ? 1000 : 1,
      }}
    >
      {/* Resize Handle */}
      <div 
        className="absolute -bottom-2 -right-2 w-6 h-6 gradient-button rounded-full cursor-se-resize opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center" 
        onMouseDown={handleResizeMouseDown}
      >
        <div className="w-2 h-2 border-r-2 border-b-2 border-white/50"></div>
      </div>

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
  );
}
