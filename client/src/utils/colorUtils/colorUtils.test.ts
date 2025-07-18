import { describe, it, expect } from 'vitest';
import {
  validateHexColor,
  hexToRgb,
  calculateContrastRatio,
  getOptimalTextColor,
  checkContrastCompliance,
  safeColor
} from './colorUtils';

describe('Color Validation Utilities', () => {
  describe('validateHexColor', () => {
    it('should validate correct HEX colors', () => {
      const validColors = [
        '#000000',
        '#FFFFFF',
        '#A2D2FF',
        '#123456',
        '#abcdef',
        '#F4F7FF'
      ];

      validColors.forEach(color => {
        const result = validateHexColor(color);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid HEX color formats', () => {
      const invalidColors = [
        '',
        '#',
        '#12',
        '#1234',
        '#12345',
        '#1234567',
        '123456',
        '#GGGGGG',
        '#12345G',
        'red',
        'rgb(255,0,0)',
        null,
        undefined
      ];

      invalidColors.forEach(color => {
        const result = validateHexColor(color as any);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject dangerous XSS patterns', () => {
      const dangerousPatterns = [
        '#123456url(javascript:alert(1))',
        '#ABCDEFjavascript:void(0)',
        '#000000expression(alert(1))',
        '#FFFFFFimport',
        '#123456@import'
      ];

      dangerousPatterns.forEach(color => {
        const result = validateHexColor(color);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid color format detected');
      });
    });

    it('should handle non-string inputs', () => {
      // Test different types of non-string inputs
      const testCases = [
        { input: 123, expectedError: 'Color must be a string' },
        { input: {}, expectedError: 'Color must be a string' },
        { input: [], expectedError: 'Color must be a string' },
        { input: true, expectedError: 'Color must be a string' },
        { input: false, expectedError: 'Color value is required' }, // false is falsy
        { input: null, expectedError: 'Color value is required' },
        { input: undefined, expectedError: 'Color value is required' }
      ];

      testCases.forEach(({ input, expectedError }) => {
        const result = validateHexColor(input as any);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe(expectedError);
      });
    });
  });

  describe('hexToRgb', () => {
    it('should convert valid HEX colors to RGB', () => {
      const testCases = [
        { hex: '#000000', expected: { r: 0, g: 0, b: 0 } },
        { hex: '#FFFFFF', expected: { r: 255, g: 255, b: 255 } },
        { hex: '#FF0000', expected: { r: 255, g: 0, b: 0 } },
        { hex: '#00FF00', expected: { r: 0, g: 255, b: 0 } },
        { hex: '#0000FF', expected: { r: 0, g: 0, b: 255 } },
        { hex: '#A2D2FF', expected: { r: 162, g: 210, b: 255 } },
        { hex: '#abcdef', expected: { r: 171, g: 205, b: 239 } }
      ];

      testCases.forEach(({ hex, expected }) => {
        const result = hexToRgb(hex);
        expect(result).toEqual(expected);
      });
    });

    it('should return null for invalid HEX colors', () => {
      const invalidColors = ['#GGG', '#12345', 'red', ''];

      invalidColors.forEach(color => {
        const result = hexToRgb(color);
        expect(result).toBeNull();
      });
    });
  });

  describe('calculateContrastRatio', () => {
    it('should calculate correct contrast ratios for known color pairs', () => {
      const testCases = [
        // Black on white should be maximum contrast (21:1)
        { color1: '#000000', color2: '#FFFFFF', expectedMin: 20.9, expectedMax: 21.1 },
        // White on black should be the same
        { color1: '#FFFFFF', color2: '#000000', expectedMin: 20.9, expectedMax: 21.1 },
        // Same colors should have 1:1 contrast
        { color1: '#FF0000', color2: '#FF0000', expectedMin: 0.9, expectedMax: 1.1 },
        // Gray combinations
        { color1: '#808080', color2: '#FFFFFF', expectedMin: 3.9, expectedMax: 4.1 },
      ];

      testCases.forEach(({ color1, color2, expectedMin, expectedMax }) => {
        const ratio = calculateContrastRatio(color1, color2);
        expect(ratio).not.toBeNull();
        expect(ratio!).toBeGreaterThanOrEqual(expectedMin);
        expect(ratio!).toBeLessThanOrEqual(expectedMax);
      });
    });

    it('should return null for invalid colors', () => {
      const invalidPairs = [
        ['#INVALID', '#FFFFFF'],
        ['#000000', '#INVALID'],
        ['#INVALID', '#INVALID']
      ];

      invalidPairs.forEach(([color1, color2]) => {
        const ratio = calculateContrastRatio(color1, color2);
        expect(ratio).toBeNull();
      });
    });

    it('should be symmetric (order should not matter)', () => {
      const color1 = '#A2D2FF';
      const color2 = '#1F2937';
      
      const ratio1 = calculateContrastRatio(color1, color2);
      const ratio2 = calculateContrastRatio(color2, color1);
      
      expect(ratio1).toEqual(ratio2);
    });
  });

  describe('getOptimalTextColor', () => {
    it('should return dark text for light backgrounds', () => {
      const lightBackgrounds = [
        '#FFFFFF', // Pure white
        '#F4F7FF', // Very light blue
        '#FEF3C7', // Light yellow
        '#FCE7F3', // Light pink
        '#D1FAE5'  // Light green
      ];

      lightBackgrounds.forEach(bg => {
        const textColor = getOptimalTextColor(bg);
        expect(textColor).toBe('#1F2937'); // Dark text
      });
    });

    it('should return light text for dark backgrounds', () => {
      const darkBackgrounds = [
        '#000000', // Pure black
        '#1F2937', // Dark gray
        '#374151', // Medium dark gray
        '#111827'  // Very dark gray
      ];

      darkBackgrounds.forEach(bg => {
        const textColor = getOptimalTextColor(bg);
        expect(textColor).toBe('#F9FAFB'); // Light text
      });
    });

    it('should return null for invalid colors', () => {
      const invalidColors = ['#INVALID', '', '#12345'];

      invalidColors.forEach(color => {
        const result = getOptimalTextColor(color);
        expect(result).toBeNull();
      });
    });
  });

  describe('checkContrastCompliance', () => {
    it('should check WCAG 2.1 AA compliance (≥4.5:1)', () => {
      const testCases = [
        // High contrast pairs (should be compliant)
        { bg: '#FFFFFF', text: '#000000', shouldBeCompliant: true },
        { bg: '#000000', text: '#FFFFFF', shouldBeCompliant: true },
        
        // Medium contrast pairs (should be compliant)
        { bg: '#F4F7FF', shouldBeCompliant: true }, // Light bg with optimal text
        
        // Low contrast pairs would need specific testing with known ratios
      ];

      testCases.forEach(({ bg, text, shouldBeCompliant }) => {
        const result = checkContrastCompliance(bg, text);
        
        expect(result.error).toBeUndefined();
        expect(result.contrastRatio).not.toBeNull();
        expect(result.textColor).not.toBeNull();
        expect(result.isCompliant).toBe(shouldBeCompliant);
        
        if (result.contrastRatio) {
          if (shouldBeCompliant) {
            expect(result.contrastRatio).toBeGreaterThanOrEqual(4.5);
          }
        }
      });
    });

    it('should use optimal text color when none provided', () => {
      const result = checkContrastCompliance('#FFFFFF');
      
      expect(result.textColor).toBe('#1F2937'); // Dark text for white background
      expect(result.contrastRatio).not.toBeNull();
      expect(result.isCompliant).toBe(true);
    });

    it('should handle invalid background colors', () => {
      const result = checkContrastCompliance('#INVALID');
      
      expect(result.isCompliant).toBe(false);
      expect(result.contrastRatio).toBeNull();
      expect(result.textColor).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should handle invalid text colors', () => {
      const result = checkContrastCompliance('#FFFFFF', '#INVALID');
      
      expect(result.isCompliant).toBe(false);
      expect(result.contrastRatio).toBeNull();
      expect(result.textColor).toBeNull();
      expect(result.error).toContain('Invalid text color');
    });
  });

  describe('safeColor', () => {
    it('should return valid colors unchanged', () => {
      const validColors = ['#FFFFFF', '#000000', '#A2D2FF'];
      
      validColors.forEach(color => {
        const result = safeColor(color);
        expect(result).toBe(color);
      });
    });

    it('should return fallback for invalid colors', () => {
      const invalidColors = ['#INVALID', '', '#12345'];
      const fallback = '#123456';
      
      invalidColors.forEach(color => {
        const result = safeColor(color, fallback);
        expect(result).toBe(fallback);
      });
    });

    it('should return default fallback when no fallback provided', () => {
      const result = safeColor('#INVALID');
      expect(result).toBe('#F4F7FF');
    });

    it('should handle undefined input', () => {
      const result = safeColor(undefined);
      expect(result).toBe('#F4F7FF');
    });
  });
});

describe('WCAG 2.1 AA Compliance Tests', () => {
  it('should meet contrast requirements for theme colors', () => {
    // Test the theme colors from the design document
    const themeColors = [
      '#F4F7FF', // Default
      '#FEF3C7', // Soft Yellow
      '#FCE7F3', // Rose Pink
      '#DBEAFE', // Sky Blue
      '#D1FAE5', // Mint Green
      '#E9D5FF', // Lavender
      '#FED7AA', // Peach
      '#FECACA', // Coral
      '#CFFAFE', // Sage
      '#C7D2FE'  // Periwinkle
    ];

    themeColors.forEach(color => {
      const compliance = checkContrastCompliance(color);
      
      expect(compliance.error).toBeUndefined();
      expect(compliance.contrastRatio).not.toBeNull();
      expect(compliance.contrastRatio!).toBeGreaterThanOrEqual(4.5);
      expect(compliance.isCompliant).toBe(true);
    });
  });

  it('should calculate accurate contrast ratios for edge cases', () => {
    // Test some specific contrast ratios that are known
    const testCases = [
      // Just above WCAG AA threshold
      { bg: '#767676', text: '#FFFFFF', minRatio: 4.5 },
      // Just below WCAG AA threshold  
      { bg: '#777777', text: '#FFFFFF', maxRatio: 4.5 }
    ];

    testCases.forEach(({ bg, text, minRatio, maxRatio }) => {
      const ratio = calculateContrastRatio(bg, text);
      expect(ratio).not.toBeNull();
      
      if (minRatio) {
        expect(ratio!).toBeGreaterThanOrEqual(minRatio);
      }
      if (maxRatio) {
        expect(ratio!).toBeLessThanOrEqual(maxRatio);
      }
    });
  });
});