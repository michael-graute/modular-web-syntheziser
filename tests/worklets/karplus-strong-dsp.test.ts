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
  applyMutedFeedback,
  applyMetallicFeedback,
  metallicDetuneOffset,
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
  const SAMPLE_RATE = 44100;

  it('matches the empirically-measured table endpoint at damping=0', () => {
    expect(dampingToFeedbackCoefficient(0, SAMPLE_RATE)).toBeCloseTo(0.929602, 5);
  });

  it('matches the empirically-measured table endpoint at damping=1, strictly below 1.0', () => {
    const coeff = dampingToFeedbackCoefficient(1, SAMPLE_RATE);
    expect(coeff).toBeCloseTo(0.996483, 5);
    expect(coeff).toBeLessThan(1.0);
  });

  it('is monotonically increasing with damping', () => {
    const low = dampingToFeedbackCoefficient(0.2, SAMPLE_RATE);
    const high = dampingToFeedbackCoefficient(0.8, SAMPLE_RATE);
    expect(high).toBeGreaterThan(low);
  });

  it('interpolates linearly between adjacent table anchors', () => {
    // damping=0.125 is exactly halfway between the damping=0 and damping=0.25 anchors
    const at0 = dampingToFeedbackCoefficient(0, SAMPLE_RATE);
    const at025 = dampingToFeedbackCoefficient(0.25, SAMPLE_RATE);
    const atMid = dampingToFeedbackCoefficient(0.125, SAMPLE_RATE);
    expect(atMid).toBeCloseTo((at0 + at025) / 2, 6);
  });

  it('is sample-rate-independent (the lookup table itself does not vary with sampleRate)', () => {
    const at44100 = dampingToFeedbackCoefficient(0.5, 44100);
    const at48000 = dampingToFeedbackCoefficient(0.5, 48000);
    expect(at44100).toBe(at48000);
  });
});

// ---------------------------------------------------------------------------
// Regression test for the "Damping has no audible effect" bug: an earlier
// closed-form formula for dampingToFeedbackCoefficient produced coefficients
// that, when run through the ACTUAL feedback loop (applyStringFeedback in a
// circular delay-line, matching karplus-strong.worklet.ts's process()), gave
// nearly IDENTICAL decay curves regardless of damping — the formula was
// correct in isolation but did not model this filter's real decay behavior.
// This test simulates the real feedback loop end-to-end and asserts that
// different Damping settings produce MEASURABLY different decay times.
// ---------------------------------------------------------------------------

