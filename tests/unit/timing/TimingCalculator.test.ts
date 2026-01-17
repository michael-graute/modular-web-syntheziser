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
    it('should calculate quarter note at 120 BPM as 125ms', () => {
      // Quarter note duration = 60000/120 = 500ms
      // GateSize.QUARTER = 0.25, so gate = 500 * 0.25 = 125ms
      const duration = calculator.calculateGateDuration(120, GateSize.QUARTER);
      expect(duration).toBe(125);
    });

    it('should calculate sixteenth note at 120 BPM as 31.25ms', () => {
      // Quarter note duration = 60000/120 = 500ms
      // GateSize.SIXTEENTH = 0.0625, so gate = 500 * 0.0625 = 31.25ms
      const duration = calculator.calculateGateDuration(120, GateSize.SIXTEENTH);
      expect(duration).toBe(31.25);
    });

    it('should calculate whole note at 60 BPM as 1000ms', () => {
      // Quarter note duration = 60000/60 = 1000ms
      // GateSize.WHOLE = 1.0, so gate = 1000 * 1.0 = 1000ms
      const duration = calculator.calculateGateDuration(60, GateSize.WHOLE);
      expect(duration).toBe(1000);
    });

    it('should handle BPM boundaries correctly', () => {
      // At 30 BPM: quarter note = 60000/30 = 2000ms, GateSize.QUARTER = 0.25, so 2000*0.25 = 500ms
      const slowDuration = calculator.calculateGateDuration(30, GateSize.QUARTER);
      // At 300 BPM: quarter note = 60000/300 = 200ms, GateSize.QUARTER = 0.25, so 200*0.25 = 50ms
      const fastDuration = calculator.calculateGateDuration(300, GateSize.QUARTER);

      expect(slowDuration).toBe(500);
      expect(fastDuration).toBe(50);
    });

    it('should handle BPM 30 (minimum) and whole note gate duration', () => {
      // At 30 BPM: quarter note = 60000/30 = 2000ms, GateSize.WHOLE = 1.0, so 2000*1.0 = 2000ms
      const duration = calculator.calculateGateDuration(30, GateSize.WHOLE);
      expect(duration).toBe(2000);
    });

    it('should return 12.5ms gate duration for BPM 300 (maximum) and sixteenth note', () => {
      // At 300 BPM: quarter note = 60000/300 = 200ms, GateSize.SIXTEENTH = 0.0625, so 200*0.0625 = 12.5ms
      const duration = calculator.calculateGateDuration(300, GateSize.SIXTEENTH);
      expect(duration).toBe(12.5);
    });

    it('should calculate all gate sizes for 120 BPM', () => {
      // At 120 BPM, quarter note = 60000/120 = 500ms
      expect(calculator.calculateGateDuration(120, GateSize.WHOLE)).toBe(500); // 500 * 1.0
      expect(calculator.calculateGateDuration(120, GateSize.HALF)).toBe(250); // 500 * 0.5
      expect(calculator.calculateGateDuration(120, GateSize.QUARTER)).toBe(125); // 500 * 0.25
      expect(calculator.calculateGateDuration(120, GateSize.EIGHTH)).toBe(62.5); // 500 * 0.125
      expect(calculator.calculateGateDuration(120, GateSize.SIXTEENTH)).toBe(31.25); // 500 * 0.0625
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
