import React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import { QuickColorPalette } from '../QuickColorPalette/QuickColorPalette';

interface ColorPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor?: string;
  onColorSelect: (color: string) => void;
  onColorPreview?: (color: string | null) => void; // For live preview
  onAdvancedClick: () => void;
  anchorElement: HTMLElement | null;
  children: React.ReactNode; // The trigger button
}

export const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({
  isOpen,
  onClose,
  currentColor,
  onColorSelect,
  onColorPreview,
  onAdvancedClick,
  children,
}) => {
  const handleColorSelect = (color: string) => {
    onColorSelect(color);
    onClose(); // Auto-close after selection
  };

  const handleAdvancedClick = () => {
    onAdvancedClick();
    onClose(); // Close popover when opening advanced modal
  };

  const handleEscapeKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Popover.Trigger asChild>
        {children}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={cn(
            // Base popover styles with glassmorphism
            'z-50 rounded-lg border border-white/20 bg-white/80 backdrop-blur-md shadow-xl',
            'p-1 outline-none',
            
            // Animation
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2',
            'data-[side=left]:slide-in-from-right-2',
            'data-[side=right]:slide-in-from-left-2',
            'data-[side=top]:slide-in-from-bottom-2',
            
            // Responsive width
            'w-[280px] max-w-[90vw]'
          )}
          side="bottom"
          align="start"
          sideOffset={8}
          alignOffset={0}
          collisionPadding={16}
          avoidCollisions={true}
          onEscapeKeyDown={handleEscapeKeyDown}
          data-testid="color-picker-popover"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-white/10">
            <h3 className="text-sm font-medium text-gray-900">
              Choose a color
            </h3>
          </div>

          {/* Quick Color Palette */}
          <QuickColorPalette
            currentColor={currentColor}
            onColorSelect={handleColorSelect}
            onColorPreview={onColorPreview}
            className="py-2"
            testId="popover-color-palette"
          />

          {/* Custom Color Button */}
          <div className="px-3 py-2 border-t border-white/10">
            <button
              type="button"
              onClick={handleAdvancedClick}
              className={cn(
                'w-full px-3 py-2 text-sm text-gray-700 rounded-md',
                'hover:bg-white/50 hover:text-gray-900',
                'focus:outline-none focus:ring-2 focus:ring-blue-400/50',
                'transition-colors duration-200',
                'text-left'
              )}
              data-testid="custom-color-button"
            >
              Custom...
            </button>
          </div>

          {/* Popover Arrow */}
          <Popover.Arrow
            className="fill-white/80 drop-shadow-sm"
            width={12}
            height={6}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};