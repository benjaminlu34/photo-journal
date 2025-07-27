import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useDrag, useDrop } from "react-dnd";
import { cn } from "@/lib/utils";
import { Check, X, GripVertical } from "lucide-react";
import { motion } from "framer-motion";
import type { ChecklistItemProps } from "@/types/checklist";
import type { DragItem, DragCollectedProps, DropCollectedProps } from "@/types/notes";
import { getOptimalTextColor, safeColor } from "@/utils/colorUtils/colorUtils";

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
  onDragStart,
  onDragEnd,
  backgroundColor,
}) => {
  const [localText, setLocalText] = useState(item.text);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate optimal text color based on background
  const textColorStyles = useMemo(() => {
    if (!backgroundColor) {
      return {
        color: undefined, // Use default CSS colors
        placeholderColor: undefined,
        mutedColor: undefined
      };
    }

    const safeBackgroundColor = safeColor(backgroundColor, '#F4F7FF');
    const optimalTextColor = getOptimalTextColor(safeBackgroundColor);
    
    if (!optimalTextColor) {
      return {
        color: undefined,
        placeholderColor: undefined,
        mutedColor: undefined
      };
    }

    // For placeholder and muted text, use more transparent versions
    const isLightText = optimalTextColor === '#F9FAFB';
    const placeholderColor = isLightText ? 'rgba(249, 250, 251, 0.7)' : 'rgba(31, 41, 55, 0.7)';
    const mutedColor = isLightText ? 'rgba(249, 250, 251, 0.8)' : 'rgba(31, 41, 55, 0.8)';

    return {
      color: optimalTextColor,
      placeholderColor,
      mutedColor
    };
  }, [backgroundColor]);

  // Drag functionality
  const [{ isDragging: dragIsDragging }, drag, preview] = useDrag<DragItem & { checklistItem: typeof item }, void, DragCollectedProps>({
    type: 'CHECKLIST_ITEM',
    item: () => {
      onDragStart?.(item.id);
      return { type: 'CHECKLIST_ITEM', id: item.id, index, checklistItem: item };
    },
    end: () => {
      onDragEnd?.();
    },
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

  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle keyboard navigation for the entire item
    switch (e.key) {
      case " ": // Space key - toggle checkbox
        e.preventDefault();
        handleCheckboxToggle();
        break;
      case "Enter": // Enter key - start editing
        e.preventDefault();
        if (!isEditing) {
          handleTextClick();
        }
        break;
      case "Delete":
      case "Backspace": // Delete/Backspace - remove item
        e.preventDefault();
        handleRemove();
        break;
      case "Escape": // Escape - cancel any ongoing operations
        e.preventDefault();
        if (isEditing) {
          // Clear debounce timeout and revert changes
          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
          }
          setLocalText(item.text);
          setHasUnsavedChanges(false);
          onEndEdit();
        }
        break;
    }
  };

  const handleCheckboxKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    // Handle keyboard navigation for checkbox specifically
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleCheckboxToggle();
    }
  };

  const handleTextElementKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle keyboard navigation for text element when not editing
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleTextClick();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      handleRemove();
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
    <div className="relative">
      {/* Enhanced Drop zone indicator - top */}
      {isOver && canDrop && (
        <motion.div
          initial={{ opacity: 0, scaleY: 0, scaleX: 0.5 }}
          animate={{ 
            opacity: 1, 
            scaleY: 1, 
            scaleX: 1,
            boxShadow: "0 0 20px rgba(59, 130, 246, 0.6)"
          }}
          exit={{ 
            opacity: 0, 
            scaleY: 0, 
            scaleX: 0.5,
            transition: { duration: 0.15 }
          }}
          className="absolute -top-1 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400 rounded-full shadow-lg z-10"
          style={{ transformOrigin: "center" }}
          transition={{ 
            duration: 0.2,
            ease: "easeOut"
          }}
        >
          {/* Pulsing glow effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-blue-300 via-blue-400 to-blue-300 rounded-full"
            animate={{
              opacity: [0.5, 1, 0.5],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </motion.div>
      )}
      
      <motion.div
        ref={dragRef}
        className={cn(
          "flex items-center gap-2 group relative",
          "p-2 rounded-lg transition-all duration-200",
          "bg-white/20 backdrop-blur-sm border border-white/30",
          "hover:bg-white/30 hover:shadow-md hover:border-white/40",
          "glassmorphism-item",
          // Enhanced drag states
          (isDragging || dragIsDragging) && [
            "opacity-60 shadow-xl border-blue-400/50",
            "transform rotate-2 scale-105 z-50",
            "bg-white/40 backdrop-blur-md"
          ],
          // Drop zone highlighting
          isOver && canDrop && [
            "bg-blue-50/40 border-blue-400/60",
            "shadow-lg ring-2 ring-blue-400/30"
          ],
          // Enhanced completed item styling
          item.completed && [
            "bg-gradient-to-r from-green-50/30 to-emerald-50/30",
            "border-green-300/50 shadow-sm",
            "hover:from-green-50/40 hover:to-emerald-50/40",
            "hover:border-green-400/60 hover:shadow-md"
          ]
        )}
        role="listitem"
        aria-label={`Task ${index + 1}: ${item.text}`}
        aria-describedby={`task-${item.id}-status`}
        tabIndex={0}
        onKeyDown={handleItemKeyDown}
        whileHover={{
          scale: 1.02,
          y: -2,
          boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
          borderColor: item.completed ? "rgba(34, 197, 94, 0.6)" : "rgba(255,255,255,0.5)",
          transition: { 
            duration: 0.2,
            ease: "easeOut"
          }
        }}
        animate={{
          scale: (isDragging || dragIsDragging) ? 1.05 : 1,
          rotate: (isDragging || dragIsDragging) ? 2 : 0,
          opacity: item.completed ? 0.85 : 1,
          backgroundColor: item.completed 
            ? "rgba(34, 197, 94, 0.08)" 
            : "rgba(255,255,255,0.2)",
          transition: { 
            duration: 0.3,
            ease: "easeInOut"
          }
        }}

      >
        {/* Enhanced Drag Handle */}
        <motion.div
          className={cn(
            "drag-handle cursor-grab active:cursor-grabbing",
            "p-1 rounded opacity-0 group-hover:opacity-100",
            "hover:bg-white/20 transition-all duration-200",
            "flex items-center justify-center relative",
            "before:absolute before:inset-0 before:rounded before:bg-gradient-to-r",
            "before:from-blue-400/20 before:to-purple-400/20 before:opacity-0",
            "hover:before:opacity-100 before:transition-opacity before:duration-200"
          )}
          aria-label="Drag to reorder"
          whileHover={{ 
            scale: 1.15,
            backgroundColor: "rgba(255,255,255,0.4)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            transition: { duration: 0.2 }
          }}
          whileTap={{ 
            scale: 0.9,
            transition: { duration: 0.1 }
          }}
          animate={{
            opacity: (isDragging || dragIsDragging) ? 1 : undefined,
            backgroundColor: (isDragging || dragIsDragging) 
              ? "rgba(59, 130, 246, 0.2)" 
              : undefined
          }}
        >
          <motion.div
            animate={{
              rotate: (isDragging || dragIsDragging) ? 15 : 0,
              scale: (isDragging || dragIsDragging) ? 1.3 : 1,
              color: (isDragging || dragIsDragging) ? "#3b82f6" : "#6b7280"
            }}
            transition={{ 
              duration: 0.2,
              ease: "easeOut"
            }}
            whileHover={{
              rotate: 5,
              transition: { duration: 0.15 }
            }}
          >
            <GripVertical className="w-4 h-4" />
          </motion.div>
        </motion.div>

        {/* Enhanced Checkbox */}
        <motion.button
          onClick={handleCheckboxToggle}
          onKeyDown={handleCheckboxKeyDown}
          className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center relative",
            "transition-all duration-200 flex-shrink-0",
            "hover:shadow-md active:shadow-sm",
            "focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-1",
            item.completed
              ? "bg-gradient-to-br from-blue-500 to-blue-600 border-blue-500 shadow-sm"
              : "bg-white/50 border-gray-300 hover:border-blue-400",
            // Add subtle glow effect for completed items
            item.completed && "shadow-blue-400/30"
          )}
          aria-label={`Toggle completion for task ${index + 1}: ${item.text}`}
          aria-describedby={`task-${item.id}-status`}
          aria-pressed={item.completed}
          type="button"
          tabIndex={0}
          whileHover={{ 
            scale: 1.15,
            boxShadow: item.completed 
              ? "0 6px 20px rgba(59, 130, 246, 0.4)" 
              : "0 4px 12px rgba(0,0,0,0.15)",
            borderColor: item.completed ? "#2563eb" : "#3b82f6",
            transition: { duration: 0.2 }
          }}
          whileTap={{ 
            scale: 0.85,
            transition: { duration: 0.1 }
          }}
          animate={{
            backgroundColor: item.completed ? "#3b82f6" : "rgba(255,255,255,0.5)",
            borderColor: item.completed ? "#3b82f6" : "#d1d5db",
            rotate: item.completed ? [0, -10, 10, 0] : 0,
            transition: { 
              duration: item.completed ? 0.5 : 0.2,
              rotate: { duration: 0.3 }
            }
          }}
        >
          {/* Completion celebration effect */}
          {item.completed && (
            <motion.div
              className="absolute inset-0 rounded border-2 border-blue-300"
              initial={{ scale: 1, opacity: 0 }}
              animate={{ 
                scale: [1, 1.5, 2],
                opacity: [0.8, 0.4, 0]
              }}
              transition={{ 
                duration: 0.6,
                ease: "easeOut"
              }}
            />
          )}
          
          <motion.div
            initial={false}
            animate={{
              scale: item.completed ? 1 : 0,
              opacity: item.completed ? 1 : 0,
              rotate: item.completed ? [180, 0] : 180
            }}
            transition={{ 
              duration: 0.3,
              type: "spring",
              stiffness: 400,
              damping: 25
            }}
          >
            <Check className="w-3 h-3 text-white drop-shadow-sm" />
          </motion.div>
        </motion.button>

      {/* Text Input/Display */}
      {isEditing ? (
        <div className="flex-1 relative">
          {textColorStyles.placeholderColor && (
            <style>
              {`
                .checklist-item-input-${item.id}::placeholder {
                  color: ${textColorStyles.placeholderColor} !important;
                }
              `}
            </style>
          )}
          <input
            ref={inputRef}
            type="text"
            value={localText}
            onChange={handleTextChange}
            onKeyDown={handleTextKeyDown}
            onBlur={handleTextBlur}
            className={cn(
              "w-full border-none outline-none bg-transparent text-sm",
              `checklist-item-input-${item.id}`,
              !textColorStyles.color && "text-gray-800",
              !textColorStyles.placeholderColor && "placeholder:text-gray-500",
              "focus:bg-white/30 focus:rounded px-2 py-1",
              "focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-1",
              "transition-all duration-200",
              hasUnsavedChanges && "bg-yellow-50/50 border-l-2 border-yellow-400"
            )}
            style={{
              color: textColorStyles.color,
            }}
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
        <motion.div
          onClick={handleTextClick}
          className={cn(
            "flex-1 text-sm cursor-text px-2 py-1 rounded relative",
            "hover:bg-white/20 transition-all duration-200",
            "min-h-[1.5rem] flex items-center",
            "focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-1 focus:bg-white/20",
            // Only apply default colors if no custom background color
            !textColorStyles.color && "text-gray-800",
            !textColorStyles.color && item.completed && [
              "text-gray-600 opacity-70",
              "hover:bg-green-50/30"
            ]
          )}
          role="button"
          tabIndex={0}
          aria-label="Click to edit task text"
          onKeyDown={handleTextElementKeyDown}
          whileHover={{
            backgroundColor: item.completed 
              ? "rgba(34, 197, 94, 0.1)" 
              : "rgba(255,255,255,0.3)",
            scale: 1.01,
            transition: { duration: 0.2 }
          }}
          animate={{
            opacity: item.completed ? 0.7 : 1,
            color: textColorStyles.color ? (item.completed ? textColorStyles.mutedColor : textColorStyles.color) : (item.completed ? "#6b7280" : "#1f2937"),
            transition: { duration: 0.3 }
          }}
        >
          {/* Strikethrough animation for completed items */}
          {item.completed && (
            <motion.div
              className="absolute inset-0 flex items-center"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ 
                duration: 0.4,
                delay: 0.1,
                ease: "easeOut"
              }}
              style={{ transformOrigin: "left center" }}
            >
              <div 
                className="w-full h-0.5 rounded-full opacity-60" 
                style={{
                  backgroundColor: textColorStyles.mutedColor || '#9ca3af'
                }}
              />
            </motion.div>
          )}
          
          <motion.span
            className="relative z-10"
            animate={{
              opacity: item.completed ? 0.65 : 1,
              scale: item.completed ? 0.98 : 1,
              y: item.completed ? -1 : 0
            }}
            transition={{ 
              duration: 0.3,
              ease: "easeOut"
            }}
          >
            {item.text || "Enter task..."}
          </motion.span>
        </motion.div>
      )}

        {/* Enhanced Remove Button */}
        <motion.button
          onClick={handleRemove}
          className={cn(
            "w-6 h-6 rounded opacity-0 group-hover:opacity-100",
            "hover:bg-red-100/80 flex items-center justify-center relative",
            "transition-all duration-200 flex-shrink-0",
            "hover:shadow-sm active:shadow-none",
            "focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:ring-offset-1 focus:opacity-100",
            "before:absolute before:inset-0 before:rounded before:bg-gradient-to-r",
            "before:from-red-400/20 before:to-pink-400/20 before:opacity-0",
            "hover:before:opacity-100 before:transition-opacity before:duration-200"
          )}
          aria-label="Remove task"
          type="button"
          tabIndex={0}
          whileHover={{ 
            scale: 1.15,
            backgroundColor: "rgba(254, 226, 226, 0.95)",
            boxShadow: "0 4px 12px rgba(239, 68, 68, 0.25)",
            transition: { duration: 0.2 }
          }}
          whileTap={{ 
            scale: 0.85,
            transition: { duration: 0.1 }
          }}
          animate={{
            opacity: (isDragging || dragIsDragging) ? 1 : undefined,
            backgroundColor: (isDragging || dragIsDragging) 
              ? "rgba(254, 226, 226, 0.8)" 
              : undefined
          }}
        >
          <motion.div
            whileHover={{ 
              rotate: 90,
              scale: 1.1,
              transition: { duration: 0.2 }
            }}
            whileTap={{
              rotate: 180,
              transition: { duration: 0.15 }
            }}
            animate={{
              color: (isDragging || dragIsDragging) ? "#dc2626" : "#ef4444"
            }}
          >
            <X className="w-3 h-3" />
          </motion.div>
        </motion.button>

        {/* Screen reader status */}
        <span id={`task-${item.id}-status`} className="sr-only">
          {item.completed ? 'Completed' : 'Not completed'}
        </span>
      </motion.div>
      
      {/* Enhanced Drop zone indicator - bottom */}
      {isOver && canDrop && (
        <motion.div
          initial={{ opacity: 0, scaleY: 0, scaleX: 0.5 }}
          animate={{ 
            opacity: 1, 
            scaleY: 1, 
            scaleX: 1,
            boxShadow: "0 0 20px rgba(59, 130, 246, 0.6)"
          }}
          exit={{ 
            opacity: 0, 
            scaleY: 0, 
            scaleX: 0.5,
            transition: { duration: 0.15 }
          }}
          className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400 rounded-full shadow-lg z-10"
          style={{ transformOrigin: "center" }}
          transition={{ 
            duration: 0.2,
            ease: "easeOut"
          }}
        >
          {/* Pulsing glow effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-blue-300 via-blue-400 to-blue-300 rounded-full"
            animate={{
              opacity: [0.5, 1, 0.5],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </motion.div>
      )}
    </div>
  );
};

export default ChecklistItem;