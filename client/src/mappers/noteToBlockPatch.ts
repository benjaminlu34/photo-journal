import { StickyNoteData } from "@/types/notes";
import { ContentBlockData, Position } from "@/types/journal";

/**
 * Converts a StickyNote update back to a ContentBlock patch
 * for legacy system compatibility during dual-write phase.
 */
export const noteToBlockPatch = (
  note: StickyNoteData,
  existingBlock?: ContentBlockData
): Partial<ContentBlockData> => {
  const position: Position = {
    x: note.position.x,
    y: note.position.y,
    width: note.position.width,
    height: note.position.height,
    rotation: note.position.rotation,
  };

  const patch: Partial<ContentBlockData> = {
    position,
    content: note.content,
    updatedAt: new Date().toISOString(),
  };

  // Only update type if creating new block or if type changed
  if (!existingBlock || existingBlock.type !== mapNoteTypeToBlockType(note.type)) {
    patch.type = mapNoteTypeToBlockType(note.type);
  }

  return patch;
};

/**
 * Converts a complete StickyNote to a ContentBlock
 * for creating new legacy blocks from notes.
 */
export const noteToBlock = (
  note: StickyNoteData,
  entryId: string
): Omit<ContentBlockData, 'id' | 'createdAt' | 'updatedAt'> => {
  return {
    type: mapNoteTypeToBlockType(note.type),
    content: note.content,
    position: {
      x: note.position.x,
      y: note.position.y,
      width: note.position.width,
      height: note.position.height,
      rotation: note.position.rotation,
    },
  };
};

/**
 * Maps note types to legacy content block types
 */
function mapNoteTypeToBlockType(noteType: string): string {
  const typeMap: Record<string, string> = {
    text: "text",
    checklist: "checklist",
    image: "photo",
    voice: "audio",
    drawing: "drawing",
  };

  return typeMap[noteType] || "sticky_note";
}