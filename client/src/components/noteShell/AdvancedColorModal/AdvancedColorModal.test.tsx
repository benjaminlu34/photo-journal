import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdvancedColorModal } from './AdvancedColorModal';

describe('AdvancedColorModal', () => {
  const mockOnClose = vi.fn();
  const mockOnColorSelect = vi.fn();
  const mockOnColorPreview = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    currentColor: '#F4F7FF',
    onColorSelect: mockOnColorSelect,
    onColorPreview: mockOnColorPreview,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open', () => {
    render(<AdvancedColorModal {...defaultProps} />);
    
    expect(screen.getByTestId('advanced-color-modal')).toBeInTheDocument();
    expect(screen.getByText('Custom Color')).toBeInTheDocument();
    expect(screen.getByTestId('hex-input')).toBeInTheDocument();
    expect(screen.getByTestId('color-preview')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<AdvancedColorModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByTestId('advanced-color-modal')).not.toBeInTheDocument();
  });

  it('displays current color in input and preview', () => {
    render(<AdvancedColorModal {...defaultProps} currentColor="#FF5733" />);
    
    const hexInput = screen.getByTestId('hex-input') as HTMLInputElement;
    expect(hexInput.value).toBe('#FF5733');
    
    const colorPreview = screen.getByTestId('color-preview');
    expect(colorPreview).toHaveStyle('background-color: #FF5733');
  });

  it('validates HEX color input', async () => {
    render(<AdvancedColorModal {...defaultProps} />);
    
    const hexInput = screen.getByTestId('hex-input');
    
    // Test invalid color
    fireEvent.change(hexInput, { target: { value: 'invalid' } });
    
    await waitFor(() => {
      expect(screen.getByTestId('validation-error')).toBeInTheDocument();
      expect(screen.getByText(/Invalid HEX color format/)).toBeInTheDocument();
    });
    
    // Test valid color
    fireEvent.change(hexInput, { target: { value: '#00FF00' } });
    
    await waitFor(() => {
      expect(screen.queryByTestId('validation-error')).not.toBeInTheDocument();
    });
  });

  it('auto-adds # prefix to color input', () => {
    render(<AdvancedColorModal {...defaultProps} />);
    
    const hexInput = screen.getByTestId('hex-input') as HTMLInputElement;
    
    fireEvent.change(hexInput, { target: { value: 'FF5733' } });
    
    expect(hexInput.value).toBe('#FF5733');
  });

  it('limits input to 7 characters', () => {
    render(<AdvancedColorModal {...defaultProps} />);
    
    const hexInput = screen.getByTestId('hex-input') as HTMLInputElement;
    
    fireEvent.change(hexInput, { target: { value: '#FF5733EXTRA' } });
    
    expect(hexInput.value).toBe('#FF5733');
  });

  it('converts input to uppercase', () => {
    render(<AdvancedColorModal {...defaultProps} />);
    
    const hexInput = screen.getByTestId('hex-input') as HTMLInputElement;
    
    fireEvent.change(hexInput, { target: { value: '#ff5733' } });
    
    expect(hexInput.value).toBe('#FF5733');
  });

  it('shows contrast compliance information', async () => {
    render(<AdvancedColorModal {...defaultProps} />);
    
    const hexInput = screen.getByTestId('hex-input');
    
    // Test with a color that should have good contrast
    fireEvent.change(hexInput, { target: { value: '#FFFFFF' } });
    
    await waitFor(() => {
      expect(screen.getByText('WCAG AA Compliant')).toBeInTheDocument();
    });
  });

  it('calls onColorPreview when color changes', async () => {
    render(<AdvancedColorModal {...defaultProps} />);
    
    const hexInput = screen.getByTestId('hex-input');
    
    fireEvent.change(hexInput, { target: { value: '#00FF00' } });
    
    await waitFor(() => {
      expect(mockOnColorPreview).toHaveBeenCalledWith('#00FF00');
    });
  });

  it('applies color when Apply button is clicked', async () => {
    render(<AdvancedColorModal {...defaultProps} />);
    
    const hexInput = screen.getByTestId('hex-input');
    const applyButton = screen.getByTestId('apply-button');
    
    fireEvent.change(hexInput, { target: { value: '#00FF00' } });
    fireEvent.click(applyButton);
    
    expect(mockOnColorSelect).toHaveBeenCalledWith('#00FF00');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('applies color when Enter key is pressed', () => {
    render(<AdvancedColorModal {...defaultProps} />);
    
    const hexInput = screen.getByTestId('hex-input');
    
    fireEvent.change(hexInput, { target: { value: '#00FF00' } });
    fireEvent.keyDown(hexInput, { key: 'Enter', code: 'Enter' });
    
    expect(mockOnColorSelect).toHaveBeenCalledWith('#00FF00');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('cancels when Cancel button is clicked', () => {
    render(<AdvancedColorModal {...defaultProps} />);
    
    const cancelButton = screen.getByTestId('cancel-button');
    fireEvent.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnColorPreview).toHaveBeenCalledWith(null);
  });

  it('cancels when Escape key is pressed', () => {
    render(<AdvancedColorModal {...defaultProps} />);
    
    const modal = screen.getByTestId('advanced-color-modal');
    fireEvent.keyDown(modal, { key: 'Escape', code: 'Escape' });
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('cancels when close button is clicked', () => {
    render(<AdvancedColorModal {...defaultProps} />);
    
    const closeButton = screen.getByTestId('close-advanced-modal');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('disables Apply button for invalid colors', async () => {
    render(<AdvancedColorModal {...defaultProps} />);
    
    const hexInput = screen.getByTestId('hex-input');
    const applyButton = screen.getByTestId('apply-button');
    
    fireEvent.change(hexInput, { target: { value: 'invalid' } });
    
    await waitFor(() => {
      expect(applyButton).toBeDisabled();
    });
  });

  it('shows sample text with appropriate contrast', async () => {
    render(<AdvancedColorModal {...defaultProps} />);
    
    const hexInput = screen.getByTestId('hex-input');
    
    fireEvent.change(hexInput, { target: { value: '#000000' } });
    
    await waitFor(() => {
      const sampleText = screen.getByText('Sample text');
      expect(sampleText).toHaveStyle('background-color: #000000');
      expect(sampleText).toHaveStyle('color: #F9FAFB'); // Light text on dark background
    });
  });
});