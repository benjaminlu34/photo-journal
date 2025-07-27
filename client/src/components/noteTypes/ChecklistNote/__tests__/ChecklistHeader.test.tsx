import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ChecklistHeader from '../ChecklistHeader';

describe('ChecklistHeader', () => {
  const mockOnTitleChange = vi.fn();

  beforeEach(() => {
    mockOnTitleChange.mockClear();
  });

  it('displays placeholder text when no title is provided', () => {
    render(<ChecklistHeader onTitleChange={mockOnTitleChange} />);
    expect(screen.getByText('Untitled Checklist')).toBeInTheDocument();
  });

  it('displays the provided title', () => {
    render(<ChecklistHeader title="My Checklist" onTitleChange={mockOnTitleChange} />);
    expect(screen.getByText('My Checklist')).toBeInTheDocument();
  });

  it('enters edit mode when clicked', () => {
    render(<ChecklistHeader title="My Checklist" onTitleChange={mockOnTitleChange} />);

    const titleElement = screen.getByText('My Checklist');
    fireEvent.click(titleElement);

    expect(screen.getByDisplayValue('My Checklist')).toBeInTheDocument();
    expect(screen.getByLabelText('Edit checklist title')).toBeInTheDocument();
  });

  it('enters edit mode when Enter key is pressed', () => {
    render(<ChecklistHeader title="My Checklist" onTitleChange={mockOnTitleChange} />);

    const titleElement = screen.getByRole('button');
    fireEvent.keyDown(titleElement, { key: 'Enter' });

    expect(screen.getByDisplayValue('My Checklist')).toBeInTheDocument();
  });

  it('enters edit mode when Space key is pressed', () => {
    render(<ChecklistHeader title="My Checklist" onTitleChange={mockOnTitleChange} />);

    const titleElement = screen.getByRole('button');
    fireEvent.keyDown(titleElement, { key: ' ' });

    expect(screen.getByDisplayValue('My Checklist')).toBeInTheDocument();
  });

  it('saves changes when Enter is pressed in edit mode', async () => {
    render(<ChecklistHeader title="My Checklist" onTitleChange={mockOnTitleChange} />);

    // Enter edit mode
    const titleElement = screen.getByText('My Checklist');
    fireEvent.click(titleElement);

    // Change the title
    const input = screen.getByDisplayValue('My Checklist');
    fireEvent.change(input, { target: { value: 'Updated Checklist' } });

    // Press Enter to save
    fireEvent.keyDown(input, { key: 'Enter' });

    // Should exit edit mode and show updated title
    expect(screen.getByText('Updated Checklist')).toBeInTheDocument();
    expect(mockOnTitleChange).toHaveBeenCalledWith('Updated Checklist');
  });

  it('cancels changes when Escape is pressed in edit mode', () => {
    render(<ChecklistHeader title="My Checklist" onTitleChange={mockOnTitleChange} />);

    // Enter edit mode
    const titleElement = screen.getByText('My Checklist');
    fireEvent.click(titleElement);

    // Change the title
    const input = screen.getByDisplayValue('My Checklist');
    fireEvent.change(input, { target: { value: 'Updated Checklist' } });

    // Press Escape to cancel
    fireEvent.keyDown(input, { key: 'Escape' });

    // Should exit edit mode and show original title
    expect(screen.getByText('My Checklist')).toBeInTheDocument();
    expect(mockOnTitleChange).not.toHaveBeenCalled();
  });

  it('saves changes when input loses focus', async () => {
    render(<ChecklistHeader title="My Checklist" onTitleChange={mockOnTitleChange} />);

    // Enter edit mode
    const titleElement = screen.getByText('My Checklist');
    fireEvent.click(titleElement);

    // Change the title
    const input = screen.getByDisplayValue('My Checklist');
    fireEvent.change(input, { target: { value: 'Updated Checklist' } });

    // Blur the input
    fireEvent.blur(input);

    // Should exit edit mode and show updated title
    expect(screen.getByText('Updated Checklist')).toBeInTheDocument();
    expect(mockOnTitleChange).toHaveBeenCalledWith('Updated Checklist');
  });

  it('implements debounced auto-save for title changes', async () => {
    vi.useFakeTimers();

    render(<ChecklistHeader title="My Checklist" onTitleChange={mockOnTitleChange} />);

    // Enter edit mode
    const titleElement = screen.getByText('My Checklist');
    fireEvent.click(titleElement);

    // Change the title
    const input = screen.getByDisplayValue('My Checklist');
    fireEvent.change(input, { target: { value: 'Updated Checklist' } });

    // Should not call onChange immediately
    expect(mockOnTitleChange).not.toHaveBeenCalled();

    // Fast-forward time by 300ms (debounce delay)
    vi.advanceTimersByTime(300);

    // Should now call onChange
    expect(mockOnTitleChange).toHaveBeenCalledWith('Updated Checklist');

    vi.useRealTimers();
  });

  it('shows placeholder styling for empty title', () => {
    render(<ChecklistHeader title="" onTitleChange={mockOnTitleChange} />);

    const titleElement = screen.getByText('Untitled Checklist');
    expect(titleElement).toHaveClass('text-gray-500', 'italic');
  });

  it('shows normal styling for non-empty title', () => {
    render(<ChecklistHeader title="My Checklist" onTitleChange={mockOnTitleChange} />);

    const titleElement = screen.getByText('My Checklist');
    expect(titleElement).toHaveClass('text-gray-800');
    expect(titleElement).not.toHaveClass('italic');
  });

  it('has proper accessibility attributes', () => {
    render(<ChecklistHeader title="My Checklist" onTitleChange={mockOnTitleChange} />);

    const titleButton = screen.getByRole('button');
    expect(titleButton).toHaveAttribute('aria-label', 'Checklist title: My Checklist. Click to edit.');
    expect(titleButton).toHaveAttribute('tabIndex', '0');
  });

  it('limits input length to 100 characters', () => {
    render(<ChecklistHeader title="My Checklist" onTitleChange={mockOnTitleChange} />);

    // Enter edit mode
    const titleElement = screen.getByText('My Checklist');
    fireEvent.click(titleElement);

    const input = screen.getByLabelText('Edit checklist title');
    expect(input).toHaveAttribute('maxLength', '100');
  });

  it('adapts text color based on background color', () => {
    // Test with dark background - should use light text
    const { rerender } = render(
      <ChecklistHeader
        title="My Checklist"
        onTitleChange={mockOnTitleChange}
        backgroundColor="#1F2937"
      />
    );

    const titleElement = screen.getByText('My Checklist');
    expect(titleElement).toHaveStyle({ color: '#F9FAFB' });

    // Test with light background - should use dark text
    rerender(
      <ChecklistHeader
        title="My Checklist"
        onTitleChange={mockOnTitleChange}
        backgroundColor="#F9FAFB"
      />
    );

    expect(titleElement).toHaveStyle({ color: '#1F2937' });
  });

  it('uses default colors when no background color is provided', () => {
    render(<ChecklistHeader title="My Checklist" onTitleChange={mockOnTitleChange} />);

    const titleElement = screen.getByText('My Checklist');
    // Should not have inline color style, relying on CSS classes
    expect(titleElement).not.toHaveStyle({ color: expect.anything() });
    expect(titleElement).toHaveClass('text-gray-800');
  });

  it('applies placeholder color styling in edit mode with custom background', () => {
    render(
      <ChecklistHeader
        title=""
        onTitleChange={mockOnTitleChange}
        backgroundColor="#1F2937"
      />
    );

    // Enter edit mode
    const titleElement = screen.getByText('Untitled Checklist');
    fireEvent.click(titleElement);

    // Check that the input has the correct text color
    const input = screen.getByLabelText('Edit checklist title');
    expect(input).toHaveStyle({ color: '#F9FAFB' });

    // Check that placeholder styling is applied via CSS
    expect(document.querySelector('style')).toBeInTheDocument();
  });
});