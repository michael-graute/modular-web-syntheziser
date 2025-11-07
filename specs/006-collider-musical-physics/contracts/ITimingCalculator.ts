/**
 * ITimingCalculator - BPM and gate timing interface
 *
 * Provides musical timing calculations for gate duration based on BPM
 * and rhythmic divisions. Handles tempo conversions and validation.
 *
 * Implementation notes:
 * - Quarter note = 1 beat (standard BPM definition)
 * - Gate sizes are multipliers of quarter note duration
 * - BPM range: 30-300 (FR-020a)
 * - Supports standard rhythmic divisions (whole to 16th notes)
 *
 * @see research.md section 5 for gate timing details
 * @see data-model.md for GateSize enum and validation rules
 */

import type {
  GateSize,
  ValidationResult,
} from './types';

/**
 * Timing calculator interface for BPM and gate duration
 */
export interface ITimingCalculator {
  /**
   * Calculate gate duration in milliseconds
   *
   * Computes note duration based on BPM and note division.
   * Formula: duration = (60000 / bpm) * gateSize
   *
   * @param bpm - Beats per minute (30-300, quarter note = 1 beat)
   * @param gateSize - Note division multiplier (GateSize enum value)
   * @returns Gate duration in milliseconds
   *
   * @example
   * ```typescript
   * // 120 BPM, quarter note = 500ms
   * const quarterNote = calc.calculateGateDuration(120, GateSize.QUARTER);
   * // Returns: 500
   *
   * // 120 BPM, 16th note = 125ms
   * const sixteenth = calc.calculateGateDuration(120, GateSize.SIXTEENTH);
   * // Returns: 125
   *
   * // 60 BPM, whole note = 4000ms
   * const wholeNote = calc.calculateGateDuration(60, GateSize.WHOLE);
   * // Returns: 4000
   * ```
   */
  calculateGateDuration(bpm: number, gateSize: GateSize): number;

  /**
   * Convert BPM to milliseconds per beat
   *
   * Calculates quarter note duration (one beat) in milliseconds.
   * Formula: ms = 60000 / bpm
   *
   * @param bpm - Beats per minute (30-300)
   * @returns Milliseconds per quarter note
   *
   * @example
   * ```typescript
   * const ms120 = calc.bpmToMs(120); // Returns: 500ms per beat
   * const ms60 = calc.bpmToMs(60);   // Returns: 1000ms per beat
   * const ms240 = calc.bpmToMs(240); // Returns: 250ms per beat
   * ```
   */
  bpmToMs(bpm: number): number;

  /**
   * Convert milliseconds to BPM
   *
   * Inverse of bpmToMs. Calculates BPM from quarter note duration.
   * Formula: bpm = 60000 / ms
   *
   * @param ms - Milliseconds per quarter note
   * @returns Beats per minute
   *
   * @example
   * ```typescript
   * const bpm = calc.msToBpm(500); // Returns: 120 BPM
   * ```
   */
  msToBpm(ms: number): number;

  /**
   * Validate BPM value
   *
   * Checks if BPM is within valid range (30-300) and is a finite number.
   * Per FR-020a requirement.
   *
   * @param bpm - BPM value to validate
   * @returns Validation result with error messages if invalid
   *
   * @example
   * ```typescript
   * const valid = calc.validateBPM(120);
   * // Returns: { isValid: true, errors: [] }
   *
   * const tooSlow = calc.validateBPM(25);
   * // Returns: { isValid: false, errors: ['BPM must be at least 30'] }
   *
   * const tooFast = calc.validateBPM(350);
   * // Returns: { isValid: false, errors: ['BPM must not exceed 300'] }
   *
   * const invalid = calc.validateBPM(NaN);
   * // Returns: { isValid: false, errors: ['BPM must be a finite number'] }
   * ```
   */
  validateBPM(bpm: number): ValidationResult;

  /**
   * Get minimum valid BPM
   *
   * @returns Minimum BPM (30)
   *
   * @example
   * ```typescript
   * const min = calc.getMinBPM(); // Returns: 30
   * ```
   */
  getMinBPM(): number;

  /**
   * Get maximum valid BPM
   *
   * @returns Maximum BPM (300)
   *
   * @example
   * ```typescript
   * const max = calc.getMaxBPM(); // Returns: 300
   * ```
   */
  getMaxBPM(): number;

  /**
   * Get all supported gate sizes
   *
   * @returns Array of valid GateSize enum values
   *
   * @example
   * ```typescript
   * const sizes = calc.getSupportedGateSizes();
   * // Returns: [GateSize.WHOLE, GateSize.HALF, GateSize.QUARTER,
   * //           GateSize.EIGHTH, GateSize.SIXTEENTH]
   * ```
   */
  getSupportedGateSizes(): readonly GateSize[];

  /**
   * Get human-readable name for gate size
   *
   * @param gateSize - Gate size enum value
   * @returns Display name (e.g., "Quarter Note", "16th Note")
   *
   * @example
   * ```typescript
   * const name = calc.getGateSizeName(GateSize.QUARTER);
   * // Returns: "Quarter Note"
   *
   * const sixteenth = calc.getGateSizeName(GateSize.SIXTEENTH);
   * // Returns: "16th Note"
   * ```
   */
  getGateSizeName(gateSize: GateSize): string;
}
