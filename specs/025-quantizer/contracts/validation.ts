/**
 * Validation helpers for the Quantizer component (feature 025-quantizer)
 */

import {
  QuantizerNote,
  QuantizerScaleType,
  QuantizerConfig,
  QuantizerValidationResult,
  QUANTIZER_SCALE_INTERVALS,
  NOTE_TO_SEMITONE,
  NOTE_ORDER,
  SCALE_TYPE_ORDER,
  MIDI_C4,
  MIDI_MIN,
  MIDI_MAX,
  CV_MIN,
  CV_MAX,
  DEFAULT_QUANTIZER_CONFIG,
} from './types';

/**
 * Validate a QuantizerConfig object.
 * Returns isValid=true only when all fields hold recognized enum values.
 */
export function validateQuantizerConfig(config: unknown): QuantizerValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { isValid: false, errors: ['Config must be a non-null object'] };
  }

  const c = config as Record<string, unknown>;

  if (!Object.values(QuantizerNote).includes(c['rootNote'] as QuantizerNote)) {
    errors.push(`Invalid rootNote: ${String(c['rootNote'])}`);
  }

  if (!Object.values(QuantizerScaleType).includes(c['scaleType'] as QuantizerScaleType)) {
    errors.push(`Invalid scaleType: ${String(c['scaleType'])}`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Serialize QuantizerConfig to numeric parameter map for patch storage.
 * rootNote → 0–11, scaleType → 0–7
 */
export function serializeQuantizerConfig(config: QuantizerConfig): Record<string, number> {
  return {
    rootNote: NOTE_ORDER.indexOf(config.rootNote),
    scaleType: SCALE_TYPE_ORDER.indexOf(config.scaleType),
  };
}

/**
 * Deserialize numeric parameter map back to QuantizerConfig.
 * Falls back to defaults for any unrecognized values.
 */
export function deserializeQuantizerConfig(params: Record<string, number>): QuantizerConfig {
  const rootNote = NOTE_ORDER[params['rootNote'] ?? 0] ?? DEFAULT_QUANTIZER_CONFIG.rootNote;
  const scaleType = SCALE_TYPE_ORDER[params['scaleType'] ?? 0] ?? DEFAULT_QUANTIZER_CONFIG.scaleType;
  return { rootNote, scaleType };
}

/**
 * Build a sorted array of all valid MIDI note numbers for the given
 * root note and scale type, spanning MIDI_MIN (C0) to MIDI_MAX (C8).
 *
 * This is the pitch lookup table used at quantization time.
 */
export function buildPitchTable(rootNote: QuantizerNote, scaleType: QuantizerScaleType): readonly number[] {
  const intervals = QUANTIZER_SCALE_INTERVALS[scaleType];
  const rootSemitone = NOTE_TO_SEMITONE[rootNote];
  const table: number[] = [];

  for (let octave = -1; octave <= 9; octave++) {
    for (const interval of intervals) {
      const midi = (octave + 5) * 12 + rootSemitone + interval; // octave offset so C4=60
      if (midi >= MIDI_MIN && midi <= MIDI_MAX) {
        table.push(midi);
      }
    }
  }

  // Sort ascending and deduplicate (chromatic scale may produce duplicates at boundaries)
  const sorted = [...new Set(table)].sort((a, b) => a - b);
  return Object.freeze(sorted);
}

/**
 * Find the nearest MIDI note in a pre-built pitch table for a given input CV.
 * Clamps input CV to [CV_MIN, CV_MAX] before lookup.
 * Ties resolve upward (higher pitch).
 *
 * Returns the quantized MIDI note number.
 */
export function quantizeCv(cv: number, pitchTable: readonly number[]): number {
  const clampedCv = Math.max(CV_MIN, Math.min(CV_MAX, cv));
  const inputMidi = MIDI_C4 + clampedCv * 12;

  let nearest = pitchTable[0] ?? MIDI_C4;
  let minDist = Math.abs(inputMidi - nearest);

  for (const midi of pitchTable) {
    const dist = Math.abs(inputMidi - midi);
    // Strictly less-than: ties keep higher pitch (later entry in ascending table wins)
    if (dist < minDist) {
      minDist = dist;
      nearest = midi;
    }
  }

  return nearest;
}

/**
 * Convert a MIDI note number to its human-readable label (e.g. MIDI 69 → "A4").
 * Octave follows standard convention: C4 = MIDI 60, so octave = floor(midi/12) - 1.
 */
export function midiToNoteLabel(midi: number): string {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const name = NOTE_NAMES[midi % 12] ?? 'C';
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/**
 * Convert CV voltage to MIDI note number (1V/octave, C4 = 0V = MIDI 60).
 */
export function cvToMidi(cv: number): number {
  return MIDI_C4 + cv * 12;
}

/**
 * Convert MIDI note number to CV voltage (1V/octave, C4 = MIDI 60 = 0V).
 */
export function midiToCv(midi: number): number {
  return (midi - MIDI_C4) / 12;
}
