/**
 * noteRegistry.tsx
 * Simple lookup so StickyBoard can render a note body
 * without a big switch-statement. Lazy-load heavy ones.
 */

import React from "react";

// Import note components directly (no lazy loading for now to avoid issues)
import TextNote from "@/components/noteTypes/TextNote/TextNote";
import ChecklistNote from "@/components/noteTypes/ChecklistNote/ChecklistNote";
import ImageNote from "@/components/noteTypes/ImageNote/ImageNote";

export const noteRegistry: Record<string, React.ComponentType<any>> = {
  sticky_note: TextNote,
  checklist: ChecklistNote,
  image: ImageNote,
};

export type NoteKind = keyof typeof noteRegistry;