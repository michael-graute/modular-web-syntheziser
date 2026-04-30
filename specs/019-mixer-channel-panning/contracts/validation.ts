// Validation helpers for feature 019-mixer-channel-panning

/** Valid pan range: [−1.0, +1.0] */
export const PAN_MIN = -1.0;
export const PAN_MAX = 1.0;
export const PAN_DEFAULT = 0.0;
export const PAN_STEP = 0.01;

/** Clamp a value to the pan range. */
export function clampPan(value: number): number {
  return Math.max(PAN_MIN, Math.min(PAN_MAX, value));
}

/** Returns true if the value is a valid pan position. */
export function isValidPan(value: number): boolean {
  return Number.isFinite(value) && value >= PAN_MIN && value <= PAN_MAX;
}

/** Returns true if the value is the center pan position (within floating-point tolerance). */
export function isCenterPan(value: number, epsilon = 0.001): boolean {
  return Math.abs(value) < epsilon;
}
