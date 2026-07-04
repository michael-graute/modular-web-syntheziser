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
 * Maps normalized Damping (0-1) to a feedback coefficient strictly below 1.0,
 * guaranteeing the string always eventually decays to silence.
 */
export function dampingToFeedbackCoefficient(damping: number): number {
  return clampDamping(damping) * KARPLUS_STRONG.MAX_FEEDBACK_COEFFICIENT;
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
