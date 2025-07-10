import type { ContentBlockData } from "@/types/journal";
import type { StickyNoteData } from "./blockToNote";

// Map note kind back to ContentBlockType
const kindToType = (kind: StickyNoteData['kind']): ContentBlockData['type'] => {
  switch (kind) {
    case 'text':
      return 'sticky_note'; // Default text notes to sticky_note
    case 'checklist':
      return 'checklist';
    case 'image':
      return 'photo';
    case 'voice':
      return 'audio';
    case 'drawing':
      return 'drawing';
    default:
      return 'sticky_note';
  }
};

// Convert StickyNoteData updates to ContentBlockData patch
export const noteToBlockPatch = (noteData: Partial<StickyNoteData>): Partial<ContentBlockData> => {
  const patch: Partial<ContentBlockData> = {};

  if (noteData.kind !== undefined) {
    patch.type = kindToType(noteData.kind);
  }

  if (noteData.content !== undefined) {
    patch.content = noteData.content;
  }

  if (noteData.position !== undefined) {
    patch.position = noteData.position;
  }

  return patch;
};

// Convert full StickyNoteData to ContentBlockData (for creation)
export const noteToBlock = (note: StickyNoteData): Omit<ContentBlockData, 'id' | 'createdAt' | 'updatedAt'> => {
  return {
    type: kindToType(note.kind),
    content: note.content,
    position: note.position,
  };
};