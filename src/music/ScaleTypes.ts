/**
 * ScaleTypes - Musical scale interval definitions and constants
 * Defines semitone intervals for supported scale types
 */

import { ScaleType, SpeedPreset } from '../../specs/006-collider-musical-physics/contracts/types';

/**
 * Scale interval definitions (semitones from root note)
 * Each array represents the semitone intervals that make up the scale
 *
 * W = Whole step (2 semitones)
 * H = Half step (1 semitone)
 */
export const SCALE_INTERVALS: Record<ScaleType, readonly number[]> = {
  [ScaleType.MAJOR]: Object.freeze([0, 2, 4, 5, 7, 9, 11]), // W-W-H-W-W-W-H
  [ScaleType.HARMONIC_MINOR]: Object.freeze([0, 2, 3, 5, 7, 8, 11]), // W-H-W-W-H-3H-H
  [ScaleType.NATURAL_MINOR]: Object.freeze([0, 2, 3, 5, 7, 8, 10]), // W-H-W-W-H-W-W
  [ScaleType.LYDIAN]: Object.freeze([0, 2, 4, 6, 7, 9, 11]), // W-W-W-H-W-W-H
  [ScaleType.MIXOLYDIAN]: Object.freeze([0, 2, 4, 5, 7, 9, 10]), // W-W-H-W-W-H-W
};

/**
 * Speed preset velocity mappings (pixels per second)
 * Based on research.md performance analysis
 */
export const SPEED_PRESET_VELOCITIES: Record<SpeedPreset, number> = {
  [SpeedPreset.SLOW]: 40, // ~30-50 px/s
  [SpeedPreset.MEDIUM]: 85, // ~70-100 px/s
  [SpeedPreset.FAST]: 135, // ~120-150 px/s
};

/**
 * Scale degree weights for random assignment
 * Tonic (index 0) and fifth (index 4) have 2x weight for tonal emphasis
 *
 * @param scaleLength - Number of notes in the scale
 * @returns Array of weights for each scale degree
 */
export function getScaleDegreeWeights(scaleLength: number): number[] {
  const weights: number[] = [];
  for (let i = 0; i < scaleLength; i++) {
    // 2x weight for tonic (0) and fifth (4)
    weights.push(i === 0 || i === 4 ? 2 : 1);
  }
  return weights;
}

/**
 * Get scale formula description
 * @param scaleType - Type of scale
 * @returns Human-readable scale formula
 */
export function getScaleFormula(scaleType: ScaleType): string {
  const formulas: Record<ScaleType, string> = {
    [ScaleType.MAJOR]: 'W-W-H-W-W-W-H',
    [ScaleType.HARMONIC_MINOR]: 'W-H-W-W-H-3H-H',
    [ScaleType.NATURAL_MINOR]: 'W-H-W-W-H-W-W',
    [ScaleType.LYDIAN]: 'W-W-W-H-W-W-H',
    [ScaleType.MIXOLYDIAN]: 'W-W-H-W-W-H-W',
  };
  return formulas[scaleType];
}

/**
 * Validate that a scale type has correct interval structure
 * @param scaleType - Type of scale to validate
 * @returns True if scale is valid
 */
export function isValidScale(scaleType: ScaleType): boolean {
  const intervals = SCALE_INTERVALS[scaleType];
  if (!intervals || intervals.length === 0) {
    return false;
  }

  // Scale should start with 0 (root)
  if (intervals[0] !== 0) {
    return false;
  }

  // All intervals should be within an octave (0-11 semitones)
  return intervals.every(interval => interval >= 0 && interval <= 11);
}

/**
 * Get all supported scale types
 * @returns Array of all ScaleType enum values
 */
export function getAllScaleTypes(): ScaleType[] {
  return Object.values(ScaleType);
}
