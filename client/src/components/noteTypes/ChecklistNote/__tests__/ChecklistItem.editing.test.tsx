import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('ChecklistItem Inline Editing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('enters edit mode when text is clicked', () => {
        const onStartEdit = vi.fn();
        renderWithDnd(<ChecklistItem {...defaultProps} onStartEdit={onStartEdit} />);

        const textElement = screen.getByText('Test task');
        fireEvent.click(textElement);

        expect(onStartEdit).toHaveBeenCalledWith('test-item-1');
    });

    it('shows input field when in editing mode', () => {
        renderWithDnd(<ChecklistItem {...defaultProps} isEditing={true} />);

        const input = screen.getByRole('textbox', { name: /edit task text/i });
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('Test task');
    });

    it('saves changes on Enter key', () => {
        const onTextChange = vi.fn();
        const onEndEdit = vi.fn();
        renderWithDnd(
            <ChecklistItem
                {...defaultProps}
                isEditing={true}
                onTextChange={onTextChange}
                onEndEdit={onEndEdit}
            />
        );

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Updated task' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(onTextChange).toHaveBeenCalledWith('test-item-1', 'Updated task');
        expect(onEndEdit).toHaveBeenCalled();
    });

    it('cancels changes on Escape key', () => {
        const onTextChange = vi.fn();
        const onEndEdit = vi.fn();
        renderWithDnd(
            <ChecklistItem
                {...defaultProps}
                isEditing={true}
                onTextChange={onTextChange}
                onEndEdit={onEndEdit}
            />
        );

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Updated task' } });
        fireEvent.keyDown(input, { key: 'Escape' });

        expect(onTextChange).not.toHaveBeenCalled();
        expect(onEndEdit).toHaveBeenCalled();
        expect(input).toHaveValue('Test task'); // Should revert to original
    });

    it('saves changes on blur', () => {
        const onTextChange = vi.fn();
        const onEndEdit = vi.fn();
        renderWithDnd(
            <ChecklistItem
                {...defaultProps}
                isEditing={true}
                onTextChange={onTextChange}
                onEndEdit={onEndEdit}
            />
        );

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Updated task' } });
        fireEvent.blur(input);

        expect(onTextChange).toHaveBeenCalledWith('test-item-1', 'Updated task');
        expect(onEndEdit).toHaveBeenCalled();
    });

    it('shows auto-saving indicator for unsaved changes', async () => {
        renderWithDnd(<ChecklistItem {...defaultProps} isEditing={true} />);

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Updated task' } });

        // Should show auto-saving indicator
        expect(screen.getByText('Auto-saving...')).toBeInTheDocument();
    });

    it('triggers debounced auto-save after 300ms', async () => {
        const onTextChange = vi.fn();
        renderWithDnd(
            <ChecklistItem
                {...defaultProps}
                isEditing={true}
                onTextChange={onTextChange}
            />
        );

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Updated task' } });

        // Should not save immediately
        expect(onTextChange).not.toHaveBeenCalled();

        // Fast-forward time by 300ms
        vi.advanceTimersByTime(300);

        // Should save after debounce delay
        expect(onTextChange).toHaveBeenCalledWith('test-item-1', 'Updated task');
    });

    it('cancels debounced save when Escape is pressed', async () => {
        const onTextChange = vi.fn();
        renderWithDnd(
            <ChecklistItem
                {...defaultProps}
                isEditing={true}
                onTextChange={onTextChange}
            />
        );

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Updated task' } });

        // Press Escape before debounce completes
        fireEvent.keyDown(input, { key: 'Escape' });

        // Fast-forward time
        vi.advanceTimersByTime(300);

        // Should not save
        expect(onTextChange).not.toHaveBeenCalled();
    });

    it('supports keyboard navigation for text element', () => {
        const onStartEdit = vi.fn();
        const onRemove = vi.fn();
        renderWithDnd(
            <ChecklistItem
                {...defaultProps}
                onStartEdit={onStartEdit}
                onRemove={onRemove}
            />
        );

        const textElement = screen.getByRole('button', { name: /click to edit task text/i });

        // Enter key should start editing
        fireEvent.keyDown(textElement, { key: 'Enter' });
        expect(onStartEdit).toHaveBeenCalledWith('test-item-1');

        // Space key should start editing
        fireEvent.keyDown(textElement, { key: ' ' });
        expect(onStartEdit).toHaveBeenCalledWith('test-item-1');

        // Delete key should remove item
        fireEvent.keyDown(textElement, { key: 'Delete' });
        expect(onRemove).toHaveBeenCalledWith('test-item-1');
    });
});