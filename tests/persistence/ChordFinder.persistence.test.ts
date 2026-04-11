/**
 * ChordFinder Persistence Tests (T039)
 *
 * Verifies that serialize() → deserialize() round-trips preserve all
 * ChordFinder state: rootNote, scaleType, octave, and progression bitmask.
 * Feature: 010-chord-finder — Phase 6 (US4)
 */

import { describe, it, expect } from 'vitest';
import { ChordFinder } from '../../src/components/utilities/ChordFinder';
import { ChordScaleType } from '../../specs/010-chord-finder/contracts/types';
import {
  encodeProgressionBitmask,
  decodeProgressionBitmask,
} from '../../specs/010-chord-finder/contracts/validation';

function makeChordFinder(): ChordFinder {
  return new ChordFinder('cf-persist', { x: 0, y: 0 });
}

// ---------------------------------------------------------------------------
// Round-trip helpers
// ---------------------------------------------------------------------------

function roundTrip(cf: ChordFinder): ChordFinder {
  const data = cf.serialize();
  const cf2 = makeChordFinder();
  cf2.deserialize(data);
  return cf2;
}

// ---------------------------------------------------------------------------
// T039 — serialize → deserialize round-trips
// ---------------------------------------------------------------------------

describe('ChordFinder persistence (T039)', () => {
  it('round-trips rootNote and scaleType for G Major', () => {
    const cf = makeChordFinder();
    cf.selectKey('G', ChordScaleType.MAJOR);

    const cf2 = roundTrip(cf);
    const state = cf2.getState();
    expect(state.config.rootNote).toBe('G');
    expect(state.config.scaleType).toBe(ChordScaleType.MAJOR);
  });

  it('round-trips rootNote and scaleType for A Natural Minor', () => {
    const cf = makeChordFinder();
    cf.selectKey('A', ChordScaleType.NATURAL_MINOR);

    const cf2 = roundTrip(cf);
    const state = cf2.getState();
    expect(state.config.rootNote).toBe('A');
    expect(state.config.scaleType).toBe(ChordScaleType.NATURAL_MINOR);
  });

  it('round-trips octave = 5', () => {
    const cf = makeChordFinder();
    cf.setOctave(5);

    const cf2 = roundTrip(cf);
    expect(cf2.getState().config.octave).toBe(5);
  });

  it('round-trips octave across all valid values (2–6)', () => {
    for (const oct of [2, 3, 4, 5, 6]) {
      const cf = makeChordFinder();
      cf.setOctave(oct);
      const cf2 = roundTrip(cf);
      expect(cf2.getState().config.octave).toBe(oct);
    }
  });

  it('round-trips progression = 0 (no active progression)', () => {
    const cf = makeChordFinder();
    // No generateProgression call — progression stays empty

    const data = cf.serialize();
    expect(data.parameters['progression']).toBe(0);

    const cf2 = roundTrip(cf);
    expect(cf2.getState().config.progression).toHaveLength(0);
    expect(cf2.parameters.get('progression')?.getValue()).toBe(0);
  });

  it('round-trips a generated progression bitmask', () => {
    const cf = makeChordFinder();
    cf.selectKey('C', ChordScaleType.MAJOR);
    cf.generateProgression();

    const originalProgression = cf.getState().config.progression;
    const originalBitmask = cf.parameters.get('progression')?.getValue() ?? 0;

    const cf2 = roundTrip(cf);
    const restoredBitmask = cf2.parameters.get('progression')?.getValue() ?? 0;

    expect(restoredBitmask).toBe(originalBitmask);

    // Degree set must be identical
    const originalSet = new Set(originalProgression);
    const restoredSet = new Set(cf2.getState().config.progression);
    expect(restoredSet.size).toBe(originalSet.size);
    for (const d of originalSet) {
      expect(restoredSet.has(d)).toBe(true);
    }
  });

  it('round-trips bitmask = 127 (all 7 degrees active)', () => {
    const cf = makeChordFinder();
    cf.selectKey('C', ChordScaleType.MAJOR);

    // Manually force all-degrees bitmask via parameter
    cf.parameters.get('progression')?.setValue(127);
    // Also set config.progression so serialize picks it up
    (cf as any).config.progression = decodeProgressionBitmask(127);

    const data = cf.serialize();
    expect(data.parameters['progression']).toBe(127);

    const cf2 = roundTrip(cf);
    expect(cf2.parameters.get('progression')?.getValue()).toBe(127);
    expect(cf2.getState().config.progression).toHaveLength(7);
  });

  it('restores diatonic chords after deserialization', () => {
    const cf = makeChordFinder();
    cf.selectKey('F#', ChordScaleType.NATURAL_MINOR);

    const cf2 = roundTrip(cf);
    expect(cf2.getDiatonicChords()).toHaveLength(7);
    expect(cf2.getDiatonicChords()[0]!.name).toBe('F#m');
  });

  it('preserves serialized parameter values in ComponentData', () => {
    const cf = makeChordFinder();
    cf.selectKey('D', ChordScaleType.MAJOR);
    cf.setOctave(3);

    const data = cf.serialize();
    expect(data.id).toBe('cf-persist');
    expect(data.parameters['rootNote']).toBe(2); // D = index 2
    expect(data.parameters['scaleType']).toBe(0); // MAJOR = 0
    expect(data.parameters['octave']).toBe(3);
    expect(typeof data.parameters['progression']).toBe('number');
  });

  it('bitmask encode/decode round-trips correctly for arbitrary degrees', () => {
    const degrees = [0, 2, 4, 6];
    const bitmask = encodeProgressionBitmask(degrees);
    const decoded = decodeProgressionBitmask(bitmask);
    expect(decoded).toEqual(degrees);
  });
});
