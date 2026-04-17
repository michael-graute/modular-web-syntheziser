/**
 * BPM validation constants and helpers for the global BPM control feature.
 */

/** Minimum allowed BPM value */
export const BPM_MIN = 30;

/** Maximum allowed BPM value */
export const BPM_MAX = 300;

/** Default global BPM when no patch value is present */
export const BPM_DEFAULT = 120;

/** Tap tempo: taps older than this (ms) are discarded */
export const TAP_TEMPO_WINDOW_MS = 3000;

/** Tap tempo: minimum taps required before a value is applied */
export const TAP_TEMPO_MIN_TAPS = 2;

/**
 * BPM mode for a tempo-aware component.
 * Stored as a numeric parameter so it serializes via the existing parameter map.
 */
export enum BpmMode {
  /** Component follows the global BPM (default) */
  Global = 0,
  /** Component uses its own locally overridden BPM */
  Local = 1,
}

/**
 * Returns true if the given BPM value is within the allowed range.
 */
export function isValidBpm(bpm: number): boolean {
  return typeof bpm === 'number' && isFinite(bpm) && bpm >= BPM_MIN && bpm <= BPM_MAX;
}

/**
 * Clamps a BPM value to the allowed range [BPM_MIN, BPM_MAX] and rounds to integer.
 * Returns BPM_MIN for non-finite values.
 */
export function clampBpm(bpm: number): number {
  if (!isFinite(bpm)) return BPM_MIN;
  return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(bpm)));
}

/**
 * Returns true if the numeric value is a valid BpmMode.
 */
export function isValidBpmMode(value: number): value is BpmMode {
  return value === BpmMode.Global || value === BpmMode.Local;
}
