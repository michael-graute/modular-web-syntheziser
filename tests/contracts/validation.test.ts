/**
 * Unit tests for ChordFinder–Keyboard Visual Sync validation helpers (feature 014).
 *
 * Covers validateChordNotesOnPayload, validateChordNotesOffPayload, and
 * isNoteInKeyboardRange from specs/014-chordfinder-keyboard-sync/contracts/validation.ts.
 * Pure function tests — no audio nodes or DOM required.
 */

import { describe, it, expect } from 'vitest';
import {
  validateChordNotesOnPayload,
  validateChordNotesOffPayload,
  isNoteInKeyboardRange,
} from '../../specs/014-chordfinder-keyboard-sync/contracts/validation';

// ---------------------------------------------------------------------------
// validateChordNotesOnPayload
// ---------------------------------------------------------------------------

describe('validateChordNotesOnPayload', () => {
  it('returns null for a valid payload', () => {
    expect(validateChordNotesOnPayload({ notes: [60, 64, 67], sourceId: 'cf-1' })).toBeNull();
  });

  it('returns null for boundary MIDI values (0 and 127)', () => {
    expect(validateChordNotesOnPayload({ notes: [0, 63, 127], sourceId: 'cf-1' })).toBeNull();
  });

  it('returns error for null payload', () => {
    expect(validateChordNotesOnPayload(null)).not.toBeNull();
  });

  it('returns error for non-object payload', () => {
    expect(validateChordNotesOnPayload('invalid')).not.toBeNull();
    expect(validateChordNotesOnPayload(42)).not.toBeNull();
  });

  it('returns error for missing sourceId', () => {
    expect(validateChordNotesOnPayload({ notes: [60, 64, 67] })).not.toBeNull();
  });

  it('returns error for empty sourceId', () => {
    expect(validateChordNotesOnPayload({ notes: [60, 64, 67], sourceId: '' })).not.toBeNull();
    expect(validateChordNotesOnPayload({ notes: [60, 64, 67], sourceId: '   ' })).not.toBeNull();
  });

  it('returns error when notes is not an array', () => {
    expect(validateChordNotesOnPayload({ notes: 60, sourceId: 'cf-1' })).not.toBeNull();
  });

  it('returns error when notes has fewer than 3 elements', () => {
    expect(validateChordNotesOnPayload({ notes: [60, 64], sourceId: 'cf-1' })).not.toBeNull();
  });

  it('returns error when notes has more than 3 elements', () => {
    expect(validateChordNotesOnPayload({ notes: [60, 64, 67, 71], sourceId: 'cf-1' })).not.toBeNull();
  });

  it('returns error when a note is not an integer', () => {
    expect(validateChordNotesOnPayload({ notes: [60.5, 64, 67], sourceId: 'cf-1' })).not.toBeNull();
    expect(validateChordNotesOnPayload({ notes: [60, 'D4', 67], sourceId: 'cf-1' })).not.toBeNull();
  });

  it('returns error when a note is below MIDI range (< 0)', () => {
    expect(validateChordNotesOnPayload({ notes: [-1, 64, 67], sourceId: 'cf-1' })).not.toBeNull();
  });

  it('returns error when a note is above MIDI range (> 127)', () => {
    expect(validateChordNotesOnPayload({ notes: [60, 64, 128], sourceId: 'cf-1' })).not.toBeNull();
  });

  it('error message references the offending notes index', () => {
    const result = validateChordNotesOnPayload({ notes: [60, 64, 200], sourceId: 'cf-1' });
    expect(result).toMatch(/notes\[2\]/);
  });
});

// ---------------------------------------------------------------------------
// validateChordNotesOffPayload — same shape, same rules
// ---------------------------------------------------------------------------

describe('validateChordNotesOffPayload', () => {
  it('returns null for a valid payload', () => {
    expect(validateChordNotesOffPayload({ notes: [60, 64, 67], sourceId: 'cf-1' })).toBeNull();
  });

  it('returns error for null payload', () => {
    expect(validateChordNotesOffPayload(null)).not.toBeNull();
  });

  it('returns error for missing notes', () => {
    expect(validateChordNotesOffPayload({ sourceId: 'cf-1' })).not.toBeNull();
  });

  it('returns error for out-of-range note', () => {
    expect(validateChordNotesOffPayload({ notes: [60, 64, -5], sourceId: 'cf-1' })).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isNoteInKeyboardRange
// ---------------------------------------------------------------------------

describe('isNoteInKeyboardRange', () => {
  // Default startOctave = 4: range is MIDI 60–83 (C4–B5)
  it('returns true for notes within the default two-octave range', () => {
    expect(isNoteInKeyboardRange(60)).toBe(true);  // C4 — low boundary
    expect(isNoteInKeyboardRange(83)).toBe(true);  // B5 — high boundary
    expect(isNoteInKeyboardRange(72)).toBe(true);  // C5 — midpoint
  });

  it('returns false for notes below the default range', () => {
    expect(isNoteInKeyboardRange(59)).toBe(false); // B3
    expect(isNoteInKeyboardRange(0)).toBe(false);
  });

  it('returns false for notes above the default range', () => {
    expect(isNoteInKeyboardRange(84)).toBe(false); // C6
    expect(isNoteInKeyboardRange(127)).toBe(false);
  });

  it('respects a custom startOctave (octave 3: MIDI 48–71)', () => {
    expect(isNoteInKeyboardRange(48, 3)).toBe(true);   // C3 — low boundary
    expect(isNoteInKeyboardRange(71, 3)).toBe(true);   // B4 — high boundary
    expect(isNoteInKeyboardRange(47, 3)).toBe(false);  // below range
    expect(isNoteInKeyboardRange(72, 3)).toBe(false);  // above range
  });

  it('respects a custom startOctave (octave 5: MIDI 72–95)', () => {
    expect(isNoteInKeyboardRange(72, 5)).toBe(true);
    expect(isNoteInKeyboardRange(95, 5)).toBe(true);
    expect(isNoteInKeyboardRange(71, 5)).toBe(false);
    expect(isNoteInKeyboardRange(96, 5)).toBe(false);
  });
});
