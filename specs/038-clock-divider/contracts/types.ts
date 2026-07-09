/**
 * Type definitions and constants for the Clock Divider component.
 *
 * Imported directly as source by src/ code and tests, per this project's
 * convention (see Looper.ts importing from specs/015-bpm-looper/contracts/,
 * Notes.ts importing from specs/036-notes-component/contracts/).
 *
 * @see ../data-model.md for complete documentation
 */

/**
 * A rate at which one Clock Divider output pulses, relative to the shared
 * global tempo. Persisted as this enum's numeric index, identical to how
 * ArpSubdivision (specs/029-arpeggiator/contracts/types.ts) is persisted.
 * Ordered slowest-to-fastest.
 */
export enum ClockDividerRate {
  Div16 = 0,
  Div8 = 1,
  Div4 = 2,
  Div2 = 3,
  X2 = 4,
  X3 = 5,
}

/** All valid rate values, slowest to fastest — used to populate each output's rate dropdown. */
export const CLOCK_DIVIDER_RATES: ClockDividerRate[] = [
  ClockDividerRate.Div16,
  ClockDividerRate.Div8,
  ClockDividerRate.Div4,
  ClockDividerRate.Div2,
  ClockDividerRate.X2,
  ClockDividerRate.X3,
];

/**
 * Beats-per-pulse for each rate: values > 1 are divisions (one pulse every
 * N beats), values < 1 are multiplications (multiple pulses per beat).
 * Fed directly to TimingCalculator.beatsToMs(bpm, beatsPerPulse) to compute
 * each output's pulse period in milliseconds (FR-004, FR-005).
 */
export const RATE_BEATS_PER_PULSE: Record<ClockDividerRate, number> = {
  [ClockDividerRate.Div16]: 16,
  [ClockDividerRate.Div8]: 8,
  [ClockDividerRate.Div4]: 4,
  [ClockDividerRate.Div2]: 2,
  [ClockDividerRate.X2]: 0.5,
  [ClockDividerRate.X3]: 1 / 3,
};

/**
 * Short-form on-canvas display label for each rate (SC-004), reusing this
 * project's existing note-value vocabulary (e.g. StepSequencer's
 * NOTE_DIVISION_LABELS, "1/4"/"1/8"/"1/16") rather than inventing new terms.
 */
export const RATE_LABELS: Record<ClockDividerRate, string> = {
  [ClockDividerRate.Div16]: '/16',
  [ClockDividerRate.Div8]: '/8',
  [ClockDividerRate.Div4]: '/4',
  [ClockDividerRate.Div2]: '/2',
  [ClockDividerRate.X2]: 'x2',
  [ClockDividerRate.X3]: 'x3',
};

/** The fixed number of independent outputs on a Clock Divider (data-model.md). */
export const CLOCK_DIVIDER_OUTPUT_COUNT = 6;

/** Default rate assigned to each output at construction — one output per named rate, slowest to fastest. */
export const DEFAULT_RATES: ClockDividerRate[] = [
  ClockDividerRate.Div2,
  ClockDividerRate.Div4,
  ClockDividerRate.Div8,
  ClockDividerRate.Div16,
  ClockDividerRate.X2,
  ClockDividerRate.X3,
];

/**
 * Fraction of each output's own period that its gate stays high, e.g. a
 * /16 output's pulse is exactly as proportionally wide as an X3 output's
 * pulse relative to their own periods. Matches StepSequencer's proportional
 * gate-duration convention (stepInterval / 2^(gateLength-1)) rather than a
 * fixed millisecond width, which would be unreliable across rates spanning
 * from a 7.5s period (/16 at 60 BPM) to a ~110ms period (x3 at 180 BPM)
 * (research.md's pulse-width decision).
 */
export const PULSE_DUTY_CYCLE = 0.25;
