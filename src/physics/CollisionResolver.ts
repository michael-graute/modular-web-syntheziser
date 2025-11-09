/**
 * CollisionResolver - Elastic collision physics calculations
 * Handles collision response with equal mass assumption
 * and wall reflection (angle of incidence = angle of reflection)
 */

import type { Collider, CollisionBoundary } from '../../specs/006-collider-musical-physics/contracts/types';
import { Vector2D } from './Vector2D';

/**
 * Collision resolution constants
 */
const COLLISION_EPSILON = 0.01; // Small epsilon to prevent stuck colliders

/**
 * CollisionResolver handles physics calculations for collisions
 */
export class CollisionResolver {
  /**
   * Resolve wall collision with reflection
   * Angle of incidence equals angle of reflection
   *
   * @param collider - Collider that hit the wall
   * @param wallSide - Which wall was hit
   * @param boundary - Collision boundary
   */
  static resolveWallCollision(
    collider: Collider,
    wallSide: 'left' | 'right' | 'top' | 'bottom',
    boundary: CollisionBoundary
  ): void {
    switch (wallSide) {
      case 'left':
        // Clamp position to boundary
        collider.position.x = boundary.left + collider.radius;
        // Reflect velocity (make positive)
        collider.velocity.x = Math.abs(collider.velocity.x);
        break;

      case 'right':
        // Clamp position to boundary
        collider.position.x = boundary.right - collider.radius;
        // Reflect velocity (make negative)
        collider.velocity.x = -Math.abs(collider.velocity.x);
        break;

      case 'top':
        // Clamp position to boundary
        collider.position.y = boundary.top + collider.radius;
        // Reflect velocity (make positive)
        collider.velocity.y = Math.abs(collider.velocity.y);
        break;

      case 'bottom':
        // Clamp position to boundary
        collider.position.y = boundary.bottom - collider.radius;
        // Reflect velocity (make negative)
        collider.velocity.y = -Math.abs(collider.velocity.y);
        break;
    }
  }

  /**
   * Resolve collision between two circular colliders
   * Uses 2D elastic collision physics with equal mass assumption
   * Includes position correction to prevent stuck colliders
   *
   * For equal mass elastic collisions, the velocities exchange
   * along the collision normal (direction connecting the centers)
   *
   * @param c1 - First collider
   * @param c2 - Second collider
   */
  static resolveCircleCollision(c1: Collider, c2: Collider): void {
    // Calculate collision normal (direction from c1 to c2)
    const dx = c2.position.x - c1.position.x;
    const dy = c2.position.y - c1.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Avoid division by zero (colliders at exact same position)
    if (dist === 0) {
      // Separate colliders slightly in random direction
      const angle = Math.random() * Math.PI * 2;
      c1.position.x += Math.cos(angle) * COLLISION_EPSILON;
      c1.position.y += Math.sin(angle) * COLLISION_EPSILON;
      c2.position.x -= Math.cos(angle) * COLLISION_EPSILON;
      c2.position.y -= Math.sin(angle) * COLLISION_EPSILON;
      return;
    }

    // Normalize collision normal
    const nx = dx / dist;
    const ny = dy / dist;

    // Calculate relative velocity
    const dvx = c1.velocity.x - c2.velocity.x;
    const dvy = c1.velocity.y - c2.velocity.y;

    // Calculate relative velocity along collision normal
    const dvn = dvx * nx + dvy * ny;

    // Do not resolve if velocities are separating
    // (prevents resolving the same collision multiple times)
    if (dvn <= 0) {
      return;
    }

    // For equal mass elastic collision:
    // Exchange velocity components along the collision normal
    // v1_new = v1 - (dvn) * n
    // v2_new = v2 + (dvn) * n
    c1.velocity.x -= dvn * nx;
    c1.velocity.y -= dvn * ny;
    c2.velocity.x += dvn * nx;
    c2.velocity.y += dvn * ny;

    // Position correction to prevent overlap
    // Separate the circles so they're just touching
    const overlap = (c1.radius + c2.radius) - dist;

    if (overlap > 0) {
      // Move each collider half the overlap distance plus epsilon
      const correction = overlap / 2 + COLLISION_EPSILON;

      c1.position.x -= correction * nx;
      c1.position.y -= correction * ny;
      c2.position.x += correction * nx;
      c2.position.y += correction * ny;
    }
  }

