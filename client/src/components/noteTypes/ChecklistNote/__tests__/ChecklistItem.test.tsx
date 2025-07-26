import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
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

const renderWithDnd = (component: React.ReactElement) => {
  return render(
    <DndProvider backend={HTML5Backend}>
      {component}
    </DndProvider>
  );
};

describe('ChecklistItem', () => {
  it('renders the item text correctly', () => {
    renderWithDnd(<ChecklistItem {...defaultProps} />);
    expect(screen.getByText('Test task')).toBeInTheDocument();
  });

  it('shows unchecked checkbox for incomplete item', () => {
    renderWithDnd(<ChecklistItem {...defaultProps} />);
    const checkbox = screen.getByRole('button', { name: /toggle completion for task 1: test task/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toHaveClass('bg-blue-500');
  });

  it('shows checked checkbox for completed item', () => {
    const completedItem = { ...mockItem, completed: true };
    renderWithDnd(<ChecklistItem {...defaultProps} item={completedItem} />);
    const checkbox = screen.getByRole('button', { name: /toggle completion for task 1: test task/i });
    expect(checkbox).toHaveClass('bg-blue-500');
  });

  it('calls onToggle when checkbox is clicked', () => {
    const onToggle = vi.fn();
    renderWithDnd(<ChecklistItem {...defaultProps} onToggle={onToggle} />);
    
    const checkbox = screen.getByRole('button', { name: /toggle completion for task 1: test task/i });
    fireEvent.click(checkbox);
    
    expect(onToggle).toHaveBeenCalledWith('test-item-1');
  });

  it('calls onStartEdit when text is clicked', () => {
    const onStartEdit = vi.fn();
    renderWithDnd(<ChecklistItem {...defaultProps} onStartEdit={onStartEdit} />);
    
    const textElement = screen.getByText('Test task');
    fireEvent.click(textElement);
    
    expect(onStartEdit).toHaveBeenCalledWith('test-item-1');
  });

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn();
    renderWithDnd(<ChecklistItem {...defaultProps} onRemove={onRemove} />);
    
    const removeButton = screen.getByRole('button', { name: /remove task/i });
    fireEvent.click(removeButton);
    
    expect(onRemove).toHaveBeenCalledWith('test-item-1');
  });

  it('shows input field when editing', () => {
    renderWithDnd(<ChecklistItem {...defaultProps} isEditing={true} />);
    
    const input = screen.getByRole('textbox', { name: /edit task text/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Test task');
  });

  it('applies dragging styles when isDragging is true', () => {
    renderWithDnd(<ChecklistItem {...defaultProps} isDragging={true} />);
    
    const container = screen.getByRole('listitem');
    expect(container).toHaveClass('opacity-50');
  });

  it('shows completed styling for completed items', () => {
    const completedItem = { ...mockItem, completed: true };
    renderWithDnd(<ChecklistItem {...defaultProps} item={completedItem} />);
    
    const textElement = screen.getByText('Test task');
    expect(textElement).toHaveClass('line-through');
  });
});