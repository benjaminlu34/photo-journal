// Utility functions for checklist management and validation

import type { ChecklistItem, ChecklistSettings, ChecklistValidationResult } from '@/types/checklist';
import { security } from '@/lib/security';

/**
 * Generates a new checklist item with proper defaults
 */
export function createChecklistItem(
  text: string, 
  order: number = 0,
  completed: boolean = false
): ChecklistItem {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    text: security.sanitizeHtml(text.trim()),
    completed,
    order,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Updates a checklist item with new values and current timestamp
 */
export function updateChecklistItem(
  item: ChecklistItem, 
  updates: Partial<Omit<ChecklistItem, 'id' | 'createdAt'>>
): ChecklistItem {
  return {
    ...item,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sorts checklist items based on the specified sort method
 */
export function sortChecklistItems(
  items: ChecklistItem[], 
  sortBy: ChecklistSettings['sortBy'] = 'order'
): ChecklistItem[] {
  switch (sortBy) {
    case 'order':
      return [...items].sort((a, b) => a.order - b.order);
    case 'created':
      return [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case 'alphabetical':
      return [...items].sort((a, b) => a.text.localeCompare(b.text));
    default:
      return items;
  }
}

/**
 * Reorders checklist items and updates their order values
 */
export function reorderChecklistItems(
  items: ChecklistItem[], 
  fromIndex: number, 
  toIndex: number
): ChecklistItem[] {
  const reorderedItems = [...items];
  const [movedItem] = reorderedItems.splice(fromIndex, 1);
  reorderedItems.splice(toIndex, 0, movedItem);
  
  // Update order values to match new positions
  return reorderedItems.map((item, index) => ({
    ...item,
    order: index,
    updatedAt: new Date().toISOString(),
  }));
}

/**
 * Validates checklist item data
 */
export function validateChecklistItem(item: Partial<ChecklistItem>): ChecklistValidationResult {
  const errors: string[] = [];
  
  if (!item.text || item.text.trim().length === 0) {
    errors.push('Item text cannot be empty');
  }
  
  if (item.text && item.text.length > 500) {
    errors.push('Item text cannot exceed 500 characters');
  }
  
  if (item.order !== undefined && (item.order < 0 || !Number.isInteger(item.order))) {
    errors.push('Order must be a non-negative integer');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Filters checklist items based on settings
 */
export function filterChecklistItems(
  items: ChecklistItem[], 
  settings?: ChecklistSettings
): ChecklistItem[] {
  if (!settings?.showCompletedItems) {
    return items.filter(item => !item.completed);
  }
  return items;
}

/**
 * Gets default checklist settings
 */
export function getDefaultChecklistSettings(): ChecklistSettings {
  return {
    allowReordering: true,
    showCompletedItems: true,
    sortBy: 'order',
  };
}

/**
 * Migrates legacy checklist item to new format
 */
export function migrateChecklistItem(item: any, index: number): ChecklistItem {
  const now = new Date().toISOString();
  return {
    id: item.id || crypto.randomUUID(),
    text: security.sanitizeHtml(item.text || ''),
    completed: Boolean(item.completed),
    order: item.order !== undefined ? item.order : index,
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
  };
}

/**
 * Calculates statistics for a checklist
 */
export function getChecklistStats(items: ChecklistItem[]) {
  const total = items.length;
  const completed = items.filter(item => item.completed).length;
  const remaining = total - completed;
  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return {
    total,
    completed,
    remaining,
    completionPercentage,
  };
}