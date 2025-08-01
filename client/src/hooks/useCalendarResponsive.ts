/**
 * Hook for managing responsive behavior in the Weekly Calendar View
 */

import { useState, useEffect } from 'react';
import { CALENDAR_CONFIG } from '@shared/config/calendar-config';
import type { ViewportState } from '@/types/calendar';

export interface UseCalendarResponsiveReturn {
  viewportState: ViewportState;
  viewMode: 'full' | 'scroll' | 'pads';
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  currentPadIndex: number;
  setCurrentPadIndex: (index: number) => void;
  navigatePad: (direction: 'prev' | 'next') => void;
  canNavigatePad: (direction: 'prev' | 'next') => boolean;
}

export function useCalendarResponsive(): UseCalendarResponsiveReturn {
  const [viewportState, setViewportState] = useState<ViewportState>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    mode: 'full',
    orientation: 'landscape',
    touchDevice: false,
  });

  const [currentPadIndex, setCurrentPadIndex] = useState(0);

  // Determine view mode based on viewport width
  const getViewMode = (width: number): 'full' | 'scroll' | 'pads' => {
    if (width >= CALENDAR_CONFIG.BREAKPOINTS.FULL_VIEW) {
      return 'full';
    } else if (width >= CALENDAR_CONFIG.BREAKPOINTS.SCROLL_VIEW) {
      return 'scroll';
    } else {
      return 'pads';
    }
  };

  // Detect touch device
  const isTouchDevice = (): boolean => {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-ignore - for older browsers
      navigator.msMaxTouchPoints > 0
    );
  };

  // Handle viewport changes
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const mode = getViewMode(width);
      const orientation = width > height ? 'landscape' : 'portrait';
      const touchDevice = isTouchDevice();

      setViewportState({
        width,
        height,
        mode,
        orientation,
        touchDevice,
      });

      // Reset pad index when switching to non-pads mode
      if (mode !== 'pads') {
        setCurrentPadIndex(0);
      }
    };

    // Initial setup
    handleResize();

    // Listen for resize events
    window.addEventListener('resize', handleResize);
    
    // Listen for orientation changes on mobile
    window.addEventListener('orientationchange', () => {
      // Delay to allow orientation change to complete
      setTimeout(handleResize, 100);
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Pad navigation functions
  const navigatePad = (direction: 'prev' | 'next') => {
    if (viewportState.mode !== 'pads') return;

    const totalPads = 3; // Always 3 pads for weekly view
    
    if (direction === 'prev' && currentPadIndex > 0) {
      setCurrentPadIndex(currentPadIndex - 1);
    } else if (direction === 'next' && currentPadIndex < totalPads - 1) {
      setCurrentPadIndex(currentPadIndex + 1);
    }
  };

  const canNavigatePad = (direction: 'prev' | 'next'): boolean => {
    if (viewportState.mode !== 'pads') return false;

    const totalPads = 3;
    
    if (direction === 'prev') {
      return currentPadIndex > 0;
    } else {
      return currentPadIndex < totalPads - 1;
    }
  };

  // Derived state
  const viewMode = viewportState.mode;
  const isMobile = viewportState.width < CALENDAR_CONFIG.BREAKPOINTS.SCROLL_VIEW;
  const isTablet = viewportState.width >= CALENDAR_CONFIG.BREAKPOINTS.SCROLL_VIEW && 
                   viewportState.width < CALENDAR_CONFIG.BREAKPOINTS.FULL_VIEW;
  const isDesktop = viewportState.width >= CALENDAR_CONFIG.BREAKPOINTS.FULL_VIEW;

  return {
    viewportState,
    viewMode,
    isMobile,
    isTablet,
    isDesktop,
    currentPadIndex,
    setCurrentPadIndex,
    navigatePad,
    canNavigatePad,
  };
}