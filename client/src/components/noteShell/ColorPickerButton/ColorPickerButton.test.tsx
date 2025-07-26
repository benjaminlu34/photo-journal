import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPickerButton } from './ColorPickerButton';
import { vi } from 'vitest';

// Mock the hooks and components
vi.mock('@/hooks/useColorPickerStrategy', () => ({
  useColorPickerStrategy: () => ({
    Component: ({ children, onColorSelect }: any) => (
      <div data-testid="color-picker-strategy">
        {children}
        <button
          data-testid="mock-color-select"
          onClick={() => onColorSelect('#FF5733')}
        >
          Select Color
        </button>
        <button
          data-testid="advanced-color-select"
          onClick={() => onColorSelect('#33FF57')}
        >
          Select Advanced Color
        </button>
      </div>
    ),
    isMobile: false
  })
}));

vi.mock('@/components/noteShell/AdvancedColorModal', () => ({
  AdvancedColorModal: ({ onColorSelect }: any) => (
    <div data-testid="advanced-color-modal">
      <button 
        data-testid="advanced-color-select" 
        onClick={() => onColorSelect('#33FF57')}
      >
        Select Advanced Color
      </button>
    </div>
  )
}));

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

describe('ColorPickerButton', () => {
  const mockOnColorChange = vi.fn();
  const mockOnColorPreview = vi.fn();

  beforeEach(() => {
    localStorageMock.clear();
    mockOnColorChange.mockClear();
    mockOnColorPreview.mockClear();
  });

  it('should add colors to recent colors when selected from main color picker', () => {
    render(
      <ColorPickerButton
        onColorChange={mockOnColorChange}
        onColorPreview={mockOnColorPreview}
      />
    );

    // Click the color picker button to open it
    const colorPickerButton = screen.getByTestId('color-picker-button');
    fireEvent.click(colorPickerButton);

    // Select a color from the main picker
    const selectColorButton = screen.getByTestId('mock-color-select');
    fireEvent.click(selectColorButton);

    // Should call onColorChange with the selected color
    expect(mockOnColorChange).toHaveBeenCalledWith('#FF5733');

    // Check that color was added to localStorage (recent colors)
    const storedColors = localStorageMock.getItem('recent-note-colors');
    expect(storedColors).toBeTruthy();
    
    const parsedColors = JSON.parse(storedColors!);
    expect(parsedColors).toHaveLength(1);
    expect(parsedColors[0].hex).toBe('#FF5733');
  });

  it('should add colors to recent colors when selected from advanced color modal', () => {
    render(
      <ColorPickerButton
        onColorChange={mockOnColorChange}
        onColorPreview={mockOnColorPreview}
      />
    );

    // The advanced color modal is available through the strategy
    const advancedColorSelect = screen.getByTestId('advanced-color-select');
    fireEvent.click(advancedColorSelect);

    // Should call onColorChange with the selected color
    expect(mockOnColorChange).toHaveBeenCalledWith('#33FF57');

    // Check that color was added to localStorage (recent colors)
    const storedColors = localStorageMock.getItem('recent-note-colors');
    expect(storedColors).toBeTruthy();
    
    const parsedColors = JSON.parse(storedColors!);
    expect(parsedColors).toHaveLength(1);
    expect(parsedColors[0].hex).toBe('#33FF57');
  });

  it('should maintain recent colors order when multiple colors are selected', () => {
    render(
      <ColorPickerButton
        onColorChange={mockOnColorChange}
        onColorPreview={mockOnColorPreview}
      />
    );

    // Select first color from main picker
    const selectColorButton = screen.getByTestId('mock-color-select');
    fireEvent.click(selectColorButton);

    // Select another color from advanced modal
    const advancedColorSelect = screen.getByTestId('advanced-color-select');
    fireEvent.click(advancedColorSelect);

    // Check that both colors are stored with correct order (most recent first)
    const storedColors = localStorageMock.getItem('recent-note-colors');
    expect(storedColors).toBeTruthy();
    
    const parsedColors = JSON.parse(storedColors!);
    expect(parsedColors).toHaveLength(2);
    expect(parsedColors[0].hex).toBe('#33FF57'); // Most recent
    expect(parsedColors[1].hex).toBe('#FF5733'); // Previous
  });

  it('should display current color correctly', () => {
    const currentColor = '#FF5733';
    
    render(
      <ColorPickerButton
        currentColor={currentColor}
        onColorChange={mockOnColorChange}
        onColorPreview={mockOnColorPreview}
      />
    );

    const colorPickerButton = screen.getByTestId('color-picker-button');
    expect(colorPickerButton).toHaveAttribute('title', `Current color: ${currentColor}`);
    expect(colorPickerButton).toHaveAttribute('aria-label', `Change note color. Current color: ${currentColor}`);
  });
});