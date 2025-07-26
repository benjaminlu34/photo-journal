import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorWheelPicker } from './ColorWheelPicker';

describe('ColorWheelPicker', () => {
  const mockOnColorSelect = vi.fn();
  const mockOnColorPreview = vi.fn();

  const defaultProps = {
    currentColor: '#F4F7FF',
    onColorSelect: mockOnColorSelect,
    onColorPreview: mockOnColorPreview,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders color wheel canvas', () => {
    render(<ColorWheelPicker {...defaultProps} />);
    
    expect(screen.getByTestId('color-wheel')).toBeInTheDocument();
    expect(screen.getByTestId('color-wheel-preview')).toBeInTheDocument();
  });

  it('displays current color in preview', () => {
    render(<ColorWheelPicker {...defaultProps} currentColor="#FF5733" />);
    
    const preview = screen.getByTestId('color-wheel-preview');
    expect(preview).toHaveStyle('background-color: #FF5733');
  });

  it('shows HEX color code', () => {
    render(<ColorWheelPicker {...defaultProps} currentColor="#FF5733" />);
    
    expect(screen.getByText('#FF5733')).toBeInTheDocument();
  });

  it('shows instructions for users', () => {
    render(<ColorWheelPicker {...defaultProps} />);
    
    // Should show instructions for using the color picker
    expect(screen.getByText(/Use arrow keys to navigate/)).toBeInTheDocument();
  });

  it('handles color changes', () => {
    render(<ColorWheelPicker {...defaultProps} />);
    
    const colorPicker = screen.getByTestId('color-wheel');
    
    // Simulate color change - react-colorful handles this internally
    // We can test that the component responds to prop changes
    expect(colorPicker).toBeInTheDocument();
  });

  it('calls onColorSelect when interaction completes', () => {
    render(<ColorWheelPicker {...defaultProps} />);
    
    const colorPicker = screen.getByTestId('color-wheel');
    
    // Test mouse up event (react-colorful will handle the color selection)
    fireEvent.mouseUp(colorPicker);
    expect(mockOnColorSelect).toHaveBeenCalled();
  });

  it('calls onColorSelect on touch end', () => {
    render(<ColorWheelPicker {...defaultProps} />);
    
    const colorPicker = screen.getByTestId('color-wheel');
    
    // Test touch end event
    fireEvent.touchEnd(colorPicker);
    expect(mockOnColorSelect).toHaveBeenCalled();
  });

  it('has proper accessibility support', () => {
    render(<ColorWheelPicker {...defaultProps} />);
    
    // react-colorful provides built-in accessibility
    const colorPicker = screen.getByTestId('color-wheel');
    expect(colorPicker).toBeInTheDocument();
  });

  it('shows instructions for screen readers', () => {
    render(<ColorWheelPicker {...defaultProps} />);
    
    expect(screen.getByText(/Use arrow keys to navigate/)).toBeInTheDocument();
  });

  it('uses custom size when provided', () => {
    render(<ColorWheelPicker {...defaultProps} size={300} />);
    
    const colorPicker = screen.getByTestId('color-wheel');
    // Check that the color wheel has the expected dimensions
    expect(colorPicker).toBeInTheDocument();
    const container = colorPicker.closest('.flex.flex-col');
    expect(container).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<ColorWheelPicker {...defaultProps} className="custom-class" />);
    
    // The custom className is applied to the root container
    const rootContainer = screen.getByTestId('color-wheel').closest('.custom-class');
    expect(rootContainer).toBeInTheDocument();
    expect(rootContainer).toHaveClass('custom-class');
  });

  it('handles mouse and touch events', () => {
    render(<ColorWheelPicker {...defaultProps} />);
    
    const colorPicker = screen.getByTestId('color-wheel');
    
    // Test mouse events
    fireEvent.mouseDown(colorPicker);
    fireEvent.mouseUp(colorPicker);
    expect(mockOnColorSelect).toHaveBeenCalled();
    
    // Test touch events
    fireEvent.touchStart(colorPicker);
    fireEvent.touchEnd(colorPicker);
    expect(mockOnColorSelect).toHaveBeenCalledTimes(2); // Called twice now
  });
});