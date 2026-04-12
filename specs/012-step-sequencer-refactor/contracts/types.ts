/**
 * Type contracts for the Step Sequencer Refactor (feature 012).
 *
 * These types define the authoritative shape of all data exchanged between
 * the audio component (StepSequencer), the canvas display (StepSequencerDisplay),
 * and the serialization layer (PatchSerializer).
 */

// ---------------------------------------------------------------------------
// Gate length enum
// ---------------------------------------------------------------------------

export const GATE_LENGTH = {
  TIED: 0,
  WHOLE: 1,
  HALF: 2,
  QUARTER: 3,
  EIGHTH: 4,
  SIXTEENTH: 5,
} as const;

export type GateLength = (typeof GATE_LENGTH)[keyof typeof GATE_LENGTH];

export const GATE_LENGTH_LABELS: Record<GateLength, string> = {
  [GATE_LENGTH.TIED]: 'tied',
  [GATE_LENGTH.WHOLE]: '1/1',
  [GATE_LENGTH.HALF]: '1/2',
  [GATE_LENGTH.QUARTER]: '1/4',
  [GATE_LENGTH.EIGHTH]: '1/8',
  [GATE_LENGTH.SIXTEENTH]: '1/16',
};

// ---------------------------------------------------------------------------
// Sequencer mode
// ---------------------------------------------------------------------------

export const SEQUENCER_MODE = {
  SEQUENCER: 0,
  ARPEGGIATOR: 1,
} as const;

export type SequencerMode = (typeof SEQUENCER_MODE)[keyof typeof SEQUENCER_MODE];

// ---------------------------------------------------------------------------
// Note division (global step division)
// ---------------------------------------------------------------------------

export const NOTE_DIVISION = {
  WHOLE: 0,
  HALF: 1,
  QUARTER: 2,
  EIGHTH: 3,
  SIXTEENTH: 4,
  THIRTYSECOND: 5,
} as const;

export type NoteDivision = (typeof NOTE_DIVISION)[keyof typeof NOTE_DIVISION];

export const NOTE_DIVISION_LABELS: Record<NoteDivision, string> = {
  [NOTE_DIVISION.WHOLE]: '1/1',
  [NOTE_DIVISION.HALF]: '1/2',
  [NOTE_DIVISION.QUARTER]: '1/4',
  [NOTE_DIVISION.EIGHTH]: '1/8',
  [NOTE_DIVISION.SIXTEENTH]: '1/16',
  [NOTE_DIVISION.THIRTYSECOND]: '1/32',
};

// ---------------------------------------------------------------------------
// Step data
// ---------------------------------------------------------------------------

/** One programmable step in the pattern. */
export interface SequencerStep {
  /** Whether this step is active (fires during playback). */
  active: boolean;

  /**
   * Pitch value — interpretation depends on mode:
   * - Sequencer mode: MIDI note number (0–127). 60 = C4.
   * - Arpeggiator mode: encoded as `semitoneOffset + 64` so the value stays
   *   in the 0–127 range. Decode as `note - 64` to get offset (−12 to +12).
   */
  note: number;

  /** Velocity (0.0–1.0). Mapped to CV output when step triggers. */
  velocity: number;

  /** Gate length — see GateLength enum. */
  gateLength: GateLength;
}

/** Default values for a freshly created step. */
export const DEFAULT_STEP: Readonly<SequencerStep> = {
  active: true,
  note: 60, // C4
  velocity: 0.8,
  gateLength: GATE_LENGTH.QUARTER,
};

// ---------------------------------------------------------------------------
// Pattern (global settings)
// ---------------------------------------------------------------------------

/** Complete pattern state — serialized as part of the patch. */
export interface SequencerPattern {
  /** Steps 0–15. Array length is always 16. */
  steps: readonly SequencerStep[];

  /** Beats per minute (30–300). */
  bpm: number;

  /** Global step division. */
  noteValue: NoteDivision;

