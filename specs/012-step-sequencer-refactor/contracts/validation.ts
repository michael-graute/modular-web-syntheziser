/**
 * Validation helpers for Step Sequencer data (feature 012).
 *
 * These functions validate runtime state and serialized parameter values.
 * They throw descriptive errors on invalid data rather than silently coercing,
 * so deserialization failures surface early and clearly.
 */

import {
  GATE_LENGTH,
  SEQUENCER_MODE,
  NOTE_DIVISION,
  DEFAULT_STEP,
  DEFAULT_PATTERN,
  type SequencerStep,
  type SequencerPattern,
  type GateLength,
  type SequencerMode,
  type NoteDivision,
} from './types';

// ---------------------------------------------------------------------------
// Scalar validators
// ---------------------------------------------------------------------------

export function validateBpm(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 30 || n > 300) {
    throw new RangeError(`BPM must be 30–300, got ${value}`);
  }
  return n;
}

export function validateSequenceLength(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 2 || n > 16) {
    throw new RangeError(`sequenceLength must be 2–16, got ${value}`);
  }
  return n;
}

export function validateNoteValue(value: unknown): NoteDivision {
  const n = Number(value);
  const valid = Object.values(NOTE_DIVISION);
  if (!valid.includes(n as NoteDivision)) {
    throw new RangeError(`noteValue must be one of ${valid.join(', ')}, got ${value}`);
  }
  return n as NoteDivision;
}

export function validateMode(value: unknown): SequencerMode {
  const n = Number(value);
  if (n !== SEQUENCER_MODE.SEQUENCER && n !== SEQUENCER_MODE.ARPEGGIATOR) {
    throw new RangeError(`mode must be 0 (Sequencer) or 1 (Arpeggiator), got ${value}`);
  }
  return n as SequencerMode;
}

export function validateMidiNote(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 127) {
    throw new RangeError(`MIDI note must be 0–127, got ${value}`);
  }
  return n;
}

export function validateVelocity(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new RangeError(`velocity must be 0.0–1.0, got ${value}`);
  }
  return n;
}

export function validateGateLength(value: unknown): GateLength {
  const n = Number(value);
  const valid = Object.values(GATE_LENGTH);
  if (!valid.includes(n as GateLength)) {
    throw new RangeError(`gateLength must be one of ${valid.join(', ')}, got ${value}`);
  }
  return n as GateLength;
}

// ---------------------------------------------------------------------------
// Step validator
// ---------------------------------------------------------------------------

export function validateStep(raw: unknown, stepIndex: number): SequencerStep {
  if (typeof raw !== 'object' || raw === null) {
    throw new TypeError(`Step ${stepIndex} must be an object, got ${typeof raw}`);
  }

  const obj = raw as Record<string, unknown>;

  return {
    active: typeof obj['active'] === 'boolean' ? obj['active'] : Boolean(obj['active'] ?? DEFAULT_STEP.active),
    note: validateMidiNote(obj['note'] ?? DEFAULT_STEP.note),
    velocity: validateVelocity(obj['velocity'] ?? DEFAULT_STEP.velocity),
    gateLength: validateGateLength(obj['gateLength'] ?? DEFAULT_STEP.gateLength),
  };
}

// ---------------------------------------------------------------------------
// Pattern validator (for deserialized patch data)
// ---------------------------------------------------------------------------

export function validatePattern(raw: unknown): SequencerPattern {
  if (typeof raw !== 'object' || raw === null) {
    throw new TypeError(`Pattern must be an object, got ${typeof raw}`);
  }

  const obj = raw as Record<string, unknown>;

  const stepsRaw = Array.isArray(obj['steps']) ? obj['steps'] : [];
  // Ensure exactly 16 steps; pad with defaults if saved with fewer
  const steps: SequencerStep[] = Array.from({ length: 16 }, (_, i) =>
    stepsRaw[i] !== undefined
      ? validateStep(stepsRaw[i], i)
      : { ...DEFAULT_STEP }
  );

  return {
    steps,
    bpm: validateBpm(obj['bpm'] ?? DEFAULT_PATTERN.bpm),
    noteValue: validateNoteValue(obj['noteValue'] ?? DEFAULT_PATTERN.noteValue),
    sequenceLength: validateSequenceLength(obj['sequenceLength'] ?? DEFAULT_PATTERN.sequenceLength),
    mode: validateMode(obj['mode'] ?? DEFAULT_PATTERN.mode),
  };
}

// ---------------------------------------------------------------------------
// Parameter map validator (used when restoring from PatchSerializer)
// ---------------------------------------------------------------------------

/**
 * Validate and reconstruct a SequencerPattern from a flat parameters map
 * as produced by PatchSerializer. Missing keys fall back to defaults.
 */
export function validatePatternFromParams(params: Record<string, number>): SequencerPattern {
  const steps: SequencerStep[] = Array.from({ length: 16 }, (_, i) => ({
    active: ((params[`step_${i}_active`] ?? 1) !== 0),
    note: validateMidiNote(params[`step_${i}_note`] ?? DEFAULT_STEP.note),
    velocity: validateVelocity(params[`step_${i}_velocity`] ?? DEFAULT_STEP.velocity),
    gateLength: validateGateLength(params[`step_${i}_gateLength`] ?? DEFAULT_STEP.gateLength),
  }));

  return {
    steps,
    bpm: validateBpm(params['bpm'] ?? DEFAULT_PATTERN.bpm),
    noteValue: validateNoteValue(params['noteValue'] ?? DEFAULT_PATTERN.noteValue),
    sequenceLength: validateSequenceLength(params['sequenceLength'] ?? DEFAULT_PATTERN.sequenceLength),
    mode: validateMode(params['mode'] ?? DEFAULT_PATTERN.mode),
  };
}

// ---------------------------------------------------------------------------
// Step index validator
// ---------------------------------------------------------------------------

export function validateStepIndex(index: number, sequenceLength: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= sequenceLength) {
    throw new RangeError(`Step index ${index} out of range for sequence length ${sequenceLength}`);
  }
}
