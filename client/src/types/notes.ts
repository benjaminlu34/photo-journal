export interface NotePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  order: number; // New field for explicit ordering
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistSettings {
  allowReordering: boolean;
  showCompletedItems: boolean;
  sortBy: 'order' | 'created' | 'alphabetical';
}

export interface DrawingStroke {
  points: Array<{ x: number; y: number; pressure: number }>;
  color: string;
  width: number;
}

export type NoteContent =
  | { type: 'text'; text: string; backgroundColor?: string }
  | { type: 'sticky_note'; text: string; backgroundColor?: string }
  | { type: 'checklist'; items: ChecklistItem[]; settings?: ChecklistSettings; backgroundColor?: string; title?: string }
  | { type: 'image'; imageUrl?: string; alt?: string; backgroundColor?: string }
  | { type: 'voice'; audioUrl?: string; duration?: number; backgroundColor?: string }
  | { type: 'drawing'; strokes: DrawingStroke[]; backgroundColor?: string };

type ContentFor<T extends NoteContent['type']> = Extract<NoteContent, { type: T }>;

export interface NoteCreator {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface NoteData<T extends NoteContent['type'] = NoteContent['type']> {
  id: string;
  type: T;
  position: NotePosition;
  content: ContentFor<T>;
  createdAt: string;
  updatedAt: string;
  createdBy?: NoteCreator;
}

export type NoteUpdate = Partial<Omit<NoteData, 'id' | 'type'>>;

// Drag and Drop Type Definitions for react-dnd integration
export interface DragItem {
  type: 'CHECKLIST_ITEM';
  id: string;
  index: number;
}

export interface DropResult {
  dropIndex: number;
}

export interface DragCollectedProps {
  isDragging: boolean;
}

export interface DropCollectedProps {
  isOver: boolean;
  canDrop: boolean;
}