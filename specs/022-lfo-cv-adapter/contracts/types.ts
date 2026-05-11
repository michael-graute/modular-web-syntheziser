/**
 * Type contracts for feature 022 — LFO CV Adapter
 *
 * These types describe the shape of new/modified interfaces.
 * Actual implementation types live in src/.
 */

/** Range descriptor for a CV input port — read by the LFO adapter at connect time. */
export interface CvInputRange {
  min: number;
  max: number;
}

/**
 * Key format for the LFO's per-connection scaler map.
 * Concatenation of target component ID and target port ID.
 * Example: "lesson-13-filter:cutoff_cv"
 */
export type ConnectionScalerKey = `${string}:${string}`;

/**
 * Entry in the LFO's connectionScalers map.
 * Kept as a plain GainNode in implementation; this type documents intent.
 */
export interface ConnectionScaler {
  /** The Web Audio GainNode performing the per-connection scaling. */
  node: GainNode;
  /** Gain value at 100% LFO depth (= (paramMax - paramMin) / 2). */
  fullDepthGain: number;
}

/**
 * Result of computeScaleGain() — the gain value to set on a per-connection scaler.
 * Accounts for current depth percentage.
 */
export type ScaleGain = number;

/**
 * New parameter added to the Filter component.
 */
export interface FilterCvAmountParameter {
  id: 'cvAmount';
  name: 'CV Amount';
  defaultValue: 50;
  min: 0;
  max: 100;
  step: 1;
  unit: '%';
}

/**
 * New protected method signature added to SynthComponent base class.
 * Returns the parameter range for a given CV input port, or null if not applicable.
 */
export type GetParameterRangeForInput = (portId: string) => CvInputRange | null;
