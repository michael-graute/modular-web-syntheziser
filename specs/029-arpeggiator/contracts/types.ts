/**
 * Type contracts for the Arpeggiator component (029-arpeggiator).
 * These are specification-level types — they mirror the runtime implementation
 * but are defined here so tests and the implementation can share them.
 */

/** Step direction for the arpeggio cycle. */
export enum ArpDirection {
  Up = 0,
  Down = 1,
  UpDown = 2,
  Random = 3,
}

/** BPM subdivision for step rate. */
export enum ArpSubdivision {
  Quarter = 0,   // 1/4 note  — fraction 1.0
  Eighth = 1,    // 1/8 note  — fraction 0.5
  Sixteenth = 2, // 1/16 note — fraction 0.25
  ThirtySecond = 3, // 1/32 note — fraction 0.125
}

/** Gate length as fraction of step interval. */
export enum ArpGateLength {
  Short = 0,   // 25% of step interval
  Medium = 1,  // 50% of step interval
  Long = 2,    // 75% of step interval
}

/** Numeric fraction of a quarter note for each subdivision. */
export const SUBDIVISION_FRACTIONS: Record<ArpSubdivision, number> = {
  [ArpSubdivision.Quarter]: 1.0,
  [ArpSubdivision.Eighth]: 0.5,
  [ArpSubdivision.Sixteenth]: 0.25,
  [ArpSubdivision.ThirtySecond]: 0.125,
};

/** Gate duty-cycle fraction for each gate length. */
export const GATE_LENGTH_FRACTIONS: Record<ArpGateLength, number> = {
  [ArpGateLength.Short]: 0.25,
  [ArpGateLength.Medium]: 0.50,
  [ArpGateLength.Long]: 0.75,
};

/** Maximum number of notes the latch queue can hold. */
export const ARP_MAX_NOTES = 8;

/** CV semitone increment (1V/octave convention: 1 octave = 1.0 CV). */
export const CV_OCTAVE = 1.0;

/** Parameter IDs used by the Arpeggiator component. */
export const ArpParameterId = {
  DIRECTION: 'direction',
  OCTAVES: 'octaves',
  SUBDIVISION: 'subdivision',
  GATE_LENGTH: 'gateLength',
} as const;

/** Port IDs used by the Arpeggiator component. */
export const ArpPortId = {
  CV_IN: 'cv-in',
  GATE_IN: 'gate-in',
  CV_OUT: 'cv-out',
  GATE_OUT: 'gate-out',
} as const;

/**
 * Serialized parameter shape stored in ComponentData.parameters.
 * All values are integers matching the enum numeric values above.
 */
export interface ArpParameters {
  direction: ArpDirection;
  octaves: 1 | 2 | 3 | 4;
  subdivision: ArpSubdivision;
  gateLength: ArpGateLength;
}
