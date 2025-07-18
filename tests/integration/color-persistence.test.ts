import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../server/db';
import { storage } from '../../server/storage';
import { contentBlocks, journalEntries } from '../../shared/schema/schema';
import { eq } from 'drizzle-orm';

describe('Color Persistence Integration Tests', () => {
  const testUserId = 'test-user-color-persistence';
  const testDate = new Date('2024-01-15');
  let testEntryId: string;

  beforeEach(async () => {
    // Clean up any existing test data
    await db.delete(contentBlocks).where(eq(contentBlocks.entryId, testEntryId));
    await db.delete(journalEntries).where(eq(journalEntries.userId, testUserId));

    // Create a test journal entry
    const entry = await storage.createJournalEntry({
      userId: testUserId,
      date: testDate,
      title: 'Test Entry for Color Persistence'
    });
    testEntryId = entry.id;
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(contentBlocks).where(eq(contentBlocks.entryId, testEntryId));
    await db.delete(journalEntries).where(eq(journalEntries.id, testEntryId));
  });

  it('should persist backgroundColor in database when creating a new sticky note', async () => {
    const testColor = '#FF5733';
    
    // Create a sticky note with backgroundColor
    const contentBlock = await storage.createContentBlock({
      entryId: testEntryId,
      type: 'sticky_note',
      content: {
        type: 'sticky_note',
        text: 'Test note with color',
        backgroundColor: testColor
      },
      position: {
        x: 100,
        y: 200,
        width: 300,
        height: 150,
        rotation: 0
      }
    });

    // Verify the block was created with the correct color
    expect(contentBlock.content).toMatchObject({
      type: 'sticky_note',
      text: 'Test note with color',
      backgroundColor: testColor
    });

    // Fetch the block from database to verify persistence
    const retrievedBlock = await storage.getContentBlock(contentBlock.id);
    expect(retrievedBlock).toBeDefined();
    expect(retrievedBlock!.content).toMatchObject({
      type: 'sticky_note',
      text: 'Test note with color',
      backgroundColor: testColor
    });
  });

  it('should persist backgroundColor updates when updating existing sticky note', async () => {
    const initialColor = '#FF5733';
    const updatedColor = '#33FF57';
    
    // Create a sticky note with initial color
    const contentBlock = await storage.createContentBlock({
      entryId: testEntryId,
      type: 'sticky_note',
      content: {
        type: 'sticky_note',
        text: 'Test note',
        backgroundColor: initialColor
      },
      position: {
        x: 100,
        y: 200,
        width: 300,
        height: 150,
        rotation: 0
      }
    });

    // Update the color
    const updatedBlock = await storage.updateContentBlock(contentBlock.id, {
      content: {
        type: 'sticky_note',
        text: 'Test note',
        backgroundColor: updatedColor
      }
    });

    // Verify the update
    expect(updatedBlock.content).toMatchObject({
      type: 'sticky_note',
      text: 'Test note',
      backgroundColor: updatedColor
    });

    // Fetch from database to verify persistence
    const retrievedBlock = await storage.getContentBlock(contentBlock.id);
    expect(retrievedBlock!.content).toMatchObject({
      type: 'sticky_note',
      text: 'Test note',
      backgroundColor: updatedColor
    });
  });

  it('should handle sticky notes without backgroundColor (legacy notes)', async () => {
    // Create a sticky note without backgroundColor (simulating legacy data)
    const contentBlock = await storage.createContentBlock({
      entryId: testEntryId,
      type: 'sticky_note',
      content: {
        type: 'sticky_note',
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
    });

    // Verify the block was created successfully
    expect(contentBlock.content).toMatchObject({
      type: 'sticky_note',
      text: 'Legacy note without color'
    });
    expect(contentBlock.content).not.toHaveProperty('backgroundColor');

    // Fetch from database to verify
    const retrievedBlock = await storage.getContentBlock(contentBlock.id);
    expect(retrievedBlock!.content).toMatchObject({
      type: 'sticky_note',
      text: 'Legacy note without color'
    });
    expect(retrievedBlock!.content).not.toHaveProperty('backgroundColor');
  });

  it('should include backgroundColor in journal entry queries', async () => {
    const testColor = '#3357FF';
    
    // Create multiple sticky notes with different colors
    await storage.createContentBlock({
      entryId: testEntryId,
      type: 'sticky_note',
      content: {
        type: 'sticky_note',
        text: 'Blue note',
        backgroundColor: testColor
      },
      position: { x: 100, y: 100, width: 200, height: 100, rotation: 0 }
    });

    await storage.createContentBlock({
      entryId: testEntryId,
      type: 'sticky_note',
      content: {
        type: 'sticky_note',
        text: 'Default note'
        // No backgroundColor
      },
      position: { x: 300, y: 100, width: 200, height: 100, rotation: 0 }
    });

    // Fetch all content blocks for the entry
    const blocks = await storage.getContentBlocks(testEntryId);
    
    expect(blocks).toHaveLength(2);
    
    // Find the colored note
    const coloredNote = blocks.find(block => {
      const content = block.content as any;
      return content.type === 'sticky_note' && 
             'backgroundColor' in content && 
             content.backgroundColor === testColor;
    });
    
    expect(coloredNote).toBeDefined();
    expect(coloredNote!.content).toMatchObject({
      type: 'sticky_note',
      text: 'Blue note',
      backgroundColor: testColor
    });

    // Find the default note
    const defaultNote = blocks.find(block => {
      const content = block.content as any;
      return content.type === 'sticky_note' && 
             !('backgroundColor' in content);
    });
    
    expect(defaultNote).toBeDefined();
    expect(defaultNote!.content).toMatchObject({
      type: 'sticky_note',
      text: 'Default note'
    });
  });

  it('should validate HEX color format and reject invalid colors', async () => {
    const invalidColors = [
      'invalid-color',
      '#GG5733', // Invalid hex characters
      '#FF573', // Too short
      '#FF57333', // Too long
      'rgb(255, 87, 51)', // Not HEX format
      'url(javascript:alert(1))', // XSS attempt
      'expression(alert(1))' // XSS attempt
    ];

    for (const invalidColor of invalidColors) {
      await expect(
        storage.createContentBlock({
          entryId: testEntryId,
          type: 'sticky_note',
          content: {
            type: 'sticky_note',
            text: 'Test note',
            backgroundColor: invalidColor
          },
          position: { x: 100, y: 100, width: 200, height: 100, rotation: 0 }
        })
      ).rejects.toThrow();
    }
  });

  it('should accept valid HEX color formats', async () => {
    const validColors = [
      '#FF5733',
      '#ff5733', // Lowercase
      '#000000', // Black
      '#FFFFFF', // White
      '#A1B2C3' // Mixed case
    ];

    for (const validColor of validColors) {
      const block = await storage.createContentBlock({
        entryId: testEntryId,
        type: 'sticky_note',
        content: {
          type: 'sticky_note',
          text: `Test note with ${validColor}`,
          backgroundColor: validColor
        },
        position: { x: 100, y: 100, width: 200, height: 100, rotation: 0 }
      });

      expect(block.content).toMatchObject({
        type: 'sticky_note',
        backgroundColor: validColor
      });

      // Clean up for next iteration
      await storage.deleteContentBlock(block.id);
    }
  });

  it('should maintain color data across simulated browser sessions', async () => {
    const testColor = '#FF5733';
    
    // Simulate first browser session - create note with color
    const contentBlock = await storage.createContentBlock({
      entryId: testEntryId,
      type: 'sticky_note',
      content: {
        type: 'sticky_note',
        text: 'Persistent color note',
        backgroundColor: testColor
      },
      position: { x: 100, y: 100, width: 200, height: 100, rotation: 0 }
    });

    const blockId = contentBlock.id;

    // Simulate second browser session - fetch journal entry
    const journalEntry = await storage.getJournalEntry(testUserId, testDate);
    expect(journalEntry).toBeDefined();

    const blocks = await storage.getContentBlocks(journalEntry!.id);
    const persistedBlock = blocks.find(block => block.id === blockId);
    
    expect(persistedBlock).toBeDefined();
    expect(persistedBlock!.content).toMatchObject({
      type: 'sticky_note',
      text: 'Persistent color note',
      backgroundColor: testColor
    });
  });
});