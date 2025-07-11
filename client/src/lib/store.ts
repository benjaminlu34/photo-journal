import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { NoteData, NoteUpdate, NoteContent } from '../types/notes';
import { security } from './security';
import { CleanupManager } from './cleanup';

interface BoardState {
  notes: Record<string, NoteData>;
  selectedId: string | null;
  gridSnapEnabled: boolean;
  userId: string | null;
}

interface BoardActions {
  /**
   * Add a new note to the board (called by Yjs observer)
   * @param note The complete note data
   */
  addNote: (note: NoteData) => void;

  /**
   * Update an existing note (called by Yjs observer)
   * @param id The ID of the note to update
   * @param updates Partial updates to apply. When updating content, you MUST include
   * the content type field, e.g.:
   * ```ts
   * // ✅ Correct - includes type
   * updateNote(id, { content: { type: 'text', text: 'new text' } })
   * 
   * // ❌ Wrong - missing type
   * updateNote(id, { content: { text: 'new text' } })
   * ```
   * Use the `updateNoteContent` helper for type-safe content updates.
   */
  updateNote: (id: string, updates: Partial<NoteData>) => void;

  /**
   * Delete a note from the board (called by Yjs observer)
   * @param id The ID of the note to delete
   */
  deleteNote: (id: string) => void;

  /**
   * Batch update multiple notes (called by Yjs observer)
   * @param updates Array of [id, updates] pairs
   */
  batchUpdateNotes: (updates: Array<[string, Partial<NoteData>]>) => void;

  setSelectedId: (id: string | null) => void;
  setGridSnapEnabled: (enabled: boolean) => void;
  setUserId: (id: string | null) => void;
}

// Create cleanup manager
const cleanupManager = new CleanupManager();

// Start periodic cleanup
cleanupManager.startCleanup();

/**
 * Helper function to create type-safe content updates
 * @param content The new content with type
 * @returns A partial note update
 * 
 * @example
 * ```ts
 * // Update text content
 * updateNote(id, updateNoteContent({ type: 'text', text: 'new text' }))
 * 
 * // Update checklist
 * updateNote(id, updateNoteContent({ type: 'checklist', items: [...] }))
 * ```
 */
export const updateNoteContent = <T extends NoteContent>(content: T): { content: T } => {
  return { content } as const;
};

