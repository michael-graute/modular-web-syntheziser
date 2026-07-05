/**
 * Karplus-Strong DSP helpers — unit tests (no AudioContext required).
 * Feature: 034-karplus-strong-oscillator (T006)
 */

import { describe, it, expect } from 'vitest';
import {
  clampFrequency,
  clampDamping,
  clampTone,
  dampingToFeedbackCoefficient,
  normalizeMode,
  maxDelayLineLength,
  frequencyToDelayLineLength,
  applyStringFeedback,
  applyStretchedFeedback,
  applyFeedbackFilter,
  createSeededRng,
  applyToneFilter,
} from '../../src/worklets/karplus-strong-dsp';
import { KarplusStrongMode } from '../../src/core/types';
import { KARPLUS_STRONG } from '../../src/utils/constants';

describe('clampFrequency', () => {
  it('clamps below minimum to 40 Hz', () => {
    expect(clampFrequency(1)).toBe(KARPLUS_STRONG.MIN_FREQUENCY);
  });

  it('clamps above maximum to 4000 Hz', () => {
    expect(clampFrequency(999999)).toBe(KARPLUS_STRONG.MAX_FREQUENCY);
  });

  it('passes through an in-range value unchanged', () => {
    expect(clampFrequency(440)).toBe(440);
  });

  it('returns minimum for NaN input', () => {
    expect(clampFrequency(NaN)).toBe(KARPLUS_STRONG.MIN_FREQUENCY);
  });
});

describe('clampDamping / clampTone', () => {
  it('clamps damping to [0, 1]', () => {
    expect(clampDamping(-1)).toBe(0);
    expect(clampDamping(2)).toBe(1);
    expect(clampDamping(0.5)).toBe(0.5);
  });

  it('clamps tone to [0, 1]', () => {
    expect(clampTone(-1)).toBe(0);
    expect(clampTone(2)).toBe(1);
    expect(clampTone(0.5)).toBe(0.5);
  });
});

describe('dampingToFeedbackCoefficient', () => {
  it('produces the fastest-decay coefficient (MIN_FEEDBACK_COEFFICIENT) at damping=0', () => {
    expect(dampingToFeedbackCoefficient(0)).toBeCloseTo(KARPLUS_STRONG.MIN_FEEDBACK_COEFFICIENT, 10);
  });

  it('approaches but never reaches 1.0 at damping=1 (MAX_FEEDBACK_COEFFICIENT)', () => {
    const coeff = dampingToFeedbackCoefficient(1);
    expect(coeff).toBeCloseTo(KARPLUS_STRONG.MAX_FEEDBACK_COEFFICIENT, 10);
    expect(coeff).toBeLessThan(1.0);
  });

  it('is monotonically increasing with damping', () => {
    const low = dampingToFeedbackCoefficient(0.2);
    const high = dampingToFeedbackCoefficient(0.8);
    expect(high).toBeGreaterThan(low);
  });
});

describe('normalizeMode', () => {
  it('returns STRING for missing/invalid input (backward compatibility)', () => {
    expect(normalizeMode(undefined)).toBe(KarplusStrongMode.STRING);
    expect(normalizeMode(null)).toBe(KarplusStrongMode.STRING);
    expect(normalizeMode(99)).toBe(KarplusStrongMode.STRING);
    expect(normalizeMode('stretched')).toBe(KarplusStrongMode.STRING);
  });

  it('returns STRETCHED when explicitly set', () => {
    expect(normalizeMode(KarplusStrongMode.STRETCHED)).toBe(KarplusStrongMode.STRETCHED);
  });

  it('returns STRING when explicitly set', () => {
    expect(normalizeMode(KarplusStrongMode.STRING)).toBe(KarplusStrongMode.STRING);
  });
});

describe('delay-line length calculation', () => {
  it('maxDelayLineLength covers the lowest supported frequency', () => {
    const sampleRate = 44100;
    const len = maxDelayLineLength(sampleRate);
    expect(len).toBeGreaterThanOrEqual(sampleRate / KARPLUS_STRONG.MIN_FREQUENCY);
  });

  it('frequencyToDelayLineLength produces a shorter length for higher frequencies', () => {
    const sampleRate = 44100;
    const lowFreqLen = frequencyToDelayLineLength(100, sampleRate);
    const highFreqLen = frequencyToDelayLineLength(2000, sampleRate);
    expect(highFreqLen).toBeLessThan(lowFreqLen);
  });

  it('clamps out-of-range CV-derived frequencies before computing length', () => {
    const sampleRate = 44100;
    const extremeLow = frequencyToDelayLineLength(-100, sampleRate);
    const extremeHigh = frequencyToDelayLineLength(999999, sampleRate);
    expect(extremeLow).toBe(frequencyToDelayLineLength(KARPLUS_STRONG.MIN_FREQUENCY, sampleRate));
    expect(extremeHigh).toBe(frequencyToDelayLineLength(KARPLUS_STRONG.MAX_FREQUENCY, sampleRate));
  });

  it('never returns a length below 2 samples', () => {
    expect(frequencyToDelayLineLength(KARPLUS_STRONG.MAX_FREQUENCY, 44100)).toBeGreaterThanOrEqual(2);
  });
});

