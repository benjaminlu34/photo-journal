import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plus, X, Check } from 'lucide-react';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface ChecklistNoteProps {
  content: { items?: ChecklistItem[] };
  onChange?: (content: { items: ChecklistItem[] }) => void;
}

export const ChecklistNote: React.FC<ChecklistNoteProps> = ({
  content,
  onChange
}) => {
  const [newItemText, setNewItemText] = useState('');
  const items = content.items || [];

  const handleToggleItem = (id: string) => {
    const updatedItems = items.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    onChange?.({ items: updatedItems });
  };

  const handleAddItem = () => {
    if (newItemText.trim()) {
      const newItem: ChecklistItem = {
        id: Date.now().toString(),
        text: newItemText.trim(),
        completed: false
      };
      onChange?.({ items: [...items, newItem] });
      setNewItemText('');
    }
  };

  const handleRemoveItem = (id: string) => {
    const updatedItems = items.filter(item => item.id !== id);
    onChange?.({ items: updatedItems });
  };

  const handleItemTextChange = (id: string, text: string) => {
    const updatedItems = items.map(item =>
      item.id === id ? { ...item, text } : item
    );
    onChange?.({ items: updatedItems });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <div className="w-full h-full flex flex-col space-y-2">
      {/* Existing Items */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center space-x-2 group">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleItem(item.id);
              }}
              className={cn(
                'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                'hover:shadow-neu-inset',
                item.completed
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-muted bg-surface'
              )}
            >
              {item.completed && <Check className="w-3 h-3" />}
            </button>
            
            <input
              type="text"
              value={item.text}
              onChange={(e) => {
                e.stopPropagation();
                handleItemTextChange(item.id, e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'flex-1 bg-transparent border-0 outline-none text-sm',
                'focus:bg-surface rounded px-2 py-1 transition-colors',
                item.completed && 'line-through text-muted-foreground'
              )}
              placeholder="Enter item text..."
            />
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveItem(item.id);
              }}
              className={cn(
                'w-5 h-5 rounded-md flex items-center justify-center',
                'text-destructive hover:bg-destructive/10 transition-colors',
                'opacity-0 group-hover:opacity-100'
              )}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Add New Item */}
      <div className="flex items-center space-x-2 pt-2 border-t border-muted/50">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAddItem();
          }}
          className={cn(
            'w-5 h-5 rounded-md border-2 border-dashed border-muted',
            'flex items-center justify-center text-muted-foreground',
            'hover:border-primary hover:text-primary transition-colors'
          )}
        >
          <Plus className="w-3 h-3" />
        </button>
        
        <input
          type="text"
          value={newItemText}
          onChange={(e) => {
            e.stopPropagation();
            setNewItemText(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex-1 bg-transparent border-0 outline-none text-sm',
            'focus:bg-surface rounded px-2 py-1 transition-colors'
          )}
          placeholder="Add new item..."
        />
      </div>
    </div>
  );
};