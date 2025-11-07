/**
 * IPhysicsEngine - Physics simulation interface
 *
 * Handles 2D elastic collision physics simulation for the Collider component.
 * Manages collider entities, detects collisions (both wall and inter-collider),
 * and generates collision events for audio triggering.
 *
 * Implementation notes:
 * - Uses brute-force O(n²) collision detection (optimal for N≤20 objects)
 * - Equal mass elastic collisions with position correction
 * - Circle-circle and circle-wall (AABB) collision detection
 * - Deterministic physics for musical predictability
 *
 * @see research.md sections 1-2 for algorithm details
 * @see data-model.md for Collider, CollisionEvent, CollisionBoundary types
 */

import type {
  Collider,
  CollisionEvent,
  CollisionBoundary,
} from './types';

/**
 * Physics engine interface for collision simulation
 */
export interface IPhysicsEngine {
  /**
   * Update physics simulation by one time step
   *
   * Performs the following operations in order:
   * 1. Update collider positions based on velocity and deltaTime
   * 2. Detect all collisions (wall and inter-collider)
   * 3. Resolve collisions (update velocities and positions)
   * 4. Return collision events for audio triggering
   *
   * @param deltaTime - Time elapsed since last update (seconds)
   * @returns Array of collision events that occurred during this update
   *
   * @example
   * ```typescript
   * const engine = new PhysicsEngine(boundary);
   * const events = engine.update(0.016); // 60fps = ~16ms
   * events.forEach(event => handleCollision(event));
   * ```
   */
  update(deltaTime: number): CollisionEvent[];

  /**
   * Add a collider to the simulation
   *
   * Collider must have non-overlapping position within boundary.
   * Position validation should be performed by caller using
   * data-model.md position validation functions.
   *
   * @param collider - Collider entity to add
   * @throws Error if collider position overlaps with existing colliders
   * @throws Error if collider position is outside boundary
   *
   * @example
   * ```typescript
   * const collider: Collider = {
   *   id: 'collider-1',
   *   position: { x: 100, y: 100 },
   *   velocity: { x: 50, y: -30 },
   *   radius: 12,
   *   scaleDegree: 0,
   *   cvVoltage: 0,
   *   color: '#ff0000',
   *   mass: 1.0,
   * };
   * engine.addCollider(collider);
   * ```
   */
  addCollider(collider: Collider): void;

  /**
   * Remove a collider from the simulation
   *
   * @param id - Unique identifier of collider to remove
   * @returns true if collider was found and removed, false otherwise
   *
   * @example
   * ```typescript
   * const removed = engine.removeCollider('collider-1');
   * if (!removed) {
   *   console.warn('Collider not found');
   * }
   * ```
   */
  removeCollider(id: string): boolean;

  /**
   * Reset simulation to initial state
   *
   * Clears all colliders and resets internal state.
   * Boundary is preserved (use setBoundary to change).
   *
   * @example
   * ```typescript
   * engine.reset(); // Clear all colliders
   * // Re-initialize with new colliders
   * colliders.forEach(c => engine.addCollider(c));
   * ```
   */
  reset(): void;

  /**
   * Get current collision boundary
   *
   * @returns Copy of current boundary (immutable)
   *
   * @example
   * ```typescript
   * const boundary = engine.getBoundary();
   * console.log(`Simulation area: ${boundary.width}x${boundary.height}`);
   * ```
   */
  getBoundary(): Readonly<CollisionBoundary>;

  /**
   * Update collision boundary
   *
   * Should be called when canvas is resized (FR-019).
   * Colliders outside new boundary will be clamped to edges.
   *
   * @param boundary - New collision boundary
   *
   * @example
   * ```typescript
   * const newBoundary = createBoundaryFromCanvas(canvas, 20);
   * engine.setBoundary(newBoundary);
   * ```
   */
  setBoundary(boundary: CollisionBoundary): void;

  /**
   * Get all active colliders
   *
   * @returns Array of collider references (do not modify directly)
   *
   * @example
   * ```typescript
   * const colliders = engine.getColliders();
   * console.log(`Active colliders: ${colliders.length}`);
   * ```
   */
  getColliders(): ReadonlyArray<Collider>;

  /**
   * Get collider by ID
   *
   * @param id - Unique collider identifier
   * @returns Collider if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const collider = engine.getCollider('collider-1');
   * if (collider) {
   *   console.log(`Position: ${collider.position.x}, ${collider.position.y}`);
   * }
   * ```
   */
  getCollider(id: string): Collider | undefined;
}
