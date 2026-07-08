/**
 * Type definitions and constants for the resizable Notes component.
 *
 * Imported directly as source by src/ code and tests, per this project's
 * convention (see Looper.ts importing from specs/015-bpm-looper/contracts/,
 * and Notes.ts importing from specs/036-notes-component/contracts/).
 *
 * @see ../data-model.md for complete documentation
 */

/** A world/canvas-space size in the same units as CanvasComponent.width/height. */
export interface ComponentSize {
  width: number;
  height: number;
}

/**
 * Minimum size a resized Notes component may shrink to, in canvas units.
 * Matches the project's existing COMPONENT.MIN_WIDTH / COMPONENT.MIN_HEIGHT
 * constants (src/utils/constants.ts) — duplicated here as the contract's
 * own named constant (rather than importing src/ from specs/, which this
 * project's contracts never do) so clampSize stays a pure, dependency-free
 * function. Keep these two values in sync if COMPONENT.MIN_WIDTH/MIN_HEIGHT
 * ever change.
 */
export const RESIZE = {
  MIN_WIDTH: 120,
  MIN_HEIGHT: 80,
} as const;
