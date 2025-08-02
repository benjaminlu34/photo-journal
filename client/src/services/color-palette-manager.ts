/**
 * ColorPaletteManager - Manages distinct color assignment for calendar feeds and friends
 * Ensures good contrast and accessibility while avoiding color collisions
 */

import { validateHexColor, checkContrastCompliance } from '@/utils/colorUtils/colorUtils';

export interface ColorAssignment {
  color: string;
  pattern?: 'stripe' | 'dot' | 'plain';
  wcagRating: 'AA' | 'AAA';
}

export class ColorPaletteManager {
  private static instance: ColorPaletteManager;

  // Predefined palette with good contrast and accessibility
  public readonly CALENDAR_COLORS: readonly string[] = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#EC4899', // Pink
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#A855F7', // Purple
    '#22C55E', // Green
    '#F43F5E', // Rose
    '#0EA5E9', // Sky
    '#65A30D', // Green-600
    '#DC2626', // Red-600
    '#7C3AED', // Violet-600
    '#059669', // Emerald-600
    '#D97706', // Amber-600
  ] as const;

  private usedColors: Set<string> = new Set();
  private colorIndex: number = 0;

  private constructor() {}

  public static getInstance(): ColorPaletteManager {
    if (!ColorPaletteManager.instance) {
      ColorPaletteManager.instance = new ColorPaletteManager();
    }
    return ColorPaletteManager.instance;
  }

  /**
   * Get the next available color from the palette
   * @param existingColors - Array of colors already in use
   * @returns Next color (distinct if available, otherwise reused from palette)
   */
  public getNextColor(existingColors: string[] = []): string {
    // Update internal tracking with existing colors
    existingColors.forEach(color => this.usedColors.add(color.toLowerCase()));

    // Find next unused color from palette
    let attempts = 0;
    while (attempts < this.CALENDAR_COLORS.length * 2) {
      const color = this.CALENDAR_COLORS[this.colorIndex % this.CALENDAR_COLORS.length];
      this.colorIndex++;

      if (!this.usedColors.has(color.toLowerCase())) {
        this.usedColors.add(color.toLowerCase());
        return color;
      }
      attempts++;
    }

    // If all colors are used, cycle back through the palette
    const baseColor = this.CALENDAR_COLORS[this.colorIndex % this.CALENDAR_COLORS.length];
    this.colorIndex++;
    return baseColor;
  }

  /**
   * Get the next available distinct color assignment with pattern variants
   * @param existingAssignments - Array of existing color assignments
   * @returns Next distinct color assignment (with pattern if colors are exhausted)
   */
  public getNextDistinctColorAssignment(existingAssignments: ColorAssignment[] = []): ColorAssignment {
    const usedColors = existingAssignments.map(a => a.color.toLowerCase());
    const usedPatterns = new Map<string, Set<string>>();
    
    // Track which patterns are used for each color
    existingAssignments.forEach(assignment => {
      const colorKey = assignment.color.toLowerCase();
      if (!usedPatterns.has(colorKey)) {
        usedPatterns.set(colorKey, new Set());
      }
      usedPatterns.get(colorKey)!.add(assignment.pattern || 'plain');
    });

    // Try to find an unused color first
    for (const color of this.CALENDAR_COLORS) {
      if (!usedColors.includes(color.toLowerCase())) {
        return this.generatePatternVariant(color);
      }
    }

    // If all colors are used, find a color with an unused pattern
    const patterns: Array<'plain' | 'stripe' | 'dot'> = ['plain', 'stripe', 'dot'];
    
    for (const color of this.CALENDAR_COLORS) {
      const colorKey = color.toLowerCase();
      const usedPatternsForColor = usedPatterns.get(colorKey) || new Set();
      
      for (const pattern of patterns) {
        if (!usedPatternsForColor.has(pattern)) {
          const contrast = checkContrastCompliance(color);
          const wcagRating = contrast.contrastRatio && contrast.contrastRatio >= 7 ? 'AAA' : 'AA';
          
          return {
            color,
            pattern,
            wcagRating,
          };
        }
      }
    }

    // If all color-pattern combinations are used, return the first color with plain pattern
    return this.generatePatternVariant(this.CALENDAR_COLORS[0]);
  }

  /**
   * Generate a pattern variant when colors are exhausted
   * @param baseColor - Base color to create variant from
   * @returns Color assignment with pattern
   */
  public generatePatternVariant(baseColor: string): ColorAssignment {
    const validation = validateHexColor(baseColor);
    if (!validation.isValid) {
      baseColor = this.CALENDAR_COLORS[0];
    }

    // Always start with plain pattern for new colors
    let pattern: 'stripe' | 'dot' | 'plain' = 'plain';

    const contrast = checkContrastCompliance(baseColor);
    const wcagRating = contrast.contrastRatio && contrast.contrastRatio >= 7 ? 'AAA' : 'AA';

    return {
      color: baseColor,
      pattern,
      wcagRating,
    };
  }

  /**
   * Check if a color has good contrast for accessibility
   * @param color - Color to check
   * @param backgroundColor - Background color (default: white)
   * @returns True if contrast meets WCAG AA standards
   */
  public hasGoodContrast(color: string, backgroundColor: string = '#FFFFFF'): boolean {
    const contrast = checkContrastCompliance(backgroundColor, color);
    return contrast.isCompliant;
  }

  /**
   * Get optimal text color for a given background color
   * @param backgroundColor - Background color
   * @returns Optimal text color (dark or light)
   */
  public getOptimalTextColor(backgroundColor: string): string {
    const contrast = checkContrastCompliance(backgroundColor);
    return contrast.textColor || '#1F2937';
  }

  /**
   * Assign colors to multiple items (feeds, friends, etc.)
   * @param items - Array of items needing color assignment
   * @param existingAssignments - Map of existing color assignments
   * @returns Map of item IDs to color assignments
   */
  public assignColors<T extends { id: string }>(
    items: T[],
    existingAssignments: Map<string, ColorAssignment> = new Map()
  ): Map<string, ColorAssignment> {
    const assignments = new Map(existingAssignments);
    const usedColors = Array.from(existingAssignments.values()).map(a => a.color);

    items.forEach(item => {
      if (!assignments.has(item.id)) {
        const color = this.getNextColor(usedColors);
        const assignment = this.generatePatternVariant(color);
        assignments.set(item.id, assignment);
        usedColors.push(color);
      }
    });

    return assignments;
  }

  /**
   * Reset the color manager state
   */
  public reset(): void {
    this.usedColors.clear();
    this.colorIndex = 0;
  }

  /**
   * Get color assignment for a specific item
   * @param itemId - ID of the item
   * @param existingAssignments - Map of existing assignments
   * @param fallbackColor - Fallback color if assignment not found
   * @returns Color assignment
   */
  public getColorAssignment(
    itemId: string,
    existingAssignments: Map<string, ColorAssignment>,
    fallbackColor?: string
  ): ColorAssignment {
    const existing = existingAssignments.get(itemId);
    if (existing) {
      return existing;
    }

    const color = fallbackColor || this.getNextColor();
    return this.generatePatternVariant(color);
  }

  /**
   * Validate and sanitize a color assignment
   * @param assignment - Color assignment to validate
   * @returns Validated and sanitized assignment
   */
  public validateColorAssignment(assignment: Partial<ColorAssignment>): ColorAssignment {
    let color = assignment.color || this.CALENDAR_COLORS[0];
    
    const validation = validateHexColor(color);
    if (!validation.isValid) {
      color = this.CALENDAR_COLORS[0];
    }

    const pattern = assignment.pattern || 'plain';
    const contrast = checkContrastCompliance(color);
    const wcagRating = contrast.contrastRatio && contrast.contrastRatio >= 7 ? 'AAA' : 'AA';

    return {
      color,
      pattern,
      wcagRating,
    };
  }

  /**
   * Get colors that work well together (for themes)
   * @param count - Number of colors needed
   * @returns Array of harmonious colors
   */
  public getHarmoniousColors(count: number): string[] {
    const colors: string[] = [];
    const maxColors = Math.min(count, this.CALENDAR_COLORS.length);
    const step = Math.floor(this.CALENDAR_COLORS.length / maxColors);

    for (let i = 0; i < maxColors && i * step < this.CALENDAR_COLORS.length; i++) {
      colors.push(this.CALENDAR_COLORS[i * step]);
    }

    // Fill remaining slots if needed, but don't exceed palette size
    while (colors.length < maxColors) {
      const remaining = this.CALENDAR_COLORS.filter(c => !colors.includes(c));
      if (remaining.length > 0) {
        colors.push(remaining[0]);
      } else {
        break;
      }
    }

    return colors;
  }
}

// Export singleton instance
export const colorPaletteManager = ColorPaletteManager.getInstance();