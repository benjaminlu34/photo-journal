import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, Plus, X } from "lucide-react";
import type { ChecklistNoteContent, ChecklistItem } from "@/types/notes";

interface ChecklistNoteProps {
  content: ChecklistNoteContent;
  onChange?: (content: ChecklistNoteContent) => void;
}
const uid = () => crypto.randomUUID();
const ChecklistNote: React.FC<ChecklistNoteProps> = ({ content = { items: [] }, onChange }) => {
  const [newItemText, setNewItemText] = useState("");

  const handleToggleItem = useCallback(
    (itemId: string) => {
      const updatedItems = (content?.items || []).map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item,
      );
      onChange?.({ items: updatedItems });
    },
    [content.items, onChange],
  );

  const handleItemTextChange = useCallback(
    (itemId: string, text: string) => {
      const updatedItems = (content?.items || []).map((item) =>
        item.id === itemId ? { ...item, text } : item,
      );
      onChange?.({ items: updatedItems });
    },
    [content.items, onChange],
  );

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      const updatedItems = (content?.items || []).filter((item) => item.id !== itemId);
      onChange?.({ items: updatedItems });
    },
    [content.items, onChange],
  );

  const handleAddItem = useCallback(() => {
    if (newItemText.trim()) {
      const newItem: ChecklistItem = {
        id: uid(),
        text: newItemText.trim(),
        completed: false,
      };
      onChange?.({ items: [...(content?.items || []), newItem] });
      setNewItemText("");
    }
  }, [content.items, newItemText, onChange]);

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
        {(content?.items || []).map((item) => (
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
                "text-gray-800 placeholder:text-gray-500",
                item.completed && "line-through text-gray-600",
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
            "text-gray-800 placeholder:text-gray-500",
          )}
          placeholder="Add new item..."
        />
      </div>
    </div>
  );
};

export default ChecklistNote;
