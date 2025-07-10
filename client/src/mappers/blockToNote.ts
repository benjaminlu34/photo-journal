import type { ContentBlockData } from "@/types/journal";

// Define the new note data structure for the shell system
export interface StickyNoteData {
  id: string;
  /** Type of note. Matches keys of noteRegistry */
  type: 'text' | 'checklist' | 'image' | 'voice' | 'drawing';
  content: any;
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

// Map ContentBlockType to note type
const blockTypeToNoteType = (
  type: ContentBlockData['type']
): StickyNoteData['type'] => {
  switch (type) {
    case 'text':
      return 'text';
    case 'checklist':
      return 'checklist';
    case 'photo':
      return 'image';
    case 'audio':
      return 'voice';
    case 'drawing':
      return 'drawing';
    case 'sticky_note':
      return 'text';
    default:
      return 'text';
  }
};

// Convert ContentBlockData to StickyNoteData
export const blockToNote = (block: ContentBlockData): StickyNoteData => {
  return {
    id: block.id,
    type: blockTypeToNoteType(block.type),
    content: block.content,
    position: block.position,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
  };
};

// Convert array of blocks to notes
export const blocksToNotes = (blocks: ContentBlockData[]): StickyNoteData[] => {
  return blocks.map(blockToNote);
};