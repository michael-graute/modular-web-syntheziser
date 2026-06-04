/**
 * POLY_CV signal type compatibility tests (T028).
 * Verifies strict isolation: POLY_CV only connects to POLY_CV (FR-002).
 */

import { describe, it, expect } from 'vitest';
import { areSignalTypesCompatible } from '../../src/utils/validators';
import { SignalType } from '../../src/core/types';

describe('POLY_CV signal type compatibility (FR-002)', () => {
  describe('allowed connections', () => {
    it('POLY_CV → POLY_CV is allowed', () => {
      expect(areSignalTypesCompatible(SignalType.POLY_CV, SignalType.POLY_CV)).toBe(true);
    });
  });

  describe('rejected cross-type connections', () => {
    it('POLY_CV → CV is rejected', () => {
      expect(areSignalTypesCompatible(SignalType.POLY_CV, SignalType.CV)).toBe(false);
    });

    it('CV → POLY_CV is rejected', () => {
      expect(areSignalTypesCompatible(SignalType.CV, SignalType.POLY_CV)).toBe(false);
    });

    it('POLY_CV → AUDIO is rejected', () => {
      expect(areSignalTypesCompatible(SignalType.POLY_CV, SignalType.AUDIO)).toBe(false);
    });

    it('AUDIO → POLY_CV is rejected', () => {
      expect(areSignalTypesCompatible(SignalType.AUDIO, SignalType.POLY_CV)).toBe(false);
    });

    it('POLY_CV → GATE is rejected', () => {
      expect(areSignalTypesCompatible(SignalType.POLY_CV, SignalType.GATE)).toBe(false);
    });

    it('GATE → POLY_CV is rejected', () => {
      expect(areSignalTypesCompatible(SignalType.GATE, SignalType.POLY_CV)).toBe(false);
    });
  });

  describe('existing mono signal type rules are unchanged (FR-015)', () => {
    it('AUDIO → AUDIO is allowed', () => {
      expect(areSignalTypesCompatible(SignalType.AUDIO, SignalType.AUDIO)).toBe(true);
    });

    it('CV → CV is allowed', () => {
      expect(areSignalTypesCompatible(SignalType.CV, SignalType.CV)).toBe(true);
    });

    it('CV → AUDIO is allowed (modulation)', () => {
      expect(areSignalTypesCompatible(SignalType.CV, SignalType.AUDIO)).toBe(true);
    });

    it('GATE → GATE is allowed', () => {
      expect(areSignalTypesCompatible(SignalType.GATE, SignalType.GATE)).toBe(true);
    });

    it('AUDIO → CV is rejected', () => {
      expect(areSignalTypesCompatible(SignalType.AUDIO, SignalType.CV)).toBe(false);
    });

    it('GATE → CV is rejected', () => {
      expect(areSignalTypesCompatible(SignalType.GATE, SignalType.CV)).toBe(false);
    });
  });
});
