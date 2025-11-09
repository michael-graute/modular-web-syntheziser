/**
 * Vector2D Unit Tests
 * Tests vector mathematics operations
 */

import { describe, it, expect } from 'vitest';
import { Vector2D } from '../../../src/physics/Vector2D';

describe('Vector2D', () => {
  describe('constructor', () => {
    it('should create a vector with x and y values', () => {
      const v = new Vector2D(3, 4);
      expect(v.x).toBe(3);
      expect(v.y).toBe(4);
    });
  });

  describe('add', () => {
    it('should add two vectors correctly', () => {
      const v1 = new Vector2D(1, 2);
      const v2 = new Vector2D(3, 4);
      const result = v1.add(v2);

      expect(result.x).toBe(4);
      expect(result.y).toBe(6);
    });

    it('should not modify original vectors', () => {
      const v1 = new Vector2D(1, 2);
      const v2 = new Vector2D(3, 4);
      v1.add(v2);

      expect(v1.x).toBe(1);
      expect(v1.y).toBe(2);
    });
  });

  describe('subtract', () => {
    it('should subtract two vectors correctly', () => {
      const v1 = new Vector2D(5, 7);
      const v2 = new Vector2D(2, 3);
      const result = v1.subtract(v2);

      expect(result.x).toBe(3);
      expect(result.y).toBe(4);
    });
  });

  describe('magnitude', () => {
    it('should calculate magnitude for 3-4-5 triangle', () => {
      const v = new Vector2D(3, 4);
      expect(v.magnitude()).toBe(5);
    });

    it('should return 0 for zero vector', () => {
      const v = new Vector2D(0, 0);
      expect(v.magnitude()).toBe(0);
    });

    it('should handle negative values correctly', () => {
      const v = new Vector2D(-3, -4);
      expect(v.magnitude()).toBe(5);
    });
  });

  describe('normalize', () => {
    it('should create unit vector from non-zero vector', () => {
      const v = new Vector2D(3, 4);
      const normalized = v.normalize();

      expect(normalized.magnitude()).toBeCloseTo(1, 10);
      expect(normalized.x).toBeCloseTo(0.6, 10);
      expect(normalized.y).toBeCloseTo(0.8, 10);
    });

    it('should return zero vector when normalizing zero vector', () => {
      const v = new Vector2D(0, 0);
      const normalized = v.normalize();

      expect(normalized.x).toBe(0);
      expect(normalized.y).toBe(0);
    });

    it('should preserve direction', () => {
      const v = new Vector2D(10, 0);
      const normalized = v.normalize();

      expect(normalized.x).toBeCloseTo(1, 10);
      expect(normalized.y).toBe(0);
    });
  });

  describe('dot', () => {
    it('should calculate dot product correctly', () => {
      const v1 = new Vector2D(2, 3);
      const v2 = new Vector2D(4, 5);
      const result = v1.dot(v2);

      expect(result).toBe(23); // 2*4 + 3*5 = 8 + 15 = 23
    });

    it('should return 0 for perpendicular vectors', () => {
      const v1 = new Vector2D(1, 0);
      const v2 = new Vector2D(0, 1);
      const result = v1.dot(v2);

      expect(result).toBe(0);
    });
  });

  describe('scale', () => {
    it('should scale vector by positive scalar', () => {
      const v = new Vector2D(2, 3);
      const scaled = v.scale(3);

      expect(scaled.x).toBe(6);
      expect(scaled.y).toBe(9);
    });

    it('should scale vector by negative scalar', () => {
      const v = new Vector2D(2, 3);
      const scaled = v.scale(-2);

      expect(scaled.x).toBe(-4);
      expect(scaled.y).toBe(-6);
    });
  });

  describe('distanceTo', () => {
    it('should calculate distance between two vectors', () => {
      const v1 = new Vector2D(0, 0);
      const v2 = new Vector2D(3, 4);
      const distance = v1.distanceTo(v2);

      expect(distance).toBe(5);
    });

    it('should return 0 for same position', () => {
      const v1 = new Vector2D(5, 5);
      const v2 = new Vector2D(5, 5);
      const distance = v1.distanceTo(v2);

      expect(distance).toBe(0);
    });
  });

  describe('distanceToSquared', () => {
    it('should calculate squared distance without sqrt', () => {
      const v1 = new Vector2D(0, 0);
      const v2 = new Vector2D(3, 4);
      const distanceSquared = v1.distanceToSquared(v2);

      expect(distanceSquared).toBe(25); // 3^2 + 4^2 = 9 + 16 = 25
    });
  });

  describe('clone', () => {
    it('should create a copy of the vector', () => {
      const v = new Vector2D(5, 7);
      const clone = v.clone();

      expect(clone.x).toBe(5);
      expect(clone.y).toBe(7);
      expect(clone).not.toBe(v);
    });
  });

  describe('static from', () => {
    it('should create Vector2D from plain object', () => {
      const obj = { x: 3, y: 4 };
      const v = Vector2D.from(obj);

      expect(v).toBeInstanceOf(Vector2D);
      expect(v.x).toBe(3);
      expect(v.y).toBe(4);
    });
  });

  describe('static zero', () => {
    it('should create zero vector', () => {
      const v = Vector2D.zero();

      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
    });
  });
});
