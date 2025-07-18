import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { QuickColorPalette } from '../QuickColorPalette/QuickColorPalette';
import { X } from 'lucide-react';

interface MobileColorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor?: string;
  onColorSelect: (color: string) => void;
  onColorPreview?: (color: string | null) => void;
  onAdvancedClick: () => void;
  children: React.ReactNode; // The trigger button
}

export const MobileColorSheet: React.FC<MobileColorSheetProps> = ({
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
    onClose(); // Close sheet when opening advanced modal
  };

  // Handle swipe-to-dismiss gesture
  const handlePointerDown = (e: React.PointerEvent) => {
    const startY = e.clientY;
    const startTime = Date.now();
    
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaTime = Date.now() - startTime;
      
      // If swiping down quickly (velocity > 0.5px/ms) and distance > 50px, close
      if (deltaY > 50 && deltaTime > 0 && deltaY / deltaTime > 0.5) {
        onClose();
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      }
    };
    
    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
    
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Trigger asChild>
        {children}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay 
          className={cn(
            'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />
        
        <Dialog.Content
          className={cn(
            // Bottom sheet positioning
            'fixed bottom-0 left-0 right-0 z-50',
            'max-h-[85vh] overflow-hidden',
            
            // Glassmorphism styling
            'bg-white/90 backdrop-blur-md border-t border-white/20',
            'rounded-t-2xl shadow-2xl',
            
            // Animation
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:slide-out-to-bottom-1/2 data-[state=open]:slide-in-from-bottom-1/2',
            
            // Touch optimization
            'touch-manipulation'
          )}
          onPointerDown={handlePointerDown}
          data-testid="mobile-color-sheet"
        >
          {/* Drag handle for visual feedback */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-gray-900">
              Choose a color
            </h2>
            <Dialog.Close asChild>
              <button
                type="button"
                className={cn(
                  'p-2 rounded-full transition-colors duration-200',
                  'hover:bg-white/50 active:bg-white/70',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400/50',
                  // Large touch target for mobile
                  'min-h-[44px] min-w-[44px] flex items-center justify-center'
                )}
                aria-label="Close color picker"
                data-testid="close-color-sheet"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content area with scroll */}
          <div className="overflow-y-auto max-h-[60vh] pb-safe">
            {/* Current color display */}
            {currentColor && (
              <div className="px-6 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white/20 shadow-sm"
                    style={{ backgroundColor: currentColor }}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Current color</p>
                    <p className="text-xs text-gray-600">{currentColor}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Color Palette - optimized for mobile */}
            <div className="px-6 py-4">
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Quick colors
              </h3>
              <QuickColorPalette
                currentColor={currentColor}
                onColorSelect={handleColorSelect}
                onColorPreview={onColorPreview}
                className={cn(
                  // Mobile-optimized grid with larger touch targets
                  'grid grid-cols-5 gap-4',
                  // Ensure minimum touch target size
                  '[&_button]:min-h-[48px] [&_button]:min-w-[48px]',
                  '[&_button]:w-12 [&_button]:h-12'
                )}
                testId="mobile-color-palette"
              />
            </div>

            {/* Custom Color Button */}
            <div className="px-6 py-4 border-t border-white/10">
              <button
                type="button"
                onClick={handleAdvancedClick}
                className={cn(
                  // Full-width button with large touch target
                  'w-full min-h-[48px] px-4 py-3 text-left',
                  'bg-white/50 hover:bg-white/70 active:bg-white/80',
                  'border border-white/20 rounded-lg',
                  'text-gray-900 font-medium',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400/50',
                  'transition-colors duration-200',
                  'touch-manipulation'
                )}
                data-testid="mobile-custom-color-button"
              >
                <div className="flex items-center justify-between">
                  <span>Custom color...</span>
                  <span className="text-gray-500 text-sm">HEX input</span>
                </div>
              </button>
            </div>

            {/* Bottom padding for safe area */}
            <div className="h-4" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};