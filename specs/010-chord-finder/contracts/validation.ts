/**
 * Validation: Chord Finder Utility
 * Feature: 010-chord-finder
 *
 * Runtime validation helpers for ChordFinder config and serialized params.
 * Pure functions — no side effects, no imports from implementation files.
 */

import type { ChordFinderConfig, ChordFinderSerializedParams, Note } from './types';
import { ChordScaleType } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_NOTES: Note[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

const MIN_OCTAVE = 2;
const MAX_OCTAVE = 6;
const MIN_PROGRESSION_LENGTH = 4;
const MAX_PROGRESSION_LENGTH = 8;
const SCALE_DEGREE_COUNT = 7;
const PROGRESSION_BITMASK_MAX = (1 << SCALE_DEGREE_COUNT) - 1; // 127

// ---------------------------------------------------------------------------
// Config validation
// ---------------------------------------------------------------------------

/**
 * Validate a ChordFinderConfig object.
 * Returns an array of error messages (empty = valid).
 */
export function validateChordFinderConfig(config: unknown): string[] {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return ['config must be a non-null object'];
  }

  const c = config as Record<string, unknown>;

  // rootNote
  if (!VALID_NOTES.includes(c['rootNote'] as Note)) {
    errors.push(
      `rootNote must be one of: ${VALID_NOTES.join(', ')}. Got: ${String(c['rootNote'])}`
    );
  }

  // scaleType
  const validScaleTypes = Object.values(ChordScaleType) as string[];
  if (!validScaleTypes.includes(c['scaleType'] as string)) {
    errors.push(
      `scaleType must be one of: ${validScaleTypes.join(', ')}. Got: ${String(c['scaleType'])}`
    );
  }

  // octave
  if (
    typeof c['octave'] !== 'number' ||
    !Number.isInteger(c['octave']) ||
    c['octave'] < MIN_OCTAVE ||
    c['octave'] > MAX_OCTAVE
  ) {
    errors.push(
      `octave must be an integer between ${MIN_OCTAVE} and ${MAX_OCTAVE}. Got: ${String(c['octave'])}`
    );
  }

  // progression
  if (!Array.isArray(c['progression'])) {
    errors.push('progression must be an array');
  } else {
    const prog = c['progression'] as unknown[];
    if (prog.length !== 0 && (prog.length < MIN_PROGRESSION_LENGTH || prog.length > MAX_PROGRESSION_LENGTH)) {
      errors.push(
        `progression length must be 0 or between ${MIN_PROGRESSION_LENGTH} and ${MAX_PROGRESSION_LENGTH}. Got: ${prog.length}`
      );
    }
    for (const degree of prog) {
      if (
        typeof degree !== 'number' ||
        !Number.isInteger(degree) ||
        degree < 0 ||
        degree >= SCALE_DEGREE_COUNT
      ) {
        errors.push(
          `each progression entry must be an integer 0–${SCALE_DEGREE_COUNT - 1}. Got: ${String(degree)}`
        );
        break;
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Serialized params validation
// ---------------------------------------------------------------------------

/**
 * Validate serialized ComponentData.parameters for ChordFinder.
 * Returns an array of error messages (empty = valid).
 */
export function validateChordFinderSerializedParams(params: unknown): string[] {
  const errors: string[] = [];

  if (!params || typeof params !== 'object') {
    return ['params must be a non-null object'];
  }

  const p = params as Record<string, unknown>;

  // rootNote
  if (
    typeof p['rootNote'] !== 'number' ||
    !Number.isInteger(p['rootNote']) ||
    p['rootNote'] < 0 ||
    p['rootNote'] > 11
  ) {
    errors.push(`rootNote param must be an integer 0–11. Got: ${String(p['rootNote'])}`);
  }

  // scaleType
  if (
    typeof p['scaleType'] !== 'number' ||
    !Number.isInteger(p['scaleType']) ||
    p['scaleType'] < 0 ||
    p['scaleType'] > 1
  ) {
    errors.push(`scaleType param must be 0 or 1. Got: ${String(p['scaleType'])}`);
  }

  // octave
  if (
    typeof p['octave'] !== 'number' ||
    !Number.isInteger(p['octave']) ||
    p['octave'] < MIN_OCTAVE ||
    p['octave'] > MAX_OCTAVE
  ) {
    errors.push(
      `octave param must be an integer ${MIN_OCTAVE}–${MAX_OCTAVE}. Got: ${String(p['octave'])}`
    );
  }

  // progression bitmask
  if (
    typeof p['progression'] !== 'number' ||
    !Number.isInteger(p['progression']) ||
    p['progression'] < 0 ||
    p['progression'] > PROGRESSION_BITMASK_MAX
  ) {
    errors.push(
      `progression param must be an integer 0–${PROGRESSION_BITMASK_MAX}. Got: ${String(p['progression'])}`
    );
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Encode / decode bitmask
// ---------------------------------------------------------------------------

/**
 * Encode a progression array (scale degree indices) into a 7-bit bitmask.
 */
export function encodeProgressionBitmask(progression: number[]): number {
  return progression.reduce((mask, degree) => mask | (1 << degree), 0);
}

/**
 * Decode a 7-bit bitmask into an ordered progression array (ascending degree order).
 */
export function decodeProgressionBitmask(bitmask: number): number[] {
  const degrees: number[] = [];
  for (let i = 0; i < SCALE_DEGREE_COUNT; i++) {
    if (bitmask & (1 << i)) {
      degrees.push(i);
    }
  }
  return degrees;
}

// ---------------------------------------------------------------------------
// Config ↔ serialized params conversion
// ---------------------------------------------------------------------------

const NOTE_ORDER: Note[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

const SCALE_TYPE_TO_INDEX: Record<ChordScaleType, number> = {
  [ChordScaleType.MAJOR]: 0,
  [ChordScaleType.NATURAL_MINOR]: 1,
};

const INDEX_TO_SCALE_TYPE: Record<number, ChordScaleType> = {
  0: ChordScaleType.MAJOR,
  1: ChordScaleType.NATURAL_MINOR,
};

/** Convert a ChordFinderConfig to its serialized numeric parameters. */
export function serializeChordFinderConfig(config: ChordFinderConfig): ChordFinderSerializedParams {
  return {
    rootNote: NOTE_ORDER.indexOf(config.rootNote),
    scaleType: SCALE_TYPE_TO_INDEX[config.scaleType],
    octave: config.octave,
    progression: encodeProgressionBitmask(config.progression),
  };
}

/** Restore a ChordFinderConfig from its serialized numeric parameters. */
export function deserializeChordFinderConfig(params: ChordFinderSerializedParams): ChordFinderConfig {
  return {
    rootNote: NOTE_ORDER[params.rootNote] as Note,
    scaleType: INDEX_TO_SCALE_TYPE[params.scaleType] ?? ChordScaleType.MAJOR,
    octave: params.octave,
    progression: decodeProgressionBitmask(params.progression),
  };
}
