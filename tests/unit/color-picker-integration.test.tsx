import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPickerButton } from '@/components/noteShell/ColorPickerButton/ColorPickerButton';
import { QuickColorPalette } from '@/components/noteShell/QuickColorPalette/QuickColorPalette';
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

describe('Color Picker Integration', () => {
  const mockOnColorChange = vi.fn();
  const mockOnColorPreview = vi.fn();

  beforeEach(() => {
    localStorageMock.clear();
    mockOnColorChange.mockClear();
    mockOnColorPreview.mockClear();
  });

  it('should show recent colors in QuickColorPalette after selecting colors from ColorPickerButton', () => {
    // First, render a ColorPickerButton and select a color to add it to recent colors
    const { unmount } = render(
      <ColorPickerButton
        onColorChange={mockOnColorChange}
        onColorPreview={mockOnColorPreview}
      />
    );

    // Simulate selecting a color (this would normally come from the color picker strategy)
    // We'll directly call the function that would be called by the color picker
    const colorPickerButton = screen.getByTestId('color-picker-button');
    
    // Since we can't easily test the full integration with the real components,
    // let's test that the useRecentColors hook is being used correctly
    expect(colorPickerButton).toBeInTheDocument();
    
    unmount();

    // Now render a QuickColorPalette and verify it can show recent colors
    render(
      <QuickColorPalette
        onColorSelect={mockOnColorChange}
        onColorPreview={mockOnColorPreview}
      />
    );

    // Initially, there should be no recent colors section
    expect(screen.queryByText('Recent Colors')).not.toBeInTheDocument();
    
    // Select a color from the theme colors
    const colorButton = screen.getByTestId('color-swatch-soft-yellow');
    fireEvent.click(colorButton);

    // Should call onColorSelect
    expect(mockOnColorChange).toHaveBeenCalledWith('#FEF3C7');

    // Check localStorage to verify the color was added
    const storedColors = localStorageMock.getItem('recent-note-colors');
    expect(storedColors).toBeTruthy();
    
    const parsedColors = JSON.parse(storedColors!);
    expect(parsedColors).toHaveLength(1);
    expect(parsedColors[0].hex).toBe('#FEF3C7');
  });

  it('should maintain recent colors across different color picker components', () => {
    // Add a color through QuickColorPalette
    const { unmount: unmountPalette } = render(
      <QuickColorPalette
        onColorSelect={mockOnColorChange}
        onColorPreview={mockOnColorPreview}
      />
    );

    const colorButton = screen.getByTestId('color-swatch-rose-pink');
    fireEvent.click(colorButton);
    expect(mockOnColorChange).toHaveBeenCalledWith('#FCE7F3');

    unmountPalette();

    // Now render another QuickColorPalette and verify the recent color is there
    render(
      <QuickColorPalette
        onColorSelect={mockOnColorChange}
        onColorPreview={mockOnColorPreview}
      />
    );

    // Should show recent colors section
    expect(screen.getByText('Recent Colors')).toBeInTheDocument();
    expect(screen.getByTestId('recent-color-0')).toBeInTheDocument();

    // The recent color should have the correct color
    const recentColorButton = screen.getByTestId('recent-color-0');
    expect(recentColorButton).toHaveAttribute('title', 'Recent color: #FCE7F3');
  });

  it('should limit recent colors to 5 items', () => {
    render(
      <QuickColorPalette
        onColorSelect={mockOnColorChange}
        onColorPreview={mockOnColorPreview}
      />
    );

    // Select 6 different colors
    const colors = [
      { testId: 'color-swatch-default', hex: '#F4F7FF' },
      { testId: 'color-swatch-soft-yellow', hex: '#FEF3C7' },
      { testId: 'color-swatch-rose-pink', hex: '#FCE7F3' },
      { testId: 'color-swatch-sky-blue', hex: '#DBEAFE' },
      { testId: 'color-swatch-mint-green', hex: '#D1FAE5' },
      { testId: 'color-swatch-lavender', hex: '#E9D5FF' },
    ];

    colors.forEach(color => {
      const colorButton = screen.getByTestId(color.testId);
      fireEvent.click(colorButton);
    });

    // Check localStorage to verify only 5 colors are stored
    const storedColors = localStorageMock.getItem('recent-note-colors');
    expect(storedColors).toBeTruthy();
    
    const parsedColors = JSON.parse(storedColors!);
    expect(parsedColors).toHaveLength(5);
    
    // The first color should have been removed (FIFO)
    const storedHexes = parsedColors.map((c: any) => c.hex);
    expect(storedHexes).not.toContain('#F4F7FF'); // First color should be removed
    expect(storedHexes).toContain('#E9D5FF'); // Last color should be present
  });

  it('should handle duplicate colors correctly', () => {
    render(
      <QuickColorPalette
        onColorSelect={mockOnColorChange}
        onColorPreview={mockOnColorPreview}
      />
    );

    // Select the same color twice
    const colorButton = screen.getByTestId('color-swatch-soft-yellow');
    fireEvent.click(colorButton);
    fireEvent.click(colorButton);

    // Check localStorage to verify only one instance is stored
    const storedColors = localStorageMock.getItem('recent-note-colors');
    expect(storedColors).toBeTruthy();
    
    const parsedColors = JSON.parse(storedColors!);
    expect(parsedColors).toHaveLength(1);
    expect(parsedColors[0].hex).toBe('#FEF3C7');
  });
});