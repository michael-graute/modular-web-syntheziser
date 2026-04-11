/**
 * Contracts: Oscilloscope Display — Main Canvas Migration
 * Feature: 011-oscilloscope-main-canvas
 *
 * Defines the interface that the refactored OscilloscopeDisplay must satisfy,
 * and the integration contract with CanvasComponent.
 */

// ---------------------------------------------------------------------------
// OscilloscopeDisplay interface (post-migration)
// ---------------------------------------------------------------------------

/**
 * The refactored display draws directly onto a supplied CanvasRenderingContext2D.
 * It owns no HTML element and requires no DOM lifecycle management.
 */
export interface IOscilloscopeDisplay {
  /**
   * Draw the oscilloscope visualization onto the main canvas context.
   * Internally throttles to ~30 FPS; returns immediately on skipped frames.
   * No-ops when isFrozen is true.
   *
   * @param ctx - The main CanvasRenderingContext2D (viewport transform already applied)
   */
  render(ctx: CanvasRenderingContext2D): void;

  /**
   * Update the world-space origin of the display area.
   * Called by CanvasComponent whenever the parent component moves.
   */
  updatePosition(x: number, y: number): void;

  /**
   * Update the display area dimensions.
   * Called by CanvasComponent if component dimensions change.
   */
  updateSize(width: number, height: number): void;

  /**
   * Enable or disable freeze mode.
   * When frozen, render() skips all drawing but does not unsubscribe.
   */
  setFrozen(frozen: boolean): void;

  /**
   * Release internal references. Does NOT remove any DOM element.
   * Safe to call multiple times.
   */
  destroy(): void;
}

// ---------------------------------------------------------------------------
// CanvasComponent integration contract
// ---------------------------------------------------------------------------

/**
 * CanvasComponent render-pass contract for oscilloscope.
 *
 * render() must call oscilloscopeDisplay.render(ctx) AFTER renderControls()
 * and BEFORE ctx.restore(), so that dropdown menus (drawn in a separate
 * renderDropdownMenus() pass by Canvas.ts) always appear on top.
 *
 * Pseudocode:
 *
 *   render(ctx: CanvasRenderingContext2D): void {
 *     ctx.save();
 *     // ... draw background, header, ports ...
 *     renderControls(ctx);
 *     if (oscilloscopeDisplay) {
 *       oscilloscopeDisplay.render(ctx);   // ← draws in world coordinates
 *     }
 *     ctx.restore();
 *   }
 */
export type OscilloscopeRenderHook = (ctx: CanvasRenderingContext2D) => void;

// ---------------------------------------------------------------------------
// Removed contracts (no longer needed post-migration)
// ---------------------------------------------------------------------------

/**
 * These methods existed on the old OscilloscopeDisplay and MUST NOT be
 * present on the refactored class:
 *
 *   getCanvas(): HTMLCanvasElement           — no DOM element
 *   updateViewportTransform(zoom, panX, panY) — main canvas handles this
 *   isVisible(): boolean                      — no getBoundingClientRect
 */
export type RemovedOscilloscopeMethods = 'getCanvas' | 'updateViewportTransform' | 'isVisible';
