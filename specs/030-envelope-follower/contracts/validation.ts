/**
 * Validation helpers for the Envelope Follower component (030-envelope-follower).
 *
 * Used by the component's deserialize() to clamp/default incoming patch data,
 * and by tests to verify parameter values stay in range.
 */

import type { EnvelopeFollowerPersistenceParams } from './types';

const DEFAULTS: EnvelopeFollowerPersistenceParams = {
  attack: 10,
  release: 100,
  gain: 1.0,
};

/**
 * Clamps attack to [1, 500] ms (integer).
 */
export function validateAttack(value: unknown): number {
  const n = typeof value === 'number' && isFinite(value) ? value : DEFAULTS.attack;
  return Math.round(Math.min(500, Math.max(1, n)));
}

/**
 * Clamps release to [5, 2000] ms. Rounds to nearest 5 ms multiple.
 */
export function validateRelease(value: unknown): number {
  const n = typeof value === 'number' && isFinite(value) ? value : DEFAULTS.release;
  const clamped = Math.min(2000, Math.max(5, n));
  return Math.round(clamped / 5) * 5;
}

/**
 * Clamps gain to [0.1, 4.0], rounded to 2 decimal places.
 */
export function validateGain(value: unknown): number {
  const n = typeof value === 'number' && isFinite(value) ? value : DEFAULTS.gain;
  const clamped = Math.min(4.0, Math.max(0.1, n));
  return Math.round(clamped * 100) / 100;
}

/**
 * Validates and normalises a full parameter record from patch data.
 * Missing keys fall back to defaults.
 */
export function validateEnvelopeFollowerParams(
  params: Partial<Record<string, number>>
): EnvelopeFollowerPersistenceParams {
  return {
    attack: validateAttack(params['attack']),
    release: validateRelease(params['release']),
    gain: validateGain(params['gain']),
  };
}

/**
 * Clamps an envelope value to [0, 1].
 * Used before writing to ConstantSourceNode.offset.
 */
export function clampEnvelope(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Computes the IIR smoothing coefficient for a given time constant and frame delta.
 * @param timeMs  Time constant in milliseconds.
 * @param dtSec   Frame delta time in seconds.
 */
export function computeSmoothingCoeff(timeMs: number, dtSec: number): number {
  if (timeMs <= 0) return 1;
  return 1 - Math.exp(-dtSec / (timeMs / 1000));
}
