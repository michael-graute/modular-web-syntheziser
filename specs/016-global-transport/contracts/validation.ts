/**
 * Validation helpers for Global Transport Controller (feature 016)
 */

import { TransportPosition, BEATS_PER_BAR } from './types';

/**
 * Returns an error string if the position is invalid, or null if valid.
 */
export function validateTransportPosition(pos: TransportPosition): string | null {
  if (!Number.isInteger(pos.bar) || pos.bar < 1) {
    return `Invalid bar: ${pos.bar} — must be an integer ≥ 1`;
  }
  if (!Number.isInteger(pos.beat) || pos.beat < 1 || pos.beat > BEATS_PER_BAR) {
    return `Invalid beat: ${pos.beat} — must be an integer between 1 and ${BEATS_PER_BAR}`;
  }
  return null;
}

/**
 * Advances a transport position by one beat (wrapping beat 4 → 1 and incrementing bar).
 * Returns a new position object — does not mutate the input.
 */
export function advancePosition(pos: TransportPosition): TransportPosition {
  if (pos.beat < BEATS_PER_BAR) {
    return { bar: pos.bar, beat: pos.beat + 1 };
  }
  return { bar: pos.bar + 1, beat: 1 };
}

/**
 * Returns the initial (reset) transport position: bar 1, beat 1.
 */
export function initialPosition(): TransportPosition {
  return { bar: 1, beat: 1 };
}

/**
 * Computes the beat interval in milliseconds for a given BPM.
 */
export function beatIntervalMs(bpm: number): number {
  if (bpm <= 0) throw new RangeError(`BPM must be > 0, got ${bpm}`);
  return 60_000 / bpm;
}
