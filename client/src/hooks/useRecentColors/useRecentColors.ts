import { useState, useCallback, useEffect } from 'react';

const RECENT_COLORS_KEY = 'recent-note-colors';
const MAX_RECENT_COLORS = 5;

export interface RecentColor {
  hex: string;
  timestamp: number;
}

export const useRecentColors = () => {
  const [recentColors, setRecentColors] = useState<RecentColor[]>([]);

  // Load recent colors from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_COLORS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentColor[];
        // Validate the data structure
        const validColors = parsed.filter(
          (color): color is RecentColor => 
            typeof color === 'object' &&
            typeof color.hex === 'string' &&
            typeof color.timestamp === 'number' &&
            /^#[0-9A-Fa-f]{6}$/.test(color.hex)
        );
        setRecentColors(validColors);
      }
    } catch (error) {
      console.warn('Failed to load recent colors from localStorage:', error);
      // Clear corrupted data
      localStorage.removeItem(RECENT_COLORS_KEY);
    }
  }, []);

  // Save recent colors to localStorage whenever they change
  const saveToStorage = useCallback((colors: RecentColor[]) => {
    try {
      localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(colors));
    } catch (error) {
      console.warn('Failed to save recent colors to localStorage:', error);
    }
  }, []);

  // Add a color to recent colors list
  const addRecentColor = useCallback((hex: string) => {
    // Validate HEX format
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      console.warn('Invalid HEX color format:', hex);
      return;
    }

    setRecentColors(prev => {
      // Remove existing instance of this color
      const filtered = prev.filter(color => color.hex !== hex);
      
      // Add new color at the beginning
      const newColors = [
        { hex, timestamp: Date.now() },
        ...filtered
      ].slice(0, MAX_RECENT_COLORS); // Keep only the most recent colors
      
      // Save to localStorage
      saveToStorage(newColors);
      
      return newColors;
    });
  }, [saveToStorage]);

  // Clear all recent colors
  const clearRecentColors = useCallback(() => {
    setRecentColors([]);
    try {
      localStorage.removeItem(RECENT_COLORS_KEY);
    } catch (error) {
      console.warn('Failed to clear recent colors from localStorage:', error);
    }
  }, []);

  // Get recent colors as hex strings only (for easier consumption)
  const recentColorHexes = recentColors.map(color => color.hex);

  return {
    recentColors: recentColorHexes,
    addRecentColor,
    clearRecentColors,
    hasRecentColors: recentColors.length > 0,
  };
};