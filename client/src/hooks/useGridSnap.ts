import { useState, useCallback } from 'react';
import { snapToGrid } from '@/utils/snapToGrid';

export interface UseGridSnapReturn {
  gridSnap: boolean;
  setGridSnap: (enabled: boolean) => void;
  snapPosition: (x: number, y: number) => { x: number; y: number };
  snapSize: (width: number, height: number) => { width: number; height: number };
}

export function useGridSnap(initialSnap: boolean = false): UseGridSnapReturn {
  const [gridSnap, setGridSnap] = useState(initialSnap);

  const snapPosition = useCallback((x: number, y: number) => {
    if (!gridSnap) return { x, y };
    return {
      x: snapToGrid(x),
      y: snapToGrid(y),
    };
  }, [gridSnap]);

  const snapSize = useCallback((width: number, height: number) => {
    if (!gridSnap) return { width, height };
    return {
      width: snapToGrid(width),
      height: snapToGrid(height),
    };
  }, [gridSnap]);

  return {
    gridSnap,
    setGridSnap,
    snapPosition,
    snapSize,
  };
}