/**
 * MusicalScale - Scale generation and CV voltage calculation
 * Handles MIDI-to-Hz conversion and 1V/octave CV voltage generation
 */

import type { MusicalScale as IMusicalScale, ScaleType, Note } from '../../specs/006-collider-musical-physics/contracts/types';
import { SCALE_INTERVALS, getScaleDegreeWeights } from './ScaleTypes';

/**
 * Note to MIDI offset mapping (C = 0, C# = 1, etc.)
 */
const NOTE_TO_OFFSET: Record<Note, number> = {
  'C': 0,
  'C#': 1,
  'D': 2,
  'D#': 3,
  'E': 4,
  'F': 5,
  'F#': 6,
  'G': 7,
  'G#': 8,
  'A': 9,
  'A#': 10,
  'B': 11,
};

/**
 * MIDI note number for A4 (440Hz reference)
 */
const MIDI_NOTE_A4 = 69;

/**
 * Frequency of A4 in Hz
 */
const FREQUENCY_A4 = 440;

/**
 * MIDI note number for C4 (0V reference for CV)
 */
const MIDI_NOTE_C4 = 60;

/**
 * MusicalScale class implements musical scale generation
 * and CV voltage calculation following the 1V/octave standard
 */
export class MusicalScale implements IMusicalScale {
  public readonly intervals: readonly number[];
  public readonly cvVoltages: readonly number[];
  public readonly weights: readonly number[];

  constructor(
    public readonly scaleType: ScaleType,
    public readonly rootNote: Note
  ) {
    // Get scale intervals from constants
    this.intervals = SCALE_INTERVALS[scaleType];

    if (!this.intervals) {
      throw new Error(`Invalid scale type: ${scaleType}`);
    }

    // Calculate CV voltages for each scale degree
    this.cvVoltages = this.calculateCVVoltages();

    // Generate weights (2x for tonic and fifth)
    this.weights = Object.freeze(getScaleDegreeWeights(this.intervals.length));
  }

  /**
   * Calculate CV voltages for all scale degrees
   * Uses 1V/octave standard with C4 = 0V reference
   */
  private calculateCVVoltages(): readonly number[] {
    const rootMidi = MIDI_NOTE_C4 + NOTE_TO_OFFSET[this.rootNote];

    return Object.freeze(
      this.intervals.map(semitones => {
        const midiNote = rootMidi + semitones;
        // 1V/octave: CV = (MIDI - 60) / 12
        // C4 (MIDI 60) = 0V
        return (midiNote - MIDI_NOTE_C4) / 12;
      })
    );
  }

  /**
   * Convert MIDI note number to frequency in Hz
   * @param midiNote - MIDI note number (0-127)
   * @returns Frequency in Hz
   */
  static midiToHz(midiNote: number): number {
    return FREQUENCY_A4 * Math.pow(2, (midiNote - MIDI_NOTE_A4) / 12);
  }

  /**
   * Convert frequency to MIDI note number
   * @param hz - Frequency in Hz
   * @returns MIDI note number
   */
  static hzToMidi(hz: number): number {
    return MIDI_NOTE_A4 + 12 * Math.log2(hz / FREQUENCY_A4);
  }

  /**
   * Convert Hz to CV voltage (1V/octave standard)
   * @param hz - Frequency in Hz
   * @returns CV voltage
   */
  static hzToCV(hz: number): number {
    const midiNote = MusicalScale.hzToMidi(hz);
    return (midiNote - MIDI_NOTE_C4) / 12;
  }

  /**
   * Convert CV voltage to Hz (1V/octave standard)
   * @param cv - CV voltage
   * @returns Frequency in Hz
   */
  static cvToHz(cv: number): number {
    const midiNote = MIDI_NOTE_C4 + (cv * 12);
    return MusicalScale.midiToHz(midiNote);
  }

  /**
   * Get CV voltage for a specific scale degree
   * @param scaleDegree - Index in the scale (0-based)
   * @returns CV voltage
   */
  getCVForDegree(scaleDegree: number): number {
    const index = scaleDegree % this.cvVoltages.length;
    return this.cvVoltages[index] as number;
  }

  /**
   * Get frequency for a specific scale degree
   * @param scaleDegree - Index in the scale (0-based)
   * @returns Frequency in Hz
   */
  getFrequencyForDegree(scaleDegree: number): number {
    const cv = this.getCVForDegree(scaleDegree);
    return MusicalScale.cvToHz(cv);
  }

  /**
   * Get MIDI note number for a specific scale degree
   * @param scaleDegree - Index in the scale (0-based)
   * @returns MIDI note number
   */
  getMidiForDegree(scaleDegree: number): number {
    const rootMidi = MIDI_NOTE_C4 + NOTE_TO_OFFSET[this.rootNote];
    const index = scaleDegree % this.intervals.length;
    return rootMidi + (this.intervals[index] as number);
  }

  /**
   * Get the number of notes in this scale
   * @returns Scale length
   */
  get length(): number {
    return this.intervals.length;
  }

  /**
   * Create a musical scale from scale type and root note
   * @param scaleType - Type of scale
   * @param rootNote - Root note of the scale
   * @returns MusicalScale instance
   */
  static create(scaleType: ScaleType, rootNote: Note): MusicalScale {
    return new MusicalScale(scaleType, rootNote);
  }
}
