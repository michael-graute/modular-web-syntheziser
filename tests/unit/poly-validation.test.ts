/**
 * 100% coverage tests for specs/032-polyphony/contracts/validation.ts
 * Constitution requirement: utility/validation functions must reach 100% coverage.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidVoiceIndex,
  isValidVoiceSlot,
  isValidVoiceSlotArray,
  isValidPolyMode,
  isValidAdsrTime,
  isValidSustainLevel,
  isValidWaveformIndex,
  findOldestActiveVoiceIndex,
  findFirstIdleVoiceIndex,
  findVoiceIndexForNote,
} from '../../src/utils/polyValidation';
import type { VoiceSlot } from '../../src/components/utilities/VoiceAllocator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSlot(overrides: Partial<VoiceSlot> = {}, index: 0 | 1 | 2 | 3 = 0): VoiceSlot {
  return {
    voiceIndex: index,
    frequency: 440,
    gate: 0,
    note: null,
    timestamp: 0,
    ...overrides,
  };
}

function makeSlotArray(gates: (0 | 1)[] = [0, 0, 0, 0], notes: (number | null)[] = [null, null, null, null]): VoiceSlot[] {
  return Array.from({ length: 4 }, (_, i) => ({
    voiceIndex: i as 0 | 1 | 2 | 3,
    frequency: 440,
    gate: gates[i] ?? 0,
    note: notes[i] ?? null,
    timestamp: i * 10, // staggered timestamps
  }));
}

// ---------------------------------------------------------------------------
// isValidVoiceIndex
// ---------------------------------------------------------------------------

describe('isValidVoiceIndex', () => {
  it('accepts 0, 1, 2, 3', () => {
    expect(isValidVoiceIndex(0)).toBe(true);
    expect(isValidVoiceIndex(1)).toBe(true);
    expect(isValidVoiceIndex(2)).toBe(true);
    expect(isValidVoiceIndex(3)).toBe(true);
  });

  it('rejects -1 (below range)', () => {
    expect(isValidVoiceIndex(-1)).toBe(false);
  });

  it('rejects 4 (above range)', () => {
    expect(isValidVoiceIndex(4)).toBe(false);
  });

  it('rejects non-integer 1.5', () => {
    expect(isValidVoiceIndex(1.5)).toBe(false);
  });

  it('rejects NaN', () => {
    expect(isValidVoiceIndex(NaN)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidVoiceSlot
// ---------------------------------------------------------------------------

describe('isValidVoiceSlot', () => {
  it('accepts a fully valid slot', () => {
    expect(isValidVoiceSlot(makeSlot())).toBe(true);
  });

  it('accepts a valid slot with an active note', () => {
    expect(isValidVoiceSlot(makeSlot({ gate: 1, note: 60 }))).toBe(true);
  });

  it('accepts note=0 (lowest MIDI note)', () => {
    expect(isValidVoiceSlot(makeSlot({ note: 0 }))).toBe(true);
  });

  it('accepts note=127 (highest MIDI note)', () => {
    expect(isValidVoiceSlot(makeSlot({ note: 127 }))).toBe(true);
  });

  it('rejects null input', () => {
    expect(isValidVoiceSlot(null)).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(isValidVoiceSlot(42)).toBe(false);
    expect(isValidVoiceSlot('slot')).toBe(false);
  });

  it('rejects slot with invalid voiceIndex (4)', () => {
    expect(isValidVoiceSlot({ ...makeSlot(), voiceIndex: 4 })).toBe(false);
  });

  it('rejects slot with negative frequency', () => {
    expect(isValidVoiceSlot(makeSlot({ frequency: -1 }))).toBe(false);
  });

  it('rejects slot with gate value other than 0 or 1', () => {
    expect(isValidVoiceSlot({ ...makeSlot(), gate: 2 })).toBe(false);
    expect(isValidVoiceSlot({ ...makeSlot(), gate: -1 })).toBe(false);
  });

  it('rejects slot with note > 127', () => {
    expect(isValidVoiceSlot(makeSlot({ note: 128 }))).toBe(false);
  });

  it('rejects slot with note < 0', () => {
    expect(isValidVoiceSlot(makeSlot({ note: -1 }))).toBe(false);
  });

  it('rejects slot with fractional note', () => {
    expect(isValidVoiceSlot(makeSlot({ note: 60.5 }))).toBe(false);
  });

  it('rejects slot with negative timestamp', () => {
    expect(isValidVoiceSlot(makeSlot({ timestamp: -1 }))).toBe(false);
  });

  it('rejects slot with non-number frequency', () => {
    expect(isValidVoiceSlot({ ...makeSlot(), frequency: 'high' })).toBe(false);
  });

  it('rejects slot with non-number timestamp', () => {
    expect(isValidVoiceSlot({ ...makeSlot(), timestamp: 'now' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidVoiceSlotArray
// ---------------------------------------------------------------------------

describe('isValidVoiceSlotArray', () => {
  it('accepts a valid 4-slot array', () => {
    expect(isValidVoiceSlotArray(makeSlotArray())).toBe(true);
  });

  it('rejects a non-array', () => {
    expect(isValidVoiceSlotArray('not an array')).toBe(false);
    expect(isValidVoiceSlotArray(null)).toBe(false);
    expect(isValidVoiceSlotArray({})).toBe(false);
  });

  it('rejects array with fewer than 4 slots', () => {
    expect(isValidVoiceSlotArray(makeSlotArray().slice(0, 3))).toBe(false);
  });

  it('rejects array with more than 4 slots', () => {
    const extra = [...makeSlotArray(), makeSlot(undefined, 0)];
    expect(isValidVoiceSlotArray(extra)).toBe(false);
  });

  it('rejects array where voiceIndex does not match position', () => {
    const slots = makeSlotArray();
    (slots[0] as any).voiceIndex = 2; // wrong index
    expect(isValidVoiceSlotArray(slots)).toBe(false);
  });

  it('rejects array containing an invalid slot', () => {
    const slots = makeSlotArray();
    (slots[1] as any).gate = 99;
    expect(isValidVoiceSlotArray(slots)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidPolyMode
// ---------------------------------------------------------------------------

describe('isValidPolyMode', () => {
  it('accepts 0 (mono)', () => {
    expect(isValidPolyMode(0)).toBe(true);
  });

  it('accepts 1 (poly)', () => {
    expect(isValidPolyMode(1)).toBe(true);
  });

  it('rejects 2', () => {
    expect(isValidPolyMode(2)).toBe(false);
  });

  it('rejects -1', () => {
    expect(isValidPolyMode(-1)).toBe(false);
  });

  it('rejects 0.5', () => {
    expect(isValidPolyMode(0.5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidAdsrTime
// ---------------------------------------------------------------------------

describe('isValidAdsrTime', () => {
  it('accepts value at minimum boundary (0.001)', () => {
    expect(isValidAdsrTime(0.001)).toBe(true);
  });

  it('accepts value at maximum boundary (5.0)', () => {
    expect(isValidAdsrTime(5.0)).toBe(true);
  });

  it('accepts a mid-range value', () => {
    expect(isValidAdsrTime(0.5)).toBe(true);
  });

  it('rejects value below minimum', () => {
    expect(isValidAdsrTime(0.0009)).toBe(false);
  });

  it('rejects value above maximum', () => {
    expect(isValidAdsrTime(5.001)).toBe(false);
  });

  it('rejects Infinity', () => {
    expect(isValidAdsrTime(Infinity)).toBe(false);
  });

  it('rejects NaN', () => {
    expect(isValidAdsrTime(NaN)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidSustainLevel
// ---------------------------------------------------------------------------

describe('isValidSustainLevel', () => {
  it('accepts 0.0', () => {
    expect(isValidSustainLevel(0.0)).toBe(true);
  });

  it('accepts 1.0', () => {
    expect(isValidSustainLevel(1.0)).toBe(true);
  });

  it('accepts mid-range value', () => {
    expect(isValidSustainLevel(0.7)).toBe(true);
  });

  it('rejects value below 0', () => {
    expect(isValidSustainLevel(-0.01)).toBe(false);
  });

  it('rejects value above 1', () => {
    expect(isValidSustainLevel(1.01)).toBe(false);
  });

  it('rejects NaN', () => {
    expect(isValidSustainLevel(NaN)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidWaveformIndex
// ---------------------------------------------------------------------------

describe('isValidWaveformIndex', () => {
  it('accepts 0, 1, 2, 3', () => {
    expect(isValidWaveformIndex(0)).toBe(true);
    expect(isValidWaveformIndex(1)).toBe(true);
    expect(isValidWaveformIndex(2)).toBe(true);
    expect(isValidWaveformIndex(3)).toBe(true);
  });

  it('rejects 4', () => {
    expect(isValidWaveformIndex(4)).toBe(false);
  });

  it('rejects -1', () => {
    expect(isValidWaveformIndex(-1)).toBe(false);
  });

  it('rejects 1.5', () => {
    expect(isValidWaveformIndex(1.5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// findOldestActiveVoiceIndex
// ---------------------------------------------------------------------------

describe('findOldestActiveVoiceIndex', () => {
  it('returns -1 when all slots are idle', () => {
    expect(findOldestActiveVoiceIndex(makeSlotArray([0, 0, 0, 0]))).toBe(-1);
  });

  it('returns the index of the only active slot', () => {
    const slots = makeSlotArray([0, 1, 0, 0]);
    slots[1]!.timestamp = 100;
    expect(findOldestActiveVoiceIndex(slots)).toBe(1);
  });

  it('returns the index of the slot with the lowest timestamp', () => {
    const slots = makeSlotArray([1, 1, 1, 1]);
    slots[0]!.timestamp = 300;
    slots[1]!.timestamp = 100; // oldest
    slots[2]!.timestamp = 200;
    slots[3]!.timestamp = 400;
    expect(findOldestActiveVoiceIndex(slots)).toBe(1);
  });

  it('ignores idle slots (gate=0) when finding oldest', () => {
    const slots = makeSlotArray([0, 1, 1, 0]);
    slots[1]!.timestamp = 50;
    slots[2]!.timestamp = 10; // gate=1, lowest ts
    expect(findOldestActiveVoiceIndex(slots)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// findFirstIdleVoiceIndex
// ---------------------------------------------------------------------------

describe('findFirstIdleVoiceIndex', () => {
  it('returns 0 when all slots are idle', () => {
    expect(findFirstIdleVoiceIndex(makeSlotArray([0, 0, 0, 0]))).toBe(0);
  });

  it('returns -1 when all slots are active', () => {
    expect(findFirstIdleVoiceIndex(makeSlotArray([1, 1, 1, 1]))).toBe(-1);
  });

  it('returns the index of the first idle slot', () => {
    expect(findFirstIdleVoiceIndex(makeSlotArray([1, 0, 0, 0]))).toBe(1);
    expect(findFirstIdleVoiceIndex(makeSlotArray([1, 1, 0, 0]))).toBe(2);
    expect(findFirstIdleVoiceIndex(makeSlotArray([1, 1, 1, 0]))).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// findVoiceIndexForNote
// ---------------------------------------------------------------------------

describe('findVoiceIndexForNote', () => {
  it('returns -1 when note is not held in any slot', () => {
    const slots = makeSlotArray([0, 0, 0, 0], [null, null, null, null]);
    expect(findVoiceIndexForNote(slots, 60)).toBe(-1);
  });

  it('returns the correct index when note is held', () => {
    const slots = makeSlotArray([1, 1, 0, 0], [60, 64, null, null]);
    expect(findVoiceIndexForNote(slots, 60)).toBe(0);
    expect(findVoiceIndexForNote(slots, 64)).toBe(1);
  });

  it('returns -1 for a note not in any slot even when other notes are held', () => {
    const slots = makeSlotArray([1, 0, 0, 0], [60, null, null, null]);
    expect(findVoiceIndexForNote(slots, 67)).toBe(-1);
  });

  it('returns the index of the slot holding note=0 (edge: lowest MIDI note)', () => {
    const slots = makeSlotArray([1, 0, 0, 0], [0, null, null, null]);
    expect(findVoiceIndexForNote(slots, 0)).toBe(0);
  });
});
