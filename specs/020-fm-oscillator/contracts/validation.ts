// Validation helpers for feature 020-fm-oscillator

import type { FMOscillatorConfig } from './types';

export const FM_DEPTH_MIN = 0;
export const FM_DEPTH_MAX = 1000;
export const FM_DEPTH_DEFAULT = 100;

/**
 * Validate the fmDepth parameter value.
 * Returns true if the value is within the allowed range [0, 1000].
 */
export function isValidFMDepth(value: number): boolean {
  return Number.isFinite(value) && value >= FM_DEPTH_MIN && value <= FM_DEPTH_MAX;
}

/**
 * Validate a full FMOscillatorConfig object.
 * Returns an error message string, or null if valid.
 */
export function validateFMOscillatorConfig(config: FMOscillatorConfig): string | null {
  if (!isValidFMDepth(config.fmDepth)) {
    return `fmDepth must be between ${FM_DEPTH_MIN} and ${FM_DEPTH_MAX}, got ${config.fmDepth}`;
  }
  return null;
}
