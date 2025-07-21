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
  | { type: 'sticky_note'; text: string; backgroundColor?: string }
  | { type: 'checklist'; items: ChecklistItem[] }
  | { type: 'image'; imageUrl?: string; alt?: string }
  | { type: 'voice'; audioUrl?: string; duration?: number }
  | { type: 'drawing'; strokes: DrawingStroke[] };

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