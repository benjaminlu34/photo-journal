import React, { useState, useEffect, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';
import { cn } from '@/lib/utils';

interface ColorWheelPickerProps {
  currentColor?: string;
  onColorSelect: (color: string) => void;
  onColorPreview?: (color: string | null) => void;
  size?: number;
  className?: string;
}

const hexToHSL = (hex: string): string => {
  // Simplified HEX-to-HSL converter (you can expand this from your original)
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 'H: 0° S: 0% L: 0%';
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `H: ${Math.round(h * 360)}° S: ${Math.round(s * 100)}% L: ${Math.round(l * 100)}%`;
};

export const ColorWheelPicker: React.FC<ColorWheelPickerProps> = ({
  currentColor = '#F4F7FF',
  onColorSelect,
  onColorPreview,
  size = 200,
  className,
}) => {
  const [color, setColor] = useState(currentColor);

  useEffect(() => {
    setColor(currentColor);
  }, [currentColor]);

  const handleColorChange = useCallback((newColor: string) => {
    setColor(newColor);
    onColorPreview?.(newColor);
  }, [onColorPreview]);

  const handleColorChangeComplete = useCallback(() => {
    onColorSelect(color); // Use latest state
  }, [color, onColorSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Basic keyboard shim (expand as needed, e.g., arrow keys to adjust HSL)
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleColorChangeComplete();
    }
  }, [handleColorChangeComplete]);

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div
        className="relative rounded-full border-2 border-white/20 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50"
        style={{ width: size, height: size }}
        tabIndex={0}
        role="slider"
        aria-label="Color wheel picker"
        aria-describedby="color-wheel-instructions"
        onKeyDown={handleKeyDown}
      >
        <HexColorPicker
          color={color}
          onChange={handleColorChange}
          onMouseUp={handleColorChangeComplete}
          onTouchEnd={handleColorChangeComplete}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '9999px', // Make it circular
          }}
          data-testid="color-wheel"
        />
      </div>

      {/* Current color display */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 border-white/20 shadow-sm"
          style={{ backgroundColor: color }}
          data-testid="color-wheel-preview"
        />
        <div className="text-sm text-gray-600 font-mono">
          {color.toUpperCase()}
        </div>
      </div>

      {/* HSL values for debugging */}
      <div className="text-xs text-gray-500 space-y-1">
        <div>{hexToHSL(color)}</div>
      </div>

      {/* Instructions */}
      <div id="color-wheel-instructions" className="sr-only">
        Use arrow keys to navigate the color picker (limited support). Press Enter or Space to select the current color. Click and drag for precise control.
      </div>
    </div>
  );
};