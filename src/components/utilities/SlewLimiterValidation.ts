/**
 * Validation helpers for the Slew Limiter component.
 * Feature: 031-slew-limiter-portamento
 */

export interface SlewLimiterParams {
  rise: number; // ms in [0, 5000]
  fall: number; // ms in [0, 5000]
}

export const SLEW_LIMITER_DEFAULTS: SlewLimiterParams = {
  rise: 50,
  fall: 50,
};

export const RISE_MIN = 0;
export const RISE_MAX = 5000;
export const FALL_MIN = 0;
export const FALL_MAX = 5000;

/** Clamps rise time to [0, 5000] ms, rounded to nearest integer. */
export function validateRise(value: unknown): number {
  const n = typeof value === 'number' && isFinite(value) ? value : SLEW_LIMITER_DEFAULTS.rise;
  return Math.round(Math.min(RISE_MAX, Math.max(RISE_MIN, n)));
}

/** Clamps fall time to [0, 5000] ms, rounded to nearest integer. */
export function validateFall(value: unknown): number {
  const n = typeof value === 'number' && isFinite(value) ? value : SLEW_LIMITER_DEFAULTS.fall;
  return Math.round(Math.min(FALL_MAX, Math.max(FALL_MIN, n)));
}

/** Validates and normalises a full parameter record from patch data. */
export function validateSlewLimiterParams(
  params: Partial<Record<string, number>>
): SlewLimiterParams {
  return {
    rise: validateRise(params['rise']),
    fall: validateFall(params['fall']),
  };
}

/** Clamps a CV output value to [0, 1]. */
export function clampCv(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Computes IIR smoothing coefficient for a given time constant and frame delta.
 * Returns 1 (instantaneous) when timeMs <= 0.
 */
export function computeSlewCoeff(timeMs: number, dtSec: number): number {
  if (timeMs <= 0) return 1;
  return 1 - Math.exp(-dtSec / (timeMs / 1000));
}
