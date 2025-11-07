/**
 * PhysicsEngine - Collision detection and physics simulation
 * Implements brute-force O(n²) collision detection for N≤20 colliders
 * Handles both wall collisions and collider-collider collisions
 */

import type { Collider, CollisionBoundary, CollisionEvent } from '../../specs/006-collider-musical-physics/contracts/types';

/**
 * Physics constants for collision handling
 */
const COLLISION_EPSILON = 0.01; // Small value to prevent stuck colliders

/**
 * PhysicsEngine manages the physics simulation for all colliders
 */
export class PhysicsEngine {
  private colliders: Map<string, Collider> = new Map();
  private boundary: CollisionBoundary | null = null;

  /**
   * Set the collision boundary
   * @param boundary - Boundary definition
   */
  setBoundary(boundary: CollisionBoundary): void {
    this.boundary = boundary;
  }

  /**
   * Add a collider to the simulation
   * @param collider - Collider entity to add
   */
  addCollider(collider: Collider): void {
    this.colliders.set(collider.id, collider);
  }

  /**
   * Remove a collider from the simulation
   * @param colliderId - ID of collider to remove
   * @returns True if collider was removed
   */
  removeCollider(colliderId: string): boolean {
    return this.colliders.delete(colliderId);
  }

  /**
   * Get a collider by ID
   * @param colliderId - ID of collider
   * @returns Collider entity or undefined
   */
  getCollider(colliderId: string): Collider | undefined {
    return this.colliders.get(colliderId);
  }

  /**
   * Get all colliders
   * @returns Array of all colliders
   */
  getAllColliders(): Collider[] {
    return Array.from(this.colliders.values());
  }

  /**
   * Reset the physics engine (remove all colliders)
   */
  reset(): void {
    this.colliders.clear();
  }

  /**
   * Update physics simulation for one frame
   * @param deltaTime - Time elapsed since last update (in seconds)
   * @returns Array of collision events that occurred
   */
  update(deltaTime: number): CollisionEvent[] {
    if (!this.boundary) {
      return [];
    }

    const events: CollisionEvent[] = [];
    const timestamp = performance.now() / 1000; // Convert to seconds

    // Update positions based on velocity
    this.updatePositions(deltaTime);

    // Detect and resolve wall collisions
    const wallEvents = this.detectAndResolveWallCollisions(timestamp);
    events.push(...wallEvents);

    // Detect and resolve collider-collider collisions
    const colliderEvents = this.detectAndResolveColliderCollisions(timestamp);
    events.push(...colliderEvents);

    return events;
  }

  /**
   * Update all collider positions based on their velocities
   * @param deltaTime - Time elapsed (in seconds)
   */
  private updatePositions(deltaTime: number): void {
    for (const collider of this.colliders.values()) {
      collider.position.x += collider.velocity.x * deltaTime;
      collider.position.y += collider.velocity.y * deltaTime;
    }
  }

  /**
   * Detect and resolve wall collisions for all colliders
   * @param timestamp - Current timestamp
   * @returns Array of wall collision events
   */
  private detectAndResolveWallCollisions(timestamp: number): CollisionEvent[] {
    if (!this.boundary) {
      return [];
    }

    const events: CollisionEvent[] = [];

    for (const collider of this.colliders.values()) {
      const wallSide = this.checkWallCollision(collider, this.boundary);

      if (wallSide) {
        this.resolveWallCollision(collider, wallSide, this.boundary);

        events.push({
          type: 'wall',
          timestamp,
          colliderId: collider.id,
          wallSide,
        });
      }
    }

    return events;
  }

  /**
   * Check if a collider is colliding with a wall
   * @param collider - Collider to check
   * @param boundary - Collision boundary
   * @returns Wall side if colliding, null otherwise
   */
  private checkWallCollision(
    collider: Collider,
    boundary: CollisionBoundary
  ): 'left' | 'right' | 'top' | 'bottom' | null {
    if (collider.position.x - collider.radius < boundary.left) {
      return 'left';
    }
    if (collider.position.x + collider.radius > boundary.right) {
      return 'right';
    }
    if (collider.position.y - collider.radius < boundary.top) {
      return 'top';
    }
    if (collider.position.y + collider.radius > boundary.bottom) {
      return 'bottom';
    }
    return null;
  }