describe('applyStringFeedback', () => {
  it('averages the two previous samples scaled by the coefficient', () => {
    expect(applyStringFeedback(0.9, 1.0, 0.5)).toBeCloseTo(0.9 * 0.5 * 1.5, 10);
  });

  it('produces zero output when both previous samples are zero', () => {
    expect(applyStringFeedback(0.9, 0, 0)).toBe(0);
  });
});

describe('applyStretchedFeedback vs applyStringFeedback', () => {
  it('produces measurably different output statistics than STRING given identical seed/damping', () => {
    const rng = createSeededRng(12345);
    const coefficient = 0.9;
    let prev1 = 1.0;
    let prev2 = 0.5;
    let signFlips = 0;
    const n = 2000;

    for (let i = 0; i < n; i++) {
      const stringResult = applyStringFeedback(coefficient, prev1, prev2);
      const stretchedResult = applyStretchedFeedback(coefficient, prev1, prev2, rng);
      if (Math.sign(stretchedResult) !== Math.sign(stringResult) && stringResult !== 0) {
        signFlips++;
      }
      prev2 = prev1;
      prev1 = stretchedResult;
    }

    // Some (but not most) samples should have flipped sign relative to the
    // deterministic STRING output, proving STRETCHED diverges statistically.
    expect(signFlips).toBeGreaterThan(0);
    expect(signFlips).toBeLessThan(n * 0.5);
  });
});

describe('applyFeedbackFilter dispatch', () => {
  it('dispatches to applyStringFeedback for STRING mode', () => {
    const result = applyFeedbackFilter(KarplusStrongMode.STRING, 0.9, 1.0, 0.5, () => 0.5);
    expect(result).toBe(applyStringFeedback(0.9, 1.0, 0.5));
  });

  it('dispatches to applyStretchedFeedback for STRETCHED mode', () => {
    const rng = () => 0.01; // forces the sign-inversion branch
    const result = applyFeedbackFilter(KarplusStrongMode.STRETCHED, 0.9, 1.0, 0.5, rng);
    expect(result).toBe(applyStretchedFeedback(0.9, 1.0, 0.5, rng));
  });
});

describe('createSeededRng', () => {
  it('produces values in [0, 1)', () => {
    const rng = createSeededRng(42);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic for a given seed', () => {
    const rngA = createSeededRng(7);
    const rngB = createSeededRng(7);
    const seqA = Array.from({ length: 10 }, () => rngA());
    const seqB = Array.from({ length: 10 }, () => rngB());
    expect(seqA).toEqual(seqB);
  });
});

describe('applyToneFilter', () => {
  it('produces a brighter (less smoothed) result at tone=1 than tone=0', () => {
    const noiseSample = 1.0;
    const prevFiltered = 0.0;
    const bright = applyToneFilter(1, noiseSample, prevFiltered);
    const dull = applyToneFilter(0, noiseSample, prevFiltered);
    expect(bright).toBeGreaterThan(dull);
  });

  it('clamps tone before computing the filter coefficient', () => {
    const withClamp = applyToneFilter(1, 1.0, 0.0);
    const overRange = applyToneFilter(5, 1.0, 0.0);
    expect(overRange).toBe(withClamp);
  });
});

// ---------------------------------------------------------------------------
// Rapid re-trigger stress test (T038, SC-007) — simulates the worklet's own
// pluck/process loop (matching karplus-strong.worklet.ts's corrected feedback
// indexing: reads from writeIndex/writeIndex-1, one full period back) at a
// high re-trigger rate, asserting no NaN/Infinity and no unbounded growth.
// ---------------------------------------------------------------------------

