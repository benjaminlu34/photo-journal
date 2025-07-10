/**
 * Grid configuration for snapping
 */
export const GRID_SIZE = 20; // pixels

/**
 * Snaps a value to the nearest grid point
 * @param value The value to snap
 * @param gridSize The grid size (defaults to GRID_SIZE)
 * @returns The snapped value
 */
export function snapToGrid(value: number, gridSize: number = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snaps a position to the grid
 * @param x The x coordinate
 * @param y The y coordinate
 * @param gridSize The grid size (defaults to GRID_SIZE)
 * @returns The snapped position
 */
export function snapPositionToGrid(
  x: number, 
  y: number, 
  gridSize: number = GRID_SIZE
): { x: number; y: number } {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize),
  };
}

/**
 * Snaps dimensions to the grid
 * @param width The width
 * @param height The height  
 * @param gridSize The grid size (defaults to GRID_SIZE)
 * @returns The snapped dimensions
 */
export function snapSizeToGrid(
  width: number, 
  height: number, 
  gridSize: number = GRID_SIZE
): { width: number; height: number } {
  return {
    width: Math.max(gridSize, snapToGrid(width, gridSize)),
    height: Math.max(gridSize, snapToGrid(height, gridSize)),
  };
}