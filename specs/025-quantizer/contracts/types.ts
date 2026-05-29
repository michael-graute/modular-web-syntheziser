/**
 * Type contracts for the Quantizer component (feature 025-quantizer)
 *
 * Intentionally self-contained — does not import from 006-collider contracts
 * so the Collider and Quantizer remain independently evolvable.
 */

/** All 12 chromatic root notes */
export enum QuantizerNote {
  C = 'C',
  C_SHARP = 'C#',
  D = 'D',
  D_SHARP = 'D#',
  E = 'E',
  F = 'F',
  F_SHARP = 'F#',
  G = 'G',
  G_SHARP = 'G#',
  A = 'A',
  A_SHARP = 'A#',
  B = 'B',
}

/**
 * Scale types supported by the Quantizer.
 * Superset of the Collider's ScaleType — adds Pentatonic and Chromatic.
 */
export enum QuantizerScaleType {
  MAJOR = 'major',
  NATURAL_MINOR = 'natural-minor',
  HARMONIC_MINOR = 'harmonic-minor',
  LYDIAN = 'lydian',
  MIXOLYDIAN = 'mixolydian',
  PENTATONIC_MAJOR = 'pentatonic-major',
  PENTATONIC_MINOR = 'pentatonic-minor',
  CHROMATIC = 'chromatic',
}

/** Semitone intervals from root for each supported scale */
export const QUANTIZER_SCALE_INTERVALS: Readonly<Record<QuantizerScaleType, readonly number[]>> = {
  [QuantizerScaleType.MAJOR]:           Object.freeze([0, 2, 4, 5, 7, 9, 11]),
  [QuantizerScaleType.NATURAL_MINOR]:   Object.freeze([0, 2, 3, 5, 7, 8, 10]),
  [QuantizerScaleType.HARMONIC_MINOR]:  Object.freeze([0, 2, 3, 5, 7, 8, 11]),
  [QuantizerScaleType.LYDIAN]:          Object.freeze([0, 2, 4, 6, 7, 9, 11]),
  [QuantizerScaleType.MIXOLYDIAN]:      Object.freeze([0, 2, 4, 5, 7, 9, 10]),
  [QuantizerScaleType.PENTATONIC_MAJOR]:Object.freeze([0, 2, 4, 7, 9]),
  [QuantizerScaleType.PENTATONIC_MINOR]:Object.freeze([0, 3, 5, 7, 10]),
  [QuantizerScaleType.CHROMATIC]:       Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
};

/** Runtime configuration for the Quantizer component */
export interface QuantizerConfig {
  rootNote: QuantizerNote;
  scaleType: QuantizerScaleType;
}

/** Default configuration */
export const DEFAULT_QUANTIZER_CONFIG: QuantizerConfig = {
  rootNote: QuantizerNote.C,
  scaleType: QuantizerScaleType.MAJOR,
};

/**
 * CV / MIDI constants matching the project-wide 1V/octave standard.
 * C4 = MIDI 60 = 0V reference.
 */
export const MIDI_C4 = 60;
export const MIDI_MIN = 12;   // C0  — lower clamp bound
export const MIDI_MAX = 108;  // C8  — upper clamp bound
export const CV_MIN = (MIDI_MIN - MIDI_C4) / 12;  // -4.0
export const CV_MAX = (MIDI_MAX - MIDI_C4) / 12;  //  4.0

/** Maps QuantizerNote to its semitone offset from C */
export const NOTE_TO_SEMITONE: Readonly<Record<QuantizerNote, number>> = {
  [QuantizerNote.C]:       0,
  [QuantizerNote.C_SHARP]: 1,
  [QuantizerNote.D]:       2,
  [QuantizerNote.D_SHARP]: 3,
  [QuantizerNote.E]:       4,
  [QuantizerNote.F]:       5,
  [QuantizerNote.F_SHARP]: 6,
  [QuantizerNote.G]:       7,
  [QuantizerNote.G_SHARP]: 8,
  [QuantizerNote.A]:       9,
  [QuantizerNote.A_SHARP]: 10,
  [QuantizerNote.B]:       11,
};

/** Ordered array of QuantizerNote values for index ↔ enum mapping */
export const NOTE_ORDER: readonly QuantizerNote[] = [
  QuantizerNote.C,
  QuantizerNote.C_SHARP,
  QuantizerNote.D,
  QuantizerNote.D_SHARP,
  QuantizerNote.E,
  QuantizerNote.F,
  QuantizerNote.F_SHARP,
  QuantizerNote.G,
  QuantizerNote.G_SHARP,
  QuantizerNote.A,
  QuantizerNote.A_SHARP,
  QuantizerNote.B,
];

/** Ordered array of QuantizerScaleType values for index ↔ enum mapping */
export const SCALE_TYPE_ORDER: readonly QuantizerScaleType[] = [
  QuantizerScaleType.MAJOR,
  QuantizerScaleType.NATURAL_MINOR,
  QuantizerScaleType.HARMONIC_MINOR,
  QuantizerScaleType.LYDIAN,
  QuantizerScaleType.MIXOLYDIAN,
  QuantizerScaleType.PENTATONIC_MAJOR,
  QuantizerScaleType.PENTATONIC_MINOR,
  QuantizerScaleType.CHROMATIC,
];

/** Human-readable display labels for scale types */
export const SCALE_TYPE_LABELS: Readonly<Record<QuantizerScaleType, string>> = {
  [QuantizerScaleType.MAJOR]:           'Major',
  [QuantizerScaleType.NATURAL_MINOR]:   'Natural Minor',
  [QuantizerScaleType.HARMONIC_MINOR]:  'Harmonic Minor',
  [QuantizerScaleType.LYDIAN]:          'Lydian',
  [QuantizerScaleType.MIXOLYDIAN]:      'Mixolydian',
  [QuantizerScaleType.PENTATONIC_MAJOR]:'Pentatonic Maj',
  [QuantizerScaleType.PENTATONIC_MINOR]:'Pentatonic Min',
  [QuantizerScaleType.CHROMATIC]:       'Chromatic',
};

/** Validation result used by validation helpers */
export interface QuantizerValidationResult {
  isValid: boolean;
  errors: string[];
}
