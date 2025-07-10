/**
 * Round a number to the nearest G-pixel grid.
 * Default grid size = 20 px (matches Firm #2's demo).
 */
export const snapToGrid = (value: number, grid = 20): number =>
  Math.round(value / grid) * grid;