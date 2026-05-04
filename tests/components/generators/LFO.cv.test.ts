import { describe, it, expect } from 'vitest';
import { _computeScaleGain } from '../../../src/components/generators/LFO';

// ---------------------------------------------------------------------------
// computeScaleGain — formula: (clamp(depth, 0, 100) / 100) * (max - min) / 2
// ---------------------------------------------------------------------------

describe('computeScaleGain', () => {
  const CUTOFF_RANGE = { min: 0, max: 20000 };
  const DETUNE_RANGE = { min: -100, max: 100 };
  const VCA_RANGE = { min: 0, max: 2 };

  it('0% depth → 0 regardless of range', () => {
    expect(_computeScaleGain(0, CUTOFF_RANGE)).toBe(0);
  });

  it('100% depth, cutoff range → 10000 (full half-swing)', () => {
    expect(_computeScaleGain(100, CUTOFF_RANGE)).toBe(10000);
  });

  it('50% depth, detune range (-100..100) → 50 cents peak', () => {
    // (50/100) * (100 - (-100)) / 2 = 0.5 * 100 = 50
    expect(_computeScaleGain(50, DETUNE_RANGE)).toBe(50);
  });

  it('50% depth, VCA range (0..2) → 0.5', () => {
    // (50/100) * (2 - 0) / 2 = 0.5 * 1 = 0.5
    expect(_computeScaleGain(50, VCA_RANGE)).toBe(0.5);
  });

  it('depth > 100 is clamped to 100', () => {
    expect(_computeScaleGain(150, VCA_RANGE)).toBe(_computeScaleGain(100, VCA_RANGE));
  });

  it('depth < 0 is clamped to 0', () => {
    expect(_computeScaleGain(-10, CUTOFF_RANGE)).toBe(0);
  });

  it('zero-width range → 0 regardless of depth', () => {
    expect(_computeScaleGain(75, { min: 5, max: 5 })).toBe(0);
  });
});
