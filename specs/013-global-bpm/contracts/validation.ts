/**
 * Validation helpers for feature 013-global-bpm
 * Global BPM Control
 */

import { BPM_MIN, BPM_MAX, BpmMode } from './types';

/**
 * Returns true if the given BPM value is within the allowed range.
 */
export function isValidBpm(bpm: number): boolean {
  return typeof bpm === 'number' && isFinite(bpm) && bpm >= BPM_MIN && bpm <= BPM_MAX;
}

/**
 * Clamps a BPM value to the allowed range [BPM_MIN, BPM_MAX].
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
