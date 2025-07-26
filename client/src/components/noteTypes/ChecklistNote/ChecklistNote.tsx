import React, { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, Plus, X } from "lucide-react";
import type { ChecklistNoteProps, ChecklistNoteContent, ChecklistItem } from "@/types/checklist";
import {
  migrateChecklistItem,
  createChecklistItem,
  updateChecklistItem,
  sortChecklistItems,
  getDefaultChecklistSettings
} from "@/lib/checklist-utils";

const ChecklistNote: React.FC<ChecklistNoteProps> = ({
  content = { type: 'checklist', items: [], settings: getDefaultChecklistSettings() },
  onChange
}) => {
  const [newItemText, setNewItemText] = useState("");
  const [localItems, setLocalItems] = useState<ChecklistItem[]>(() =>
    (content.items || []).map(migrateChecklistItem)
  );
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local state when content prop changes (from server)
  useEffect(() => {
    const migratedItems = (content.items || []).map(migrateChecklistItem);
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
      const updatedItems = [...localItems, newItem];
      setLocalItems(updatedItems);
      debouncedSave(updatedItems);
      setNewItemText("");
    }
  }, [localItems, newItemText, debouncedSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddItem();
      }
    },
    [handleAddItem],
  );

  return (
    <div className="h-full p-4 space-y-2">
      {/* Existing items */}
      <div className="space-y-2">
        {localItems.map((item) => (
          <div key={item.id} className="flex items-center gap-2 group">
            <button
              onClick={() => handleToggleItem(item.id)}
              className={cn(
                "w-4 h-4 rounded border-2 flex items-center justify-center",
                "hover:shadow-md active:shadow-sm transition-all",
                item.completed
                  ? "bg-blue-500 border-blue-500"
                  : "bg-white border-gray-300",
              )}
            >
              {item.completed && <Check className="w-3 h-3 text-white" />}
            </button>
            <input
              type="text"
              value={item.text}
              onChange={(e) => handleItemTextChange(item.id, e.target.value)}
              className={cn(
                "flex-1 border-none outline-none bg-transparent text-sm",
                "placeholder:text-current/50",
                item.completed && "line-through opacity-60",
              )}
              placeholder="Enter task..."
            />
            <button
              onClick={() => handleRemoveItem(item.id)}
              className={cn(
                "w-6 h-6 rounded opacity-0 group-hover:opacity-100",
                "hover:bg-red-100 flex items-center justify-center transition-all",
              )}
            >
              <X className="w-3 h-3 text-red-500" />
            </button>
          </div>
        ))}
      </div>

      {/* Add new item */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={handleAddItem}
          className={cn(
            "w-4 h-4 rounded border-2 border-gray-300 bg-white",
            "hover:shadow-md active:shadow-sm transition-all",
            "flex items-center justify-center",
          )}
        >
          <Plus className="w-3 h-3 text-gray-500" />
        </button>
        <input
          type="text"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex-1 border-none outline-none bg-transparent text-sm",
            "placeholder:text-current/50",
          )}
          placeholder="Add new item..."
        />
      </div>
    </div>
  );
};

export default ChecklistNote;
