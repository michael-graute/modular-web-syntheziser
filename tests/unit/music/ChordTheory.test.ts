/**
 * ChordTheory Unit Tests
 * Tests diatonic chord derivation, chord naming, and roman numeral generation.
 * Feature: 010-chord-finder — T011, T012
 */

import { describe, it, expect } from 'vitest';
import {
  getDiatonicChords,
  getChordName,
  getRomanNumeral,
} from '../../../src/music/ChordTheory';
import {
  ChordScaleType,
  ChordQuality,
} from '../../../specs/010-chord-finder/contracts/types';

// ---------------------------------------------------------------------------
// getDiatonicChords
// ---------------------------------------------------------------------------

describe('getDiatonicChords', () => {
  describe('C Major', () => {
    const chords = getDiatonicChords('C', ChordScaleType.MAJOR);

    it('returns exactly 7 chords', () => {
      expect(chords).toHaveLength(7);
    });

    it('assigns correct scale degrees 0–6', () => {
      chords.forEach((chord, i) => {
        expect(chord.scaleDegree).toBe(i);
      });
    });

    it('produces correct chord qualities for C Major', () => {
      const expectedQualities = [
        ChordQuality.MAJOR,      // I   — C
        ChordQuality.MINOR,      // ii  — Dm
        ChordQuality.MINOR,      // iii — Em
        ChordQuality.MAJOR,      // IV  — F
        ChordQuality.MAJOR,      // V   — G
        ChordQuality.MINOR,      // vi  — Am
        ChordQuality.DIMINISHED, // vii°— Bdim
      ];
      chords.forEach((chord, i) => {
        expect(chord.quality).toBe(expectedQualities[i]);
      });
    });

    it('produces correct chord names for C Major', () => {
      const expectedNames = ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'];
      chords.forEach((chord, i) => {
        expect(chord.name).toBe(expectedNames[i]);
      });
    });

    it('produces correct roman numerals for C Major', () => {
      const expectedRomans = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
      chords.forEach((chord, i) => {
        expect(chord.romanNumeral).toBe(expectedRomans[i]);
      });
    });

    it('CV voltages follow 1V/octave formula (C4 = 0V)', () => {
      // C Major tonic chord: root=C4 (MIDI 60), third=E4 (MIDI 64), fifth=G4 (MIDI 67)
      const tonic = chords[0]!;
      expect(tonic.cvVoltages[0]).toBeCloseTo(0.0, 5);          // C4
      expect(tonic.cvVoltages[1]).toBeCloseTo(4 / 12, 5);       // E4
      expect(tonic.cvVoltages[2]).toBeCloseTo(7 / 12, 5);       // G4
    });

    it('all cvVoltages equal (midiNote - 60) / 12', () => {
      chords.forEach((chord) => {
        chord.notes.forEach((midi, i) => {
          expect(chord.cvVoltages[i]).toBeCloseTo((midi - 60) / 12, 5);
        });
      });
    });
  });

  describe('A Natural Minor', () => {
    const chords = getDiatonicChords('A', ChordScaleType.NATURAL_MINOR);

    it('returns exactly 7 chords', () => {
      expect(chords).toHaveLength(7);
    });

    it('produces correct chord qualities for A Natural Minor', () => {
      const expectedQualities = [
        ChordQuality.MINOR,      // i   — Am
        ChordQuality.DIMINISHED, // ii° — Bdim
        ChordQuality.MAJOR,      // III — C
        ChordQuality.MINOR,      // iv  — Dm
        ChordQuality.MAJOR,      // V   — Em (natural minor uses minor v, but table says MAJOR)
        ChordQuality.MAJOR,      // VI  — F
        ChordQuality.MAJOR,      // VII — G
      ];
      chords.forEach((chord, i) => {
        expect(chord.quality).toBe(expectedQualities[i]);
      });
    });

    it('produces correct chord names for A Natural Minor', () => {
      // Note: degree 4 (V) is MAJOR in the data model (harmonic convention used here)
      const expectedNames = ['Am', 'Bdim', 'C', 'Dm', 'E', 'F', 'G'];
      chords.forEach((chord, i) => {
        expect(chord.name).toBe(expectedNames[i]);
      });
    });

    it('all cvVoltages equal (midiNote - 60) / 12', () => {
      chords.forEach((chord) => {
        chord.notes.forEach((midi, i) => {
          expect(chord.cvVoltages[i]).toBeCloseTo((midi - 60) / 12, 5);
        });
      });
    });
  });
});

// ---------------------------------------------------------------------------
// getChordName
// ---------------------------------------------------------------------------

describe('getChordName', () => {
  it('returns root name only for MAJOR quality', () => {
    expect(getChordName('C', ChordQuality.MAJOR)).toBe('C');
    expect(getChordName('G', ChordQuality.MAJOR)).toBe('G');
    expect(getChordName('F#', ChordQuality.MAJOR)).toBe('F#');
  });

  it('appends "m" for MINOR quality', () => {
    expect(getChordName('A', ChordQuality.MINOR)).toBe('Am');
    expect(getChordName('D', ChordQuality.MINOR)).toBe('Dm');
    expect(getChordName('C#', ChordQuality.MINOR)).toBe('C#m');
  });

  it('appends "dim" for DIMINISHED quality', () => {
    expect(getChordName('B', ChordQuality.DIMINISHED)).toBe('Bdim');
    expect(getChordName('C#', ChordQuality.DIMINISHED)).toBe('C#dim');
    expect(getChordName('F', ChordQuality.DIMINISHED)).toBe('Fdim');
  });
});

// ---------------------------------------------------------------------------
// getRomanNumeral
// ---------------------------------------------------------------------------

describe('getRomanNumeral', () => {
  it('returns uppercase roman for MAJOR quality', () => {
    expect(getRomanNumeral(0, ChordQuality.MAJOR)).toBe('I');
    expect(getRomanNumeral(3, ChordQuality.MAJOR)).toBe('IV');
    expect(getRomanNumeral(4, ChordQuality.MAJOR)).toBe('V');
  });

  it('returns lowercase roman for MINOR quality', () => {
    expect(getRomanNumeral(1, ChordQuality.MINOR)).toBe('ii');
    expect(getRomanNumeral(2, ChordQuality.MINOR)).toBe('iii');
    expect(getRomanNumeral(5, ChordQuality.MINOR)).toBe('vi');
  });

  it('returns lowercase roman with ° suffix for DIMINISHED quality', () => {
    expect(getRomanNumeral(6, ChordQuality.DIMINISHED)).toBe('vii°');
    expect(getRomanNumeral(1, ChordQuality.DIMINISHED)).toBe('ii°');
  });

  it('handles all 7 degrees for C Major qualities', () => {
    const qualities = [
      ChordQuality.MAJOR,
      ChordQuality.MINOR,
      ChordQuality.MINOR,
      ChordQuality.MAJOR,
      ChordQuality.MAJOR,
      ChordQuality.MINOR,
      ChordQuality.DIMINISHED,
    ];
    const expected = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    qualities.forEach((q, i) => {
      expect(getRomanNumeral(i, q)).toBe(expected[i]);
    });
  });
});
