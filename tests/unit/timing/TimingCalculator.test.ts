/**
 * TimingCalculator Unit Tests
 * Tests BPM to duration conversions
 */

import { describe, it, expect } from 'vitest';
import { TimingCalculator } from '../../../src/timing/TimingCalculator';
import { GateSize } from '../../../specs/006-collider-musical-physics/contracts/types';

describe('TimingCalculator', () => {
  const calculator = new TimingCalculator();

  describe('calculateGateDuration', () => {
    it('should calculate quarter note at 120 BPM as 500ms', () => {
      const duration = calculator.calculateGateDuration(120, GateSize.QUARTER);
      expect(duration).toBe(500);
    });

    it('should calculate sixteenth note at 120 BPM as 125ms', () => {
      const duration = calculator.calculateGateDuration(120, GateSize.SIXTEENTH);
      expect(duration).toBe(125);
    });

    it('should calculate whole note at 60 BPM as 4000ms', () => {
      const duration = calculator.calculateGateDuration(60, GateSize.WHOLE);
      expect(duration).toBe(4000);
    });

    it('should handle BPM boundaries correctly', () => {
      const slowDuration = calculator.calculateGateDuration(30, GateSize.QUARTER); // Slow
      const fastDuration = calculator.calculateGateDuration(300, GateSize.QUARTER); // Fast

      expect(slowDuration).toBe(2000); // 60000 / 30 = 2000ms
      expect(fastDuration).toBe(200); // 60000 / 300 = 200ms
    });

    it('should calculate all gate sizes for 120 BPM', () => {
      expect(calculator.calculateGateDuration(120, GateSize.WHOLE)).toBe(2000);
      expect(calculator.calculateGateDuration(120, GateSize.HALF)).toBe(1000);
      expect(calculator.calculateGateDuration(120, GateSize.QUARTER)).toBe(500);
      expect(calculator.calculateGateDuration(120, GateSize.EIGHTH)).toBe(250);
      expect(calculator.calculateGateDuration(120, GateSize.SIXTEENTH)).toBe(125);
    });

    it('should throw error for invalid BPM', () => {
      expect(() => calculator.calculateGateDuration(0, GateSize.QUARTER)).toThrow();
      expect(() => calculator.calculateGateDuration(-1, GateSize.QUARTER)).toThrow();
      expect(() => calculator.calculateGateDuration(Infinity, GateSize.QUARTER)).toThrow();
    });
  });

  describe('isValidBPM', () => {
    it('should validate BPM within range', () => {
      expect(calculator.isValidBPM(30)).toBe(true);
      expect(calculator.isValidBPM(120)).toBe(true);
      expect(calculator.isValidBPM(300)).toBe(true);
    });

    it('should reject BPM outside range', () => {
      expect(calculator.isValidBPM(29)).toBe(false);
      expect(calculator.isValidBPM(301)).toBe(false);
      expect(calculator.isValidBPM(Infinity)).toBe(false);
    });
  });
});
