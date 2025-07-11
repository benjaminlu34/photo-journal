/**
 * noteRegistry.tsx
 * Simple lookup so StickyBoard can render a note body
 * without a big switch-statement. Lazy-load heavy ones.
 */

import React from "react";

// Import note components directly (no lazy loading for now to avoid issues)
import TextNote from "@/components/noteTypes/TextNote";
import ChecklistNote from "@/components/noteTypes/ChecklistNote";
import ImageNote from "@/components/noteTypes/ImageNote";
import VoiceNote from "@/components/noteTypes/VoiceNote";
import DrawingNote from "@/components/noteTypes/DrawingNote";

export const noteRegistry: Record<string, React.ComponentType<any>> = {
  text: TextNote,
  sticky_note: TextNote,
  checklist: ChecklistNote,
  image: ImageNote,
  voice: VoiceNote,
  drawing: DrawingNote,
};

export type NoteKind = keyof typeof noteRegistry;