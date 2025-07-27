import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChecklistNote from '../ChecklistNote';
import type { ChecklistNoteContent } from '@/types/checklist';

describe('ChecklistNote', () => {
  const mockContent: ChecklistNoteContent = {
    type: 'checklist',
    items: [
      {
        id: '1',
        text: 'Test item 1',
        completed: false,
        order: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        text: 'Test item 2',
        completed: true,
        order: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ],
    settings: {
      allowReordering: true,
      showCompletedItems: true,
      sortBy: 'order',
    },
  };

  it('renders checklist items with enhanced data model', () => {
    const onChange = vi.fn();
    render(<ChecklistNote content={mockContent} onChange={onChange} />);

    expect(screen.getByText('Test item 1')).toBeInTheDocument();
    expect(screen.getByText('Test item 2')).toBeInTheDocument();
  });

  it('handles adding new items with proper timestamps and order', async () => {
    const onChange = vi.fn();
    render(<ChecklistNote content={mockContent} onChange={onChange} />);

    const input = screen.getByPlaceholderText('Add new item...');
    const addButton = screen.getAllByRole('button').find(button =>
      button.querySelector('svg')?.classList.contains('lucide-plus')
    );

    fireEvent.change(input, { target: { value: 'New test item' } });
    fireEvent.click(addButton!);

    // Wait for debounced save
    await new Promise(resolve => setTimeout(resolve, 600));

    // Verify onChange was called with proper structure
    expect(onChange).toHaveBeenCalled();
    const callArgs = onChange.mock.calls[0][0];
    expect(callArgs.type).toBe('checklist');
    expect(callArgs.items).toHaveLength(3);

    const newItem = callArgs.items[2];
    expect(newItem.text).toBe('New test item');
    expect(newItem.order).toBe(2);
    expect(newItem.createdAt).toBeDefined();
    expect(newItem.updatedAt).toBeDefined();
    expect(typeof newItem.createdAt).toBe('string');
    expect(typeof newItem.updatedAt).toBe('string');
  });

  it('handles legacy items without new fields', () => {
    const legacyContent = {
      type: 'checklist' as const,
      items: [
        {
          id: '1',
          text: 'Legacy item',
          completed: false,
          // Missing order, createdAt, updatedAt - these will be migrated
        },
      ],
    } as any; // Use 'as any' to simulate legacy data structure

    const onChange = vi.fn();
    render(<ChecklistNote content={legacyContent} onChange={onChange} />);

    expect(screen.getByText('Legacy item')).toBeInTheDocument();
  });

  it('supports backgroundColor in content', async () => {
    const coloredContent: ChecklistNoteContent = {
      type: 'checklist',
      items: [
        {
          id: '1',
          text: 'Colored item',
          completed: false,
          order: 0,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      backgroundColor: '#FF6B6B',
      settings: {
        allowReordering: true,
        showCompletedItems: true,
        sortBy: 'order',
      },
    };

    const onChange = vi.fn();
    render(<ChecklistNote content={coloredContent} onChange={onChange} />);

    expect(screen.getByText('Colored item')).toBeInTheDocument();

    // Test that onChange preserves backgroundColor
    const input = screen.getByPlaceholderText('Add new item...');
    const addButton = screen.getAllByRole('button').find(button =>
      button.querySelector('svg')?.classList.contains('lucide-plus')
    );

    fireEvent.change(input, { target: { value: 'New colored item' } });
    fireEvent.click(addButton!);

    // Wait for debounced save
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(onChange).toHaveBeenCalled();
    const callArgs = onChange.mock.calls[0][0];
    expect(callArgs.backgroundColor).toBe('#FF6B6B');
  });

  it('updates items with proper timestamps', async () => {
    const onChange = vi.fn();
    render(<ChecklistNote content={mockContent} onChange={onChange} />);

    // Find the first checkbox (unchecked item)
    const checkbox = screen.getAllByRole('button').find(button =>
      button.getAttribute('aria-label')?.includes('Toggle completion for task 1')
    );

    fireEvent.click(checkbox!);

    // Wait for debounced save
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(onChange).toHaveBeenCalled();
    const callArgs = onChange.mock.calls[0][0];
    const updatedItem = callArgs.items[0];
    expect(updatedItem.completed).toBe(true);
    expect(updatedItem.updatedAt).not.toBe('2024-01-01T00:00:00.000Z');
  });
});