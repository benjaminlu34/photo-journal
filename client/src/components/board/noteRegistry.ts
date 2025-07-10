/**
 * noteRegistry.ts
 * Simple lookup so StickyBoard can render a note body
 * without a big switch-statement. Lazy-load heavy ones.
 */

import { lazy } from 'react';
import type { ContentBlockType } from '@/types/journal';

// Import lightweight components directly
import { TextNote } from '@/components/noteTypes/TextNote';
import { ChecklistNote } from '@/components/noteTypes/ChecklistNote';

// Lazy-loaded because they pull in heavier deps / media
const ImageNote = lazy(() => import('@/components/noteTypes/ImageNote'));
const VoiceNote = lazy(() => import('@/components/noteTypes/VoiceNote'));
const DrawingNote = lazy(() => import('@/components/noteTypes/DrawingNote'));

export const noteRegistry = {
  text: TextNote,
  sticky_note: TextNote, // alias for compatibility
  checklist: ChecklistNote,
  photo: ImageNote,
  audio: VoiceNote,
  drawing: DrawingNote,
} as const;

export type NoteKind = keyof typeof noteRegistry;

// Map our content block types to note kinds
export const contentTypeToNoteKind = (type: ContentBlockType): NoteKind => {
  switch (type) {
    case 'sticky_note':
    case 'text':
      return 'text';
    case 'checklist':
      return 'checklist';
    case 'photo':
      return 'photo';
    case 'audio':
      return 'audio';
    case 'drawing':
      return 'drawing';
    default:
      return 'text';
  }
};