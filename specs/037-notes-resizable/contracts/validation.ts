/**
 * Validation helpers for the resizable Notes component.
 *
 * Pure functions, no DOM/Canvas dependency, directly unit-testable per the
 * Constitution's Test Coverage requirements (utility/validation functions
 * require 100% coverage). Imported directly as source by src/ code and
 * tests, per this project's convention.
 *
 * @see ../data-model.md for the invariants these enforce
 */

import { RESIZE, type ComponentSize } from './types';

/**
 * Clamps a proposed size to the minimum allowed width/height (FR-004).
 * There is no maximum (FR-005), so values above the minimum pass through
 * unchanged.
 */
export function clampSize(size: ComponentSize): ComponentSize {
  return {
    width: Math.max(size.width, RESIZE.MIN_WIDTH),
    height: Math.max(size.height, RESIZE.MIN_HEIGHT),
  };
}

/**
 * Computes the new top-left position and size for a bottom-left-corner
 * resize drag, given the component's current position/size and one frame's
 * pointer delta (dx, dy) in canvas/world units.
 *
 * Dragging the corner left (negative dx) or down (positive dy) grows the
 * component; the opposite (top-right) corner stays fixed (FR-003). Width
 * changes are clamped to the minimum by adjusting how far the left edge
 * (and therefore x) is allowed to move, so the two never disagree.
 */
export function applyBottomLeftResize(
  position: { x: number; y: number },
  size: ComponentSize,
  dx: number,
  dy: number
): { position: { x: number; y: number }; size: ComponentSize } {
  const proposedWidth = size.width - dx;
  const clampedWidth = Math.max(proposedWidth, RESIZE.MIN_WIDTH);
  const widthDelta = size.width - clampedWidth; // > 0 when shrinking, < 0 when growing

  const proposedHeight = size.height + dy;
  const clampedHeight = Math.max(proposedHeight, RESIZE.MIN_HEIGHT);

  return {
    position: {
      x: position.x + widthDelta,
      y: position.y,
    },
    size: {
      width: clampedWidth,
      height: clampedHeight,
    },
  };
}

/**
 * Computes the new size for a bottom-right-corner resize drag, given the
 * component's current size and one frame's pointer delta (dx, dy) in
 * canvas/world units. The top-left corner (position) never moves — width
 * and height simply track the cursor directly, clamped to the minimum.
 */
export function applyBottomRightResize(
  size: ComponentSize,
  dx: number,
  dy: number
): { size: ComponentSize } {
  return {
    size: {
      width: Math.max(size.width + dx, RESIZE.MIN_WIDTH),
      height: Math.max(size.height + dy, RESIZE.MIN_HEIGHT),
    },
  };
}
