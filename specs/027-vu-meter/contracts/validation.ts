/**
 * Validation helpers for the VU Meter feature (027).
 * Pure functions — no Web Audio API or DOM dependencies.
 */

/**
 * Clamp a peak level reading to the valid [0, 1] display range.
 */
export function clampPeakLevel(level: number): number {
  return Math.min(1, Math.max(0, level));
}

/**
 * Determine which segment index (0 = bottom) should be fully lit for a given level.
 * Returns -1 when level is effectively zero (below one segment's threshold).
 */
export function levelToSegmentIndex(level: number, segmentCount: number): number {
  const clamped = clampPeakLevel(level);
  return Math.floor(clamped * segmentCount) - 1;
}

/**
 * Returns true if the peak hold marker should still be displayed
 * (i.e. the hold window has not expired).
 */
export function isPeakHoldActive(
  peakHoldTimestamp: number,
  nowMs: number,
  holdDurationMs: number
): boolean {
  return nowMs - peakHoldTimestamp < holdDurationMs;
}

/**
 * Decay the peak hold level toward the current level by one step.
 * Returns the new (lower) peak hold level.
 */
export function decayPeakHold(
  peakHoldLevel: number,
  currentLevel: number,
  decayRate: number
): number {
  const next = peakHoldLevel - decayRate;
  return Math.max(currentLevel, next);
}
