/**
 * Gesture disambiguation helpers for pointer event handling.
 * All functions are pure and side-effect-free.
 */

export const GESTURE_CONFIG = {
  /** Euclidean distance in CSS pixels before a touch is treated as a drag. */
  DRAG_THRESHOLD_PX: 8,
  /** Duration in ms before a stationary touch triggers a long-press. */
  LONG_PRESS_MS: 500,
} as const;

export interface ActivePointer {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  longPressTimer: ReturnType<typeof setTimeout> | null;
}

export interface ScreenPosition {
  screenX: number;
  screenY: number;
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
 * Returns true when the pointer has moved far enough from its start
 * position to be considered a drag (not a tap).
 */
export function isDragIntent(pointer: ActivePointer): boolean {
  const dx = pointer.currentX - pointer.startX;
  const dy = pointer.currentY - pointer.startY;
  return Math.hypot(dx, dy) > GESTURE_CONFIG.DRAG_THRESHOLD_PX;
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
