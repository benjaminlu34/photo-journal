'use client';

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768; // px

export const useMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = (): void => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(isTouchDevice || isSmallScreen);
    };

    // Initial check
    checkMobile();

    // Add event listener with proper cleanup
    const debouncedCheckMobile = (): void => {
      requestAnimationFrame(checkMobile);
    };

    window.addEventListener('resize', debouncedCheckMobile, { passive: true });

    return () => {
      window.removeEventListener('resize', debouncedCheckMobile);
    };
  }, []);

  return isMobile;
}; 