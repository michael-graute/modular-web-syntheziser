/**
 * SlewLimiterValidation — 100% coverage of all exported helpers.
 * Feature: 031-slew-limiter-portamento (T003)
 */

import { describe, it, expect } from 'vitest';
import {
  validateRise,
  validateFall,
  validateSlewLimiterParams,
  clampCv,
  computeSlewCoeff,
  SLEW_LIMITER_DEFAULTS,
  RISE_MIN,
  RISE_MAX,
  FALL_MIN,
  FALL_MAX,
} from '../../../src/components/utilities/SlewLimiterValidation';

// ---------------------------------------------------------------------------
// validateRise
// ---------------------------------------------------------------------------

describe('validateRise', () => {
  it('passes through a valid integer in range', () => {
    expect(validateRise(100)).toBe(100);
  });

  it('accepts minimum boundary 0', () => {
    expect(validateRise(RISE_MIN)).toBe(0);
  });

  it('accepts maximum boundary 5000', () => {
    expect(validateRise(RISE_MAX)).toBe(5000);
  });

  it('clamps negative value to 0', () => {
    expect(validateRise(-100)).toBe(0);
  });

  it('clamps value above maximum to 5000', () => {
    expect(validateRise(9999)).toBe(5000);
  });

  it('rounds fractional values to nearest integer', () => {
    expect(validateRise(100.6)).toBe(101);
    expect(validateRise(100.4)).toBe(100);
  });

  it('uses default for NaN', () => {
    expect(validateRise(NaN)).toBe(SLEW_LIMITER_DEFAULTS.rise);
  });

  it('uses default for Infinity', () => {
    expect(validateRise(Infinity)).toBe(SLEW_LIMITER_DEFAULTS.rise);
  });

  it('uses default for string', () => {
    expect(validateRise('fast')).toBe(SLEW_LIMITER_DEFAULTS.rise);
  });

  it('uses default for undefined', () => {
    expect(validateRise(undefined)).toBe(SLEW_LIMITER_DEFAULTS.rise);
  });
});

// ---------------------------------------------------------------------------
// validateFall
// ---------------------------------------------------------------------------

describe('validateFall', () => {
  it('passes through a valid integer in range', () => {
    expect(validateFall(200)).toBe(200);
  });

  it('accepts minimum boundary 0', () => {
    expect(validateFall(FALL_MIN)).toBe(0);
  });

  it('accepts maximum boundary 5000', () => {
    expect(validateFall(FALL_MAX)).toBe(5000);
  });

  it('clamps negative value to 0', () => {
    expect(validateFall(-1)).toBe(0);
  });

  it('clamps value above maximum to 5000', () => {
    expect(validateFall(10000)).toBe(5000);
  });

  it('rounds fractional values to nearest integer', () => {
    expect(validateFall(250.7)).toBe(251);
  });

  it('uses default for NaN', () => {
    expect(validateFall(NaN)).toBe(SLEW_LIMITER_DEFAULTS.fall);
  });

  it('uses default for Infinity', () => {
    expect(validateFall(Infinity)).toBe(SLEW_LIMITER_DEFAULTS.fall);
  });

  it('uses default for null', () => {
    expect(validateFall(null)).toBe(SLEW_LIMITER_DEFAULTS.fall);
  });
});

// ---------------------------------------------------------------------------
// validateSlewLimiterParams
// ---------------------------------------------------------------------------

describe('validateSlewLimiterParams', () => {
  it('passes through valid params unchanged', () => {
    expect(validateSlewLimiterParams({ rise: 100, fall: 200 })).toEqual({ rise: 100, fall: 200 });
  });

  it('fills missing rise with default', () => {
    expect(validateSlewLimiterParams({ fall: 300 }).rise).toBe(SLEW_LIMITER_DEFAULTS.rise);
  });

  it('fills missing fall with default', () => {
    expect(validateSlewLimiterParams({ rise: 300 }).fall).toBe(SLEW_LIMITER_DEFAULTS.fall);
  });

  it('fills completely empty record with defaults', () => {
    expect(validateSlewLimiterParams({})).toEqual(SLEW_LIMITER_DEFAULTS);
  });

  it('clamps out-of-range values', () => {
    const p = validateSlewLimiterParams({ rise: -100, fall: 99999 });
    expect(p.rise).toBe(0);
    expect(p.fall).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// clampCv
// ---------------------------------------------------------------------------

describe('clampCv', () => {
  it('returns value unchanged when in [0, 1]', () => {
    expect(clampCv(0.5)).toBe(0.5);
  });

  it('clamps to 0 for negative values', () => {
    expect(clampCv(-0.5)).toBe(0);
    expect(clampCv(-10)).toBe(0);
  });

  it('clamps to 1 for values above 1', () => {
    expect(clampCv(1.5)).toBe(1);
    expect(clampCv(100)).toBe(1);
  });

  it('handles exact boundaries 0 and 1', () => {
    expect(clampCv(0)).toBe(0);
    expect(clampCv(1)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeSlewCoeff
// ---------------------------------------------------------------------------

describe('computeSlewCoeff', () => {
  it('returns 1 for timeMs = 0 (instantaneous)', () => {
    expect(computeSlewCoeff(0, 1 / 60)).toBe(1);
  });

  it('returns 1 for negative timeMs', () => {
    expect(computeSlewCoeff(-100, 1 / 60)).toBe(1);
  });

  it('returns a value in (0, 1) for positive time constants', () => {
    const c = computeSlewCoeff(100, 1 / 60);
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(1);
  });

  it('larger time constant → smaller coefficient (slower response)', () => {
    const slow = computeSlewCoeff(2000, 1 / 60);
    const fast = computeSlewCoeff(10, 1 / 60);
    expect(fast).toBeGreaterThan(slow);
  });

  it('produces finite result for maximum time constant (5000 ms)', () => {
    const c = computeSlewCoeff(5000, 1 / 60);
    expect(isFinite(c)).toBe(true);
    expect(c).toBeGreaterThan(0);
  });

  it('returns close to 1 for very small time constant relative to dt', () => {
    // 1 ms time constant, 16 ms dt → nearly instantaneous
    const c = computeSlewCoeff(1, 0.016);
    expect(c).toBeGreaterThan(0.99);
  });
});
