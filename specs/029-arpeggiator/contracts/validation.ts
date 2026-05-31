/**
 * Validation helpers for Arpeggiator contracts (029-arpeggiator).
 */

import {
  ArpDirection,
  ArpSubdivision,
  ArpGateLength,
  ARP_MAX_NOTES,
  type ArpParameters,
} from './types';

export function isValidDirection(v: unknown): v is ArpDirection {
  return (
    typeof v === 'number' &&
    Number.isInteger(v) &&
    v >= ArpDirection.Up &&
    v <= ArpDirection.Random
  );
}

export function isValidOctaves(v: unknown): v is 1 | 2 | 3 | 4 {
  return typeof v === 'number' && [1, 2, 3, 4].includes(v);
}

export function isValidSubdivision(v: unknown): v is ArpSubdivision {
  return (
    typeof v === 'number' &&
    Number.isInteger(v) &&
    v >= ArpSubdivision.Quarter &&
    v <= ArpSubdivision.ThirtySecond
  );
}

export function isValidGateLength(v: unknown): v is ArpGateLength {
  return (
    typeof v === 'number' &&
    Number.isInteger(v) &&
    v >= ArpGateLength.Short &&
    v <= ArpGateLength.Long
  );
}

export function isValidNoteSequence(seq: unknown): seq is number[] {
  return (
    Array.isArray(seq) &&
    seq.length <= ARP_MAX_NOTES &&
    seq.every((v) => typeof v === 'number' && isFinite(v))
  );
}

/** Validate a full deserialized ArpParameters object; apply defaults for missing/invalid fields. */
export function sanitizeArpParameters(raw: Partial<ArpParameters>): ArpParameters {
  return {
    direction: isValidDirection(raw.direction) ? raw.direction : ArpDirection.Up,
    octaves: isValidOctaves(raw.octaves) ? raw.octaves : 1,
    subdivision: isValidSubdivision(raw.subdivision) ? raw.subdivision : ArpSubdivision.Sixteenth,
    gateLength: isValidGateLength(raw.gateLength) ? raw.gateLength : ArpGateLength.Medium,
  };
}
