/**
 * Contracts for 017-touch-support
 * All types are runtime-only (no serialization needed).
 */

/** A single active pointer being tracked on the canvas. */
export interface ActivePointer {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  longPressTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Gesture type resolved from the current set of active pointers.
 * Determines which interaction branch runs in the pointer move/up handlers.
 */
export type GestureType =
  | 'idle'
  | 'tap-pending'      // one pointer, distance ≤ threshold — intent not yet resolved
  | 'drag'             // one pointer, distance > threshold — dragging control/component
  | 'two-finger-pan'   // two pointers, no significant pinch
  | 'pinch-zoom'       // two pointers with distance change
  | 'long-press';      // one pointer held ≥ 500ms without movement

/** Screen-space position in CSS pixels relative to the canvas element. */
export interface ScreenPosition {
  screenX: number;
  screenY: number;
}

/** Configuration constants for gesture disambiguation. */
export const GESTURE_CONFIG = {
  /** Euclidean distance in CSS pixels before a touch is treated as a drag. */
  DRAG_THRESHOLD_PX: 8,
  /** Duration in ms before a stationary touch triggers a long-press. */
  LONG_PRESS_MS: 500,
} as const;

/** State for the context menu shown on long-press. */
export interface ContextMenuState {
  targetComponentId: string;
  /** Position in viewport (screen) coordinates for menu placement. */
  x: number;
  y: number;
  visible: boolean;
}

/** Actions available in the long-press context menu. */
export type ContextMenuAction = 'delete';
