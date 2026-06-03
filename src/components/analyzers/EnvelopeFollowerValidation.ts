/**
 * Validation helpers for the Envelope Follower component.
 * Feature: 030-envelope-follower
 */

export interface EnvelopeFollowerParams {
  attack: number;   // ms, integer in [1, 500]
  release: number;  // ms, multiple-of-5 in [5, 2000]
  gain: number;     // linear scalar in [0.1, 4.0]
}

const DEFAULTS: EnvelopeFollowerParams = {
  attack: 10,
  release: 100,
  gain: 1.0,
};

/** Clamps attack to [1, 500] ms (integer). */
export function validateAttack(value: unknown): number {
  const n = typeof value === 'number' && isFinite(value) ? value : DEFAULTS.attack;
  return Math.round(Math.min(500, Math.max(1, n)));
}

/** Clamps release to [5, 2000] ms, rounded to nearest 5 ms multiple. */
export function validateRelease(value: unknown): number {
  const n = typeof value === 'number' && isFinite(value) ? value : DEFAULTS.release;
  const clamped = Math.min(2000, Math.max(5, n));
  return Math.round(clamped / 5) * 5;
}

/** Clamps gain to [0.1, 4.0], rounded to 2 decimal places. */
export function validateGain(value: unknown): number {
  const n = typeof value === 'number' && isFinite(value) ? value : DEFAULTS.gain;
  const clamped = Math.min(4.0, Math.max(0.1, n));
  return Math.round(clamped * 100) / 100;
}

/** Validates and normalises a full parameter record from patch data. */
export function validateEnvelopeFollowerParams(
  params: Partial<Record<string, number>>
): EnvelopeFollowerParams {
  return {
    attack: validateAttack(params['attack']),
    release: validateRelease(params['release']),
    gain: validateGain(params['gain']),
  };
}

/** Clamps an envelope value to [0, 1]. */
export function clampEnvelope(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Computes the IIR smoothing coefficient for a given time constant and frame delta.
 * Returns 1 (instantaneous) when timeMs <= 0.
 */
export function computeSmoothingCoeff(timeMs: number, dtSec: number): number {
  if (timeMs <= 0) return 1;
  return 1 - Math.exp(-dtSec / (timeMs / 1000));
}
