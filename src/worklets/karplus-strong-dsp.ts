/**
 * Karplus-Strong — pure DSP helper functions.
 *
 * Extracted from the AudioWorkletProcessor so they are unit-testable via Vitest
 * without an AudioWorkletGlobalScope (jsdom/Vitest cannot execute one). The
 * processor (karplus-strong.worklet.ts) imports these directly.
 *
 * Feature: 034-karplus-strong-oscillator
 */

import { KARPLUS_STRONG } from '../utils/constants';
import { KarplusStrongMode } from '../core/types';

/** Clamps a manual/CV-derived frequency to the supported range (FR-012). */
export function clampFrequency(frequencyHz: number): number {
  if (Number.isNaN(frequencyHz)) return KARPLUS_STRONG.MIN_FREQUENCY;
  return Math.min(KARPLUS_STRONG.MAX_FREQUENCY, Math.max(KARPLUS_STRONG.MIN_FREQUENCY, frequencyHz));
}

/** Clamps Damping to [0, 1]. */
export function clampDamping(damping: number): number {
  if (Number.isNaN(damping)) return 0;
  return Math.min(1, Math.max(0, damping));
}

/** Clamps Tone to [0, 1]. */
export function clampTone(tone: number): number {
  if (Number.isNaN(tone)) return 0;
  return Math.min(1, Math.max(0, tone));
}

/**
 * Empirically-measured lookup table mapping Damping (0, 0.25, 0.5, 0.75, 1)
 * to the feedback coefficient that produces an evenly-spaced number of
 * delay-line PERIODS to decay to -60dB, for this specific two-tap averaging
 * filter structure (`applyStringFeedback`).
 *
 * This table is NOT derived from a closed-form formula: an earlier attempt
 * assumed decay followed a simple exponential coeff^n over n *samples*, but
 * empirical measurement (simulating the actual feedback loop and directly
 * measuring time-to-silence) showed that assumption was wrong by roughly two
 * orders of magnitude — this filter's amplitude envelope does not decay as
 * a simple per-sample exponential. Periods-to-decay (not seconds-to-decay)
 * is the frequency-independent invariant for a fixed coefficient (verified
 * empirically across the 40Hz-4kHz range, varying by <15%), so absolute
 * decay TIME still scales with pitch (higher notes ring shorter, which is
 * physically realistic for Karplus-Strong), but the coefficient-to-Damping
 * mapping itself does not need to know the frequency.
 *
 * Measured with Tone=0.5, seed=1/3/5, at delay-line lengths of 11, 44, 300,
 * and 1102 samples (4kHz, 1kHz, ~147Hz, 40Hz). Values at intermediate
 * Damping positions are linearly interpolated between the nearest anchors.
 */
const DAMPING_COEFFICIENT_TABLE: readonly number[] = [
  0.929602, // damping = 0.00 (~42 periods to -60dB)
  0.988184, // damping = 0.25 (~225 periods to -60dB)
  0.993554, // damping = 0.50 (~405 periods to -60dB)
  0.995506, // damping = 0.75 (~575 periods to -60dB)
  0.996483, // damping = 1.00 (~725 periods to -60dB)
];

/**
 * Maps normalized Damping (0-1) to a feedback coefficient via linear
 * interpolation over DAMPING_COEFFICIENT_TABLE (see its docs for why this
 * is a lookup table rather than a formula). `sampleRate` is accepted for
 * API symmetry/future use but the table itself is sample-rate-independent.
 */
export function dampingToFeedbackCoefficient(damping: number, _sampleRate: number): number {
  const clamped = clampDamping(damping);
  const lastIndex = DAMPING_COEFFICIENT_TABLE.length - 1;
  const position = clamped * lastIndex;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.min(lowerIndex + 1, lastIndex);
  const frac = position - lowerIndex;
  const lower = DAMPING_COEFFICIENT_TABLE[lowerIndex]!;
  const upper = DAMPING_COEFFICIENT_TABLE[upperIndex]!;
  return lower + frac * (upper - lower);
}

/** Validates and normalizes a Mode value loaded from persisted patch data (FR-010). */
export function normalizeMode(rawMode: unknown): KarplusStrongMode {
  if (rawMode === KarplusStrongMode.STRETCHED) return KarplusStrongMode.STRETCHED;
  return KarplusStrongMode.STRING;
}

/**
 * Computes the required delay-line buffer length (in samples) to support the
 * lowest supported frequency at a given sample rate — used once at worklet
 * construction to pre-allocate the buffer (no per-process()-call allocation).
 */
export function maxDelayLineLength(sampleRate: number): number {
  return Math.ceil(sampleRate / KARPLUS_STRONG.MIN_FREQUENCY);
}

/** Computes the active delay-line length (samples) for a given frequency + sample rate. */
export function frequencyToDelayLineLength(frequencyHz: number, sampleRate: number): number {
  const clamped = clampFrequency(frequencyHz);
  return Math.max(2, Math.round(sampleRate / clamped));
}

/**
 * Applies the "String" mode feedback filter: a simple two-tap averaging lowpass,
 * scaled by the feedback coefficient. Produces a clean plucked-string decay.
 */
export function applyStringFeedback(coefficient: number, prev1: number, prev2: number): number {
  return coefficient * 0.5 * (prev1 + prev2);
}

/**
 * Applies the "Stretched" mode feedback filter (Jaffe & Smith): the averaged
 * sample is randomly sign-inverted with a fixed low probability, extending
 * sustain and adding a percussive/noisy character suited to drum-like sounds.
 */
export function applyStretchedFeedback(
  coefficient: number,
  prev1: number,
  prev2: number,
  rng: () => number
): number {
  const averaged = coefficient * 0.5 * (prev1 + prev2);
  // Fixed low blend probability: mostly pass through, occasionally invert sign.
  const STRETCH_INVERT_PROBABILITY = 0.02;
  return rng() < STRETCH_INVERT_PROBABILITY ? -averaged : averaged;
}

/** Applies the mode-appropriate feedback filter for a single delay-line sample. */
export function applyFeedbackFilter(
  mode: KarplusStrongMode,
  coefficient: number,
  prev1: number,
  prev2: number,
  rng: () => number
): number {
  return mode === KarplusStrongMode.STRETCHED
    ? applyStretchedFeedback(coefficient, prev1, prev2, rng)
    : applyStringFeedback(coefficient, prev1, prev2);
}

/**
 * Simple deterministic pseudo-random generator (mulberry32) — no external RNG
 * dependency, per the project's zero-runtime-deps constraint. Returns a
 * function producing floats in [0, 1).
 */
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function rng(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Applies a one-pole lowpass to a single excitation-noise sample, using the
 * Tone/Pick-Position control to shape excitation brightness (0 = dull/warm,
 * 1 = bright/metallic). Higher tone = higher cutoff = less smoothing.
 */
export function applyToneFilter(tone: number, noiseSample: number, prevFiltered: number): number {
  const clampedTone = clampTone(tone);
  // At tone=1, alpha≈1 (no smoothing, brightest). At tone=0, alpha is small (heavy smoothing, dull).
  const alpha = 0.05 + clampedTone * 0.95;
  return prevFiltered + alpha * (noiseSample - prevFiltered);
}
