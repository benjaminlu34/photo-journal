// Enhanced Checklist Types for Interactive Checklist Note Feature

import type { ChecklistItem, ChecklistSettings, DragItem, DropResult } from './notes';

// Extended interfaces for enhanced checklist functionality
export interface ChecklistItemProps {
  item: ChecklistItem;
  index: number;
  isEditing: boolean;
  isDragging: boolean;
  onToggle: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onStartEdit: (id: string) => void;
  onEndEdit: () => void;
  onMove: (dragIndex: number, dropIndex: number) => void;
}

export interface ChecklistNoteProps {
  content: ChecklistNoteContent;
  onChange?: (content: ChecklistNoteContent) => void;
  isCollaborative?: boolean;
  readOnly?: boolean;
}

export interface ChecklistNoteContent {
  type: 'checklist';
  items: ChecklistItem[];
  settings?: ChecklistSettings;
  backgroundColor?: string;
}

export interface ChecklistNoteState {
  localItems: ChecklistItem[];
  draggedItemId: string | null;
  editingItemId: string | null;
  newItemText: string;
}

// CRDT Operations for checklist management
export interface ChecklistOperations {
  addItem: (item: Omit<ChecklistItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateItem: (id: string, updates: Partial<ChecklistItem>) => void;
  removeItem: (id: string) => void;
  reorderItems: (itemIds: string[]) => void;
  toggleItem: (id: string) => void;
}

// Drag and Drop specific types
export interface ChecklistDragItem extends DragItem {
  type: 'CHECKLIST_ITEM';
  item: ChecklistItem;
}

export interface ChecklistDropResult extends DropResult {
  targetIndex: number;
}

// Validation and utility types
export interface ChecklistValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ChecklistItemUpdate {
  id: string;
  text?: string;
  completed?: boolean;
  order?: number;
}

// Re-export commonly used types from notes.ts for convenience
export type { ChecklistItem, ChecklistSettings, DragItem, DropResult } from './notes';