import { describe, it, expect } from 'vitest';
import { _computeCvAmountGain } from '../../../src/components/processors/Filter';

// ---------------------------------------------------------------------------
// computeCvAmountGain — formula: (clamp(amount, 0, 100) / 100) * (max - min)
// Unipolar (ADSR 0..1) scaler — uses full range, not ÷2 like the LFO scaler.
// ---------------------------------------------------------------------------

describe('computeCvAmountGain', () => {
  const CUTOFF_RANGE = { min: 0, max: 20000 };

  it('0% → 0 Hz', () => {
    expect(_computeCvAmountGain(0, CUTOFF_RANGE)).toBe(0);
  });

  it('50% → 10000 Hz (half the cutoff range)', () => {
    expect(_computeCvAmountGain(50, CUTOFF_RANGE)).toBe(10000);
  });

  it('100% → 20000 Hz (full cutoff range)', () => {
    expect(_computeCvAmountGain(100, CUTOFF_RANGE)).toBe(20000);
  });

  it('amount > 100 is clamped to 100', () => {
    expect(_computeCvAmountGain(150, CUTOFF_RANGE)).toBe(_computeCvAmountGain(100, CUTOFF_RANGE));
  });

  it('amount < 0 is clamped to 0', () => {
    expect(_computeCvAmountGain(-10, CUTOFF_RANGE)).toBe(0);
  });

  it('zero-width range → 0 regardless of amount', () => {
    expect(_computeCvAmountGain(75, { min: 1000, max: 1000 })).toBe(0);
  });
});
