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
    hover: (item: DragItem, monitor) => {
      if (item.id === block.id) return;
      
      const hoverBoundingRect = blockRef.current?.getBoundingClientRect();
      if (!hoverBoundingRect) return;

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      // Calculate new position
      const newPosition: Position = {
        ...block.position,
        x: clientOffset.x - hoverBoundingRect.width / 2,
        y: clientOffset.y - hoverBoundingRect.height / 2,
      };

      updateBlockPosition(item.id, newPosition);
    },
  });

  useEffect(() => {
    setIsDragging(dragMonitor);
  }, [dragMonitor]);

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
        return "bg-warm-yellow";
      case "photo":
        return "bg-white";
      case "text":
        return "bg-white";
      case "checklist":
        return "bg-primary-100";
      case "audio":
        return "bg-warm-lavender";
      case "drawing":
        return "bg-primary-50";
      default:
        return "bg-white";
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
            {block.content.url && (
              <img 
                src={block.content.url} 
                alt={block.content.caption || "Photo"} 
                className="w-full h-32 object-cover rounded-lg"
              />
            )}
            {block.content.caption && (
              <p className="text-xs text-secondary-600">{block.content.caption}</p>
            )}
          </div>
        );

      case "audio":
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <Button size="sm" variant="outline" className="w-8 h-8 p-0">
                <Play className="w-3 h-3" />
              </Button>
              <div className="flex-1">
                <div className="bg-purple-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full w-1/3 rounded-full"></div>
                </div>
                <p className="text-xs text-purple-700 mt-1">
                  {block.content.duration || "0:00"}
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return <div className="text-sm text-secondary-500">Unsupported content type</div>;
    }
  };

  return (
    <Card
      ref={(node) => {
        blockRef.current = node;
        drag(drop(node));
      }}
      className={`absolute p-4 rounded-2xl shadow-neumorphic transition-all cursor-move hover:shadow-lg ${getBlockColor()} ${
        isDragging ? "opacity-50 scale-105" : "hover:-translate-y-1"
      }`}
      style={{
        left: block.position.x,
        top: block.position.y,
        width: block.position.width,
        height: block.position.height,
        transform: `rotate(${block.position.rotation}deg)`,
        zIndex: isDragging ? 1000 : 1,
      }}
    >
      {/* Resize Handle */}
      <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-primary-500 border-2 border-white rounded-full cursor-se-resize opacity-0 hover:opacity-100 transition-opacity" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-sm">{getBlockIcon()}</span>
          <span className="text-xs text-secondary-500 font-medium">
            {new Date(block.createdAt).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            className="w-6 h-6 p-0"
            onClick={resetRotation}
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="w-6 h-6 p-0 text-red-500 hover:text-red-700"
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
    </Card>
  );
}
