/**
 * noteRegistry.ts
 * Simple lookup so StickyBoard can render a note body
 * without a big switch-statement.  Lazy-load heavy ones.
 */

import { lazy } from 'react';

import { TextNote }       from '@/components/noteTypes/TextNote';
import { ChecklistNote }  from '@/components/noteTypes/ChecklistNote';

// ⬇ lazy-loaded because they pull in heavier deps / media
const ImageNote  = lazy(() => import('@/components/noteTypes/ImageNote'));
const VoiceNote  = lazy(() => import('@/components/noteTypes/VoiceNote'));

export const noteRegistry = {
  text:       TextNote,
  checklist:  ChecklistNote,
  image:      ImageNote,
  voice:      VoiceNote,
} as const;

export type NoteKind = keyof typeof noteRegistry;
