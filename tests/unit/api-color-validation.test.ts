import { describe, it, expect } from 'vitest';
import { contentBlockSchema } from '../../shared/schema/schema';

describe('API Color Validation', () => {
  it('should validate content block creation with backgroundColor', () => {
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

    // This simulates the validation that happens in POST /api/content-blocks
    const result = contentBlockSchema.safeParse(contentBlockData);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toMatchObject({
        type: 'sticky_note',
        text: 'Test note with color',
        backgroundColor: '#FF5733'
      });
    }
  });

  it('should reject content block creation with invalid backgroundColor', () => {
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
        height: 150,
        rotation: 0
      }
    };

    // This simulates the validation that happens in POST /api/content-blocks
    const result = contentBlockSchema.safeParse(invalidContentBlockData);
    
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('backgroundColor');
  });

  it('should validate content block update with backgroundColor', () => {
    const updateData = {
      content: {
        type: 'sticky_note' as const,
        text: 'Updated note text',
        backgroundColor: '#33FF57'
      },
      position: {
        x: 150,
        y: 250,
        width: 350,
        height: 200,
        rotation: 15
      }
    };

    // This simulates the validation that happens in PATCH /api/content-blocks/:blockId
    const updateSchema = contentBlockSchema.partial().omit({ entryId: true });
    const result = updateSchema.safeParse(updateData);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toMatchObject({
        type: 'sticky_note',
        text: 'Updated note text',
        backgroundColor: '#33FF57'
      });
    }
  });

  it('should allow content block creation without backgroundColor (backward compatibility)', () => {
    const contentBlockData = {
      entryId: '123e4567-e89b-12d3-a456-426614174000',
      type: 'sticky_note' as const,
      content: {
        type: 'sticky_note' as const,
        text: 'Legacy note without color'
        // No backgroundColor field
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
      expect(result.data.content).toMatchObject({
        type: 'sticky_note',
        text: 'Legacy note without color'
      });
      expect(result.data.content).not.toHaveProperty('backgroundColor');
    }
  });

  it('should prevent XSS attacks through backgroundColor field', () => {
    const maliciousColors = [
      'url(javascript:alert(1))',
      'expression(alert(1))',
      'url("javascript:alert(1)")',
      '#FF5733; background-image: url(javascript:alert(1))'
    ];

    maliciousColors.forEach(maliciousColor => {
      const contentBlockData = {
        entryId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'sticky_note' as const,
        content: {
          type: 'sticky_note' as const,
          text: 'Test note',
          backgroundColor: maliciousColor
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
      
      expect(result.success).toBe(false);
      expect(result.error?.issues.some(issue => 
        issue.message.includes('Invalid color value detected') ||
        issue.message.includes('Invalid HEX color format')
      )).toBe(true);
    });
  });

  it('should enforce length limits on backgroundColor', () => {
    const tooLongColor = '#FF5733EXTRA'; // 8+ characters

    const contentBlockData = {
      entryId: '123e4567-e89b-12d3-a456-426614174000',
      type: 'sticky_note' as const,
      content: {
        type: 'sticky_note' as const,
        text: 'Test note',
        backgroundColor: tooLongColor
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
    
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('Invalid HEX color format');
  });
});