/**
 * Validation contracts for the Karplus-Strong String Synthesizer component.
 * Feature: 034-karplus-strong-oscillator
 *
 * Design-time reference for /speckit.tasks and implementation; mirrors the
 * validation style used by specs/006-collider-musical-physics/contracts/validation.ts.
 */

import {
  KARPLUS_STRONG_MIN_DECAY_TIME_SEC,
  KARPLUS_STRONG_MAX_DECAY_TIME_SEC,
  KARPLUS_STRONG_MAX_FREQUENCY_HZ,
  KARPLUS_STRONG_MIN_FREQUENCY_HZ,
  KarplusStrongMode,
  type KarplusStrongParameters,
} from './types';

/** Clamps a manual/CV-derived frequency to the supported range (FR-012). */
export function clampFrequency(frequencyHz: number): number {
  if (Number.isNaN(frequencyHz)) return KARPLUS_STRONG_MIN_FREQUENCY_HZ;
  return Math.min(KARPLUS_STRONG_MAX_FREQUENCY_HZ, Math.max(KARPLUS_STRONG_MIN_FREQUENCY_HZ, frequencyHz));
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
 * Maps normalized Damping (0-1) LINEARLY TO DECAY TIME (not directly to the
 * feedback coefficient — coefficient-to-decay-time is exponential, so a
 * linear coefficient mapping would concentrate nearly all audible change in
 * the last ~10-20% of the knob's range), then derives the per-sample
 * feedback coefficient (strictly below 1.0, guaranteeing eventual decay to
 * silence — spec Edge Case: "Damping at absolute maximum must not sustain
 * indefinitely or self-oscillate") that produces that decay time.
 */
export function dampingToFeedbackCoefficient(damping: number, sampleRate: number): number {
  const decayReferenceRatio = Math.pow(10, -60 / 20);
  const clamped = clampDamping(damping);
  const decayTimeSec =
    KARPLUS_STRONG_MIN_DECAY_TIME_SEC + clamped * (KARPLUS_STRONG_MAX_DECAY_TIME_SEC - KARPLUS_STRONG_MIN_DECAY_TIME_SEC);
  return Math.pow(decayReferenceRatio, 1 / (decayTimeSec * sampleRate));
}

/** Validates and normalizes a Mode value loaded from persisted patch data (FR-010). */
export function normalizeMode(rawMode: unknown): KarplusStrongMode {
  if (rawMode === KarplusStrongMode.STRETCHED) return KarplusStrongMode.STRETCHED;
  return KarplusStrongMode.STRING; // backward-compatible default for missing/invalid values
}

/** Validates a full parameter set deserialized from ComponentData.parameters. */
export function validateKarplusStrongParameters(
  raw: Partial<Record<keyof KarplusStrongParameters, number>>,
): KarplusStrongParameters {
  return {
    frequency: clampFrequency(raw.frequency ?? Number.NaN),
    damping: clampDamping(raw.damping ?? Number.NaN),
    tone: clampTone(raw.tone ?? Number.NaN),
    mode: normalizeMode(raw.mode),
  };
}

/**
 * Computes the required delay-line buffer length (in samples) to support the
 * lowest supported frequency at a given sample rate — used once at worklet
 * construction to pre-allocate the buffer (no per-process()-call allocation,
 * per Constitution Performance requirement).
 */
export function maxDelayLineLength(sampleRate: number): number {
  return Math.ceil(sampleRate / KARPLUS_STRONG_MIN_FREQUENCY_HZ);
}

/** Computes the active delay-line length (samples) for a given frequency + sample rate. */
export function frequencyToDelayLineLength(frequencyHz: number, sampleRate: number): number {
  const clamped = clampFrequency(frequencyHz);
  return Math.max(2, Math.round(sampleRate / clamped));
}
