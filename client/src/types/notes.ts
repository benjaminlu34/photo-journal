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
}

export interface DrawingStroke {
  points: Array<{ x: number; y: number; pressure: number }>;
  color: string;
  width: number;
}

export type NoteContent =
  | { type: 'text'; text: string }
  | { type: 'checklist'; items: ChecklistItem[] }
  | { type: 'image'; imageUrl?: string; alt?: string }
  | { type: 'voice'; audioUrl?: string; duration?: number }
  | { type: 'drawing'; strokes: DrawingStroke[] };

type ContentFor<T extends NoteContent['type']> = Extract<NoteContent, { type: T }>;

// Export individual content types for component props
export type TextNoteContent = { type: 'text'; text: string };
export type ChecklistNoteContent = { type: 'checklist'; items: ChecklistItem[] };
export type ImageNoteContent = { type: 'image'; imageUrl?: string; alt?: string };
export type VoiceNoteContent = { type: 'voice'; audioUrl?: string; duration?: number };
export type DrawingNoteContent = { type: 'drawing'; strokes: DrawingStroke[] };

export interface NoteData<T extends NoteContent['type'] = NoteContent['type']> {
  id: string;
  type: T;
  position: NotePosition;
  content: ContentFor<T>;
  createdAt: string;
  updatedAt: string;
}

export type NoteUpdate = Partial<Omit<NoteData, 'id' | 'type'>>;