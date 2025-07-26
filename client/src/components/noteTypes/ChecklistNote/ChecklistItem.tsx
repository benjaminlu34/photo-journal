import React, { useState, useRef, useEffect, useCallback } from "react";
import { useDrag, useDrop } from "react-dnd";
import { cn } from "@/lib/utils";
import { Check, X, GripVertical } from "lucide-react";
import type { ChecklistItemProps } from "@/types/checklist";
import type { DragItem, DragCollectedProps, DropCollectedProps } from "@/types/notes";

const ChecklistItem: React.FC<ChecklistItemProps> = ({
  item,
  index,
  isEditing,
  isDragging,
  onToggle,
  onTextChange,
  onRemove,
  onStartEdit,
  onEndEdit,
  onMove,
}) => {
  const [localText, setLocalText] = useState(item.text);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Drag functionality
  const [{ isDragging: dragIsDragging }, drag, preview] = useDrag<DragItem & { checklistItem: typeof item }, void, DragCollectedProps>({
    type: 'CHECKLIST_ITEM',
    item: { type: 'CHECKLIST_ITEM', id: item.id, index, checklistItem: item },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Drop functionality
  const [{ isOver, canDrop }, drop] = useDrop<DragItem, void, DropCollectedProps>({
    accept: 'CHECKLIST_ITEM',
    hover: (draggedItem: DragItem, monitor) => {
      if (!dragRef.current) {
        return;
      }

      const dragIndex = draggedItem.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }

      // Determine rectangle on screen
      const hoverBoundingRect = dragRef.current.getBoundingClientRect();

      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) {
        return;
      }

      // Get pixels to the top
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      // Time to actually perform the action
      onMove(dragIndex, hoverIndex);

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      draggedItem.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  // Connect drag and drop refs
  drag(dragRef);
  drop(dragRef);

  // Use empty drag preview (we'll use DragLayer for custom preview)
  useEffect(() => {
    if (preview) {
      preview(document.createElement('div'), {
        captureDraggingState: true,
      });
    }
  }, [preview]);

  // Debounced auto-save function
  const debouncedSave = useCallback((text: string) => {
    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for auto-save
    debounceTimeoutRef.current = setTimeout(() => {
      if (text !== item.text) {
        onTextChange(item.id, text);
        setHasUnsavedChanges(false);
      }
    }, 300); // 300ms debounce delay
  }, [item.id, item.text, onTextChange]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sync local text with item text when not editing
  useEffect(() => {
    if (!isEditing) {
      setLocalText(item.text);
      setHasUnsavedChanges(false);
    }
  }, [item.text, isEditing]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleTextClick = () => {
    if (!isEditing) {
      onStartEdit(item.id);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setLocalText(newText);
    setHasUnsavedChanges(newText !== item.text);
    
    // Trigger debounced auto-save
    debouncedSave(newText);
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Clear debounce timeout and save immediately
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      onTextChange(item.id, localText);
      setHasUnsavedChanges(false);
      onEndEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Clear debounce timeout and revert changes
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      setLocalText(item.text); // Reset to original text
      setHasUnsavedChanges(false);
      onEndEdit();
    }
  };

  const handleTextBlur = () => {
    // Clear debounce timeout and save immediately on blur
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    if (localText !== item.text) {
      onTextChange(item.id, localText);
    }
    setHasUnsavedChanges(false);
    onEndEdit();
  };

  const handleCheckboxToggle = () => {
    onToggle(item.id);
  };

  const handleRemove = () => {
    onRemove(item.id);
  };

  return (
    <div
      ref={dragRef}
      className={cn(
        "flex items-center gap-2 group relative",
        "p-2 rounded-lg transition-all duration-200",
        "bg-white/20 backdrop-blur-sm border border-white/30",
        "hover:bg-white/30 hover:shadow-md hover:border-white/40",
        (isDragging || dragIsDragging) && "opacity-50 shadow-lg transform rotate-1 scale-105",
        isOver && canDrop && "bg-blue-100/30 border-blue-400/50",
        "glassmorphism-item"
      )}
      role="listitem"
      aria-label={`Task ${index + 1}: ${item.text}`}
      aria-describedby={`task-${item.id}-status`}
      tabIndex={0}
    >
      {/* Drag Handle */}
      <div
        className={cn(
          "drag-handle cursor-grab active:cursor-grabbing",
          "p-1 rounded opacity-0 group-hover:opacity-100",
          "hover:bg-white/20 transition-all duration-200",
          "flex items-center justify-center"
        )}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4 text-gray-600" />
      </div>

      {/* Checkbox */}
      <button
        onClick={handleCheckboxToggle}
        className={cn(
          "w-5 h-5 rounded border-2 flex items-center justify-center",
          "transition-all duration-200 flex-shrink-0",
          "hover:shadow-md active:shadow-sm",
          item.completed
            ? "bg-blue-500 border-blue-500 shadow-sm"
            : "bg-white/50 border-gray-300 hover:border-blue-400",
        )}
        aria-label={`Toggle completion for task ${index + 1}: ${item.text}`}
        aria-describedby={`task-${item.id}-status`}
        type="button"
      >
        {item.completed && <Check className="w-3 h-3 text-white" />}
      </button>

      {/* Text Input/Display */}
      {isEditing ? (
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={localText}
            onChange={handleTextChange}
            onKeyDown={handleTextKeyDown}
            onBlur={handleTextBlur}
            className={cn(
              "w-full border-none outline-none bg-transparent text-sm",
              "text-gray-800 placeholder:text-gray-500",
              "focus:bg-white/30 focus:rounded px-2 py-1",
              "transition-all duration-200",
              hasUnsavedChanges && "bg-yellow-50/50 border-l-2 border-yellow-400"
            )}
            placeholder="Enter task..."
            aria-label="Edit task text"
            aria-describedby={hasUnsavedChanges ? `unsaved-${item.id}` : undefined}
          />
          {hasUnsavedChanges && (
            <div
              id={`unsaved-${item.id}`}
              className="absolute -bottom-5 left-2 text-xs text-yellow-600"
            >
              Auto-saving...
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={handleTextClick}
          className={cn(
            "flex-1 text-sm cursor-text px-2 py-1 rounded",
            "text-gray-800 hover:bg-white/20 transition-all duration-200",
            item.completed && "line-through text-gray-600 opacity-75",
            "min-h-[1.5rem] flex items-center",
            "focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:bg-white/20"
          )}
          role="button"
          tabIndex={0}
          aria-label="Click to edit task text"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleTextClick();
            } else if (e.key === "Delete" || e.key === "Backspace") {
              e.preventDefault();
              handleRemove();
            }
          }}
        >
          {item.text || "Enter task..."}
        </div>
      )}

      {/* Remove Button */}
      <button
        onClick={handleRemove}
        className={cn(
          "w-6 h-6 rounded opacity-0 group-hover:opacity-100",
          "hover:bg-red-100/80 flex items-center justify-center",
          "transition-all duration-200 flex-shrink-0",
          "hover:shadow-sm active:shadow-none"
        )}
        aria-label="Remove task"
        type="button"
      >
        <X className="w-3 h-3 text-red-500" />
      </button>

      {/* Screen reader status */}
      <span id={`task-${item.id}-status`} className="sr-only">
        {item.completed ? 'Completed' : 'Not completed'}
      </span>
    </div>
  );
};

export default ChecklistItem;