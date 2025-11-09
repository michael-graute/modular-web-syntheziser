/**
 * ColliderDisplay - Canvas-based visualization for Collider component
 * Renders the physics simulation with bouncing colliders
 */

import type { Collider } from '../../components/utilities/Collider';

/**
 * Display renderer for collider physics visualization
 */
export class ColliderDisplay {
  private canvas: HTMLCanvasElement;
  private collider: Collider;
  private baseX: number;
  private baseY: number;
  private baseWidth: number;
  private baseHeight: number;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    collider: Collider
  ) {
    this.collider = collider;
    this.baseX = x;
    this.baseY = y;
    this.baseWidth = width;
    this.baseHeight = height;

    // Create canvas element
    this.canvas = document.createElement('canvas');

    // Apply device pixel ratio scaling for sharp rendering on high-DPI displays (e.g., Retina)
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.canvas.style.position = 'absolute';
    this.canvas.style.left = `${x}px`;
    this.canvas.style.top = `${y}px`;
    this.canvas.style.border = '1px solid #444';
    this.canvas.style.backgroundColor = '#1a1a1a';
    this.canvas.style.pointerEvents = 'none'; // Don't interfere with canvas interactions
    this.canvas.style.transformOrigin = '0 0'; // Transform from top-left corner
    this.canvas.style.zIndex = '100'; // Ensure canvas appears above main canvas (main canvas is z-index: 1)

    // Scale the 2D context to match device pixel ratio
    const ctx = this.canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    // Initialize collider component with this canvas
    // The Collider component will create its own renderer when simulation starts
    this.collider.setCanvas(this.canvas);
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get the base (logical) width of the canvas
   */
  getBaseWidth(): number {
    return this.baseWidth;
  }

  /**
   * Get the base (logical) height of the canvas
   */
  getBaseHeight(): number {
    return this.baseHeight;
  }

  /**
   * Update position when component moves
   */
  updatePosition(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.canvas.style.left = `${x}px`;
    this.canvas.style.top = `${y}px`;
  }

  /**
   * Update size when component resizes
   */
  updateSize(width: number, height: number): void {
    this.baseWidth = width;
    this.baseHeight = height;

    // Apply device pixel ratio scaling
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Re-apply context scaling after resize
    const ctx = this.canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }

  /**
   * Update viewport transform (zoom and pan)
   */
  updateViewportTransform(zoom: number, panX: number, panY: number): void {
    // Apply CSS transform to match the main canvas viewport
    const screenX = this.baseX * zoom + panX;
    const screenY = this.baseY * zoom + panY;

    this.canvas.style.left = `${screenX}px`;
    this.canvas.style.top = `${screenY}px`;
    this.canvas.style.transform = `scale(${zoom})`;

    // DON'T reset canvas dimensions - this clears the canvas!
    // The Collider component is responsible for rendering, not us
    // this.canvas.width = this.baseWidth;
    // this.canvas.height = this.baseHeight;
  }

  /**
   * Cleanup when component is destroyed
   */
  destroy(): void {
    // Remove canvas from DOM
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}