  /**
   * Resolve simultaneous collision of a collider with a wall
   * This handles the edge case where a collider hits a wall
   * at the same time it collides with another collider
   *
   * @param collider - Collider to resolve
   * @param wallSide - Wall that was hit
   * @param boundary - Collision boundary
   * @param otherCollider - Other collider involved (optional)
   */
  static resolveSimultaneousCollision(
    collider: Collider,
    wallSide: 'left' | 'right' | 'top' | 'bottom',
    boundary: CollisionBoundary,
    otherCollider?: Collider
  ): void {
    // First resolve wall collision
    CollisionResolver.resolveWallCollision(collider, wallSide, boundary);

    // Then resolve collider collision if present
    if (otherCollider) {
      CollisionResolver.resolveCircleCollision(collider, otherCollider);
    }
  }

  /**
   * Calculate reflection vector for a velocity hitting a surface
   * @param velocity - Incoming velocity vector
   * @param normal - Surface normal vector
   * @returns Reflected velocity vector
   */
  static calculateReflection(velocity: Vector2D, normal: Vector2D): Vector2D {
    // Reflection formula: v' = v - 2(v·n)n
    // where v is velocity, n is surface normal
    const dotProduct = velocity.dot(normal);
    const reflection = velocity.subtract(normal.scale(2 * dotProduct));
    return reflection;
  }

  /**
   * Check if a collision is happening (velocities are approaching)
   * @param c1 - First collider
   * @param c2 - Second collider
   * @returns True if colliders are approaching each other
   */
  static areCollidersApproaching(c1: Collider, c2: Collider): boolean {
    // Calculate relative velocity
    const dvx = c1.velocity.x - c2.velocity.x;
    const dvy = c1.velocity.y - c2.velocity.y;

    // Calculate normal direction (from c1 to c2)
    const dx = c2.position.x - c1.position.x;
    const dy = c2.position.y - c1.position.y;

    // Dot product of relative velocity and normal
    // Positive means separating, negative means approaching
    const dvn = dvx * dx + dvy * dy;

    return dvn > 0;
  }

  /**
   * Calculate collision impulse magnitude for two colliders
   * @param c1 - First collider
   * @param c2 - Second collider
   * @param restitution - Coefficient of restitution (1.0 = perfectly elastic)
   * @returns Impulse magnitude
   */
  static calculateImpulseMagnitude(
    c1: Collider,
    c2: Collider,
    restitution: number = 1.0
  ): number {
    // Calculate collision normal
    const dx = c2.position.x - c1.position.x;
    const dy = c2.position.y - c1.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) {
      return 0;
    }

    const nx = dx / dist;
    const ny = dy / dist;

    // Calculate relative velocity along normal
    const dvx = c1.velocity.x - c2.velocity.x;
    const dvy = c1.velocity.y - c2.velocity.y;
    const dvn = dvx * nx + dvy * ny;

    // Impulse magnitude for equal mass:
    // j = -(1 + e) * v_rel·n / (1/m1 + 1/m2)
    // For m1 = m2 = 1: j = -(1 + e) * v_rel·n / 2
    const impulseMagnitude = -(1 + restitution) * dvn / 2;

    return impulseMagnitude;
  }

  /**
   * Calculate the angle of reflection for a wall collision
   * @param velocity - Incoming velocity
   * @param wallSide - Which wall was hit
   * @returns Angle in radians
   */
  static calculateReflectionAngle(
    velocity: Vector2D,
    wallSide: 'left' | 'right' | 'top' | 'bottom'
  ): number {
    switch (wallSide) {
      case 'left':
      case 'right':
        // Horizontal walls: reflect x component
        return Math.atan2(velocity.y, -velocity.x);

      case 'top':
      case 'bottom':
        // Vertical walls: reflect y component
        return Math.atan2(-velocity.y, velocity.x);
    }
  }
}
