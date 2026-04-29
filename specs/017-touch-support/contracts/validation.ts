import type { ActivePointer, ScreenPosition } from './types';
import { GESTURE_CONFIG } from './types';

/**
 * Returns true when the pointer has moved far enough from its start
 * position to be considered a drag (not a tap).
 */
export function isDragIntent(pointer: ActivePointer): boolean {
  const dx = pointer.currentX - pointer.startX;
  const dy = pointer.currentY - pointer.startY;
  return Math.hypot(dx, dy) > GESTURE_CONFIG.DRAG_THRESHOLD_PX;
}

/**
 * Extracts a normalised screen position from a PointerEvent or MouseEvent
 * relative to the given canvas element.
 */
export function getEventPosition(
  e: PointerEvent | MouseEvent,
  canvas: HTMLCanvasElement,
): ScreenPosition {
  const rect = canvas.getBoundingClientRect();
  return {
    screenX: e.clientX - rect.left,
    screenY: e.clientY - rect.top,
  };
}

/**
 * Returns the Euclidean distance between two screen positions.
 * Used for pinch-zoom scale factor computation.
 */
export function pointerDistance(a: ScreenPosition, b: ScreenPosition): number {
  return Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY);
}

/**
 * Returns the midpoint between two screen positions.
 * Used as the zoom anchor for pinch gestures.
 */
export function pointerMidpoint(a: ScreenPosition, b: ScreenPosition): ScreenPosition {
  return {
    screenX: (a.screenX + b.screenX) / 2,
    screenY: (a.screenY + b.screenY) / 2,
  };
}

/**
 * Returns true when the runtime environment is a coarse-pointer (touch) device.
 * Evaluated once at startup; result is stable for the page lifetime.
 */
export function isCoarsePointerDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}
