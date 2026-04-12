/**
 * Unit tests for Step Sequencer contracts helpers (feature 012).
 *
 * Tests all encode/decode and serialization helper functions from
 * specs/012-step-sequencer-refactor/contracts/types.ts and validation.ts.
 * No audio nodes are created — pure function tests.
 */

import { describe, it, expect } from 'vitest';
import {
  encodeMidiNote,
  decodeMidiNote,
  encodeArpOffset,
  decodeArpOffset,
  stepToParams,
  paramsToStep,
  NOTE_NAMES,
  GATE_LENGTH,
  SEQUENCER_MODE,
  NOTE_DIVISION,
  DEFAULT_STEP,
  DEFAULT_PATTERN,
  type SequencerStep,
} from '../../specs/012-step-sequencer-refactor/contracts/types';
import {
  validateBpm,
  validateSequenceLength,
  validateMode,
  validateNoteValue,
  validateMidiNote,
  validateVelocity,
  validateGateLength,
  validatePatternFromParams,
} from '../../specs/012-step-sequencer-refactor/contracts/validation';

// ---------------------------------------------------------------------------
// encodeMidiNote / decodeMidiNote round-trip
// ---------------------------------------------------------------------------

describe('encodeMidiNote / decodeMidiNote', () => {
  it('round-trips all 128 MIDI notes', () => {
    for (let midi = 0; midi <= 127; midi++) {
      const { noteNameIndex, octave } = decodeMidiNote(midi);
      const encoded = encodeMidiNote(noteNameIndex, octave);
      expect(encoded).toBe(midi);
    }
  });

  it('decodeMidiNote(60) returns C4 (noteNameIndex=0, octave=4)', () => {
    const { noteNameIndex, octave } = decodeMidiNote(60);
    expect(NOTE_NAMES[noteNameIndex]).toBe('C');
    expect(octave).toBe(4);
  });

  it('decodeMidiNote(69) returns A4 (noteNameIndex=9, octave=4)', () => {
    const { noteNameIndex, octave } = decodeMidiNote(69);
    expect(NOTE_NAMES[noteNameIndex]).toBe('A');
    expect(octave).toBe(4);
  });

  it('encodeMidiNote(0, 0) returns 0 (C0)', () => {
    expect(encodeMidiNote(0, 0)).toBe(12); // C0 = MIDI 12 (octave 0 = C4 octave group -1 -> +1 = 0+1=1 -> 1*12=12)
  });

  it('decodeMidiNote clamps values out of 0-127 range', () => {
    // Should not throw — clamps internally
    expect(() => decodeMidiNote(-1)).not.toThrow();
    expect(() => decodeMidiNote(128)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// encodeArpOffset / decodeArpOffset round-trip
// ---------------------------------------------------------------------------

describe('encodeArpOffset / decodeArpOffset', () => {
  it('round-trips all valid offsets from -12 to +12', () => {
    for (let offset = -12; offset <= 12; offset++) {
      const encoded = encodeArpOffset(offset);
      const decoded = decodeArpOffset(encoded);
      expect(decoded).toBe(offset);
    }
  });

  it('encodeArpOffset(0) returns 64', () => {
    expect(encodeArpOffset(0)).toBe(64);
  });

  it('encodeArpOffset(-12) returns 52', () => {
    expect(encodeArpOffset(-12)).toBe(52);
  });

  it('encodeArpOffset(+12) returns 76', () => {
    expect(encodeArpOffset(12)).toBe(76);
  });

  it('clamps offset below -12 to 52', () => {
    expect(encodeArpOffset(-20)).toBe(52);
  });

  it('clamps offset above +12 to 76', () => {
    expect(encodeArpOffset(20)).toBe(76);
  });

  it('decodeArpOffset(64) returns 0', () => {
    expect(decodeArpOffset(64)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// stepToParams / paramsToStep round-trip
// ---------------------------------------------------------------------------

describe('stepToParams / paramsToStep', () => {
  const sampleStep: SequencerStep = {
    active: true,
    note: 60,
    velocity: 0.75,
    gateLength: GATE_LENGTH.EIGHTH,
  };

  it('round-trips a sample step at index 0', () => {
    const params = stepToParams(0, sampleStep);
    const restored = paramsToStep(0, params);
    expect(restored.active).toBe(sampleStep.active);
    expect(restored.note).toBe(sampleStep.note);
    expect(restored.velocity).toBe(sampleStep.velocity);
    expect(restored.gateLength).toBe(sampleStep.gateLength);
  });

  it('round-trips all 16 steps', () => {
    for (let i = 0; i < 16; i++) {
      const step: SequencerStep = {
        active: i % 2 === 0,
        note: 48 + i,
        velocity: i / 16,
        gateLength: (i % 6) as SequencerStep['gateLength'],
      };
      const params = stepToParams(i, step);
      const restored = paramsToStep(i, params);
      expect(restored).toEqual(step);
    }
  });

  it('inactive step serializes active as 0', () => {
    const inactiveStep: SequencerStep = { ...sampleStep, active: false };
    const params = stepToParams(3, inactiveStep);
    expect(params['step_3_active']).toBe(0);
  });

  it('active step serializes active as 1', () => {
    const params = stepToParams(5, sampleStep);
    expect(params['step_5_active']).toBe(1);
  });

  it('paramsToStep uses defaults for missing keys', () => {
    const restored = paramsToStep(0, {});
    expect(restored.active).toBe(DEFAULT_STEP.active);
    expect(restored.note).toBe(DEFAULT_STEP.note);
    expect(restored.velocity).toBe(DEFAULT_STEP.velocity);
    expect(restored.gateLength).toBe(DEFAULT_STEP.gateLength);
  });
});

// ---------------------------------------------------------------------------
// validatePatternFromParams
// ---------------------------------------------------------------------------

describe('validatePatternFromParams', () => {
  it('restores valid full params correctly', () => {
    const params: Record<string, number> = {
      bpm: 140,
      noteValue: NOTE_DIVISION.EIGHTH,
      sequenceLength: 8,
      mode: SEQUENCER_MODE.ARPEGGIATOR,
    };
    for (let i = 0; i < 16; i++) {
      params[`step_${i}_active`] = i < 8 ? 1 : 0;
      params[`step_${i}_note`] = 60 + i;
      params[`step_${i}_velocity`] = 0.5 + i * 0.02;
      params[`step_${i}_gateLength`] = GATE_LENGTH.QUARTER;
    }
    const pattern = validatePatternFromParams(params);
    expect(pattern.bpm).toBe(140);
    expect(pattern.sequenceLength).toBe(8);
    expect(pattern.mode).toBe(SEQUENCER_MODE.ARPEGGIATOR);
    expect(pattern.steps.length).toBe(16);
    expect(pattern.steps[0]!.note).toBe(60);
    expect(pattern.steps[15]!.active).toBe(false);
  });

  it('uses defaults for missing keys', () => {
    const pattern = validatePatternFromParams({});
    expect(pattern.bpm).toBe(DEFAULT_PATTERN.bpm);
    expect(pattern.sequenceLength).toBe(DEFAULT_PATTERN.sequenceLength);
    expect(pattern.mode).toBe(DEFAULT_PATTERN.mode);
    expect(pattern.steps.length).toBe(16);
    expect(pattern.steps[0]!.note).toBe(DEFAULT_STEP.note);
  });

  it('pads steps array to 16 when fewer are provided', () => {
    const params: Record<string, number> = {};
    // Only provide 4 steps
    for (let i = 0; i < 4; i++) {
      params[`step_${i}_active`] = 1;
      params[`step_${i}_note`] = 48;
      params[`step_${i}_velocity`] = 0.8;
      params[`step_${i}_gateLength`] = 3;
    }
    const pattern = validatePatternFromParams(params);
    expect(pattern.steps.length).toBe(16);
    // Steps 4-15 should use defaults
    expect(pattern.steps[4]!.note).toBe(DEFAULT_STEP.note);
  });
});

// ---------------------------------------------------------------------------
// Scalar validators
// ---------------------------------------------------------------------------

describe('validateBpm', () => {
  it('accepts values within 30-300', () => {
    expect(validateBpm(30)).toBe(30);
    expect(validateBpm(120)).toBe(120);
    expect(validateBpm(300)).toBe(300);
  });

  it('throws for values outside range', () => {
    expect(() => validateBpm(29)).toThrow(RangeError);
    expect(() => validateBpm(301)).toThrow(RangeError);
    expect(() => validateBpm(NaN)).toThrow(RangeError);
  });
});

describe('validateSequenceLength', () => {
  it('accepts 2-16', () => {
    expect(validateSequenceLength(2)).toBe(2);
    expect(validateSequenceLength(16)).toBe(16);
  });

  it('throws for 1 and 17', () => {
    expect(() => validateSequenceLength(1)).toThrow(RangeError);
    expect(() => validateSequenceLength(17)).toThrow(RangeError);
  });
});

describe('validateMidiNote', () => {
  it('accepts 0-127', () => {
    expect(validateMidiNote(0)).toBe(0);
    expect(validateMidiNote(127)).toBe(127);
  });

  it('throws for out-of-range values', () => {
    expect(() => validateMidiNote(-1)).toThrow(RangeError);
    expect(() => validateMidiNote(128)).toThrow(RangeError);
  });
});

describe('validateVelocity', () => {
  it('accepts 0.0-1.0', () => {
    expect(validateVelocity(0)).toBe(0);
    expect(validateVelocity(0.5)).toBe(0.5);
    expect(validateVelocity(1)).toBe(1);
  });

  it('throws for out-of-range values', () => {
    expect(() => validateVelocity(-0.1)).toThrow(RangeError);
    expect(() => validateVelocity(1.1)).toThrow(RangeError);
  });
});

describe('validateGateLength', () => {
  it('accepts all valid enum values 0-5', () => {
    for (let v = 0; v <= 5; v++) {
      expect(validateGateLength(v)).toBe(v);
    }
  });

  it('throws for invalid values', () => {
    expect(() => validateGateLength(6)).toThrow(RangeError);
    expect(() => validateGateLength(-1)).toThrow(RangeError);
  });
});

describe('validateMode', () => {
  it('accepts 0 and 1', () => {
    expect(validateMode(0)).toBe(SEQUENCER_MODE.SEQUENCER);
    expect(validateMode(1)).toBe(SEQUENCER_MODE.ARPEGGIATOR);
  });

  it('throws for other values', () => {
    expect(() => validateMode(2)).toThrow(RangeError);
  });
});

describe('validateNoteValue', () => {
  it('accepts all 6 division values 0-5', () => {
    for (let v = 0; v <= 5; v++) {
      expect(validateNoteValue(v)).toBe(v);
    }
  });

  it('throws for invalid values', () => {
    expect(() => validateNoteValue(6)).toThrow(RangeError);
  });
});
