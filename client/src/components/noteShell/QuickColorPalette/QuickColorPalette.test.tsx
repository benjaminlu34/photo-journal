import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuickColorPalette, THEME_COLORS } from './QuickColorPalette';
import { vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('QuickColorPalette', () => {
  const mockOnColorSelect = vi.fn();
  const mockOnColorPreview = vi.fn();

  beforeEach(() => {
    localStorageMock.clear();
    mockOnColorSelect.mockClear();
    mockOnColorPreview.mockClear();
  });

  it('should render theme colors', () => {
    render(
      <QuickColorPalette
        onColorSelect={mockOnColorSelect}
        onColorPreview={mockOnColorPreview}
      />
    );

    // Should show theme colors section
    expect(screen.getByText('Theme Colors')).toBeInTheDocument();
    
    // Should render all theme colors
    THEME_COLORS.forEach(color => {
      expect(screen.getByTestId(`color-swatch-${color.name.toLowerCase().replace(/\s+/g, '-')}`)).toBeInTheDocument();
    });
  });

  it('should not show recent colors section when no recent colors exist', () => {
    render(
      <QuickColorPalette
        onColorSelect={mockOnColorSelect}
        onColorPreview={mockOnColorPreview}
      />
    );

    // Should not show recent colors section
    expect(screen.queryByText('Recent Colors')).not.toBeInTheDocument();
  });

  it('should add color to recent colors when selected', async () => {
    const { rerender } = render(
      <QuickColorPalette
        onColorSelect={mockOnColorSelect}
        onColorPreview={mockOnColorPreview}
      />
    );

    // Click on a theme color
    const colorButton = screen.getByTestId('color-swatch-soft-yellow');
    fireEvent.click(colorButton);

    // Should call onColorSelect
    expect(mockOnColorSelect).toHaveBeenCalledWith('#FEF3C7');

    // Re-render to see recent colors
    rerender(
      <QuickColorPalette
        onColorSelect={mockOnColorSelect}
        onColorPreview={mockOnColorPreview}
      />
    );

    // Should now show recent colors section
    await waitFor(() => {
      expect(screen.getByText('Recent Colors')).toBeInTheDocument();
    });

    // Should show the recent color
    expect(screen.getByTestId('recent-color-0')).toBeInTheDocument();
  });

  it('should handle color preview on hover', () => {
    render(
      <QuickColorPalette
        onColorSelect={mockOnColorSelect}
        onColorPreview={mockOnColorPreview}
      />
    );

    const colorButton = screen.getByTestId('color-swatch-rose-pink');
    
    // Hover over color
    fireEvent.mouseEnter(colorButton);
    expect(mockOnColorPreview).toHaveBeenCalledWith('#FCE7F3');

    // Mouse leave should clear preview
    fireEvent.mouseLeave(colorButton);
    expect(mockOnColorPreview).toHaveBeenCalledWith(null);
  });

  it('should show selected state for current color', () => {
    const currentColor = '#FCE7F3'; // Rose Pink
    
    render(
      <QuickColorPalette
        currentColor={currentColor}
        onColorSelect={mockOnColorSelect}
        onColorPreview={mockOnColorPreview}
      />
    );

    const colorButton = screen.getByTestId('color-swatch-rose-pink');
    expect(colorButton).toHaveAttribute('aria-checked', 'true');
  });

  it('should handle keyboard navigation', () => {
    render(
      <QuickColorPalette
        onColorSelect={mockOnColorSelect}
        onColorPreview={mockOnColorPreview}
      />
    );

    const colorButton = screen.getByTestId('color-swatch-sky-blue');
    
    // Press Enter key
    fireEvent.keyDown(colorButton, { key: 'Enter' });
    expect(mockOnColorSelect).toHaveBeenCalledWith('#DBEAFE');

    mockOnColorSelect.mockClear();

    // Press Space key
    fireEvent.keyDown(colorButton, { key: ' ' });
    expect(mockOnColorSelect).toHaveBeenCalledWith('#DBEAFE');
  });
});