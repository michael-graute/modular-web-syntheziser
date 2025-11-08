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

    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = `${x}px`;
    this.canvas.style.top = `${y}px`;
    this.canvas.style.border = '1px solid #444';
    this.canvas.style.backgroundColor = '#1a1a1a';
    this.canvas.style.pointerEvents = 'none'; // Don't interfere with canvas interactions
    this.canvas.style.transformOrigin = '0 0'; // Transform from top-left corner
    this.canvas.style.zIndex = '100'; // Ensure canvas appears above main canvas (main canvas is z-index: 1)

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
    this.canvas.width = width;
    this.canvas.height = height;
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
