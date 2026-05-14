import { describe, it, expect } from 'vitest';
import {
  MIDI_CC_MIN,
  MIDI_CC_MAX,
  MIDI_CHANNEL_MIN,
  MIDI_CHANNEL_MAX,
  isValidMidiMapping,
  scaleCcToParam,
  mappingKey,
  sanitiseMidiMappings,
} from '../../src/midi/midiValidation';
import type { MidiMapping } from '../../src/core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validMapping(overrides: Partial<MidiMapping> = {}): MidiMapping {
  return {
    componentId: 'osc-1',
    parameterName: 'frequency',
    channel: 1,
    cc: 74,
    minValue: 20,
    maxValue: 20000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('MIDI validation constants', () => {
  it('MIDI_CC_MIN is 0', () => expect(MIDI_CC_MIN).toBe(0));
  it('MIDI_CC_MAX is 127', () => expect(MIDI_CC_MAX).toBe(127));
  it('MIDI_CHANNEL_MIN is 0', () => expect(MIDI_CHANNEL_MIN).toBe(0));
  it('MIDI_CHANNEL_MAX is 15', () => expect(MIDI_CHANNEL_MAX).toBe(15));
});

// ---------------------------------------------------------------------------
// isValidMidiMapping
// ---------------------------------------------------------------------------

describe('isValidMidiMapping', () => {
  it('returns true for a fully valid mapping', () => {
    expect(isValidMidiMapping(validMapping())).toBe(true);
  });

  it('returns false for null', () => expect(isValidMidiMapping(null)).toBe(false));
  it('returns false for a string', () => expect(isValidMidiMapping('bad')).toBe(false));
  it('returns false for a number', () => expect(isValidMidiMapping(42)).toBe(false));
  it('returns false for an array', () => expect(isValidMidiMapping([])).toBe(false));

  it('returns false when componentId is empty string', () => {
    expect(isValidMidiMapping(validMapping({ componentId: '' }))).toBe(false);
  });

  it('returns false when parameterName is empty string', () => {
    expect(isValidMidiMapping(validMapping({ parameterName: '' }))).toBe(false);
  });

  it('accepts channel=0 (omni)', () => {
    expect(isValidMidiMapping(validMapping({ channel: 0 }))).toBe(true);
  });

  it('accepts channel=15 (max)', () => {
    expect(isValidMidiMapping(validMapping({ channel: 15 }))).toBe(true);
  });

  it('rejects channel=-1 (below min)', () => {
    expect(isValidMidiMapping(validMapping({ channel: -1 }))).toBe(false);
  });

  it('rejects channel=16 (above max)', () => {
    expect(isValidMidiMapping(validMapping({ channel: 16 }))).toBe(false);
  });

  it('accepts cc=0 (min boundary)', () => {
    expect(isValidMidiMapping(validMapping({ cc: 0 }))).toBe(true);
  });

  it('accepts cc=127 (max boundary)', () => {
    expect(isValidMidiMapping(validMapping({ cc: 127 }))).toBe(true);
  });

  it('rejects cc=-1 (below min)', () => {
    expect(isValidMidiMapping(validMapping({ cc: -1 }))).toBe(false);
  });

  it('rejects cc=128 (above max)', () => {
    expect(isValidMidiMapping(validMapping({ cc: 128 }))).toBe(false);
  });

  it('rejects mapping where maxValue === minValue', () => {
    expect(isValidMidiMapping(validMapping({ minValue: 5, maxValue: 5 }))).toBe(false);
  });

  it('rejects mapping where maxValue < minValue', () => {
    expect(isValidMidiMapping(validMapping({ minValue: 10, maxValue: 5 }))).toBe(false);
  });

  it('rejects when componentId is not a string', () => {
    expect(isValidMidiMapping({ ...validMapping(), componentId: 123 })).toBe(false);
  });

  it('rejects when cc is not a number', () => {
    expect(isValidMidiMapping({ ...validMapping(), cc: '74' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// scaleCcToParam
// ---------------------------------------------------------------------------

describe('scaleCcToParam', () => {
  it('cc=0 maps to minValue', () => {
    expect(scaleCcToParam(0, 0, 100)).toBe(0);
  });

  it('cc=127 maps to maxValue', () => {
    expect(scaleCcToParam(127, 0, 100)).toBe(100);
  });

  it('cc=64 maps to roughly midpoint', () => {
    const result = scaleCcToParam(64, 0, 100);
    // 0 + (64/127)*100 ≈ 50.39
    expect(result).toBeCloseTo(50.39, 1);
  });

  it('works with a negative min range', () => {
    const result = scaleCcToParam(0, -1, 1);
    expect(result).toBe(-1);
  });

  it('cc=127 on range [-1, 1] maps to 1', () => {
    expect(scaleCcToParam(127, -1, 1)).toBe(1);
  });

  it('clamps cc below 0 to MIDI_CC_MIN', () => {
    expect(scaleCcToParam(-10, 0, 100)).toBe(0);
  });

  it('clamps cc above 127 to MIDI_CC_MAX', () => {
    expect(scaleCcToParam(200, 0, 100)).toBe(100);
  });

  it('handles frequency range (20–20000)', () => {
    const result = scaleCcToParam(0, 20, 20000);
    expect(result).toBe(20);
    const result2 = scaleCcToParam(127, 20, 20000);
    expect(result2).toBe(20000);
  });
});

// ---------------------------------------------------------------------------
// mappingKey
// ---------------------------------------------------------------------------

describe('mappingKey', () => {
  it('concatenates componentId and parameterName with colon', () => {
    expect(mappingKey('osc-1', 'frequency')).toBe('osc-1:frequency');
  });

  it('works with arbitrary strings', () => {
    expect(mappingKey('comp', 'gain')).toBe('comp:gain');
  });
});

// ---------------------------------------------------------------------------
// sanitiseMidiMappings
// ---------------------------------------------------------------------------

describe('sanitiseMidiMappings', () => {
  it('returns empty array for null', () => {
    expect(sanitiseMidiMappings(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(sanitiseMidiMappings(undefined)).toEqual([]);
  });

  it('returns empty array for non-array primitive', () => {
    expect(sanitiseMidiMappings(42)).toEqual([]);
  });

  it('returns empty array for empty array input', () => {
    expect(sanitiseMidiMappings([])).toEqual([]);
  });

  it('passes through a single valid mapping', () => {
    const m = validMapping();
    expect(sanitiseMidiMappings([m])).toEqual([m]);
  });

  it('filters out invalid entries and keeps valid ones', () => {
    const m = validMapping();
    const result = sanitiseMidiMappings([m, null, 'bad', { cc: -1 }]);
    expect(result).toEqual([m]);
  });

  it('returns all valid mappings from a multi-element array', () => {
    const m1 = validMapping({ cc: 1 });
    const m2 = validMapping({ cc: 2 });
    expect(sanitiseMidiMappings([m1, m2])).toEqual([m1, m2]);
  });

  it('rejects a mapping with maxValue === minValue', () => {
    const bad = validMapping({ minValue: 0, maxValue: 0 });
    expect(sanitiseMidiMappings([bad])).toEqual([]);
  });
});
