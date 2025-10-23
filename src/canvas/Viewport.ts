/**
 * Viewport - Manages canvas pan and zoom transformations
 */

import { ViewportState } from '../core/types';
import { CANVAS } from '../utils/constants';
import { clamp } from '../utils/geometry';

/**
 * Viewport class for managing canvas transformations
 */
export class Viewport {
  private zoom: number;
  private panX: number;
  private panY: number;

  constructor() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
  }

  /**
   * Get current viewport state
   */
  getState(): ViewportState {
    return {
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
    };
  }

  /**
   * Set viewport state
   */
  setState(state: Partial<ViewportState>): void {
    if (state.zoom !== undefined) {
      this.zoom = clamp(state.zoom, CANVAS.MIN_ZOOM, CANVAS.MAX_ZOOM);
    }
    if (state.panX !== undefined) {
      this.panX = state.panX;
    }
    if (state.panY !== undefined) {
      this.panY = state.panY;
    }
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.zoom;
  }

  /**
   * Set zoom level
   */
  setZoom(zoom: number): void {
    this.zoom = clamp(zoom, CANVAS.MIN_ZOOM, CANVAS.MAX_ZOOM);
  }

  /**
   * Zoom in by step amount
   */
  zoomIn(): void {
    this.setZoom(this.zoom + CANVAS.ZOOM_STEP);
  }

  /**
   * Zoom out by step amount
   */
  zoomOut(): void {
    this.setZoom(this.zoom - CANVAS.ZOOM_STEP);
  }

  /**
   * Zoom to specific level at a point
   */
  zoomAt(zoomDelta: number, x: number, y: number): void {
    const oldZoom = this.zoom;
    const newZoom = clamp(
      this.zoom + zoomDelta,
      CANVAS.MIN_ZOOM,
      CANVAS.MAX_ZOOM
    );

    if (oldZoom === newZoom) {
      return;
    }

    // Adjust pan to zoom towards the point
    const scale = newZoom / oldZoom;
    this.panX = x - (x - this.panX) * scale;
    this.panY = y - (y - this.panY) * scale;
    this.zoom = newZoom;
  }

  /**
   * Get current pan offset
   */
  getPan(): { x: number; y: number } {
    return { x: this.panX, y: this.panY };
  }

  /**
   * Set pan offset
   */
  setPan(x: number, y: number): void {
    this.panX = x;
    this.panY = y;
  }

  /**
   * Pan by delta amount
   */
  panBy(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
  }

  /**
   * Reset viewport to default state
   */
  reset(): void {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
  }

  /**
   * Apply transformations to a canvas context
   */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.panX) / this.zoom,
      y: (screenY - this.panY) / this.zoom,
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.zoom + this.panX,
      y: worldY * this.zoom + this.panY,
    };
  }

  /**
   * Get visible bounds in world coordinates
   */
  getVisibleBounds(canvasWidth: number, canvasHeight: number): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(canvasWidth, canvasHeight);

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }
}
