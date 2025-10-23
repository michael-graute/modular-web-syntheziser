/**
 * Geometry utility functions for canvas operations
 */

import { Position } from '../core/types';

/**
 * Calculate distance between two points
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Distance between points
 */
export function distance(p1: Position, p2: Position): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if a point is inside a rectangle
 * @param point - Point to check
 * @param rect - Rectangle with x, y, width, height
 * @returns True if point is inside rectangle
 */
export function isPointInRect(
  point: Position,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Check if a point is near a line segment
 * @param point - Point to check
 * @param lineStart - Start of line segment
 * @param lineEnd - End of line segment
 * @param tolerance - Distance tolerance
 * @returns True if point is within tolerance of line
 */
export function isPointNearLine(
  point: Position,
  lineStart: Position,
  lineEnd: Position,
  tolerance: number
): boolean {
  const dist = distanceToLineSegment(point, lineStart, lineEnd);
  return dist <= tolerance;
}

/**
 * Calculate distance from point to line segment
 * @param point - Point to measure from
 * @param lineStart - Start of line segment
 * @param lineEnd - End of line segment
 * @returns Distance to line segment
 */
export function distanceToLineSegment(
  point: Position,
  lineStart: Position,
  lineEnd: Position
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return distance(point, lineStart);
  }

  let t =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
    lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projection = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
  };

  return distance(point, projection);
}

/**
 * Clamp a value between min and max
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Lerp (linear interpolation) between two values
 * @param start - Start value
 * @param end - End value
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Snap a value to grid
 * @param value - Value to snap
 * @param gridSize - Grid size
 * @returns Snapped value
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap a position to grid
 * @param position - Position to snap
 * @param gridSize - Grid size
 * @returns Snapped position
 */
export function snapPositionToGrid(
  position: Position,
  gridSize: number
): Position {
  return {
    x: snapToGrid(position.x, gridSize),
    y: snapToGrid(position.y, gridSize),
  };
}

/**
 * Calculate bounding box for multiple positions
 * @param positions - Array of positions
 * @returns Bounding box { x, y, width, height }
 */
export function getBoundingBox(
  positions: Position[]
): { x: number; y: number; width: number; height: number } {
  if (positions.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pos of positions) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x);
    maxY = Math.max(maxY, pos.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
