import { useState, useEffect } from 'react';
import { ColorPickerPopover } from '@/components/noteShell/ColorPickerPopover/ColorPickerPopover';
import { MobileColorSheet } from '@/components/noteShell/MobileColorSheet/MobileColorSheet';

// Breakpoint for color picker mobile vs desktop (640px as per design spec)
const COLOR_PICKER_MOBILE_BREAKPOINT = 640;

export interface ColorPickerStrategy {
  /** The component to use for the color picker interface */
  Component: typeof ColorPickerPopover | typeof MobileColorSheet;
  /** Whether the current device/screen should use mobile interface */
  isMobile: boolean;
  /** The interaction mode for triggering the color picker */
  triggerMode: 'header-button' | 'context-menu';
  /** The positioning strategy for the color picker */
  positioning: 'popover-anchored' | 'bottom-sheet';
}

/**
 * Hook to determine the appropriate color picker strategy based on device capabilities
 * and screen size. Switches between desktop popover and mobile bottom sheet interfaces.
 * 
 * @returns ColorPickerStrategy object with component and configuration
 */
export const useColorPickerStrategy = (): ColorPickerStrategy => {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobileStrategy = (): void => {
      // Check for touch capability
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Check screen size (using color picker specific breakpoint)
      const isSmallScreen = window.innerWidth < COLOR_PICKER_MOBILE_BREAKPOINT;
      
      // Use mobile interface if either touch device OR small screen
      const shouldUseMobile = isTouchDevice || isSmallScreen;
      
      setIsMobile(shouldUseMobile);
    };

    // Initial check
    checkMobileStrategy();

    // Add resize listener with debouncing for performance
    let timeoutId: NodeJS.Timeout;
    const debouncedCheck = (): void => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        requestAnimationFrame(checkMobileStrategy);
      }, 100); // 100ms debounce
    };

    window.addEventListener('resize', debouncedCheck, { passive: true });

    return () => {
      window.removeEventListener('resize', debouncedCheck);
      clearTimeout(timeoutId);
    };
  }, []);

  return {
    Component: isMobile ? MobileColorSheet : ColorPickerPopover,
    isMobile,
    triggerMode: isMobile ? 'context-menu' : 'header-button',
    positioning: isMobile ? 'bottom-sheet' : 'popover-anchored'
  };
};

/**
 * Hook for media query detection specifically for color picker breakpoint
 * Can be used for CSS-in-JS or conditional rendering based on screen size only
 * 
 * @returns boolean indicating if screen is below mobile breakpoint
 */
export const useColorPickerMediaQuery = (): boolean => {
  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${COLOR_PICKER_MOBILE_BREAKPOINT - 1}px)`);
    
    const handleChange = (e: MediaQueryListEvent): void => {
      setIsSmallScreen(e.matches);
    };

    // Initial check
    setIsSmallScreen(mediaQuery.matches);

    // Modern browsers support addEventListener on MediaQueryList
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return isSmallScreen;
};