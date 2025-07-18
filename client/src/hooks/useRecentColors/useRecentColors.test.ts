import { renderHook, act } from '@testing-library/react';
import { useRecentColors } from './useRecentColors';
import { vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useRecentColors', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should initialize with empty recent colors', () => {
    const { result } = renderHook(() => useRecentColors());
    
    expect(result.current.recentColors).toEqual([]);
    expect(result.current.hasRecentColors).toBe(false);
  });

  it('should add a color to recent colors', () => {
    const { result } = renderHook(() => useRecentColors());
    
    act(() => {
      result.current.addRecentColor('#FF0000');
    });
    
    expect(result.current.recentColors).toEqual(['#FF0000']);
    expect(result.current.hasRecentColors).toBe(true);
  });

  it('should avoid duplicate colors and move existing color to front', () => {
    const { result } = renderHook(() => useRecentColors());
    
    act(() => {
      result.current.addRecentColor('#FF0000');
      result.current.addRecentColor('#00FF00');
      result.current.addRecentColor('#FF0000'); // Duplicate
    });
    
    expect(result.current.recentColors).toEqual(['#FF0000', '#00FF00']);
  });

  it('should limit recent colors to 5 items', () => {
    const { result } = renderHook(() => useRecentColors());
    
    act(() => {
      result.current.addRecentColor('#FF0000');
      result.current.addRecentColor('#00FF00');
      result.current.addRecentColor('#0000FF');
      result.current.addRecentColor('#FFFF00');
      result.current.addRecentColor('#FF00FF');
      result.current.addRecentColor('#00FFFF'); // 6th color, should remove oldest
    });
    
    expect(result.current.recentColors).toHaveLength(5);
    expect(result.current.recentColors).toEqual([
      '#00FFFF', '#FF00FF', '#FFFF00', '#0000FF', '#00FF00'
    ]);
    expect(result.current.recentColors).not.toContain('#FF0000'); // Oldest should be removed
  });

  it('should validate HEX color format', () => {
    const { result } = renderHook(() => useRecentColors());
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    act(() => {
      result.current.addRecentColor('invalid-color');
      result.current.addRecentColor('#FF'); // Too short
      result.current.addRecentColor('#GGGGGG'); // Invalid characters
    });
    
    expect(result.current.recentColors).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledTimes(3);
    
    consoleSpy.mockRestore();
  });

  it('should persist colors to localStorage', () => {
    const { result } = renderHook(() => useRecentColors());
    
    act(() => {
      result.current.addRecentColor('#FF0000');
    });
    
    const stored = localStorageMock.getItem('recent-note-colors');
    expect(stored).toBeTruthy();
    
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].hex).toBe('#FF0000');
    expect(typeof parsed[0].timestamp).toBe('number');
  });

  it('should load colors from localStorage on initialization', () => {
    // Pre-populate localStorage
    const testColors = [
      { hex: '#FF0000', timestamp: Date.now() - 1000 },
      { hex: '#00FF00', timestamp: Date.now() - 2000 },
    ];
    localStorageMock.setItem('recent-note-colors', JSON.stringify(testColors));
    
    const { result } = renderHook(() => useRecentColors());
    
    expect(result.current.recentColors).toEqual(['#FF0000', '#00FF00']);
    expect(result.current.hasRecentColors).toBe(true);
  });

  it('should handle corrupted localStorage data gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Set invalid JSON
    localStorageMock.setItem('recent-note-colors', 'invalid-json');
    
    const { result } = renderHook(() => useRecentColors());
    
    expect(result.current.recentColors).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    expect(localStorageMock.getItem('recent-note-colors')).toBeNull(); // Should be cleared
    
    consoleSpy.mockRestore();
  });

  it('should clear all recent colors', () => {
    const { result } = renderHook(() => useRecentColors());
    
    act(() => {
      result.current.addRecentColor('#FF0000');
      result.current.addRecentColor('#00FF00');
    });
    
    expect(result.current.recentColors).toHaveLength(2);
    
    act(() => {
      result.current.clearRecentColors();
    });
    
    expect(result.current.recentColors).toEqual([]);
    expect(result.current.hasRecentColors).toBe(false);
    expect(localStorageMock.getItem('recent-note-colors')).toBeNull();
  });
});