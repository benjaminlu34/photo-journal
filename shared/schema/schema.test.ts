import { describe, it, expect } from 'vitest';
import { yjs_snapshots, stickyNoteContentSchema, contentSchema, contentBlockSchema } from './schema';
import { prepareSnapshotForStorage, compressBinary, decompressBinary } from '../../server/utils/binary-utils';

describe('Schema', () => {
  it('yjs_snapshots table should be defined', () => {
    expect(yjs_snapshots).toBeDefined();
  });

  it('yjs_snapshots table should have the correct columns', () => {
    const columnNames = Object.keys(yjs_snapshots);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('boardId');
    expect(columnNames).toContain('version');
    expect(columnNames).toContain('snapshot');
    expect(columnNames).toContain('createdAt');
    expect(columnNames).toContain('metadata');
  });
});

describe('Binary Utils', () => {
  it('should prepare snapshot for storage with Buffer type', () => {
    // Create sample binary data
    const originalData = new Uint8Array([1, 2, 3, 255, 0, 128]);
    
    // Prepare for storage
    const prepared = prepareSnapshotForStorage('test-board-id', 1, originalData);
    
    // Verify the data structure
    expect(prepared.boardId).toBe('test-board-id');
    expect(prepared.version).toBe(1);
    
    // With our custom bytea type, the snapshot is passed directly as Uint8Array
    expect(prepared.snapshot).toBe(originalData);
    expect(prepared.snapshot).toBeInstanceOf(Uint8Array);
    
    // Verify the binary data is preserved
    const snapshotArray = new Uint8Array(prepared.snapshot);
    expect(snapshotArray.length).toBe(originalData.length);
    for (let i = 0; i < originalData.length; i++) {
      expect(snapshotArray[i]).toBe(originalData[i]);
    }
  });
  
  it('should have placeholder compression functions', async () => {
    // Create sample binary data
    const originalData = new Uint8Array([1, 2, 3, 255, 0, 128]);
    
    // Test compression (currently a no-op)
    const compressed = await compressBinary(originalData);
    expect(compressed).toBe(originalData); // Same reference for now
    
    // Test decompression (currently a no-op)
    const decompressed = await decompressBinary(compressed);
    expect(decompressed).toBe(compressed); // Same reference for now
  });
}); 

