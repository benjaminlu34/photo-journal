import React from 'react';
import { render, screen } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TestBackend } from 'react-dnd-test-backend';
import { describe, it, expect, vi } from 'vitest';
import ChecklistItem from '../ChecklistItem';
import type { ChecklistItem as ChecklistItemType } from '@/types/checklist';

const mockItem: ChecklistItemType = {
  id: 'test-item-1',
  text: 'Test task',
  completed: false,
  order: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const defaultProps = {
  item: mockItem,
  index: 0,
  isEditing: false,
  isDragging: false,
  onToggle: vi.fn(),
  onTextChange: vi.fn(),
  onRemove: vi.fn(),
  onStartEdit: vi.fn(),
  onEndEdit: vi.fn(),
  onMove: vi.fn(),
};

const renderWithDnd = (component: React.ReactElement, backend = HTML5Backend) => {
  return render(
    <DndProvider backend={backend}>
      {component}
    </DndProvider>
  );
};

describe('ChecklistItem Drag and Drop', () => {
  it('renders with drag and drop functionality', () => {
    renderWithDnd(<ChecklistItem {...defaultProps} />);
    
    const dragHandle = screen.getByLabelText('Drag to reorder');
    expect(dragHandle).toBeInTheDocument();
  });

  it('applies dragging styles when isDragging is true', () => {
    renderWithDnd(<ChecklistItem {...defaultProps} isDragging={true} />);
    
    const container = screen.getByRole('listitem');
    expect(container).toHaveClass('opacity-60');
  });

  it('shows drag handle on hover', () => {
    renderWithDnd(<ChecklistItem {...defaultProps} />);
    
    const dragHandle = screen.getByLabelText('Drag to reorder');
    expect(dragHandle).toHaveClass('opacity-0');
    expect(dragHandle).toHaveClass('group-hover:opacity-100');
  });

  it('has proper drag and drop attributes', () => {
    renderWithDnd(<ChecklistItem {...defaultProps} />);
    
    const container = screen.getByRole('listitem');
    expect(container).toBeInTheDocument();
    
    // The drag handle should be present
    const dragHandle = screen.getByLabelText('Drag to reorder');
    expect(dragHandle).toBeInTheDocument();
  });

  it('maintains accessibility during drag operations', () => {
    renderWithDnd(<ChecklistItem {...defaultProps} isDragging={true} />);
    
    const container = screen.getByRole('listitem');
    expect(container).toHaveAttribute('aria-label', 'Task 1: Test task');
    expect(container).toHaveAttribute('aria-describedby', 'task-test-item-1-status');
  });
});