  /** Number of active steps in the loop (2–16). */
  sequenceLength: number;

  /** Playback mode. */
  mode: SequencerMode;
}

export const DEFAULT_PATTERN: Readonly<SequencerPattern> = {
  steps: Array.from({ length: 16 }, () => ({ ...DEFAULT_STEP })) as readonly SequencerStep[],
  bpm: 120,
  noteValue: NOTE_DIVISION.QUARTER,
  sequenceLength: 16,
  mode: SEQUENCER_MODE.SEQUENCER,
};

// ---------------------------------------------------------------------------
// Transport state (ephemeral — not serialized)
// ---------------------------------------------------------------------------

export interface TransportState {
  isPlaying: boolean;
  /** Visual step index (0-indexed, updated at actual step time via setTimeout). */
  visualCurrentStep: number;
}

// ---------------------------------------------------------------------------
// Display state (read by StepSequencerDisplay each frame)
// ---------------------------------------------------------------------------

/** Snapshot of sequencer state consumed by the display renderer. */
export interface StepSequencerDisplayState {
  pattern: SequencerPattern;
  transport: TransportState;
}

// ---------------------------------------------------------------------------
// Note picker state
// ---------------------------------------------------------------------------

/** Which step's note picker is open, if any. */
export interface NotePickerState {
  /** Index of the step whose picker is open (0–15), or -1 if closed. */
  stepIndex: number;
  /** Currently selected note name index (0=C, 1=C#, …, 11=B). */
  noteNameIndex: number;
  /** Currently selected octave (0–8). */
  octave: number;
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export type NoteName = (typeof NOTE_NAMES)[number];

/** Decode a MIDI note number into note name index and octave. */
export function decodeMidiNote(midiNote: number): { noteNameIndex: number; octave: number } {
  const clamped = Math.max(0, Math.min(127, midiNote));
  return {
    noteNameIndex: clamped % 12,
    octave: Math.floor(clamped / 12) - 1, // MIDI 0 = C-1; clamp display to 0–8
  };
}

/** Encode a note name index and octave into a MIDI note number. */
export function encodeMidiNote(noteNameIndex: number, octave: number): number {
  return (octave + 1) * 12 + noteNameIndex;
}

/** Decode arpeggiator semitone offset from stored note value (note - 64). */
export function decodeArpOffset(encodedNote: number): number {
  return encodedNote - 64;
}

/** Encode arpeggiator semitone offset to stored note value (offset + 64). */
export function encodeArpOffset(semitoneOffset: number): number {
  return Math.max(52, Math.min(76, semitoneOffset + 64));
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/** Parameter IDs for step data — used by serialize/deserialize. */
export function stepParamId(stepIndex: number, field: keyof SequencerStep): string {
  return `step_${stepIndex}_${field}`;
}

/** Convert a SequencerStep to its serialized parameter values. */
export function stepToParams(stepIndex: number, step: SequencerStep): Record<string, number> {
  return {
    [stepParamId(stepIndex, 'active')]: step.active ? 1 : 0,
    [stepParamId(stepIndex, 'note')]: step.note,
    [stepParamId(stepIndex, 'velocity')]: step.velocity,
    [stepParamId(stepIndex, 'gateLength')]: step.gateLength,
  };
}

/** Reconstruct a SequencerStep from deserialized parameter values. */
export function paramsToStep(stepIndex: number, params: Record<string, number>): SequencerStep {
  return {
    active: (params[stepParamId(stepIndex, 'active')] ?? 1) !== 0,
    note: params[stepParamId(stepIndex, 'note')] ?? DEFAULT_STEP.note,
    velocity: params[stepParamId(stepIndex, 'velocity')] ?? DEFAULT_STEP.velocity,
    gateLength: (params[stepParamId(stepIndex, 'gateLength')] ?? DEFAULT_STEP.gateLength) as GateLength,
  };
}