export const useBoardStore = create<BoardState & BoardActions>()(
  subscribeWithSelector(
    devtools(
      immer((set, get) => ({
        // State
        notes: {},
        selectedId: null,
        gridSnapEnabled: true,
        userId: null,

        // Actions
        setUserId: (id: string | null) =>
          set((state) => {
            state.userId = id;
          }),

        addNote: (note: NoteData) =>
          set((state) => {
            try {
              // Validate note data
              const validatedNote = security.validateNote(note);
              
              // Check rate limit
              if (state.userId && !security.checkRateLimit(state.userId)) {
                throw new Error('Rate limit exceeded');
              }

              state.notes[validatedNote.id] = validatedNote;

              // Track assets for cleanup
              if (validatedNote.content.type === 'image' && validatedNote.content.imageUrl) {
                cleanupManager.trackAsset(validatedNote.content.imageUrl);
              } else if (validatedNote.content.type === 'voice' && validatedNote.content.audioUrl) {
                cleanupManager.trackAsset(validatedNote.content.audioUrl);
              }

              // Run cleanup if we have too many notes
              void cleanupManager.cleanupNotes(state.notes);
            } catch (error) {
              console.error('Failed to add note:', error);
            }
          }),

        updateNote: (id: string, updates: Partial<NoteData>) =>
          set((state) => {
            try {
              if (!state.notes[id]) return;

              // Check rate limit
              if (state.userId && !security.checkRateLimit(state.userId)) {
                throw new Error('Rate limit exceeded');
              }

              // Validate updates
              const validatedUpdates: Partial<NoteData> = {};

              if (updates.position) {
                validatedUpdates.position = security.validatePosition(updates.position);
              }

              if (updates.content) {
                validatedUpdates.content = security.validateContent(updates.content);

                // Track new assets and untrack old ones
                const oldContent = state.notes[id].content;
                const newContent = validatedUpdates.content;

                if (oldContent.type === 'image' && newContent.type === 'image') {
                  if (oldContent.imageUrl && oldContent.imageUrl !== newContent.imageUrl) {
                    cleanupManager.untrackAsset(oldContent.imageUrl);
                  }
                  if (newContent.imageUrl) {
                    cleanupManager.trackAsset(newContent.imageUrl);
                  }
                } else if (oldContent.type === 'voice' && newContent.type === 'voice') {
                  if (oldContent.audioUrl && oldContent.audioUrl !== newContent.audioUrl) {
                    cleanupManager.untrackAsset(oldContent.audioUrl);
                  }
                  if (newContent.audioUrl) {
                    cleanupManager.trackAsset(newContent.audioUrl);
                  }
                }
              }

              // Apply update immediately to local state
              Object.assign(state.notes[id], validatedUpdates);
            } catch (error) {
              console.error('Failed to update note:', error);
            }
          }),

        deleteNote: (id: string) =>
          set((state) => {
            try {
              // Check rate limit
              if (state.userId && !security.checkRateLimit(state.userId)) {
                throw new Error('Rate limit exceeded');
              }

              const note = state.notes[id];
              if (note) {
                // Track assets for cleanup
                const content = note.content;
                if (content.type === 'image' && content.imageUrl) {
                  cleanupManager.untrackAsset(content.imageUrl);
                } else if (content.type === 'voice' && content.audioUrl) {
                  cleanupManager.untrackAsset(content.audioUrl);
                }

                // Track deleted note
                cleanupManager.trackDeletedNote(id);
              }

              delete state.notes[id];
              if (state.selectedId === id) {
                state.selectedId = null;
              }
            } catch (error) {
              console.error('Failed to delete note:', error);
            }
          }),

        setSelectedId: (id: string | null) =>
          set((state) => {
            state.selectedId = id;
          }),

        setGridSnapEnabled: (enabled: boolean) =>
          set((state) => {
            state.gridSnapEnabled = enabled;
          }),

        batchUpdateNotes: (updates: Array<[string, Partial<NoteData>]>) =>
          set((state) => {
            try {
              updates.forEach(([id, update]) => {
                if (state.notes[id]) {
                  // Validate updates
                  const validatedUpdate: Partial<NoteData> = {};

                  if (update.position) {
                    validatedUpdate.position = security.validatePosition(update.position);
                  }

                  if (update.content) {
                    validatedUpdate.content = security.validateContent(update.content);

                    // Track new assets and untrack old ones
                    const oldContent = state.notes[id].content;
                    const newContent = validatedUpdate.content;

                    if (oldContent.type === 'image' && newContent.type === 'image') {
                      if (oldContent.imageUrl && oldContent.imageUrl !== newContent.imageUrl) {
                        cleanupManager.untrackAsset(oldContent.imageUrl);
                      }
                      if (newContent.imageUrl) {
                        cleanupManager.trackAsset(newContent.imageUrl);
                      }
                    } else if (oldContent.type === 'voice' && newContent.type === 'voice') {
                      if (oldContent.audioUrl && oldContent.audioUrl !== newContent.audioUrl) {
                        cleanupManager.untrackAsset(oldContent.audioUrl);
                      }
                      if (newContent.audioUrl) {
                        cleanupManager.trackAsset(newContent.audioUrl);
                      }
                    }
                  }

                  // Apply update to local state
                  Object.assign(state.notes[id], validatedUpdate);
                }
              });
            } catch (error) {
              console.error('Failed to batch update notes:', error);
            }
          }),
      }))
    )
  )
);

// Cleanup on window unload
if (typeof window !== 'undefined') {
  window.addEventListener('unload', () => {
    cleanupManager.dispose();
  });
} 