/**
 * Color validation and contrast calculation utilities
 * Following WCAG 2.1 AA standards for accessibility
 */

export interface ColorValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates HEX color format using regex pattern matching
 * @param color - Color string to validate (should be 7-character HEX format like #A2D2FF)
 * @returns Validation result with error message if invalid
 */
export function validateHexColor(color: string): ColorValidationResult {
  if (!color) {
    return { isValid: false, error: 'Color value is required' };
  }

  if (typeof color !== 'string') {
    return { isValid: false, error: 'Color must be a string' };
  }

  // First check for dangerous XSS patterns before format validation
  const dangerousPatterns = [
    /url\(/i,
    /javascript:/i,
    /expression\(/i,
    /import/i,
    /@import/i
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(color)) {
      return { isValid: false, error: 'Invalid color format detected' };
    }
  }

  // Check for exact 7-character HEX format: #RRGGBB
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  
  if (!hexRegex.test(color)) {
    return { isValid: false, error: 'Invalid HEX color format. Expected format: #RRGGBB' };
  }

  return { isValid: true };
}

/**
 * Converts HEX color to RGB values
 * @param hex - HEX color string (e.g., "#A2D2FF")
 * @returns RGB object with r, g, b values (0-255)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const validation = validateHexColor(hex);
  if (!validation.isValid) {
    return null;
  }

  const result = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Calculates relative luminance of a color according to WCAG 2.1
 * @param rgb - RGB color object
 * @returns Relative luminance value (0-1)
 */
function calculateRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
  // Convert RGB to sRGB
  const rsRGB = rgb.r / 255;
  const gsRGB = rgb.g / 255;
  const bsRGB = rgb.b / 255;

  // Apply gamma correction
  const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  // Calculate relative luminance using WCAG formula
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculates contrast ratio between two colors according to WCAG 2.1
 * @param color1 - First color in HEX format
 * @param color2 - Second color in HEX format
 * @returns Contrast ratio (1-21) or null if invalid colors
 */
export function calculateContrastRatio(color1: string, color2: string): number | null {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) {
    return null;
  }

  const luminance1 = calculateRelativeLuminance(rgb1);
  const luminance2 = calculateRelativeLuminance(rgb2);

  // WCAG contrast ratio formula: (L1 + 0.05) / (L2 + 0.05)
  // where L1 is the lighter color and L2 is the darker color
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determines optimal text color (black or white) based on background color
 * @param backgroundColor - Background color in HEX format
 * @returns Optimal text color in HEX format (#1F2937 for dark text, #F9FAFB for light text)
 */
export function getOptimalTextColor(backgroundColor: string): string | null {
  const validation = validateHexColor(backgroundColor);
  if (!validation.isValid) {
    return null;
  }

  const rgb = hexToRgb(backgroundColor);
  if (!rgb) {
    return null;
  }

  const luminance = calculateRelativeLuminance(rgb);
  
  // Use dark text on light backgrounds, light text on dark backgrounds
  // Threshold of 0.5 provides good contrast in most cases
  return luminance > 0.5 ? '#1F2937' : '#F9FAFB';
}

/**
 * Checks if contrast ratio meets WCAG 2.1 AA standards
 * @param backgroundColor - Background color in HEX format
 * @param textColor - Text color in HEX format (optional, will use optimal if not provided)
 * @returns Object with compliance status and contrast ratio
 */
export function checkContrastCompliance(
  backgroundColor: string, 
  textColor?: string
): { 
  isCompliant: boolean; 
  contrastRatio: number | null; 
  textColor: string | null;
  error?: string;
} {
  const validation = validateHexColor(backgroundColor);
  if (!validation.isValid) {
    return {
      isCompliant: false,
      contrastRatio: null,
      textColor: null,
      error: validation.error
    };
  }

  const finalTextColor = textColor || getOptimalTextColor(backgroundColor);
  if (!finalTextColor) {
    return {
      isCompliant: false,
      contrastRatio: null,
      textColor: null,
      error: 'Unable to determine optimal text color'
    };
  }

  if (textColor) {
    const textValidation = validateHexColor(textColor);
    if (!textValidation.isValid) {
      return {
        isCompliant: false,
        contrastRatio: null,
        textColor: null,
        error: `Invalid text color: ${textValidation.error}`
      };
    }
  }

  const contrastRatio = calculateContrastRatio(backgroundColor, finalTextColor);
  if (contrastRatio === null) {
    return {
      isCompliant: false,
      contrastRatio: null,
      textColor: finalTextColor,
      error: 'Unable to calculate contrast ratio'
    };
  }

  // WCAG 2.1 AA standard requires contrast ratio ≥ 4.5:1 for normal text
  const isCompliant = contrastRatio >= 4.5;

  return {
    isCompliant,
    contrastRatio,
    textColor: finalTextColor
  };
}

/**
 * Safely applies a color with error handling
 * @param color - Color to validate and apply
 * @param fallbackColor - Fallback color if validation fails
 * @returns Valid color or fallback
 */
export function safeColor(color: string | undefined, fallbackColor: string = '#F4F7FF'): string {
  if (!color) {
    return fallbackColor;
  }

  const validation = validateHexColor(color);
  return validation.isValid ? color : fallbackColor;
}

/**
 * Converts a hex color to rgba with specified opacity
 * @param hexColor - Hex color string (e.g., "#FF0000")
 * @param opacity - Opacity value between 0 and 1
 * @returns RGBA color string (e.g., "rgba(255, 0, 0, 0.2)")
 */
export function hexToRgba(hexColor: string, opacity: number): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Ensures a color string has proper opacity
 * Accepts both hex and rgba colors
 * @param color - Color string
 * @param opacity - Desired opacity (0-1)
 * @returns Color string with applied opacity
 */
export function applyOpacityToColor(color: string, opacity: number): string {
  if (color.startsWith('#')) {
    return hexToRgba(color, opacity);
  } else if (color.startsWith('rgb(')) {
    // Convert rgb to rgba
    return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
  } else if (color.startsWith('rgba(')) {
    // Replace existing opacity
    return color.replace(/,\s*[\d.]+\)$/, `, ${opacity})`);
  }
  
  // Fallback: treat as hex
  return hexToRgba(color, opacity);
}

/**
 * Normalizes event data to ensure all date properties are Date objects
 * @param event - Calendar event object
 * @returns Normalized event with proper Date objects
 */
export function normalizeEventDates<T extends { startTime: Date | string; endTime: Date | string }>(event: T): T {
  return {
    ...event,
    startTime: event.startTime instanceof Date ? event.startTime : new Date(event.startTime),
    endTime: event.endTime instanceof Date ? event.endTime : new Date(event.endTime)
  };
}