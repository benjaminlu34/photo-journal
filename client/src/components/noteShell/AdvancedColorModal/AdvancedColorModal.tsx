import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { X, AlertTriangle, Check, Palette } from 'lucide-react';
import { validateHexColor, checkContrastCompliance } from '@/utils/colorUtils/colorUtils';

// Lazy load the color wheel to minimize initial bundle size
const ColorWheelPicker = lazy(() => 
  import('../ColorWheelPicker/ColorWheelPicker').then(module => ({ default: module.ColorWheelPicker }))
);

interface AdvancedColorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor?: string;
  onColorSelect: (color: string) => void;
  onColorPreview?: (color: string | null) => void;
}

export const AdvancedColorModal: React.FC<AdvancedColorModalProps> = ({
  isOpen,
  onClose,
  currentColor = '#F4F7FF',
  onColorSelect,
  onColorPreview,
}) => {
  const [hexInput, setHexInput] = useState(currentColor);
  const [isValidColor, setIsValidColor] = useState(true);
  const [validationError, setValidationError] = useState<string>('');
  const [contrastInfo, setContrastInfo] = useState<{
    isCompliant: boolean;
    contrastRatio: number | null;
    textColor: string | null;
    error?: string;
  } | null>(null);
  const [showColorWheel, setShowColorWheel] = useState(false);

  // Update hex input when currentColor changes
  useEffect(() => {
    if (currentColor) {
      setHexInput(currentColor);
    }
  }, [currentColor]);

  // Validate color and check contrast whenever hexInput changes
  useEffect(() => {
    const validation = validateHexColor(hexInput);
    setIsValidColor(validation.isValid);
    setValidationError(validation.error || '');

    if (validation.isValid) {
      const contrast = checkContrastCompliance(hexInput);
      setContrastInfo(contrast);
      
      // Provide live preview for valid colors
      onColorPreview?.(hexInput);
    } else {
      setContrastInfo(null);
      onColorPreview?.(null);
    }
  }, [hexInput, onColorPreview]);

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Auto-add # if not present
    if (value && !value.startsWith('#')) {
      value = '#' + value;
    }
    
    // Limit to 7 characters (#RRGGBB)
    if (value.length > 7) {
      value = value.slice(0, 7);
    }
    
    // Convert to uppercase for consistency
    value = value.toUpperCase();
    
    setHexInput(value);
  };

  const handleApplyColor = () => {
    if (isValidColor && hexInput) {
      onColorSelect(hexInput);
      onClose();
    }
  };

  const handleCancel = () => {
    // Clear preview and reset to current color
    onColorPreview?.(null);
    setHexInput(currentColor);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValidColor) {
      e.preventDefault();
      handleApplyColor();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // Clear preview when modal closes
  useEffect(() => {
    if (!isOpen) {
      onColorPreview?.(null);
    }
  }, [isOpen, onColorPreview]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
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
            // Modal positioning - centered on desktop, bottom sheet on mobile
            'fixed z-50 w-full max-w-md mx-auto',
            'sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
            'bottom-0 sm:bottom-auto', // Bottom sheet on mobile
            
            // Styling with glassmorphism
            'bg-white/90 backdrop-blur-md border border-white/20 shadow-xl',
            'rounded-t-xl sm:rounded-xl',
            
            // Animation
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%]',
            'sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]',
            'data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full',
            'sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0',
            
            // Responsive padding
            'p-6 sm:p-8'
          )}
          onKeyDown={handleKeyDown}
          data-testid="advanced-color-modal"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Custom Color
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                onClick={handleCancel}
                className={cn(
                  'rounded-full p-2 text-gray-500 hover:text-gray-700',
                  'hover:bg-white/50 transition-colors duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400/50'
                )}
                aria-label="Close"
                data-testid="close-advanced-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Color Preview */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color Preview
            </label>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-lg border-2 border-white/20 shadow-sm"
                style={{
                  backgroundColor: isValidColor ? hexInput : '#F3F4F6',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                }}
                data-testid="color-preview"
              />
              <div className="flex-1">
                <div className="text-sm text-gray-600">
                  {isValidColor ? hexInput : 'Invalid color'}
                </div>
                {contrastInfo?.textColor && (
                  <div 
                    className="text-xs mt-1 px-2 py-1 rounded"
                    style={{
                      backgroundColor: hexInput,
                      color: contrastInfo.textColor,
                    }}
                  >
                    Sample text
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* HEX Input */}
          <div className="mb-6">
            <label 
              htmlFor="hex-input" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              HEX Color Code
            </label>
            <input
              id="hex-input"
              type="text"
              value={hexInput}
              onChange={handleHexInputChange}
              placeholder="#RRGGBB"
              className={cn(
                'w-full px-3 py-2 border rounded-md text-sm font-mono',
                'focus:outline-none focus:ring-2 focus:ring-blue-400/50',
                'transition-colors duration-200',
                isValidColor 
                  ? 'border-gray-300 focus:border-blue-400' 
                  : 'border-red-300 focus:border-red-400 bg-red-50'
              )}
              data-testid="hex-input"
              autoComplete="off"
              spellCheck={false}
            />
            {!isValidColor && validationError && (
              <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span data-testid="validation-error">{validationError}</span>
              </div>
            )}
          </div>

          {/* Color Wheel Toggle */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowColorWheel(!showColorWheel)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md',
                'border border-gray-300 hover:bg-gray-50',
                'focus:outline-none focus:ring-2 focus:ring-blue-400/50',
                'transition-colors duration-200',
                showColorWheel && 'bg-blue-50 border-blue-300 text-blue-700'
              )}
              data-testid="color-wheel-toggle"
            >
              <Palette className="w-4 h-4" />
              {showColorWheel ? 'Hide Color Wheel' : 'Show Color Wheel'}
            </button>
          </div>

          {/* Color Wheel Picker (Lazy Loaded) */}
          {showColorWheel && (
            <div className="mb-6 p-4 rounded-lg bg-gray-50/50 border border-gray-200/50">
              <h4 className="text-sm font-medium text-gray-700 mb-4">
                Visual Color Picker
              </h4>
              <div className="flex justify-center">
                <Suspense 
                  fallback={
                    <div className="flex items-center justify-center w-48 h-48 rounded-full bg-gray-100 border-2 border-gray-200">
                      <div className="text-sm text-gray-500">Loading color wheel...</div>
                    </div>
                  }
                >
                  <ColorWheelPicker
                    currentColor={hexInput}
                    onColorSelect={(color) => {
                      setHexInput(color);
                    }}
                    onColorPreview={onColorPreview}
                    size={180}
                    data-testid="color-wheel-picker"
                  />
                </Suspense>
              </div>
              <div className="mt-3 text-xs text-gray-600 text-center">
                Click and drag on the wheel to select a color, or use arrow keys for precise control.
              </div>
            </div>
          )}

          {/* Contrast Information */}
          {contrastInfo && (
            <div className="mb-6 p-4 rounded-lg bg-gray-50/50 border border-gray-200/50">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Accessibility Check
              </h4>
              <div className="flex items-center gap-2 text-sm">
                {contrastInfo.isCompliant ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-green-700">
                      WCAG AA Compliant
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-amber-700">
                      Low contrast warning
                    </span>
                  </>
                )}
                {contrastInfo.contrastRatio && (
                  <span className="text-gray-600 ml-auto">
                    Ratio: {contrastInfo.contrastRatio.toFixed(2)}:1
                  </span>
                )}
              </div>
              {!contrastInfo.isCompliant && (
                <div className="mt-2 text-xs text-gray-600">
                  For better accessibility, choose a color with higher contrast.
                  WCAG AA requires a ratio of at least 4.5:1.
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className={cn(
                'px-4 py-2 text-sm font-medium text-gray-700 rounded-md',
                'hover:bg-white/50 hover:text-gray-900',
                'focus:outline-none focus:ring-2 focus:ring-blue-400/50',
                'transition-colors duration-200'
              )}
              data-testid="cancel-button"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyColor}
              disabled={!isValidColor}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-md',
                'focus:outline-none focus:ring-2 focus:ring-blue-400/50',
                'transition-colors duration-200',
                isValidColor
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              )}
              data-testid="apply-button"
            >
              Apply Color
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};