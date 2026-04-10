/**
 * Type Contracts: Chord Finder Utility
 * Feature: 010-chord-finder
 *
 * These types define the public interface of the ChordFinder component.
 * They are technology-agnostic and must not import from implementation files.
 */

// ---------------------------------------------------------------------------
// Re-exported primitives (sourced from existing project types)
// ---------------------------------------------------------------------------

/** Root note of a key (C, C#, D … B) — mirrors existing Note enum */
export type Note =
  | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F'
  | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

// ---------------------------------------------------------------------------
// Chord Finder–specific enumerations
// ---------------------------------------------------------------------------

/**
 * Scale types supported by the Chord Finder at launch.
 * Subset of the project-wide ScaleType enum.
 */
export enum ChordScaleType {
  MAJOR = 'major',
  NATURAL_MINOR = 'natural_minor',
}

/** Chord quality for a diatonic triad */
export enum ChordQuality {
  MAJOR = 'major',
  MINOR = 'minor',
  DIMINISHED = 'diminished',
}

// ---------------------------------------------------------------------------
// Core data structures
// ---------------------------------------------------------------------------

/**
 * Configuration for the Chord Finder component.
 * Persisted as part of the patch state.
 */
export interface ChordFinderConfig {
  /** Root note of the selected key */
  rootNote: Note;
  /** Scale type (Major or Natural Minor) */
  scaleType: ChordScaleType;
  /** Octave transposition for CV output (C2=2 … C6=6; C4=4 is 0V reference) */
  octave: number;
  /**
   * Currently active chord progression as an ordered array of scale degree
   * indices (0–6). Empty array means no progression is active.
   */
  progression: number[];
}

/**
 * A single diatonic chord within a key.
 * Derived from ChordFinderConfig — not stored directly.
 */
export interface DiatonicChord {
  /** Scale degree index (0 = tonic / I, 6 = leading tone / vii°) */
  scaleDegree: number;
  /** Roman numeral label displayed on the chord node (e.g. "I", "ii", "V") */
  romanNumeral: string;
  /** Chord quality */
  quality: ChordQuality;
  /** Display name with accidentals and quality suffix (e.g. "Am", "Bdim", "C") */
  name: string;
  /** MIDI note numbers for the triad [root, third, fifth] in octave 4 */
  notes: [number, number, number];
  /** 1V/octave CV voltages for [root, third, fifth] in octave 4 (before octave offset) */
  cvVoltages: [number, number, number];
}

/**
 * Full runtime state of the Chord Finder.
 */
export interface ChordFinderState {
  /** Current user-facing configuration */
  config: ChordFinderConfig;
  /** The 7 diatonic chords derived from config, indexed 0–6 by scale degree */
  diatonicChords: DiatonicChord[];
  /** Scale degree of the chord currently pressed (gate open), or null */
  pressedDegree: number | null;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** Emitted when a chord node is pressed */
export interface ChordPressEvent {
  /** Scale degree of the pressed chord (0–6) */
  scaleDegree: number;
  /** The chord that was pressed */
  chord: DiatonicChord;
  /** CV voltages being emitted, with octave offset applied */
  cvVoltages: [number, number, number];
}

/** Emitted when a chord node is released */
export interface ChordReleaseEvent {
  /** Scale degree that was released */
  scaleDegree: number;
}

/** Emitted when a new progression is generated */
export interface ProgressionGeneratedEvent {
  /** Ordered array of scale degrees in the new progression */
  progression: number[];
  /** The DiatonicChord objects corresponding to the progression */
  chords: DiatonicChord[];
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialized form of ChordFinderConfig stored in ComponentData.parameters.
 * All values are numbers to match the Record<string, number> constraint.
 */
export interface ChordFinderSerializedParams {
  /** Root note as integer index 0–11 (C=0, C#=1 … B=11) */
  rootNote: number;
  /** Scale type as integer: 0=MAJOR, 1=NATURAL_MINOR */
  scaleType: number;
  /** Octave as integer 2–6 */
  octave: number;
  /**
   * Progression encoded as a 7-bit bitmask.
   * Bit N is set if scale degree N is in the progression.
   * Value 0 means no active progression.
   */
  progression: number;
}

// ---------------------------------------------------------------------------
// Component interface
// ---------------------------------------------------------------------------

/**
 * Public interface of the ChordFinder SynthComponent.
 * Describes the observable behaviour without implementation details.
 */
export interface IChordFinder {
  /** Select a new key (root note + scale type). Clears the active progression. */
  selectKey(rootNote: Note, scaleType: ChordScaleType): void;

  /** Set the octave for CV output (2–6). */
  setOctave(octave: number): void;

  /**
   * Generate a new chord progression for the current key.
   * Uses weighted harmonic rules; vii° has reduced probability.
   * Throws if no key is selected.
   */
  generateProgression(): void;

  /**
   * Activate a chord: set CV outputs and open gate.
   * @param scaleDegree - Index 0–6
   */
  pressChord(scaleDegree: number): void;

  /**
   * Deactivate the currently pressed chord and close gate.
   */
  releaseChord(): void;

  /** Read current state snapshot. */
  getState(): ChordFinderState;

  /** Return all 7 diatonic chords for the current key (or empty if no key selected). */
  getDiatonicChords(): DiatonicChord[];
}
