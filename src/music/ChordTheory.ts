/**
 * ChordTheory - Pure functions for diatonic chord derivation, naming, and progression generation
 * Feature: 010-chord-finder
 */

import type {
  Note,
  DiatonicChord,
} from '../../specs/010-chord-finder/contracts/types';
import {
  ChordScaleType,
  ChordQuality,
} from '../../specs/010-chord-finder/contracts/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOTE_TO_OFFSET: Record<Note, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
  'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
};

const MIDI_C4 = 60;

/** Scale intervals (semitones from root) for supported scale types */
const SCALE_INTERVALS: Record<ChordScaleType, readonly number[]> = {
  [ChordScaleType.MAJOR]:         [0, 2, 4, 5, 7, 9, 11],
  [ChordScaleType.NATURAL_MINOR]: [0, 2, 3, 5, 7, 8, 10],
};

/** Chord quality per scale degree: [Major, Natural Minor] */
const DEGREE_QUALITIES: Record<ChordScaleType, readonly ChordQuality[]> = {
  [ChordScaleType.MAJOR]: [
    ChordQuality.MAJOR,
    ChordQuality.MINOR,
    ChordQuality.MINOR,
    ChordQuality.MAJOR,
    ChordQuality.MAJOR,
    ChordQuality.MINOR,
    ChordQuality.DIMINISHED,
  ],
  [ChordScaleType.NATURAL_MINOR]: [
    ChordQuality.MINOR,
    ChordQuality.DIMINISHED,
    ChordQuality.MAJOR,
    ChordQuality.MINOR,
    ChordQuality.MAJOR,
    ChordQuality.MAJOR,
    ChordQuality.MAJOR,
  ],
};

const NOTE_NAMES: readonly Note[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  [ChordQuality.MAJOR]: '',
  [ChordQuality.MINOR]: 'm',
  [ChordQuality.DIMINISHED]: 'dim',
};

const ROMAN_MAJOR: readonly string[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const ROMAN_MINOR: readonly string[] = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the display name for a chord (e.g. "Am", "Bdim", "C").
 */
export function getChordName(rootNote: Note, quality: ChordQuality): string {
  return rootNote + QUALITY_SUFFIX[quality];
}

/**
 * Get the roman numeral label for a scale degree and quality.
 * Examples: degree=0,MAJOR → "I"; degree=1,MINOR → "ii"; degree=6,DIMINISHED → "vii°"
 */
export function getRomanNumeral(scaleDegree: number, quality: ChordQuality): string {
  const base =
    quality === ChordQuality.MAJOR
      ? (ROMAN_MAJOR[scaleDegree] ?? String(scaleDegree + 1))
      : (ROMAN_MINOR[scaleDegree] ?? String(scaleDegree + 1).toLowerCase());

  if (quality === ChordQuality.DIMINISHED) {
    return base + '°';
  }
  return base;
}

/**
 * Compute the 7 diatonic chords for a key.
 */
export function getDiatonicChords(rootNote: Note, scaleType: ChordScaleType): DiatonicChord[] {
  const intervals = SCALE_INTERVALS[scaleType];
  const qualities = DEGREE_QUALITIES[scaleType];
  const rootOffset = NOTE_TO_OFFSET[rootNote];
  const chords: DiatonicChord[] = [];

  for (let degree = 0; degree < 7; degree++) {
    const interval = intervals[degree] as number;
    const quality = qualities[degree] as ChordQuality;

    // Root MIDI note (octave 4)
    const rootMidi = MIDI_C4 + rootOffset + interval;

    // Third: +4 semitones for major, +3 for minor/diminished
    const thirdOffset = quality === ChordQuality.MAJOR ? 4 : 3;
    const thirdMidi = rootMidi + thirdOffset;

    // Fifth: +6 semitones for diminished, +7 for major/minor
    const fifthOffset = quality === ChordQuality.DIMINISHED ? 6 : 7;
    const fifthMidi = rootMidi + fifthOffset;

    // CV voltages (1V/octave, C4 = 0V)
    const cv0 = (rootMidi - MIDI_C4) / 12;
    const cv1 = (thirdMidi - MIDI_C4) / 12;
    const cv2 = (fifthMidi - MIDI_C4) / 12;

    // Chord root note name
    const chordRootNote = NOTE_NAMES[(rootOffset + interval) % 12] as Note;

    chords.push({
      scaleDegree: degree,
      romanNumeral: getRomanNumeral(degree, quality),
      quality,
      name: getChordName(chordRootNote, quality),
      notes: [rootMidi, thirdMidi, fifthMidi],
      cvVoltages: [cv0, cv1, cv2],
    });
  }

  return chords;
}

/**
 * Generate a musically coherent chord progression using a weighted Markov chain.
 * - Starts on degree 0 (tonic)
 * - Length: random integer in [4, 8]
 * - Prefers ending on degree 0 or degree 4 (V→I cadence)
 * - Degree 6 (vii°) has 0.2× weight relative to others
 */
export function generateProgression(chords: DiatonicChord[]): number[] {
  if (chords.length === 0) {
    throw new Error('generateProgression: chords array must not be empty');
  }

  // Weighted transition table: strong functional harmony rules
  // Rows = current degree, columns = target degree
  // Base weight 1.0 everywhere, then adjusted:
  const BASE_WEIGHT = 1.0;
  const DIMINISHED_WEIGHT = 0.2;
  const STRONG_WEIGHT = 3.0;

  // Build per-degree transition weights
  function buildWeights(current: number): number[] {
    const w = Array<number>(7).fill(BASE_WEIGHT);

    // Reduce weight for vii°
    w[6] = DIMINISHED_WEIGHT;

    // Strong functional progressions
    const strong: Record<number, number[]> = {
      0: [3, 4],       // I → IV, I → V
      1: [4],          // ii → V
      3: [4],          // IV → V
      4: [0],          // V → I
      5: [1, 3],       // vi → ii, vi → IV
    };

    if (strong[current]) {
      for (const target of strong[current] as number[]) {
        w[target] = STRONG_WEIGHT;
      }
    }

    // Don't stay on the same degree (weight 0)
    w[current] = 0;

    return w;
  }

  function weightedPick(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i] as number;
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  const minLen = 4;
  const maxLen = 8;
  const length = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));

  const progression: number[] = [0]; // Always start on tonic

  while (progression.length < length) {
    const current = progression[progression.length - 1] as number;
    const remaining = length - progression.length;

    // On the last step, bias toward ending on 0 (tonic) or 4 (dominant)
    if (remaining === 1) {
      const endWeights = buildWeights(current);
      // Strongly prefer ending on tonic or dominant
      endWeights[0] = endWeights[0] === 0 ? 0 : STRONG_WEIGHT * 2;
      endWeights[4] = endWeights[4] === 0 ? 0 : STRONG_WEIGHT;
      progression.push(weightedPick(endWeights));
    } else {
      progression.push(weightedPick(buildWeights(current)));
    }
  }

  return progression;
}
