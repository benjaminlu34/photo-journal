import { describe, it, expect } from 'vitest';
import { stickyNoteContentSchema } from '../../shared/schema/schema';

describe('Color Migration Logic', () => {
  it('should validate that default backgroundColor can be added to existing notes', () => {
    // Simulate existing note content without backgroundColor
    const existingNoteContent = {
      type: 'sticky_note' as const,
      text: 'Existing note without color'
    };

    // Simulate migration: add default backgroundColor with proper HEX format
    const migratedContent = {
      ...existingNoteContent,
      backgroundColor: '#F4F7FF' // Default theme color in HEX format
    };

    // Validate that the migrated content passes schema validation
    const result = stickyNoteContentSchema.safeParse(migratedContent);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.backgroundColor).toBe('#F4F7FF');
    }
  });

  it('should validate that proper HEX default color works for migration', () => {
    // Simulate existing note content without backgroundColor
    const existingNoteContent = {
      type: 'sticky_note' as const,
      text: 'Existing note without color'
    };

    // Simulate migration: add proper HEX default backgroundColor
    const migratedContent = {
      ...existingNoteContent,
      backgroundColor: '#F4F7FF' // Proper HEX format
    };

    // Validate that the migrated content passes schema validation
    const result = stickyNoteContentSchema.safeParse(migratedContent);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.backgroundColor).toBe('#F4F7FF');
    }
  });

  it('should handle notes that already have backgroundColor', () => {
    // Simulate note that already has a color
    const existingColoredNote = {
      type: 'sticky_note' as const,
      text: 'Note with existing color',
      backgroundColor: '#FF5733'
    };

    // Migration should not affect notes that already have colors
    const result = stickyNoteContentSchema.safeParse(existingColoredNote);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.backgroundColor).toBe('#FF5733');
    }
  });

  it('should validate migration SQL logic conceptually', () => {
    // Test the conceptual migration logic
    const testNotes = [
      {
        id: '1',
        content: { type: 'sticky_note', text: 'Note 1' }, // No backgroundColor
        shouldBeMigrated: true
      },
      {
        id: '2', 
        content: { type: 'sticky_note', text: 'Note 2', backgroundColor: '#FF5733' }, // Has backgroundColor
        shouldBeMigrated: false
      },
      {
        id: '3',
        content: { type: 'photo', url: 'test.jpg' }, // Not a sticky note
        shouldBeMigrated: false
      }
    ];

    const notesToMigrate = testNotes.filter(note => 
      note.content.type === 'sticky_note' && 
      !('backgroundColor' in note.content)
    );

    expect(notesToMigrate).toHaveLength(1);
    expect(notesToMigrate[0].id).toBe('1');
    expect(notesToMigrate[0].shouldBeMigrated).toBe(true);
  });

  it('should validate that migration preserves existing note data', () => {
    const originalNote = {
      type: 'sticky_note' as const,
      text: 'Important note content'
    };

    // Simulate adding backgroundColor during migration
    const migratedNote = {
      ...originalNote,
      backgroundColor: '#F4F7FF'
    };

    // Ensure original data is preserved
    expect(migratedNote.type).toBe(originalNote.type);
    expect(migratedNote.text).toBe(originalNote.text);
    expect(migratedNote.backgroundColor).toBe('#F4F7FF');

    // Validate schema compliance
    const result = stickyNoteContentSchema.safeParse(migratedNote);
    expect(result.success).toBe(true);
  });
});