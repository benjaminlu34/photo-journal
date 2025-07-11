import type { NoteData } from '../types/notes';

// Constants for cleanup thresholds
const MAX_NOTES = 1000;
const MAX_NOTE_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_DELETED_NOTE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Types for cleanup
interface CleanupStats {
  notesRemoved: number;
  assetsRemoved: number;
  bytesReclaimed: number;
}

interface CleanupOptions {
  maxNotes?: number;
  maxNoteAge?: number;
  maxDeletedNoteAge?: number;
}

export class CleanupManager {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private assetUrls: Set<string> = new Set();
  private deletedNotes: Map<string, number> = new Map(); // noteId -> deletion timestamp
  private readonly options: Required<CleanupOptions>;

  constructor(options: CleanupOptions = {}) {
    this.options = {
      maxNotes: options.maxNotes ?? MAX_NOTES,
      maxNoteAge: options.maxNoteAge ?? MAX_NOTE_AGE_MS,
      maxDeletedNoteAge: options.maxDeletedNoteAge ?? MAX_DELETED_NOTE_AGE_MS,
    };
  }

  // Start periodic cleanup
  public startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      void this.runCleanup();
    }, CLEANUP_INTERVAL_MS);
  }

  // Stop cleanup
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Track asset URL
  public trackAsset(url: string): void {
    this.assetUrls.add(url);
  }

  // Untrack asset URL
  public untrackAsset(url: string): void {
    this.assetUrls.delete(url);
  }

  // Track deleted note
  public trackDeletedNote(noteId: string): void {
    this.deletedNotes.set(noteId, Date.now());
  }

  // Clean up notes and assets
  public async runCleanup(): Promise<CleanupStats> {
    const stats: CleanupStats = {
      notesRemoved: 0,
      assetsRemoved: 0,
      bytesReclaimed: 0,
    };

    try {
      // Clean up old deleted notes
      const now = Date.now();
      for (const [noteId, deletionTime] of this.deletedNotes.entries()) {
        if (now - deletionTime > this.options.maxDeletedNoteAge) {
          this.deletedNotes.delete(noteId);
          stats.notesRemoved++;
        }
      }

      // Clean up unused assets
      const unusedAssets = new Set(this.assetUrls);
      for (const url of unusedAssets) {
        try {
          // Here you would typically delete the asset from your storage
          // For now, we just untrack it
          this.untrackAsset(url);
          stats.assetsRemoved++;
          stats.bytesReclaimed += 1000; // Placeholder value
        } catch (error) {
          console.error('Failed to clean up asset:', url, error);
        }
      }

      return stats;
    } catch (error) {
      console.error('Cleanup failed:', error);
      throw error;
    }
  }

  // Clean up specific notes
  public async cleanupNotes(notes: Record<string, NoteData>): Promise<CleanupStats> {
    const stats: CleanupStats = {
      notesRemoved: 0,
      assetsRemoved: 0,
      bytesReclaimed: 0,
    };

    try {
      const notesList = Object.values(notes);
      const now = Date.now();

      // Sort notes by last update time
      const sortedNotes = notesList.sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      // Remove old notes
      for (const note of sortedNotes) {
        const noteAge = now - new Date(note.updatedAt).getTime();
        
        if (noteAge > this.options.maxNoteAge) {
          // Here you would typically delete the note from your storage
          this.trackDeletedNote(note.id);
          stats.notesRemoved++;

          // Track assets for cleanup
          if (note.type === 'image' && note.content.type === 'image' && note.content.imageUrl) {
            this.trackAsset(note.content.imageUrl);
          } else if (note.type === 'voice' && note.content.type === 'voice' && note.content.audioUrl) {
            this.trackAsset(note.content.audioUrl);
          }
        }
      }

      // If we have too many notes, remove the oldest ones
      if (sortedNotes.length > this.options.maxNotes) {
        const notesToRemove = sortedNotes.slice(this.options.maxNotes);
        for (const note of notesToRemove) {
          this.trackDeletedNote(note.id);
          stats.notesRemoved++;
        }
      }

      return stats;
    } catch (error) {
      console.error('Note cleanup failed:', error);
      throw error;
    }
  }

  // Dispose of cleanup manager
  public dispose(): void {
    this.stopCleanup();
    this.assetUrls.clear();
    this.deletedNotes.clear();
  }
} 