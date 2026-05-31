/**
 * Ring Modulator — constants and validation helpers
 */

/** Gain applied to the carrier and modulator entry nodes (unity gain). */
export const CARRIER_GAIN = 1.0;
export const MODULATOR_GAIN = 1.0;

/**
 * Base value of the multiplier GainNode's gain AudioParam.
 * Must be 0.0 so that an absent modulator produces silence (FR-004).
 */
export const MULTIPLIER_GAIN_BASE = 0.0;

/** Output GainNode gain (unity — no level change at output). */
export const OUTPUT_GAIN = 1.0;

/**
 * Guard that the Ring Modulator data has an empty parameters map.
 * Used during patch loading to ignore any stale serialised parameters.
 */
export function isValidRingModulatorData(
  parameters: Record<string, number>
): boolean {
  return Object.keys(parameters).length === 0;
}
