/**
 * TimingCalculator - BPM to millisecond duration conversion
 * Handles timing calculations for gate durations and note lengths
 */

import type { GateSize } from '../../specs/006-collider-musical-physics/contracts/types';

/**
 * TimingCalculator class provides BPM-based duration calculations
 */
export class TimingCalculator {
  /**
   * Calculate gate duration in milliseconds based on BPM and gate size
   *
   * @param bpm - Beats per minute (30-300)
   * @param gateSize - Note length as fraction of quarter note
   * @returns Duration in milliseconds
   *
   * @example
   * calculateGateDuration(120, GateSize.QUARTER) // Returns 500ms
   * calculateGateDuration(120, GateSize.SIXTEENTH) // Returns 125ms
   */
  calculateGateDuration(bpm: number, gateSize: GateSize): number {
    if (bpm <= 0) {
      throw new Error('BPM must be positive');
    }

    if (!isFinite(bpm)) {
      throw new Error('BPM must be finite');
    }

    // Calculate quarter note duration in milliseconds
    // Quarter note = 60,000ms / BPM
    const quarterNoteDurationMs = 60000 / bpm;

    // Multiply by gate size fraction
    return quarterNoteDurationMs * gateSize;
  }

  /**
   * Convert BPM to milliseconds per quarter note
   * @param bpm - Beats per minute
   * @returns Duration of one quarter note in milliseconds
   */
  bpmToMs(bpm: number): number {
    if (bpm <= 0) {
      throw new Error('BPM must be positive');
    }

    return 60000 / bpm;
  }

  /**
   * Convert BPM to milliseconds per beat
   * Alias for bpmToMs for clarity
   * @param bpm - Beats per minute
   * @returns Duration of one beat in milliseconds
   */
  bpmToBeatDuration(bpm: number): number {
    return this.bpmToMs(bpm);
  }

  /**
   * Calculate duration for a specific number of beats
   * @param bpm - Beats per minute
   * @param beats - Number of beats
   * @returns Duration in milliseconds
   */
  beatsToMs(bpm: number, beats: number): number {
    const beatDuration = this.bpmToMs(bpm);
    return beatDuration * beats;
  }

  /**
   * Convert milliseconds to number of beats at given BPM
   * @param ms - Duration in milliseconds
   * @param bpm - Beats per minute
   * @returns Number of beats
   */
  msToBeats(ms: number, bpm: number): number {
    const beatDuration = this.bpmToMs(bpm);
    return ms / beatDuration;
  }

  /**
   * Get all standard gate durations for a given BPM
   * @param bpm - Beats per minute
   * @returns Map of gate size to duration in milliseconds
   */
  getAllGateDurations(bpm: number): Map<GateSize, number> {
    const durations = new Map<GateSize, number>();

    durations.set(1.0, this.calculateGateDuration(bpm, 1.0)); // Whole note
    durations.set(0.5, this.calculateGateDuration(bpm, 0.5)); // Half note
    durations.set(0.25, this.calculateGateDuration(bpm, 0.25)); // Quarter note
    durations.set(0.125, this.calculateGateDuration(bpm, 0.125)); // Eighth note
    durations.set(0.0625, this.calculateGateDuration(bpm, 0.0625)); // Sixteenth note

    return durations;
  }

  /**
   * Calculate gate duration in seconds (for Web Audio API scheduling)
   * @param bpm - Beats per minute
   * @param gateSize - Note length as fraction of quarter note
   * @returns Duration in seconds
   */
  calculateGateDurationSeconds(bpm: number, gateSize: GateSize): number {
    return this.calculateGateDuration(bpm, gateSize) / 1000;
  }

  /**
   * Validate BPM value
   * @param bpm - BPM value to validate
   * @param min - Minimum allowed BPM (default: 30)
   * @param max - Maximum allowed BPM (default: 300)
   * @returns True if BPM is valid
   */
  isValidBPM(bpm: number, min: number = 30, max: number = 300): boolean {
    return (
      typeof bpm === 'number' &&
      isFinite(bpm) &&
      bpm >= min &&
      bpm <= max
    );
  }

  /**
   * Clamp BPM to valid range
   * @param bpm - BPM value to clamp
   * @param min - Minimum allowed BPM (default: 30)
   * @param max - Maximum allowed BPM (default: 300)
   * @returns Clamped BPM value
   */
  clampBPM(bpm: number, min: number = 30, max: number = 300): number {
    if (!isFinite(bpm)) {
      return min;
    }
    return Math.max(min, Math.min(max, bpm));
  }
}

/**
 * Create a singleton instance for convenience
 */
export const timingCalculator = new TimingCalculator();
