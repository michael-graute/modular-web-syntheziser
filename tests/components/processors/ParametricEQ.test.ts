/**
 * ParametricEQ — pure-function contract tests + component integration tests
 *
 * Phase 2 (T006–T009): clampGain, clampLowFreq, clampMidFreq, clampMidQ,
 * clampHighFreq, validateEQConfig, serializeEQConfig, deserializeEQConfig.
 *
 * Feature: 026-parametric-eq
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  clampGain,
  clampLowFreq,
  clampMidFreq,
  clampMidQ,
  clampHighFreq,
  validateEQConfig,
  serializeEQConfig,
  deserializeEQConfig,
} from '../../../specs/026-parametric-eq/contracts/validation';
import {
  DEFAULT_EQ_CONFIG,
  EQ_GAIN_MIN,
  EQ_GAIN_MAX,
  LOW_FREQ_MIN,
  LOW_FREQ_MAX,
  MID_FREQ_MIN,
  MID_FREQ_MAX,
  MID_Q_MIN,
  MID_Q_MAX,
  HIGH_FREQ_MIN,
  HIGH_FREQ_MAX,
} from '../../../specs/026-parametric-eq/contracts/types';

// ---------------------------------------------------------------------------
// clampGain
// ---------------------------------------------------------------------------

describe('clampGain', () => {
  it('passes through value within range', () => {
    expect(clampGain(0)).toBe(0);
    expect(clampGain(6)).toBe(6);
    expect(clampGain(-6)).toBe(-6);
  });

  it('clamps at lower boundary', () => {
    expect(clampGain(EQ_GAIN_MIN)).toBe(EQ_GAIN_MIN);
    expect(clampGain(EQ_GAIN_MIN - 1)).toBe(EQ_GAIN_MIN);
    expect(clampGain(-100)).toBe(EQ_GAIN_MIN);
  });

  it('clamps at upper boundary', () => {
    expect(clampGain(EQ_GAIN_MAX)).toBe(EQ_GAIN_MAX);
    expect(clampGain(EQ_GAIN_MAX + 1)).toBe(EQ_GAIN_MAX);
    expect(clampGain(100)).toBe(EQ_GAIN_MAX);
  });
});

// ---------------------------------------------------------------------------
// clampLowFreq
// ---------------------------------------------------------------------------

describe('clampLowFreq', () => {
  it('passes through value within range', () => {
    expect(clampLowFreq(80)).toBe(80);
    expect(clampLowFreq(400)).toBe(400);
  });

  it('clamps at lower boundary', () => {
    expect(clampLowFreq(LOW_FREQ_MIN)).toBe(LOW_FREQ_MIN);
    expect(clampLowFreq(0)).toBe(LOW_FREQ_MIN);
    expect(clampLowFreq(-1)).toBe(LOW_FREQ_MIN);
  });

  it('clamps at upper boundary', () => {
    expect(clampLowFreq(LOW_FREQ_MAX)).toBe(LOW_FREQ_MAX);
    expect(clampLowFreq(999)).toBe(LOW_FREQ_MAX);
  });
});

// ---------------------------------------------------------------------------
// clampMidFreq
// ---------------------------------------------------------------------------

describe('clampMidFreq', () => {
  it('passes through value within range', () => {
    expect(clampMidFreq(1000)).toBe(1000);
    expect(clampMidFreq(4000)).toBe(4000);
  });

  it('clamps at lower boundary', () => {
    expect(clampMidFreq(MID_FREQ_MIN)).toBe(MID_FREQ_MIN);
    expect(clampMidFreq(0)).toBe(MID_FREQ_MIN);
  });

  it('clamps at upper boundary', () => {
    expect(clampMidFreq(MID_FREQ_MAX)).toBe(MID_FREQ_MAX);
    expect(clampMidFreq(20000)).toBe(MID_FREQ_MAX);
  });
});

// ---------------------------------------------------------------------------
// clampMidQ
// ---------------------------------------------------------------------------

describe('clampMidQ', () => {
  it('passes through value within range', () => {
    expect(clampMidQ(1.0)).toBe(1.0);
    expect(clampMidQ(5.0)).toBe(5.0);
  });

  it('clamps at lower boundary', () => {
    expect(clampMidQ(MID_Q_MIN)).toBe(MID_Q_MIN);
    expect(clampMidQ(0)).toBe(MID_Q_MIN);
    expect(clampMidQ(-1)).toBe(MID_Q_MIN);
  });

  it('clamps at upper boundary', () => {
    expect(clampMidQ(MID_Q_MAX)).toBe(MID_Q_MAX);
    expect(clampMidQ(100)).toBe(MID_Q_MAX);
  });
});

// ---------------------------------------------------------------------------
// clampHighFreq
// ---------------------------------------------------------------------------

describe('clampHighFreq', () => {
  it('passes through value within range', () => {
    expect(clampHighFreq(8000)).toBe(8000);
    expect(clampHighFreq(12000)).toBe(12000);
  });

  it('clamps at lower boundary', () => {
    expect(clampHighFreq(HIGH_FREQ_MIN)).toBe(HIGH_FREQ_MIN);
    expect(clampHighFreq(0)).toBe(HIGH_FREQ_MIN);
  });

  it('clamps at upper boundary', () => {
    expect(clampHighFreq(HIGH_FREQ_MAX)).toBe(HIGH_FREQ_MAX);
    expect(clampHighFreq(30000)).toBe(HIGH_FREQ_MAX);
  });
});

// ---------------------------------------------------------------------------
// validateEQConfig
// ---------------------------------------------------------------------------

describe('validateEQConfig', () => {
  it('returns isValid=true for the default config', () => {
    const result = validateEQConfig({ ...DEFAULT_EQ_CONFIG });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns isValid=true for a non-default valid config', () => {
    const result = validateEQConfig({
      lowGain: 6, lowFreq: 200,
      midGain: -12, midFreq: 500, midQ: 5.0,
      highGain: 3, highFreq: 12000,
    });
    expect(result.isValid).toBe(true);
  });

  it('returns isValid=false when config is not an object', () => {
    expect(validateEQConfig(null).isValid).toBe(false);
    expect(validateEQConfig(undefined).isValid).toBe(false);
    expect(validateEQConfig(42).isValid).toBe(false);
  });

  it('returns errors for NaN values', () => {
    const result = validateEQConfig({ ...DEFAULT_EQ_CONFIG, lowGain: NaN });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('lowGain'))).toBe(true);
  });

  it('returns errors for out-of-range gain', () => {
    const result = validateEQConfig({ ...DEFAULT_EQ_CONFIG, midGain: -100 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('midGain'))).toBe(true);
  });

  it('returns errors for out-of-range frequency', () => {
    const result = validateEQConfig({ ...DEFAULT_EQ_CONFIG, highFreq: 30000 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('highFreq'))).toBe(true);
  });

  it('returns errors for non-numeric values', () => {
    const result = validateEQConfig({ ...DEFAULT_EQ_CONFIG, midQ: 'fast' as any });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('midQ'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// serializeEQConfig / deserializeEQConfig
// ---------------------------------------------------------------------------

describe('serializeEQConfig and deserializeEQConfig', () => {
  it('round-trips the default config exactly', () => {
    const serialized = serializeEQConfig({ ...DEFAULT_EQ_CONFIG });
    const restored = deserializeEQConfig(serialized);
    expect(restored).toEqual(DEFAULT_EQ_CONFIG);
  });

  it('round-trips a non-default config exactly', () => {
    const config = {
      lowGain: 6, lowFreq: 200,
      midGain: -12, midFreq: 500, midQ: 5.0,
      highGain: 3, highFreq: 12000,
    };
    const serialized = serializeEQConfig(config);
    const restored = deserializeEQConfig(serialized);
    expect(restored).toEqual(config);
  });

  it('deserialize falls back to defaults for missing keys', () => {
    const restored = deserializeEQConfig({});
    expect(restored).toEqual(DEFAULT_EQ_CONFIG);
  });

  it('deserialize clamps out-of-range values on restore', () => {
    const restored = deserializeEQConfig({
      lowGain: -100,
      lowFreq: 0,
      midGain: 999,
      midFreq: 0,
      midQ: -5,
      highGain: 100,
      highFreq: 99999,
    });
    expect(restored.lowGain).toBe(EQ_GAIN_MIN);
    expect(restored.lowFreq).toBe(LOW_FREQ_MIN);
    expect(restored.midGain).toBe(EQ_GAIN_MAX);
    expect(restored.midFreq).toBe(MID_FREQ_MIN);
    expect(restored.midQ).toBe(MID_Q_MIN);
    expect(restored.highGain).toBe(EQ_GAIN_MAX);
    expect(restored.highFreq).toBe(HIGH_FREQ_MAX);
  });

  it('serialized output contains all 7 parameter keys', () => {
    const serialized = serializeEQConfig({ ...DEFAULT_EQ_CONFIG });
    const keys = ['lowGain', 'lowFreq', 'midGain', 'midFreq', 'midQ', 'highGain', 'highFreq'];
    for (const key of keys) {
      expect(Object.prototype.hasOwnProperty.call(serialized, key)).toBe(true);
    }
  });
});
