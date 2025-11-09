/**
 * IMusicalScaleSystem - Musical scale generation interface
 *
 * Provides musical scale construction, note assignment, and conversion utilities.
 * Handles scale interval mappings, weighted random distribution (tonic/fifth emphasis),
 * and MIDI/CV conversions following standard 1V/octave specification.
 *
 * Implementation notes:
 * - Scales defined as semitone intervals from root note
 * - MIDI note numbers as canonical reference (A4 = 440Hz = MIDI 69)
 * - 1V/octave CV standard (C4 = 0V reference)
 * - Tonic and fifth have 2x weighting per FR-006
 *
 * @see research.md section 3 for scale system details
 * @see data-model.md for MusicalScale, ScaleType, Note types
 */

import type {
  MusicalScale,
  ScaleType,
  Note,
} from './types';

/**
 * Musical scale system interface for note generation and conversion
 */
export interface IMusicalScaleSystem {
  /**
   * Create a musical scale from type and root note
   *
   * Generates complete scale definition with pre-computed CV voltages
   * and weighted probabilities for efficient note assignment.
   *
   * @param type - Scale type (major, harmonic-minor, etc.)
   * @param root - Root note (tonic) for the scale
   * @returns Complete musical scale with intervals and CV voltages
   *
   * @example
   * ```typescript
   * const scale = scaleSystem.getScale(ScaleType.MAJOR, Note.C);
   * // Returns C Major: intervals [0, 2, 4, 5, 7, 9, 11]
   * // cvVoltages: [0, 0.167, 0.333, 0.417, 0.583, 0.75, 0.917]
   * // weights: [2, 1, 1, 1, 2, 1, 1] (C and G emphasized)
   * ```
   */
  getScale(type: ScaleType, root: Note): MusicalScale;

  /**
   * Assign notes to colliders with weighted distribution
   *
   * Distributes scale degrees across N colliders using weighted random
   * selection. Tonic (degree 0) and fifth (degree 4) have 2x probability.
   *
   * @param count - Number of colliders to assign notes to
   * @param scale - Musical scale to use for assignment
   * @param weighted - If true, apply 2x weight to tonic/fifth (FR-006)
   * @returns Array of scale degree indices (length = count)
   *
   * @example
   * ```typescript
   * const degrees = scaleSystem.assignNotesToColliders(5, scale, true);
   * // Example result: [0, 4, 2, 0, 6] (tonic/fifth appear more often)
   *
   * const uniform = scaleSystem.assignNotesToColliders(5, scale, false);
   * // Example result: [1, 3, 5, 2, 4] (all degrees equally likely)
   * ```
   */
  assignNotesToColliders(
    count: number,
    scale: MusicalScale,
    weighted: boolean
  ): number[];

  /**
   * Convert MIDI note number to frequency (Hz)
   *
   * Uses standard equal temperament tuning: A4 = 440Hz = MIDI 69
   * Formula: f = 440 * 2^((n - 69) / 12)
   *
   * @param midiNote - MIDI note number (0-127)
   * @returns Frequency in Hertz
   *
   * @example
   * ```typescript
   * const c4Freq = scaleSystem.midiToFrequency(60); // 261.63 Hz (Middle C)
   * const a4Freq = scaleSystem.midiToFrequency(69); // 440.00 Hz (Concert A)
   * const c5Freq = scaleSystem.midiToFrequency(72); // 523.25 Hz (C one octave up)
   * ```
   */
  midiToFrequency(midiNote: number): number;

  /**
   * Convert MIDI note number to CV voltage (1V/octave)
   *
   * Uses standard Eurorack CV: C4 (MIDI 60) = 0V reference
   * Formula: cv = (n - 60) / 12
   * Range: -5V to +5V (10 octave range)
   *
   * @param midiNote - MIDI note number (0-127)
   * @returns CV voltage in volts (1V/octave standard)
   *
   * @example
   * ```typescript
   * const c4CV = scaleSystem.midiToCVVoltage(60);  // 0.00V (reference)
   * const c5CV = scaleSystem.midiToCVVoltage(72);  // 1.00V (one octave up)
   * const c3CV = scaleSystem.midiToCVVoltage(48);  // -1.00V (one octave down)
   * const a4CV = scaleSystem.midiToCVVoltage(69);  // 0.75V
   * ```
   */
  midiToCVVoltage(midiNote: number): number;

  /**
   * Get scale degree CV voltage for a given scale and root
   *
   * Convenience method that combines scale intervals with CV conversion.
   * Equivalent to: midiToCVVoltage(rootMidi + scale.intervals[degree])
   *
   * @param scale - Musical scale definition
   * @param degree - Scale degree index (0-based)
   * @returns CV voltage for the specified scale degree
   * @throws Error if degree is out of bounds
   *
   * @example
   * ```typescript
   * const cMajor = scaleSystem.getScale(ScaleType.MAJOR, Note.C);
   * const tonicCV = scaleSystem.getScaleDegreeCV(cMajor, 0);  // 0V (C4)
   * const fifthCV = scaleSystem.getScaleDegreeCV(cMajor, 4);  // 0.583V (G4)
   * ```
   */
  getScaleDegreeCV(scale: MusicalScale, degree: number): number;

  /**
   * Get all available scale types
   *
   * @returns Array of supported scale type identifiers
   *
   * @example
   * ```typescript
   * const types = scaleSystem.getAvailableScaleTypes();
   * // Returns: ['major', 'harmonic-minor', 'natural-minor', 'lydian', 'mixolydian']
   * ```
   */
  getAvailableScaleTypes(): readonly ScaleType[];

  /**
   * Get all chromatic notes
   *
   * @returns Array of all 12 chromatic note identifiers
   *
   * @example
   * ```typescript
   * const notes = scaleSystem.getAvailableNotes();
   * // Returns: [Note.C, Note.C_SHARP, Note.D, ..., Note.B]
   * ```
   */
  getAvailableNotes(): readonly Note[];
}
