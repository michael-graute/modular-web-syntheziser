/**
 * bpmValidation Unit Tests
 *
 * 100% coverage required for utility/validation functions per the project constitution.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidBpm,
  clampBpm,
  isValidBpmMode,
  BpmMode,
  BPM_MIN,
  BPM_MAX,
  BPM_DEFAULT,
} from '../../../src/core/bpmValidation';

describe('bpmValidation', () => {

  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------

  describe('constants', () => {
    it('BPM_MIN is 30', () => expect(BPM_MIN).toBe(30));
    it('BPM_MAX is 300', () => expect(BPM_MAX).toBe(300));
    it('BPM_DEFAULT is 120', () => expect(BPM_DEFAULT).toBe(120));
  });

  // -------------------------------------------------------------------------
  // isValidBpm
  // -------------------------------------------------------------------------

  describe('isValidBpm', () => {
    it('returns true for the minimum boundary (30)', () => {
      expect(isValidBpm(30)).toBe(true);
    });

    it('returns true for the default value (120)', () => {
      expect(isValidBpm(120)).toBe(true);
    });

    it('returns true for the maximum boundary (300)', () => {
      expect(isValidBpm(300)).toBe(true);
    });

    it('returns true for a mid-range value (160)', () => {
      expect(isValidBpm(160)).toBe(true);
    });

    it('returns false for a value below the minimum (29)', () => {
      expect(isValidBpm(29)).toBe(false);
    });

    it('returns false for a value above the maximum (301)', () => {
      expect(isValidBpm(301)).toBe(false);
    });

    it('returns false for 0', () => {
      expect(isValidBpm(0)).toBe(false);
    });

    it('returns false for negative values', () => {
      expect(isValidBpm(-1)).toBe(false);
    });

    it('returns false for NaN', () => {
      expect(isValidBpm(NaN)).toBe(false);
    });

    it('returns false for Infinity', () => {
      expect(isValidBpm(Infinity)).toBe(false);
    });

    it('returns false for -Infinity', () => {
      expect(isValidBpm(-Infinity)).toBe(false);
    });

    it('returns false for a string cast as number', () => {
      expect(isValidBpm('120' as unknown as number)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // clampBpm
  // -------------------------------------------------------------------------

  describe('clampBpm', () => {
    it('returns the value unchanged when within range', () => {
      expect(clampBpm(120)).toBe(120);
    });

    it('clamps values below BPM_MIN to BPM_MIN', () => {
      expect(clampBpm(10)).toBe(BPM_MIN);
    });

    it('clamps values above BPM_MAX to BPM_MAX', () => {
      expect(clampBpm(500)).toBe(BPM_MAX);
    });

    it('returns BPM_MIN for Infinity', () => {
      expect(clampBpm(Infinity)).toBe(BPM_MIN);
    });

    it('returns BPM_MIN for -Infinity', () => {
      expect(clampBpm(-Infinity)).toBe(BPM_MIN);
    });

    it('returns BPM_MIN for NaN', () => {
      expect(clampBpm(NaN)).toBe(BPM_MIN);
    });

    it('rounds fractional values to the nearest integer', () => {
      expect(clampBpm(120.4)).toBe(120);
      expect(clampBpm(120.5)).toBe(121);
      expect(clampBpm(120.6)).toBe(121);
    });

    it('handles the minimum boundary exactly', () => {
      expect(clampBpm(30)).toBe(30);
    });

    it('handles the maximum boundary exactly', () => {
      expect(clampBpm(300)).toBe(300);
    });
  });

  // -------------------------------------------------------------------------
  // isValidBpmMode
  // -------------------------------------------------------------------------

  describe('isValidBpmMode', () => {
    it('returns true for BpmMode.Global (0)', () => {
      expect(isValidBpmMode(BpmMode.Global)).toBe(true);
    });

    it('returns true for BpmMode.Local (1)', () => {
      expect(isValidBpmMode(BpmMode.Local)).toBe(true);
    });

    it('returns false for 2', () => {
      expect(isValidBpmMode(2)).toBe(false);
    });

    it('returns false for -1', () => {
      expect(isValidBpmMode(-1)).toBe(false);
    });

    it('returns false for 0.5', () => {
      expect(isValidBpmMode(0.5)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // BpmMode enum values
  // -------------------------------------------------------------------------

  describe('BpmMode', () => {
    it('BpmMode.Global equals 0', () => expect(BpmMode.Global).toBe(0));
    it('BpmMode.Local equals 1', () => expect(BpmMode.Local).toBe(1));
  });
});
