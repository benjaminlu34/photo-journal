// Base note content types
export interface TextNoteContent {
  text: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface ChecklistNoteContent {
  items: ChecklistItem[];
}

export interface ImageNoteContent {
  imageUrl?: string;
  alt?: string;
}

export interface VoiceNoteContent {
  audioUrl?: string;
  duration?: number;
}

export interface DrawingNoteContent {
  strokes: Array<{
    points: Array<{ x: number; y: number }>;
    color: string;
    width: number;
  }>;
}

// Union type for all note content types
export type NoteContent = 
  | TextNoteContent
  | ChecklistNoteContent
  | ImageNoteContent
  | VoiceNoteContent
  | DrawingNoteContent;

// Note kinds
export type NoteKind = 'text' | 'checklist' | 'image' | 'voice' | 'drawing';

// Full note data used by the board/shell system
export interface StickyNoteData {
  id: string;
  type: NoteKind;
  content: NoteContent;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
  createdAt: string;
  updatedAt: string;
}