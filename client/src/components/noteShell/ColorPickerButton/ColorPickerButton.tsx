import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useColorPickerStrategy } from '@/hooks/useColorPickerStrategy';
import { useRecentColors } from '@/hooks/useRecentColors/useRecentColors';
import { AdvancedColorModal } from '../AdvancedColorModal/AdvancedColorModal';

interface ColorPickerButtonProps {
    currentColor?: string;
    onColorChange: (color: string) => void;
    onColorPreview?: (color: string | null) => void; // For live preview
    disabled?: boolean;
    testId?: string;
}

export const ColorPickerButton: React.FC<ColorPickerButtonProps> = ({
    currentColor = '#F4F7FF', // Default theme color
    onColorChange,
    onColorPreview,
    disabled = false,
    testId = 'color-picker-button',
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
    const { Component: ColorPickerComponent, isMobile } = useColorPickerStrategy();
    const { addRecentColor } = useRecentColors();

    const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (disabled) return;

        setIsPickerOpen(true);
    };

    const handleColorSelect = (color: string) => {
        // Add color to recent colors when selected from any source
        addRecentColor(color);
        onColorChange(color);
    };

    const handleColorPreview = (color: string | null) => {
        onColorPreview?.(color);
    };

    const handleAdvancedClick = () => {
        setIsAdvancedModalOpen(true);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        // Prevent touch from triggering drag on mobile
        e.stopPropagation();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            handleClick(e as any);
        }
    };

    return (
        <>
            <ColorPickerComponent
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                currentColor={currentColor}
                onColorSelect={handleColorSelect}
                onColorPreview={handleColorPreview}
                onAdvancedClick={handleAdvancedClick}
                anchorElement={null} // Radix handles this automatically with the trigger
            >
                <button
                    type="button"
                    onClick={handleClick}
                    onTouchStart={handleTouchStart}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    disabled={disabled}
                    data-testid={testId}
                    data-drag-ignore // Prevent drag when clicking this button
                    className={cn(
                        // Base styles - larger touch area for mobile accessibility
                        'relative min-h-[44px] min-w-[44px] flex items-center justify-center',
                        'rounded-full transition-all duration-200 touch-manipulation',

                        // Interactive states
                        !disabled && [
                            'hover:scale-110',
                            'active:scale-95',
                            'cursor-pointer',
                        ],

                        // Focus states for accessibility
                        isFocused && [
                            'ring-2 ring-blue-400/50 ring-offset-1 ring-offset-white/20',
                            'outline-none',
                        ],

                        // Disabled state
                        disabled && [
                            'opacity-50 cursor-not-allowed',
                        ],
                    )}
                    aria-label={`Change note color. Current color: ${currentColor}`}
                    aria-describedby="color-picker-description"
                    title={`Current color: ${currentColor}`}
                >
                    {/* Visual color circle - subtle and integrated */}
                    <div
                        className="w-5 h-5 rounded-full shadow-sm backdrop-blur-sm border border-white/10"
                        style={{
                            backgroundColor: currentColor,
                            boxShadow: `0 1px 3px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                        }}
                    />

                    {/* Hidden description for screen readers */}
                    <span id="color-picker-description" className="sr-only">
                        Click to open color picker and change the background color of this note
                    </span>
                </button>
            </ColorPickerComponent>

            {/* Advanced Color Modal */}
            <AdvancedColorModal
                isOpen={isAdvancedModalOpen}
                onClose={() => setIsAdvancedModalOpen(false)}
                currentColor={currentColor}
                onColorSelect={handleColorSelect}
                onColorPreview={handleColorPreview}
            />
        </>
    );
};