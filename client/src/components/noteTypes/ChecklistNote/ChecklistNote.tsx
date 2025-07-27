import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { getOptimalTextColor, safeColor } from "@/utils/colorUtils/colorUtils";
import type { ChecklistNoteProps, ChecklistNoteContent, ChecklistItem } from "@/types/checklist";
import {
  migrateChecklistItem,
  createChecklistItem,
  updateChecklistItem,
  sortChecklistItems,
  getDefaultChecklistSettings
} from "@/lib/checklist-utils";
import ChecklistItemComponent from "./ChecklistItem";
// import ChecklistDragPreview from "./ChecklistDragPreview"; // Disabled to prevent duplicate drag previews
import EmptyState from "./EmptyState";
import ChecklistHeader from "./ChecklistHeader";
import { motion, AnimatePresence } from "framer-motion";

const ChecklistNote: React.FC<ChecklistNoteProps> = ({
  content = { type: 'checklist', items: [], settings: getDefaultChecklistSettings() },
  onChange
}) => {
  const [newItemText, setNewItemText] = useState("");
  const [localItems, setLocalItems] = useState<ChecklistItem[]>(() =>
    sortChecklistItems((content.items || []).map(migrateChecklistItem))
  );
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const addItemInputRef = useRef<HTMLInputElement>(null);

  // Calculate optimal text color based on background
  const textColorStyles = useMemo(() => {
    if (!content.backgroundColor) {
      return {
        color: undefined, // Use default CSS colors
        placeholderColor: undefined,
        iconColor: undefined
      };
    }

    const safeBackgroundColor = safeColor(content.backgroundColor, '#F4F7FF');
    const optimalTextColor = getOptimalTextColor(safeBackgroundColor);
    
    if (!optimalTextColor) {
      return {
        color: undefined,
        placeholderColor: undefined,
        iconColor: undefined
      };
    }

    // For placeholder text, use a slightly more transparent version
    const isLightText = optimalTextColor === '#F9FAFB';
    const placeholderColor = isLightText ? 'rgba(249, 250, 251, 0.7)' : 'rgba(31, 41, 55, 0.7)';
    const iconColor = isLightText ? 'rgba(249, 250, 251, 0.8)' : 'rgba(31, 41, 55, 0.8)';

    return {
      color: optimalTextColor,
      placeholderColor,
      iconColor
    };
  }, [content.backgroundColor]);

  // Sync local state when content prop changes (from server)
  useEffect(() => {
    const migratedItems = sortChecklistItems((content.items || []).map(migrateChecklistItem));
    setLocalItems(migratedItems);
  }, [content.items]);

  // Debounced save function
  const debouncedSave = useCallback((items: ChecklistItem[]) => {
    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for saving
    debounceTimeoutRef.current = setTimeout(() => {
      const updatedContent: ChecklistNoteContent = {
        ...content,
        items,
        settings: content.settings || getDefaultChecklistSettings(),
      };
      onChange?.(updatedContent);
    }, 500); // 500ms debounce
  }, [onChange, content]);

  // Auto-resize effect to expand note when content grows
  useEffect(() => {
    if (!containerRef.current) return;

    const calculateRequiredHeight = () => {
      // Get the actual content height by measuring the container's scroll height
      const container = containerRef.current;
      if (!container) return;

      // Temporarily remove height constraint to measure natural content height
      const originalHeight = container.style.height;
      container.style.height = 'auto';
      
      // Measure the natural height needed for all content
      const naturalHeight = container.scrollHeight;
      
      // Restore original height
      container.style.height = originalHeight;
      
      // Add some padding for comfortable spacing
      const requiredHeight = Math.max(naturalHeight + 20, 150);
      
      // Get current note element (traverse up to find the note shell)
      const noteElement = container.closest('[style*="height"]') as HTMLElement;
      if (noteElement) {
        const currentHeight = parseInt(noteElement.style.height || '150');
        
        // Expand the note if more height is needed
        if (requiredHeight > currentHeight) {
          noteElement.style.height = `${requiredHeight}px`;
          
          // Also update the width to maintain aspect ratio if needed
          const currentWidth = parseInt(noteElement.style.width || '200');
          const minWidth = Math.max(currentWidth, 250); // Ensure minimum width for readability
          noteElement.style.width = `${minWidth}px`;
        }
      }
    };

    // Calculate on mount and when items change
    const timeoutId = setTimeout(calculateRequiredHeight, 150);
    
    return () => clearTimeout(timeoutId);
  }, [localItems.length]);

  // Set up resize observer for dynamic content changes
  useEffect(() => {
    if (!containerRef.current) return;

    // Create resize observer to watch for content changes
    resizeObserverRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const container = entry.target as HTMLElement;
        const noteElement = container.closest('[style*="height"]') as HTMLElement;
        
        if (noteElement) {
          const contentHeight = entry.contentRect.height;
          const requiredHeight = Math.max(contentHeight + 40, 150); // Add padding
          const currentHeight = parseInt(noteElement.style.height || '150');
          
          // Only expand if needed
          if (requiredHeight > currentHeight) {
            noteElement.style.height = `${requiredHeight}px`;
          }
        }
      }
    });

    resizeObserverRef.current.observe(containerRef.current);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleToggleItem = useCallback(
    (itemId: string) => {
      const updatedItems = localItems.map((item) =>
        item.id === itemId ? updateChecklistItem(item, { completed: !item.completed }) : item,
      );
      setLocalItems(updatedItems);
      debouncedSave(updatedItems);
    },
    [localItems, debouncedSave],
  );

  const handleItemTextChange = useCallback(
    (itemId: string, text: string) => {
      const updatedItems = localItems.map((item) =>
        item.id === itemId ? updateChecklistItem(item, { text }) : item,
      );
      setLocalItems(updatedItems);
      debouncedSave(updatedItems);
    },
    [localItems, debouncedSave],
  );

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      const updatedItems = localItems.filter((item) => item.id !== itemId);
      setLocalItems(updatedItems);
      debouncedSave(updatedItems);
    },
    [localItems, debouncedSave],
  );

  const handleAddItem = useCallback(() => {
    if (newItemText.trim()) {
      const newItem = createChecklistItem(newItemText, localItems.length);
      const updatedItems = sortChecklistItems([...localItems, newItem]);
      setLocalItems(updatedItems);
      debouncedSave(updatedItems);
      setNewItemText("");
    }
  }, [localItems, newItemText, debouncedSave]);

  const handleStartEdit = useCallback((itemId: string) => {
    setEditingItemId(itemId);
  }, []);

  const handleEndEdit = useCallback(() => {
    setEditingItemId(null);
  }, []);

  const handleDragStart = useCallback((itemId: string) => {
    setDraggedItemId(itemId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItemId(null);
  }, []);

  const handleMoveItem = useCallback((dragIndex: number, dropIndex: number) => {
    if (dragIndex === dropIndex) return;

    setIsReordering(true);
    
    const draggedItem = localItems[dragIndex];
    const newItems = [...localItems];
    
    // Remove the dragged item
    newItems.splice(dragIndex, 1);
    
    // Insert it at the new position
    newItems.splice(dropIndex, 0, draggedItem);
    
    // Update order field for all items
    const reorderedItems = newItems.map((item, index) => 
      updateChecklistItem(item, { order: index })
    );
    
    setLocalItems(reorderedItems);
    debouncedSave(reorderedItems);
    
    // Reset reordering state after animation
    setTimeout(() => setIsReordering(false), 300);
  }, [localItems, debouncedSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddItem();
      }
    },
    [handleAddItem],
  );

  const handleAddButtonKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleAddItem();
      }
    },
    [handleAddItem],
  );

  const handleAddFirstItem = useCallback(() => {
    // Focus the input field within this specific checklist instance
    if (addItemInputRef.current) {
      addItemInputRef.current.focus();
    }
  }, []);

  const handleTitleChange = useCallback((title: string) => {
    const updatedContent: ChecklistNoteContent = {
      ...content,
      title,
      settings: content.settings || getDefaultChecklistSettings(),
    };
    onChange?.(updatedContent);
  }, [onChange, content]);

  return (
    <DndProvider backend={HTML5Backend}>
      {/* <ChecklistDragPreview /> Disabled to prevent duplicate drag previews */}
      <div 
        ref={containerRef}
        className="h-full p-4 flex flex-col"
      >
        {/* Checklist Header */}
        <ChecklistHeader
          title={content.title}
          onTitleChange={handleTitleChange}
          backgroundColor={content.backgroundColor}
        />

        {/* Existing items or empty state */}
        {localItems.length === 0 ? (
          <EmptyState 
            onAddFirstItem={handleAddFirstItem}
            className="flex-1"
          />
        ) : (
          <div 
            className={cn(
              "space-y-2 transition-all duration-300",
              isReordering && "pointer-events-none"
            )} 
            role="list" 
            aria-label="Checklist items"
          >
            <AnimatePresence mode="popLayout">
              {localItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0, 
                    scale: 1,
                    transition: {
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                      duration: 0.3
                    }
                  }}
                  exit={{ 
                    opacity: 0, 
                    y: -10, 
                    scale: 0.95,
                    transition: {
                      duration: 0.2
                    }
                  }}
                  whileHover={{ 
                    scale: 1.02,
                    transition: { duration: 0.2 }
                  }}
                  className={cn(
                    "transform-gpu",
                    draggedItemId === item.id && "z-50"
                  )}
                >
                  <ChecklistItemComponent
                    item={item}
                    index={index}
                    isEditing={editingItemId === item.id}
                    isDragging={draggedItemId === item.id}
                    onToggle={handleToggleItem}
                    onTextChange={handleItemTextChange}
                    onRemove={handleRemoveItem}
                    onStartEdit={handleStartEdit}
                    onEndEdit={handleEndEdit}
                    onMove={handleMoveItem}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    backgroundColor={content.backgroundColor}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Spacer to push add item section to bottom when there are items */}
        {localItems.length > 0 && <div className="flex-1 min-h-2" />}

        {/* Add new item - always at bottom */}
        <motion.div 
          className="flex items-center gap-2 pt-2 mt-auto border-t border-white/20"
          initial={{ opacity: 0.7 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            onClick={handleAddItem}
            onKeyDown={handleAddButtonKeyDown}
            className={cn(
              "w-5 h-5 rounded border-2 border-gray-300 bg-white/50",
              "hover:shadow-md active:shadow-sm transition-all duration-200",
              "flex items-center justify-center flex-shrink-0",
              "hover:border-blue-400 hover:bg-white/70",
              "focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-1",
            )}
            aria-label="Add new checklist item"
            type="button"
            tabIndex={0}
            whileHover={{ 
              scale: 1.1,
              boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
            }}
            whileTap={{ 
              scale: 0.95,
              transition: { duration: 0.1 }
            }}
          >
            <motion.div
              animate={{ rotate: newItemText.trim() ? 45 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <Plus 
                className={cn(
                  "w-3 h-3",
                  !textColorStyles.iconColor && "text-gray-600"
                )}
                style={{
                  color: textColorStyles.iconColor
                }}
              />
            </motion.div>
          </motion.button>
          {textColorStyles.placeholderColor && (
            <style>
              {`
                .checklist-add-item-input::placeholder {
                  color: ${textColorStyles.placeholderColor} !important;
                }
              `}
            </style>
          )}
          <motion.input
            ref={addItemInputRef}
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "flex-1 border-none outline-none bg-transparent text-sm",
              "checklist-add-item-input",
              !textColorStyles.color && "text-gray-800",
              !textColorStyles.placeholderColor && "placeholder:text-gray-500",
              "focus:bg-white/20 focus:rounded px-2 py-1",
              "focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-1",
              "transition-all duration-200",
            )}
            style={{
              color: textColorStyles.color,
            }}
            placeholder="Add new item..."
            aria-label="Enter new checklist item text"
            whileFocus={{
              backgroundColor: "rgba(255,255,255,0.3)",
              scale: 1.02,
              transition: { duration: 0.2 }
            }}
          />
        </motion.div>
      </div>
    </DndProvider>
  );
};

export default ChecklistNote;
