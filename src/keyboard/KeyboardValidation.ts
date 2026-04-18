/**
 * Validation helpers for ChordFinder–Keyboard visual sync (feature 014).
 *
 * Used by KeyboardController to defensively validate incoming chord event
 * payloads and to test whether a MIDI note falls within the Keyboard's
 * visible two-octave range before attempting to highlight it.
 */

const MIDI_MIN = 0;
const MIDI_MAX = 127;
const CHORD_NOTE_COUNT = 3;

export interface ChordEventPayload {
  notes: [number, number, number];
  sourceId: string;
}

/**
 * Validates a CHORD_NOTES_ON or CHORD_NOTES_OFF event payload.
 * Returns an error message string, or null if valid.
 */
export function validateChordPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return 'Payload must be a non-null object';
  }

  const p = payload as Partial<ChordEventPayload>;

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
 * Returns true if a MIDI note falls within the Keyboard's two-octave
 * visible range starting at startOctave.
 *
 * Formula: rangeStart = (startOctave + 1) * 12, covers 24 semitones.
 * Default startOctave = 4 → MIDI 60–83 (C4–B5).
 */
export function isNoteInKeyboardRange(midiNote: number, startOctave: number = 4): boolean {
  const rangeStart = (startOctave + 1) * 12;
  const rangeEnd = rangeStart + 24 - 1;
  return midiNote >= rangeStart && midiNote <= rangeEnd;
}