describe('StickyNote Content Schema Validation', () => {
  describe('backgroundColor validation', () => {
    it('should accept valid HEX color formats', () => {
      const validColors = [
        '#FF0000', // Red
        '#00FF00', // Green
        '#0000FF', // Blue
        '#FFFFFF', // White
        '#000000', // Black
        '#A1B2C3', // Mixed case
        '#123456', // Numbers
        '#ABCDEF', // All letters
        '#abcdef', // Lowercase
      ];

      validColors.forEach(color => {
        const result = stickyNoteContentSchema.safeParse({
          type: 'sticky_note',
          text: 'Test note',
          backgroundColor: color
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.backgroundColor).toBe(color);
        }
      });
    });

    it('should reject invalid HEX color formats', () => {
      const invalidColors = [
        '#FF', // Too short
        '#FFFF', // Too short
        '#FFFFF', // Too short
        '#FFFFFFF', // Too long
        'FF0000', // Missing #
        '#GG0000', // Invalid character G
        '#FF00ZZ', // Invalid character Z
        '#FF 000', // Space in color
        '#FF-000', // Dash in color
        '', // Empty string
        '#', // Just hash
        'red', // Color name
        'rgb(255,0,0)', // RGB format
        'hsl(0,100%,50%)', // HSL format
      ];

      invalidColors.forEach(color => {
        const result = stickyNoteContentSchema.safeParse({
          type: 'sticky_note',
          text: 'Test note',
          backgroundColor: color
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some(issue => 
            issue.path.includes('backgroundColor')
          )).toBe(true);
        }
      });
    });

    it('should accept undefined backgroundColor (optional field)', () => {
      const result = stickyNoteContentSchema.safeParse({
        type: 'sticky_note',
        text: 'Test note'
        // backgroundColor is optional
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.backgroundColor).toBeUndefined();
      }
    });

    it('should prevent XSS through color value injection', () => {
      const xssAttempts = [
        'url(javascript:alert(1))',
        '#FF0000;background:url(javascript:alert(1))',
        'expression(alert(1))',
        '#FF0000 url(data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+)',
        'javascript:alert(1)',
        '#FF0000;background-image:url(javascript:alert(1))',
      ];

      xssAttempts.forEach(maliciousValue => {
        const result = stickyNoteContentSchema.safeParse({
          type: 'sticky_note',
          text: 'Test note',
          backgroundColor: maliciousValue
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some(issue => 
            issue.path.includes('backgroundColor') && 
            (issue.message.includes('Invalid HEX color format') || 
             issue.message.includes('Invalid color value detected'))
          )).toBe(true);
        }
      });
    });

    it('should enforce length limits', () => {
      const tooLongColor = '#' + 'A'.repeat(20); // Way too long
      const result = stickyNoteContentSchema.safeParse({
        type: 'sticky_note',
        text: 'Test note',
        backgroundColor: tooLongColor
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('backgroundColor') && 
          issue.message.includes('Color value too long')
        )).toBe(true);
      }
    });

    it('should validate complete sticky note content with backgroundColor', () => {
      const validStickyNote = {
        type: 'sticky_note' as const,
        text: 'This is a test note with color',
        backgroundColor: '#FF5733'
      };

      const result = stickyNoteContentSchema.safeParse(validStickyNote);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('sticky_note');
        expect(result.data.text).toBe('This is a test note with color');
        expect(result.data.backgroundColor).toBe('#FF5733');
      }
    });
  });

  describe('required fields validation', () => {
    it('should require type field', () => {
      const result = stickyNoteContentSchema.safeParse({
        text: 'Test note',
        backgroundColor: '#FF0000'
      });
      expect(result.success).toBe(false);
    });

    it('should require text field', () => {
      const result = stickyNoteContentSchema.safeParse({
        type: 'sticky_note',
        backgroundColor: '#FF0000'
      });
      expect(result.success).toBe(false);
    });

    it('should require correct type value', () => {
      const result = stickyNoteContentSchema.safeParse({
        type: 'photo', // Wrong type
        text: 'Test note',
        backgroundColor: '#FF0000'
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Content Schema Union Validation', () => {
  it('should validate sticky note content through union schema', () => {
    const stickyNoteData = {
      type: 'sticky_note' as const,
      text: 'Test note',
      backgroundColor: '#FF0000'
    };

    const result = contentSchema.safeParse(stickyNoteData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('sticky_note');
      if (result.data.type === 'sticky_note') {
        expect(result.data.backgroundColor).toBe('#FF0000');
      }
    }
  });

  it('should reject invalid backgroundColor in union schema', () => {
    const invalidStickyNoteData = {
      type: 'sticky_note' as const,
      text: 'Test note',
      backgroundColor: 'invalid-color'
    };

    const result = contentSchema.safeParse(invalidStickyNoteData);
    expect(result.success).toBe(false);
  });
});

describe('ContentBlock Schema Validation', () => {
  it('should validate complete content block with backgroundColor', () => {
    const contentBlockData = {
      entryId: '123e4567-e89b-12d3-a456-426614174000',
      type: 'sticky_note' as const,
      content: {
        type: 'sticky_note' as const,
        text: 'Test note with color',
        backgroundColor: '#FF5733'
      },
      position: {
        x: 100,
        y: 200,
        width: 300,
        height: 150,
        rotation: 0
      }
    };

    const result = contentBlockSchema.safeParse(contentBlockData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content.type).toBe('sticky_note');
      if (result.data.content.type === 'sticky_note') {
        expect(result.data.content.backgroundColor).toBe('#FF5733');
      }
    }
  });

  it('should reject content block with invalid backgroundColor', () => {
    const invalidContentBlockData = {
      entryId: '123e4567-e89b-12d3-a456-426614174000',
      type: 'sticky_note' as const,
      content: {
        type: 'sticky_note' as const,
        text: 'Test note',
        backgroundColor: 'invalid-color'
      },
      position: {
        x: 100,
        y: 200,
        width: 300,
        height: 150
      }
    };

    const result = contentBlockSchema.safeParse(invalidContentBlockData);
    expect(result.success).toBe(false);
  });
});