describe('dampingToFeedbackCoefficient produces an audibly different decay in the real feedback loop', () => {
  function simulateDecayPeriods(damping: number, activeLength: number, sampleRate: number, seed: number): number {
    const coefficient = dampingToFeedbackCoefficient(damping, sampleRate);
    const rng = createSeededRng(seed);
    const delayLine = new Float32Array(activeLength);

    let toneFilterState = 0;
    for (let i = 0; i < activeLength; i++) {
      const noiseSample = rng() * 2 - 1;
      toneFilterState = applyToneFilter(0.5, noiseSample, toneFilterState);
      delayLine[i] = toneFilterState;
    }

    const maxPeriods = 3000;
    const periodPeaks: number[] = [];
    let writeIndex = 0;
    let currentPeriodPeak = 0;
    let samplesInPeriod = 0;

    while (periodPeaks.length < maxPeriods) {
      const idx1 = writeIndex;
      const idx2 = (writeIndex - 1 + activeLength) % activeLength;
      const filtered = applyStringFeedback(coefficient, delayLine[idx1]!, delayLine[idx2]!);
      delayLine[idx1] = filtered;
      currentPeriodPeak = Math.max(currentPeriodPeak, Math.abs(filtered));
      samplesInPeriod++;
      if (samplesInPeriod >= activeLength) {
        periodPeaks.push(currentPeriodPeak);
        currentPeriodPeak = 0;
        samplesInPeriod = 0;
      }
      writeIndex = (writeIndex + 1) % activeLength;
    }

    const initialPeak = Math.max(...periodPeaks.slice(0, 5));
    const threshold = initialPeak * Math.pow(10, -60 / 20);
    for (let i = 0; i < periodPeaks.length; i++) {
      if (periodPeaks[i]! < threshold) return i;
    }
    return maxPeriods; // did not decay within the simulation window
  }

  it('damping=1.0 rings out for measurably more periods than damping=0.0', () => {
    const sampleRate = 44100;
    const activeLength = 44; // ~1 kHz, short enough to simulate quickly

    const shortDecay = simulateDecayPeriods(0, activeLength, sampleRate, 3);
    const longDecay = simulateDecayPeriods(1, activeLength, sampleRate, 3);

    // The bug this guards against showed damping=0 and damping=1 producing
    // nearly IDENTICAL decay (within ~10%). A working implementation must
    // show at least a 3x difference in periods-to-decay across the full range.
    expect(longDecay).toBeGreaterThan(shortDecay * 3);
  });

  it('damping=0.5 rings out longer than damping=0.0 but shorter than damping=1.0', () => {
    const sampleRate = 44100;
    const activeLength = 44;

    const shortDecay = simulateDecayPeriods(0, activeLength, sampleRate, 7);
    const midDecay = simulateDecayPeriods(0.5, activeLength, sampleRate, 7);
    const longDecay = simulateDecayPeriods(1, activeLength, sampleRate, 7);

    expect(midDecay).toBeGreaterThan(shortDecay);
    expect(midDecay).toBeLessThan(longDecay);
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
  it('passes prev1 through unchanged when the RNG selects the skip-damping branch', () => {
    // rng() always returns 0, which is < STRETCH_SKIP_DAMPING_PROBABILITY,
    // so damping is skipped entirely this cycle: output === prev1 exactly.
    const result = applyStretchedFeedback(0.9, 1.0, 0.5, () => 0);
    expect(result).toBe(1.0);
  });

  it('applies normal String-mode damping when the RNG selects the damping branch', () => {
    // rng() always returns a value >= STRETCH_SKIP_DAMPING_PROBABILITY (0.4),
    // so every cycle applies normal averaging — identical to applyStringFeedback.
    const result = applyStretchedFeedback(0.9, 1.0, 0.5, () => 0.99);
    expect(result).toBe(applyStringFeedback(0.9, 1.0, 0.5));
  });

  it('produces measurably longer sustain than STRING given identical seed/damping (the actual audible effect)', () => {
    // Regression test for the original bug: an earlier implementation randomly
    // inverted the SIGN of the already-damped output, which made STRETCHED
    // decay to silence FASTER than STRING — the opposite of "extends sustain."
    // This simulates the real feedback loop (matching karplus-strong.worklet.ts)
    // for both modes and asserts STRETCHED rings out for measurably longer.
    function simulateDecayPeriods(mode: KarplusStrongMode, seed: number): number {
      const activeLength = 44; // ~1kHz, short enough to simulate quickly
      const coefficient = dampingToFeedbackCoefficient(0.5, 44100);
      const rng = createSeededRng(seed);
      const delayLine = new Float32Array(activeLength);

      let toneFilterState = 0;
      for (let i = 0; i < activeLength; i++) {
        const noiseSample = rng() * 2 - 1;
        toneFilterState = applyToneFilter(0.5, noiseSample, toneFilterState);
        delayLine[i] = toneFilterState;
      }

      const maxPeriods = 2000;
      const periodPeaks: number[] = [];
      let writeIndex = 0;
      let currentPeriodPeak = 0;
      let samplesInPeriod = 0;
      let mutedState = 0;

      while (periodPeaks.length < maxPeriods) {
        const idx1 = writeIndex;
        const idx2 = (writeIndex - 1 + activeLength) % activeLength;
        const filtered = applyFeedbackFilter(
          mode,
          coefficient,
          delayLine[idx1]!,
          delayLine[idx2]!,
          rng,
          mutedState,
          (next) => { mutedState = next; }
        );
        delayLine[idx1] = filtered;
        currentPeriodPeak = Math.max(currentPeriodPeak, Math.abs(filtered));
        samplesInPeriod++;
        if (samplesInPeriod >= activeLength) {
          periodPeaks.push(currentPeriodPeak);
          currentPeriodPeak = 0;
          samplesInPeriod = 0;
        }
        writeIndex = (writeIndex + 1) % activeLength;
      }

      const initialPeak = Math.max(...periodPeaks.slice(0, 5));
      const threshold = initialPeak * Math.pow(10, -60 / 20);
      for (let i = 0; i < periodPeaks.length; i++) {
        if (periodPeaks[i]! < threshold) return i;
      }
      return maxPeriods;
    }

    const stringDecay = simulateDecayPeriods(KarplusStrongMode.STRING, 3);
    const stretchedDecay = simulateDecayPeriods(KarplusStrongMode.STRETCHED, 3);

    expect(stretchedDecay).toBeGreaterThan(stringDecay);
  });
});

describe('applyMutedFeedback', () => {
  it('smooths the averaged signal toward its own filter state (lowpass behavior)', () => {
    const { output, nextFilterState } = applyMutedFeedback(0.9, 1.0, 1.0, 0);
    // Starting from filter state 0, the output should move toward the
    // averaged value but not reach it in a single step (that's the lowpass).
    const averaged = applyStringFeedback(0.9, 1.0, 1.0);
    expect(output).toBeGreaterThan(0);
    expect(output).toBeLessThan(averaged);
    expect(nextFilterState).toBe(output);
  });

  it('produces a measurably duller (fewer zero-crossings) waveform than STRING', () => {
    function simulateWaveform(mode: KarplusStrongMode, seed: number): number[] {
      const activeLength = 44;
      const coefficient = dampingToFeedbackCoefficient(0.5, 44100);
      const rng = createSeededRng(seed);
      const delayLine = new Float32Array(activeLength);

      let toneFilterState = 0;
      for (let i = 0; i < activeLength; i++) {
        const noiseSample = rng() * 2 - 1;
        toneFilterState = applyToneFilter(0.5, noiseSample, toneFilterState);
        delayLine[i] = toneFilterState;
      }

      const output: number[] = [];
      let writeIndex = 0;
      let mutedState = 0;
      for (let i = 0; i < 4410; i++) {
        // 100ms
        const idx1 = writeIndex;
        const idx2 = (writeIndex - 1 + activeLength) % activeLength;
        const filtered = applyFeedbackFilter(
          mode,
          coefficient,
          delayLine[idx1]!,
          delayLine[idx2]!,
          rng,
          mutedState,
          (next) => { mutedState = next; }
        );
        delayLine[idx1] = filtered;
        output.push(filtered);
        writeIndex = (writeIndex + 1) % activeLength;
      }
      return output;
    }

    function zeroCrossings(sig: number[]): number {
      let count = 0;
      for (let i = 1; i < sig.length; i++) {
        if (sig[i - 1]! >= 0 !== sig[i]! >= 0) count++;
      }
      return count;
    }

    const stringZc = zeroCrossings(simulateWaveform(KarplusStrongMode.STRING, 5));
    const mutedZc = zeroCrossings(simulateWaveform(KarplusStrongMode.MUTED, 5));

    expect(mutedZc).toBeLessThan(stringZc * 0.5);
  });
});

describe('metallicDetuneOffset', () => {
  it('scales with the delay-line length (fixed fraction, not a fixed sample count)', () => {
    const short = metallicDetuneOffset(44); // ~1kHz
    const long = metallicDetuneOffset(1102); // 40Hz
    expect(long).toBeGreaterThan(short * 10);
  });

  it('never returns 0 (would degenerate to the standard tap)', () => {
    expect(metallicDetuneOffset(2)).toBeGreaterThanOrEqual(1);
  });
});

describe('applyMetallicFeedback', () => {
  it('blends the standard averaged tap with the detuned tap', () => {
    const result = applyMetallicFeedback(0.9, 1.0, 1.0, 0.0);
    // prev3=0 pulls the blended result below the pure String-mode average.
    const stringResult = applyStringFeedback(0.9, 1.0, 1.0);
    expect(result).toBeLessThan(stringResult);
    expect(result).toBeGreaterThan(0);
  });

  it('produces measurably inharmonic partials (energy spread away from exact harmonics), unlike STRING', () => {
    // Regression test for the actual intended effect: Metallic must break the
    // harmonic series, not just add brightness/roughness like Stretched/Muted.
    // Verified via a simple DFT magnitude comparison at exact harmonics vs.
    // slightly-detuned (+3%) frequencies — String concentrates energy tightly
    // at exact harmonics; Metallic measurably does not.
    function simulateWaveform(mode: KarplusStrongMode, seed: number): number[] {
      const activeLength = 100; // ~441 Hz
      const sampleRate = 44100;
      const coefficient = dampingToFeedbackCoefficient(0.5, sampleRate);
      const rng = createSeededRng(seed);
      const delayLine = new Float32Array(activeLength);
      const detuneOffset = metallicDetuneOffset(activeLength);

      let toneFilterState = 0;
      for (let i = 0; i < activeLength; i++) {
        const noiseSample = rng() * 2 - 1;
        toneFilterState = applyToneFilter(0.5, noiseSample, toneFilterState);
        delayLine[i] = toneFilterState;
      }

      const output: number[] = [];
      let writeIndex = 0;
      for (let i = 0; i < 2000; i++) {
        const idx1 = writeIndex;
        const idx2 = (writeIndex - 1 + activeLength) % activeLength;
        const idx3 = (writeIndex - detuneOffset + activeLength) % activeLength;
        const filtered = applyFeedbackFilter(
          mode,
          coefficient,
          delayLine[idx1]!,
          delayLine[idx2]!,
          rng,
          0,
          () => {},
          delayLine[idx3]!
        );
        delayLine[idx1] = filtered;
        output.push(filtered);
        writeIndex = (writeIndex + 1) % activeLength;
      }
      return output;
    }

    function dftMagnitude(sig: number[], freq: number, sampleRate: number): number {
      let re = 0;
      let im = 0;
      for (let i = 0; i < sig.length; i++) {
        const angle = (2 * Math.PI * freq * i) / sampleRate;
        re += sig[i]! * Math.cos(angle);
        im += sig[i]! * Math.sin(angle);
      }
      return Math.sqrt(re * re + im * im);
    }

    const sampleRate = 44100;
    const fundamental = sampleRate / 100;
    const stringOut = simulateWaveform(KarplusStrongMode.STRING, 5);
    const metallicOut = simulateWaveform(KarplusStrongMode.METALLIC, 5);

    // On-harmonic vs. 3%-sharp-of-harmonic energy ratio at the 2nd partial —
    // String should concentrate energy tightly at the exact harmonic (low
    // ratio); Metallic should show measurably more energy leaking into the
    // off-harmonic bin (higher ratio), proving it breaks the harmonic series.
    const stringOnHarmonic = dftMagnitude(stringOut, fundamental * 2, sampleRate);
    const stringOffHarmonic = dftMagnitude(stringOut, fundamental * 2 * 1.03, sampleRate);
    const metallicOnHarmonic = dftMagnitude(metallicOut, fundamental * 2, sampleRate);
    const metallicOffHarmonic = dftMagnitude(metallicOut, fundamental * 2 * 1.03, sampleRate);

    const stringRatio = stringOffHarmonic / stringOnHarmonic;
    const metallicRatio = metallicOffHarmonic / metallicOnHarmonic;

    expect(metallicRatio).toBeGreaterThan(stringRatio);
  });
});

describe('applyFeedbackFilter dispatch', () => {
  const noopSetState = () => {};

  it('dispatches to applyStringFeedback for STRING mode', () => {
    const result = applyFeedbackFilter(KarplusStrongMode.STRING, 0.9, 1.0, 0.5, () => 0.5, 0, noopSetState);
    expect(result).toBe(applyStringFeedback(0.9, 1.0, 0.5));
  });

  it('dispatches to applyStretchedFeedback for STRETCHED mode', () => {
    const rng = () => 0.01; // forces the skip-damping branch
    const result = applyFeedbackFilter(KarplusStrongMode.STRETCHED, 0.9, 1.0, 0.5, rng, 0, noopSetState);
    expect(result).toBe(applyStretchedFeedback(0.9, 1.0, 0.5, rng));
  });

  it('dispatches to applyMutedFeedback for MUTED mode and reports the new filter state', () => {
    let reportedState: number | null = null;
    const result = applyFeedbackFilter(
      KarplusStrongMode.MUTED,
      0.9,
      1.0,
      0.5,
      () => 0.5,
      0,
      (next) => { reportedState = next; }
    );
    const expected = applyMutedFeedback(0.9, 1.0, 0.5, 0);
    expect(result).toBe(expected.output);
    expect(reportedState).toBe(expected.nextFilterState);
  });

  it('dispatches to applyMetallicFeedback for METALLIC mode, using the prev3 argument', () => {
    const result = applyFeedbackFilter(
      KarplusStrongMode.METALLIC,
      0.9,
      1.0,
      0.5,
      () => 0.5,
      0,
      noopSetState,
      0.25
    );
    expect(result).toBe(applyMetallicFeedback(0.9, 1.0, 0.5, 0.25));
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
      const filtered = applyFeedbackFilter(mode, coefficient, prev1, prev2, rng, 0, () => {});
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
    const coefficient = dampingToFeedbackCoefficient(0.5, sampleRate);
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
    const coefficient = dampingToFeedbackCoefficient(1, sampleRate); // max sustain — worst case for runaway
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