  /**
   * Resolve a wall collision (reflection)
   * @param collider - Collider that hit the wall
   * @param wallSide - Which wall was hit
   * @param boundary - Collision boundary
   */
  private resolveWallCollision(
    collider: Collider,
    wallSide: 'left' | 'right' | 'top' | 'bottom',
    boundary: CollisionBoundary
  ): void {
    switch (wallSide) {
      case 'left':
        collider.position.x = boundary.left + collider.radius;
        collider.velocity.x = Math.abs(collider.velocity.x);
        break;
      case 'right':
        collider.position.x = boundary.right - collider.radius;
        collider.velocity.x = -Math.abs(collider.velocity.x);
        break;
      case 'top':
        collider.position.y = boundary.top + collider.radius;
        collider.velocity.y = Math.abs(collider.velocity.y);
        break;
      case 'bottom':
        collider.position.y = boundary.bottom - collider.radius;
        collider.velocity.y = -Math.abs(collider.velocity.y);
        break;
    }
  }

  /**
   * Detect and resolve collider-collider collisions
   * Uses brute-force O(n²) algorithm (efficient for N≤20)
   * @param timestamp - Current timestamp
   * @returns Array of collider collision events
   */
  private detectAndResolveColliderCollisions(timestamp: number): CollisionEvent[] {
    const events: CollisionEvent[] = [];
    const colliderArray = Array.from(this.colliders.values());

    // Brute-force collision detection (O(n²))
    for (let i = 0; i < colliderArray.length - 1; i++) {
      for (let j = i + 1; j < colliderArray.length; j++) {
        const c1 = colliderArray[i];
        const c2 = colliderArray[j];

        // Safety check for undefined colliders
        if (!c1 || !c2) continue;

        if (this.checkCircleCollision(c1, c2)) {
          this.resolveCircleCollision(c1, c2);

          // Create events for both colliders
          events.push({
            type: 'collider',
            timestamp,
            colliderId: c1.id,
            otherColliderId: c2.id,
          });

          events.push({
            type: 'collider',
            timestamp,
            colliderId: c2.id,
            otherColliderId: c1.id,
          });
        }
      }
    }

    return events;
  }

  /**
   * Check if two circular colliders are colliding
   * Uses squared distance to avoid expensive sqrt operation
   * @param c1 - First collider
   * @param c2 - Second collider
   * @returns True if colliders are overlapping
   */
  private checkCircleCollision(c1: Collider, c2: Collider): boolean {
    const dx = c2.position.x - c1.position.x;
    const dy = c2.position.y - c1.position.y;
    const distanceSquared = dx * dx + dy * dy;
    const radiusSum = c1.radius + c2.radius;
    return distanceSquared < (radiusSum * radiusSum);
  }

  /**
   * Resolve collision between two circular colliders
   * Uses elastic collision physics with equal mass
   * Includes position correction to prevent stuck colliders
   *
   * @param c1 - First collider
   * @param c2 - Second collider
   */
  private resolveCircleCollision(c1: Collider, c2: Collider): void {
    // Calculate collision normal (normalized direction vector)
    const dx = c2.position.x - c1.position.x;
    const dy = c2.position.y - c1.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Avoid division by zero
    if (dist === 0) {
      return;
    }

    const nx = dx / dist;
    const ny = dy / dist;

    // Relative velocity
    const dvx = c1.velocity.x - c2.velocity.x;
    const dvy = c1.velocity.y - c2.velocity.y;

    // Relative velocity along normal
    const dvn = dvx * nx + dvy * ny;

    // Do not resolve if velocities are separating
    if (dvn <= 0) {
      return;
    }

    // Elastic collision with equal mass: exchange velocity components along normal
    c1.velocity.x -= dvn * nx;
    c1.velocity.y -= dvn * ny;
    c2.velocity.x += dvn * nx;
    c2.velocity.y += dvn * ny;

    // Position correction (separate overlapping circles)
    const overlap = (c1.radius + c2.radius) - dist;
    const correction = overlap / 2 + COLLISION_EPSILON;

    c1.position.x -= correction * nx;
    c1.position.y -= correction * ny;
    c2.position.x += correction * nx;
    c2.position.y += correction * ny;
  }

  /**
   * Get number of colliders in simulation
   * @returns Collider count
   */
  get colliderCount(): number {
    return this.colliders.size;
  }
}
