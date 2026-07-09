/**
 * Validation and scheduling helpers for the Clock Divider component.
 *
 * Pure functions, no DOM/AudioContext dependency, directly unit-testable
 * per the Constitution's Test Coverage requirements (utility/validation
 * functions require 100% coverage). Imported directly as source by src/
 * code and tests, per this project's convention.
 *
 * @see ../data-model.md for the invariants these enforce
 * @see ../research.md for why this scheduling approach was chosen
 */

import { ClockDividerRate, RATE_BEATS_PER_PULSE, PULSE_DUTY_CYCLE } from './types';

/**
 * Clamps a raw parameter value to a valid ClockDividerRate index (0-5).
 * Mirrors the generic Parameter min/max/step clamping every enum-index
 * parameter in this codebase already relies on — exposed as a pure
 * function here so it is independently unit-testable.
 */
export function clampRateIndex(value: number): ClockDividerRate {
  const rounded = Math.round(value);
  if (rounded < ClockDividerRate.Div16) return ClockDividerRate.Div16;
  if (rounded > ClockDividerRate.X3) return ClockDividerRate.X3;
  return rounded as ClockDividerRate;
}

/**
 * Computes one output's pulse period in milliseconds for a given BPM.
 * Thin wrapper around the beats-per-pulse lookup so callers never need to
 * touch RATE_BEATS_PER_PULSE directly.
 */
export function ratePeriodMs(bpm: number, rate: ClockDividerRate): number {
  const beatsPerPulse = RATE_BEATS_PER_PULSE[rate];
  return (60000 / bpm) * beatsPerPulse;
}

/**
 * Computes how long one output's gate should stay high, in milliseconds,
 * for a given BPM/rate. A fixed proportion (PULSE_DUTY_CYCLE) of that
 * output's own period — NOT a fixed millisecond value — so the pulse
 * scales correctly across all six rates and any BPM, matching
 * StepSequencer's own proportional gate-duration convention
 * (getGateDuration: stepInterval / 2^(gateLength-1)) rather than an
 * unrelated fixed-width blip (research.md's pulse-width decision).
 */
export function pulseWidthMs(bpm: number, rate: ClockDividerRate): number {
  return ratePeriodMs(bpm, rate) * PULSE_DUTY_CYCLE;
}

/**
 * Advances one output's lookahead scheduling cursor by exactly one pulse
 * period, without resetting the cursor's origin (FR-002, FR-008, FR-010).
 * This is the core drift-resistant primitive: because nextTickTime is only
 * ever advanced by addition, never reassigned to "now", a live BPM or rate
 * change takes effect on the pulse immediately following the change with
 * no phase discontinuity — the same property StepSequencer's nextStepTime
 * already relies on (research.md decision 1).
 */
export function advanceTick(nextTickTime: number, bpm: number, rate: ClockDividerRate): number {
  return nextTickTime + ratePeriodMs(bpm, rate) / 1000;
}

/**
 * Returns every scheduled tick time that has come due by `horizonTime`,
 * advancing nextTickTime past each one in turn. Mirrors StepSequencer's
 * `while (nextStepTime < currentTime + lookaheadTime)` loop body as a pure
 * function: given a cursor and a horizon, returns the list of tick times
 * to fire plus the resulting (advanced) cursor, with no side effects.
 */
export function collectDueTicks(
  nextTickTime: number,
  horizonTime: number,
  bpm: number,
  rate: ClockDividerRate
): { dueTimes: number[]; nextTickTime: number } {
  const dueTimes: number[] = [];
  let cursor = nextTickTime;
  while (cursor < horizonTime) {
    dueTimes.push(cursor);
    cursor = advanceTick(cursor, bpm, rate);
  }
  return { dueTimes, nextTickTime: cursor };
}
