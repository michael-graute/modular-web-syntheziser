/**
 * MusicalScale Unit Tests
 * Tests MIDI-to-Hz conversion, CV voltage calculation, and scale generation
 */

import { describe, it, expect } from 'vitest';
import { MusicalScale } from '../../../src/music/MusicalScale';
import { ScaleType } from '../../../specs/006-collider-musical-physics/contracts/types';

describe('MusicalScale', () => {
  describe('static midiToHz', () => {
    it('should convert MIDI 69 (A4) to 440Hz', () => {
      const hz = MusicalScale.midiToHz(69);
      expect(hz).toBeCloseTo(440, 1);
    });

    it('should convert MIDI 60 (C4) correctly', () => {
      const hz = MusicalScale.midiToHz(60);
      expect(hz).toBeCloseTo(261.63, 2);
    });

    it('should convert octaves correctly', () => {
      const a4 = MusicalScale.midiToHz(69); // 440Hz
      const a5 = MusicalScale.midiToHz(81); // 880Hz
      expect(a5).toBeCloseTo(a4 * 2, 1);
    });
  });

  describe('static hzToCV', () => {
    it('should convert C4 (261.63Hz) to 0V', () => {
      const cv = MusicalScale.hzToCV(261.63);
      expect(cv).toBeCloseTo(0, 2);
    });

    it('should use 1V/octave standard', () => {
      const c4 = MusicalScale.hzToCV(261.63); // 0V
      const c5 = MusicalScale.hzToCV(523.25); // 1V (one octave up)
      expect(c5 - c4).toBeCloseTo(1, 2);
    });
  });

  describe('scale generation', () => {
    it('should generate C Major scale correctly', () => {
      const scale = new MusicalScale(ScaleType.MAJOR, 'C');

      expect(scale.intervals).toEqual([0, 2, 4, 5, 7, 9, 11]);
      expect(scale.cvVoltages).toHaveLength(7);
      expect(scale.cvVoltages[0]).toBeCloseTo(0, 3); // C4 = 0V
    });

    it('should generate correct weights (2x for tonic and fifth)', () => {
      const scale = new MusicalScale(ScaleType.MAJOR, 'C');

      expect(scale.weights[0]).toBe(2); // Tonic
      expect(scale.weights[4]).toBe(2); // Fifth
      expect(scale.weights[1]).toBe(1); // Other degrees
      expect(scale.weights[2]).toBe(1);
    });

    it('should generate all 5 supported scale types', () => {
      const scaleTypes = [
        ScaleType.MAJOR,
        ScaleType.HARMONIC_MINOR,
        ScaleType.NATURAL_MINOR,
        ScaleType.LYDIAN,
        ScaleType.MIXOLYDIAN,
      ];

      for (const scaleType of scaleTypes) {
        const scale = new MusicalScale(scaleType, 'C');
        expect(scale.intervals.length).toBeGreaterThan(0);
        expect(scale.cvVoltages.length).toBe(scale.intervals.length);
      }
    });
  });

  describe('getCVForDegree', () => {
    it('should return correct CV for scale degrees', () => {
      const scale = new MusicalScale(ScaleType.MAJOR, 'C');
      const cv0 = scale.getCVForDegree(0); // Tonic
      const cv4 = scale.getCVForDegree(4); // Fifth

      expect(cv0).toBeCloseTo(0, 3); // C4 = 0V
      expect(cv4).toBeCloseTo(0.583, 2); // G4 = 0.583V (7 semitones up)
    });
  });
});
