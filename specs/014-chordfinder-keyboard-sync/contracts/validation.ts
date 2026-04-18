/**
 * Validation helpers for feature 014: ChordFinder–Keyboard Visual Sync
 */

import type { ChordNotesOnPayload, ChordNotesOffPayload } from './types';

const MIDI_MIN = 0;
const MIDI_MAX = 127;
const CHORD_NOTE_COUNT = 3;

/**
 * Validates a CHORD_NOTES_ON event payload.
 * Returns an error message string, or null if valid.
 */
export function validateChordNotesOnPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return 'Payload must be a non-null object';
  }

  const p = payload as Partial<ChordNotesOnPayload>;

  if (typeof p.sourceId !== 'string' || p.sourceId.trim() === '') {
    return 'sourceId must be a non-empty string';
  }

  if (!Array.isArray(p.notes) || p.notes.length !== CHORD_NOTE_COUNT) {
    return `notes must be an array of exactly ${CHORD_NOTE_COUNT} elements`;
  }

  for (let i = 0; i < CHORD_NOTE_COUNT; i++) {
    const note = p.notes[i];
    if (typeof note !== 'number' || !Number.isInteger(note) || note < MIDI_MIN || note > MIDI_MAX) {
      return `notes[${i}] must be an integer MIDI note number (${MIDI_MIN}–${MIDI_MAX}), got ${note}`;
    }
  }

  return null;
}

/**
 * Validates a CHORD_NOTES_OFF event payload.
 * Returns an error message string, or null if valid.
 */
export function validateChordNotesOffPayload(payload: unknown): string | null {
  // Same shape as ON payload
  return validateChordNotesOnPayload(payload);
}

/**
 * Returns true if a given MIDI note falls within the Keyboard's two-octave
 * visible range starting at startOctave.
 *
 * startOctave defaults to 4 (C4 = MIDI 60), covering MIDI 60–83.
 */
export function isNoteInKeyboardRange(midiNote: number, startOctave: number = 4): boolean {
  const rangeStart = (startOctave + 1) * 12; // C of startOctave (e.g., octave 4 → MIDI 60)
  const rangeEnd = rangeStart + 24 - 1;       // 2 octaves = 24 semitones
  return midiNote >= rangeStart && midiNote <= rangeEnd;
}
