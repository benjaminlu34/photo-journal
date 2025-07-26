import { describe, it, expect } from 'vitest';
import {
  createChecklistItem,
  updateChecklistItem,
  sortChecklistItems,
  reorderChecklistItems,
  validateChecklistItem,
  migrateChecklistItem,
  getChecklistStats,
  getDefaultChecklistSettings,
} from '../checklist-utils';
import type { ChecklistItem } from '@/types/checklist';

describe('checklist-utils', () => {
  describe('createChecklistItem', () => {
    it('creates a new checklist item with proper defaults', () => {
      const item = createChecklistItem('Test item', 0);
      
      expect(item.id).toBeDefined();
      expect(item.text).toBe('Test item');
      expect(item.completed).toBe(false);
      expect(item.order).toBe(0);
      expect(item.createdAt).toBeDefined();
      expect(item.updatedAt).toBeDefined();
      expect(typeof item.createdAt).toBe('string');
      expect(typeof item.updatedAt).toBe('string');
    });

    it('sanitizes HTML in text', () => {
      const item = createChecklistItem('<script>alert("xss")</script>Test', 0);
      expect(item.text).toBe('Test');
    });
  });

  describe('updateChecklistItem', () => {
    it('updates item with new timestamp', () => {
      const originalItem: ChecklistItem = {
        id: '1',
        text: 'Original',
        completed: false,
        order: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const updatedItem = updateChecklistItem(originalItem, { text: 'Updated' });
      
      expect(updatedItem.text).toBe('Updated');
      expect(updatedItem.updatedAt).not.toBe('2024-01-01T00:00:00.000Z');
      expect(updatedItem.createdAt).toBe('2024-01-01T00:00:00.000Z'); // Should not change
    });
  });

  describe('sortChecklistItems', () => {
    const items: ChecklistItem[] = [
      {
        id: '1',
        text: 'B item',
        completed: false,
        order: 2,
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
      {
        id: '2',
        text: 'A item',
        completed: false,
        order: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ];

    it('sorts by order', () => {
      const sorted = sortChecklistItems(items, 'order');
      expect(sorted[0].order).toBe(1);
      expect(sorted[1].order).toBe(2);
    });

    it('sorts by created date', () => {
      const sorted = sortChecklistItems(items, 'created');
      expect(sorted[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(sorted[1].createdAt).toBe('2024-01-02T00:00:00.000Z');
    });

    it('sorts alphabetically', () => {
      const sorted = sortChecklistItems(items, 'alphabetical');
      expect(sorted[0].text).toBe('A item');
      expect(sorted[1].text).toBe('B item');
    });
  });

  describe('reorderChecklistItems', () => {
    it('reorders items and updates order values', () => {
      const items: ChecklistItem[] = [
        { id: '1', text: 'First', completed: false, order: 0, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
        { id: '2', text: 'Second', completed: false, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
        { id: '3', text: 'Third', completed: false, order: 2, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
      ];

      const reordered = reorderChecklistItems(items, 0, 2); // Move first item to third position
      
      expect(reordered[0].text).toBe('Second');
      expect(reordered[0].order).toBe(0);
      expect(reordered[1].text).toBe('Third');
      expect(reordered[1].order).toBe(1);
      expect(reordered[2].text).toBe('First');
      expect(reordered[2].order).toBe(2);
    });
  });

  describe('validateChecklistItem', () => {
    it('validates valid item', () => {
      const result = validateChecklistItem({
        text: 'Valid item',
        order: 0,
      });
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects empty text', () => {
      const result = validateChecklistItem({
        text: '',
        order: 0,
      });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Item text cannot be empty');
    });

    it('rejects text that is too long', () => {
      const result = validateChecklistItem({
        text: 'a'.repeat(501),
        order: 0,
      });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Item text cannot exceed 500 characters');
    });

    it('rejects negative order', () => {
      const result = validateChecklistItem({
        text: 'Valid text',
        order: -1,
      });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Order must be a non-negative integer');
    });
  });

  describe('migrateChecklistItem', () => {
    it('migrates legacy item with missing fields', () => {
      const legacyItem = {
        id: '1',
        text: 'Legacy item',
        completed: true,
      };

      const migrated = migrateChecklistItem(legacyItem, 0);
      
      expect(migrated.id).toBe('1');
      expect(migrated.text).toBe('Legacy item');
      expect(migrated.completed).toBe(true);
      expect(migrated.order).toBe(0);
      expect(migrated.createdAt).toBeDefined();
      expect(migrated.updatedAt).toBeDefined();
    });

    it('preserves existing fields', () => {
      const existingItem = {
        id: '1',
        text: 'Existing item',
        completed: false,
        order: 5,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const migrated = migrateChecklistItem(existingItem, 0);
      
      expect(migrated.order).toBe(5); // Should preserve existing order
      expect(migrated.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(migrated.updatedAt).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('getChecklistStats', () => {
    it('calculates stats correctly', () => {
      const items: ChecklistItem[] = [
        { id: '1', text: 'Item 1', completed: true, order: 0, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
        { id: '2', text: 'Item 2', completed: false, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
        { id: '3', text: 'Item 3', completed: true, order: 2, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
      ];

      const stats = getChecklistStats(items);
      
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(2);
      expect(stats.remaining).toBe(1);
      expect(stats.completionPercentage).toBe(67);
    });

    it('handles empty list', () => {
      const stats = getChecklistStats([]);
      
      expect(stats.total).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.remaining).toBe(0);
      expect(stats.completionPercentage).toBe(0);
    });
  });

  describe('getDefaultChecklistSettings', () => {
    it('returns default settings', () => {
      const settings = getDefaultChecklistSettings();
      
      expect(settings.allowReordering).toBe(true);
      expect(settings.showCompletedItems).toBe(true);
      expect(settings.sortBy).toBe('order');
    });
  });
});