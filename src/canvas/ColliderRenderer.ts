/**
 * ColliderRenderer - Canvas rendering for collider visualization
 * Handles rendering of colliders, boundary, and visual flash effects
 */

import type { Collider, CollisionBoundary } from '../../specs/006-collider-musical-physics/contracts/types';

/**
 * Flash effect state for a single collider
 */
interface FlashState {
  opacity: number;
  duration: number;
  elapsed: number;
}

/**
 * Rendering constants
 */
const FLASH_DURATION_MS = 300;
const FLASH_INITIAL_OPACITY = 0.3;
const FLASH_DECAY_PER_FRAME = 0.05;
const COLLIDER_STROKE_WIDTH = 2;
const COLLIDER_STROKE_COLOR = '#ffffff';
const BOUNDARY_STROKE_WIDTH = 2;
const BOUNDARY_STROKE_COLOR = '#666666';
const BOUNDARY_FILL_COLOR = '#1a1a1a';

/**
 * ColliderRenderer handles canvas rendering for the physics simulation
 */
export class ColliderRenderer {
  private flashStates: Map<string, FlashState> = new Map();

  constructor(private ctx: CanvasRenderingContext2D) {}

  /**
   * Clear the canvas
   */
  clear(): void {
    const canvas = this.ctx.canvas;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * Render the collision boundary
   * @param boundary - Boundary to render
   */
  drawBounds(boundary: CollisionBoundary): void {
    this.ctx.strokeStyle = BOUNDARY_STROKE_COLOR;
    this.ctx.lineWidth = BOUNDARY_STROKE_WIDTH;
    this.ctx.fillStyle = BOUNDARY_FILL_COLOR;

    // Fill background
    this.ctx.fillRect(
      boundary.left,
      boundary.top,
      boundary.width,
      boundary.height
    );

    // Draw border
    this.ctx.strokeRect(
      boundary.left,
      boundary.top,
      boundary.width,
      boundary.height
    );
  }

  /**
   * Render all colliders
   * @param colliders - Array of colliders to render
   */
  drawCircles(colliders: Collider[]): void {
    for (const collider of colliders) {
      this.drawCircle(collider);
    }
  }

  /**
   * Render a single collider
   * @param collider - Collider to render
   */
  private drawCircle(collider: Collider): void {
    this.ctx.beginPath();
    this.ctx.arc(
      collider.position.x,
      collider.position.y,
      collider.radius,
      0,
      Math.PI * 2
    );

    // Fill with collider color
    this.ctx.fillStyle = collider.color;
    this.ctx.fill();

    // Draw outline
    this.ctx.strokeStyle = COLLIDER_STROKE_COLOR;
    this.ctx.lineWidth = COLLIDER_STROKE_WIDTH;
    this.ctx.stroke();
  }

  /**
   * Trigger a flash effect for a specific collider
   * @param colliderId - ID of collider to flash
   * @param durationMs - Flash duration in milliseconds (default: 300ms)
   */
  flashCollider(colliderId: string, durationMs: number = FLASH_DURATION_MS): void {
    this.flashStates.set(colliderId, {
      opacity: FLASH_INITIAL_OPACITY,
      duration: durationMs,
      elapsed: 0,
    });
  }

  /**
   * Render flash effects for all active flashes
   * Should be called after drawing colliders
   */
  drawFlash(): void {
    for (const [colliderId, flashState] of this.flashStates.entries()) {
      if (flashState.opacity > 0) {
        // Draw white overlay with current opacity
        this.ctx.fillStyle = `rgba(255, 255, 255, ${flashState.opacity})`;
        this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        // Decay opacity
        flashState.opacity -= FLASH_DECAY_PER_FRAME;

        // Remove flash if fully faded
        if (flashState.opacity <= 0) {
          this.flashStates.delete(colliderId);
        }
      }
    }
  }

  /**
   * Render the complete scene
   * @param colliders - Array of colliders to render
   * @param boundary - Collision boundary
   */
  render(colliders: Collider[], boundary: CollisionBoundary): void {
    this.clear();
    this.drawBounds(boundary);
    this.drawCircles(colliders);
    this.drawFlash();
  }

  /**
   * Update flash animations
   * Call this in the animation loop to update flash states
   * @param deltaTime - Time elapsed since last update (in milliseconds)
   */
  updateFlashes(deltaTime: number): void {
    for (const [colliderId, flashState] of this.flashStates.entries()) {
      flashState.elapsed += deltaTime;

      // Linear decay based on duration
      const progress = flashState.elapsed / flashState.duration;
      flashState.opacity = Math.max(0, FLASH_INITIAL_OPACITY * (1 - progress));

      // Remove completed flashes
      if (flashState.elapsed >= flashState.duration) {
        this.flashStates.delete(colliderId);
      }
    }
  }

  /**
   * Clear all active flash effects
   */
  clearFlashes(): void {
    this.flashStates.clear();
  }

  /**
   * Check if a collider has an active flash
   * @param colliderId - ID of collider to check
   * @returns True if collider is currently flashing
   */
  isFlashing(colliderId: string): boolean {
    return this.flashStates.has(colliderId);
  }

  /**
   * Get the number of active flashes
   * @returns Count of active flash effects
   */
  get activeFlashCount(): number {
    return this.flashStates.size;
  }

  /**
   * Set the rendering context
   * @param ctx - New canvas rendering context
   */
  setContext(ctx: CanvasRenderingContext2D): void {
    this.ctx = ctx;
  }

  /**
   * Get the current rendering context
   * @returns Canvas rendering context
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }
}
