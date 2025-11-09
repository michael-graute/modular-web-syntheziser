/**
 * Vector2D - 2D vector mathematics utility
 * Used for position and velocity calculations in physics simulation
 */

import type { Vector2D as IVector2D } from '../../specs/006-collider-musical-physics/contracts/types';

export class Vector2D implements IVector2D {
  constructor(
    public x: number,
    public y: number
  ) {}

  /**
   * Add another vector to this vector
   * @param other - Vector to add
   * @returns New vector representing the sum
   */
  add(other: Vector2D): Vector2D {
    return new Vector2D(this.x + other.x, this.y + other.y);
  }

  /**
   * Subtract another vector from this vector
   * @param other - Vector to subtract
   * @returns New vector representing the difference
   */
  subtract(other: Vector2D): Vector2D {
    return new Vector2D(this.x - other.x, this.y - other.y);
  }

  /**
   * Calculate the magnitude (length) of this vector
   * @returns Magnitude of the vector
   */
  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Normalize this vector (make it unit length)
   * @returns New normalized vector, or zero vector if magnitude is zero
   */
  normalize(): Vector2D {
    const mag = this.magnitude();
    if (mag === 0) {
      return new Vector2D(0, 0);
    }
    return new Vector2D(this.x / mag, this.y / mag);
  }

  /**
   * Calculate dot product with another vector
   * @param other - Vector to calculate dot product with
   * @returns Dot product value
   */
  dot(other: Vector2D): number {
    return this.x * other.x + this.y * other.y;
  }

  /**
   * Multiply vector by a scalar
   * @param scalar - Value to multiply by
   * @returns New scaled vector
   */
  scale(scalar: number): Vector2D {
    return new Vector2D(this.x * scalar, this.y * scalar);
  }

  /**
   * Get distance to another vector
   * @param other - Vector to measure distance to
   * @returns Distance between vectors
   */
  distanceTo(other: Vector2D): number {
    return this.subtract(other).magnitude();
  }

  /**
   * Get squared distance to another vector (avoids sqrt for performance)
   * @param other - Vector to measure distance to
   * @returns Squared distance between vectors
   */
  distanceToSquared(other: Vector2D): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return dx * dx + dy * dy;
  }

  /**
   * Create a copy of this vector
   * @returns New vector with same values
   */
  clone(): Vector2D {
    return new Vector2D(this.x, this.y);
  }

  /**
   * Create vector from plain object
   * @param obj - Object with x and y properties
   * @returns New Vector2D instance
   */
  static from(obj: IVector2D): Vector2D {
    return new Vector2D(obj.x, obj.y);
  }

  /**
   * Create zero vector
   * @returns New vector at (0, 0)
   */
  static zero(): Vector2D {
    return new Vector2D(0, 0);
  }
}