describe('rapid re-trigger numerical stability (SC-007)', () => {
  function simulatePluck(
    delayLine: Float32Array,
    activeLength: number,
    rng: () => number,
    tone: number
  ): number {
    let toneFilterState = 0;
    for (let i = 0; i < activeLength; i++) {
      const noiseSample = rng() * 2 - 1;
      toneFilterState = applyToneFilter(tone, noiseSample, toneFilterState);
      delayLine[i] = toneFilterState;
    }
    return 0; // writeIndex reset to 0
  }

  function simulateProcessBlock(
    delayLine: Float32Array,
    activeLength: number,
    writeIndex: number,
    coefficient: number,
    mode: Parameters<typeof applyFeedbackFilter>[0],
    rng: () => number,
    blockSize: number
  ): { writeIndex: number; samples: number[] } {
    const samples: number[] = [];
    for (let i = 0; i < blockSize; i++) {
      const idx1 = writeIndex;
      const idx2 = (writeIndex - 1 + activeLength) % activeLength;
      const prev1 = delayLine[idx1] ?? 0;
      const prev2 = delayLine[idx2] ?? 0;
      const filtered = applyFeedbackFilter(mode, coefficient, prev1, prev2, rng);
      delayLine[idx1] = filtered;
      samples.push(filtered);
      writeIndex = (writeIndex + 1) % activeLength;
    }
    return { writeIndex, samples };
  }

  it('produces no NaN/Infinity and no unbounded growth at ≥10 re-triggers/sec', () => {
    const sampleRate = 44100;
    const frequency = 220;
    const activeLength = frequencyToDelayLineLength(frequency, sampleRate);
    const delayLine = new Float32Array(maxDelayLineLength(sampleRate));
    const rng = createSeededRng(12345);
    const coefficient = dampingToFeedbackCoefficient(0.5);
    const tone = 0.5;

    let writeIndex = 0;
    const blockSize = 128;
    // 10 triggers/sec at 44.1kHz ≈ one re-pluck every 4410 samples (~34 blocks).
    const blocksBetweenPlucks = Math.floor(4410 / blockSize);
    const totalBlocks = blocksBetweenPlucks * 50; // 50 re-triggers total

    let allSamples: number[] = [];
    for (let block = 0; block < totalBlocks; block++) {
      if (block % blocksBetweenPlucks === 0) {
        writeIndex = simulatePluck(delayLine, activeLength, rng, tone);
      }
      const result = simulateProcessBlock(
        delayLine,
        activeLength,
        writeIndex,
        coefficient,
        0 as Parameters<typeof applyFeedbackFilter>[0], // STRING mode
        rng,
        blockSize
      );
      writeIndex = result.writeIndex;
      allSamples = allSamples.concat(result.samples);
    }

    expect(allSamples.length).toBeGreaterThan(0);
    for (const sample of allSamples) {
      expect(Number.isNaN(sample)).toBe(false);
      expect(Number.isFinite(sample)).toBe(true);
    }

    const maxAbs = allSamples.reduce((max, s) => Math.max(max, Math.abs(s)), 0);
    // Bounded by the noise burst's amplitude range; the feedback coefficient
    // is strictly < 1.0, so output must never grow beyond the initial excitation.
    expect(maxAbs).toBeLessThanOrEqual(1.5);
  });

  it('handles re-triggering faster than the DSP can decay without runaway amplitude', () => {
    const sampleRate = 44100;
    const frequency = 440;
    const activeLength = frequencyToDelayLineLength(frequency, sampleRate);
    const delayLine = new Float32Array(maxDelayLineLength(sampleRate));
    const rng = createSeededRng(999);
    const coefficient = dampingToFeedbackCoefficient(1); // max sustain — worst case for runaway
    const tone = 1;

    let writeIndex = 0;
    // Re-pluck every single block (128 samples ≈ 2.9ms) — far faster than 10/sec.
    for (let trigger = 0; trigger < 200; trigger++) {
      writeIndex = simulatePluck(delayLine, activeLength, rng, tone);
      const result = simulateProcessBlock(
        delayLine,
        activeLength,
        writeIndex,
        coefficient,
        0 as Parameters<typeof applyFeedbackFilter>[0],
        rng,
        128
      );
      writeIndex = result.writeIndex;

      for (const sample of result.samples) {
        expect(Number.isFinite(sample)).toBe(true);
      }
    }

    // Final delay-line state must still be finite and bounded.
    for (let i = 0; i < activeLength; i++) {
      expect(Number.isFinite(delayLine[i])).toBe(true);
      expect(Math.abs(delayLine[i]!)).toBeLessThanOrEqual(1.5);
    }
  });
});
