import React from 'react';
import { cn } from '@/lib/utils';
import { useRecentColors } from '@/hooks/useRecentColors/useRecentColors';

// Theme colors as defined in the design document
export const THEME_COLORS = [
  { name: 'Default', hex: '#F4F7FF', description: 'Light blue default' },
  { name: 'Soft Yellow', hex: '#FEF3C7', description: 'Warm yellow note' },
  { name: 'Rose Pink', hex: '#FCE7F3', description: 'Gentle pink note' },
  { name: 'Sky Blue', hex: '#DBEAFE', description: 'Light blue note' },
  { name: 'Mint Green', hex: '#D1FAE5', description: 'Fresh green note' },
  { name: 'Lavender', hex: '#E9D5FF', description: 'Soft purple note' },
  { name: 'Peach', hex: '#FED7AA', description: 'Warm peach note' },
  { name: 'Coral', hex: '#FECACA', description: 'Light coral note' },
  { name: 'Sage', hex: '#CFFAFE', description: 'Muted teal note' }, // Fixed from duplicate #D1FAE5
  { name: 'Periwinkle', hex: '#C7D2FE', description: 'Light purple note' }
] as const;

interface QuickColorPaletteProps {
  currentColor?: string;
  onColorSelect: (color: string) => void;
  onColorPreview?: (color: string | null) => void; // null to clear preview
  className?: string;
  testId?: string;
}

export const QuickColorPalette: React.FC<QuickColorPaletteProps> = ({
  currentColor,
  onColorSelect,
  onColorPreview,
  className,
  testId = 'color-palette',
}) => {
  const { recentColors, addRecentColor, hasRecentColors } = useRecentColors();

  const handleColorSelect = (color: string) => {
    // Add to recent colors when selected
    addRecentColor(color);
    onColorSelect(color);
  };

  const handleColorPreview = (color: string) => {
    onColorPreview?.(color);
  };

  const handleClearPreview = () => {
    onColorPreview?.(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, color: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleColorSelect(color);
    }
  };

  return (
    <div className={cn('p-3 space-y-3', className)} data-testid={testId}>
      {/* Recent Colors Section */}
      {hasRecentColors && (
        <div>
          <div className="text-xs font-medium text-gray-600 mb-2 px-1">
            Recent Colors
          </div>
          <div
            className="flex gap-2 flex-wrap"
            role="radiogroup"
            aria-label="Recent colors"
          >
            {recentColors.map((color, index) => {
              const isSelected = currentColor === color;
              
              return (
                <button
                  key={`recent-${color}-${index}`}
                  type="button"
                  onClick={() => handleColorSelect(color)}
                  onKeyDown={(e) => handleKeyDown(e, color)}
                  onMouseEnter={() => handleColorPreview(color)}
                  onMouseLeave={handleClearPreview}
                  className={cn(
                    // Base styles
                    'relative w-7 h-7 rounded-full transition-all duration-200',
                    'border-2 border-transparent',
                    'hover:scale-110 hover:shadow-lg',
                    'active:scale-95',
                    'focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-1',
                    
                    // Selected state
                    isSelected && [
                      'ring-2 ring-gray-800 ring-offset-2 ring-offset-white',
                      'scale-110',
                    ],
                    
                    // Touch targets for mobile
                    'min-h-[40px] min-w-[40px] flex items-center justify-center',
                    'touch-manipulation cursor-pointer'
                  )}
                  style={{
                    backgroundColor: color,
                    boxShadow: `0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                  }}
                  aria-label={`Recent color ${color}`}
                  role="radio"
                  aria-checked={isSelected}
                  data-testid={`recent-color-${index}`}
                  title={`Recent color: ${color}`}
                >
                  {/* Visual color circle */}
                  <div
                    className="w-5 h-5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  
                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-gray-800 rounded-full" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Theme Colors Section */}
      <div>
        <div className="text-xs font-medium text-gray-600 mb-2 px-1">
          Theme Colors
        </div>
        <div
          className="grid grid-cols-5 gap-2 sm:grid-cols-5 md:gap-3"
          role="radiogroup"
          aria-label="Theme color palette"
        >
          {THEME_COLORS.map((color, index) => {
        const isSelected = currentColor === color.hex;
        
        return (
          <button
            key={color.hex}
            type="button"
            onClick={() => handleColorSelect(color.hex)}
            onKeyDown={(e) => handleKeyDown(e, color.hex)}
            onMouseEnter={() => handleColorPreview(color.hex)}
            onMouseLeave={handleClearPreview}
            className={cn(
              // Base styles
              'relative w-8 h-8 rounded-full transition-all duration-200',
              'border-2 border-transparent',
              'hover:scale-110 hover:shadow-lg',
              'active:scale-95',
              'focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-1',
              
              // Selected state
              isSelected && [
                'ring-2 ring-gray-800 ring-offset-2 ring-offset-white',
                'scale-110',
              ],
              
              // Touch targets for mobile
              'min-h-[44px] min-w-[44px] flex items-center justify-center',
              'touch-manipulation cursor-pointer'
            )}
            style={{
              backgroundColor: color.hex,
              boxShadow: `0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
            }}
            aria-label={`${color.name} - ${color.description}`}
            aria-describedby={`color-desc-${index}`}
            role="radio"
            aria-checked={isSelected}
            data-testid={`color-swatch-${color.name.toLowerCase().replace(/\s+/g, '-')}`}
            title={`${color.name} (${color.hex})`}
          >
            {/* Visual color circle */}
            <div
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: color.hex }}
            />
            
            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-gray-800 rounded-full" />
              </div>
            )}
            
            {/* Hidden description for screen readers */}
            <span id={`color-desc-${index}`} className="sr-only">
              {color.description}. HEX code: {color.hex}
            </span>
          </button>
        );
      })}
        </div>
      </div>
    </div>
  );
};