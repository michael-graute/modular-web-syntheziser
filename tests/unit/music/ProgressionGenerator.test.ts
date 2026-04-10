/**
 * ProgressionGenerator Unit Tests
 * Tests the generateProgression function's statistical properties.
 * Feature: 010-chord-finder — T014
 */

import { describe, it, expect } from 'vitest';
import { generateProgression, getDiatonicChords } from '../../../src/music/ChordTheory';
import { ChordScaleType } from '../../../specs/010-chord-finder/contracts/types';

const cMajorChords = getDiatonicChords('C', ChordScaleType.MAJOR);

describe('generateProgression', () => {
  it('returns an array', () => {
    const prog = generateProgression(cMajorChords);
    expect(Array.isArray(prog)).toBe(true);
  });

  it('starts on degree 0 (tonic)', () => {
    for (let i = 0; i < 20; i++) {
      const prog = generateProgression(cMajorChords);
      expect(prog[0]).toBe(0);
    }
  });

  it('length is in [4, 8]', () => {
    for (let i = 0; i < 50; i++) {
      const prog = generateProgression(cMajorChords);
      expect(prog.length).toBeGreaterThanOrEqual(4);
      expect(prog.length).toBeLessThanOrEqual(8);
    }
  });

  it('all degrees are valid integers in 0–6', () => {
    for (let i = 0; i < 50; i++) {
      const prog = generateProgression(cMajorChords);
      for (const degree of prog) {
        expect(Number.isInteger(degree)).toBe(true);
        expect(degree).toBeGreaterThanOrEqual(0);
        expect(degree).toBeLessThanOrEqual(6);
      }
    }
  });

  it('vii° (degree 6) frequency < 30% across 100 runs', () => {
    let totalDegrees = 0;
    let degree6Count = 0;

    for (let i = 0; i < 100; i++) {
      const prog = generateProgression(cMajorChords);
      // Skip the first degree (always 0) for a fair count
      for (const d of prog.slice(1)) {
        totalDegrees++;
        if (d === 6) degree6Count++;
      }
    }

    const frequency = degree6Count / totalDegrees;
    expect(frequency).toBeLessThan(0.3);
  });

  it('two consecutive runs produce different progressions (probabilistic)', () => {
    let diffCount = 0;
    const trials = 20;
    for (let i = 0; i < trials; i++) {
      const a = generateProgression(cMajorChords);
      const b = generateProgression(cMajorChords);
      if (a.join(',') !== b.join(',')) diffCount++;
    }
    // With random generation, at least half the pairs should differ
    expect(diffCount).toBeGreaterThan(trials / 2);
  });

  it('throws if chords array is empty', () => {
    expect(() => generateProgression([])).toThrow();
  });

  it('works for A Natural Minor', () => {
    const aMinorChords = getDiatonicChords('A', ChordScaleType.NATURAL_MINOR);
    const prog = generateProgression(aMinorChords);
    expect(prog.length).toBeGreaterThanOrEqual(4);
    expect(prog.length).toBeLessThanOrEqual(8);
    expect(prog[0]).toBe(0);
  });
});
