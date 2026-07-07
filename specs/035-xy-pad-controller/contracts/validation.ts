/**
 * Validation helpers for the X-Y Pad Controller component.
 *
 * Pure functions, no AudioContext/DOM dependency, so they are directly
 * unit-testable per the Constitution's Test Coverage requirements
 * (utility/validation functions require 100% coverage).
 *
 * @see ../data-model.md for the invariants these enforce
 */

import type { MovementRecording, XYPosition } from './types';

/** Clamps a single axis value into the valid [0, 1] normalized range (FR-016). */
export function clampAxis(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Clamps both axes of a position into [0, 1] (FR-016). */
export function clampPosition(position: XYPosition): XYPosition {
  return { x: clampAxis(position.x), y: clampAxis(position.y) };
}

/**
 * A recording is only considered valid/playable when it has at least one
 * sample. A zero-length capture (e.g. Stop pressed in the same frame as
 * Record) must not enable the Play control (FR-012).
 */
export function isPlayableRecording(
  recording: MovementRecording | null
): recording is MovementRecording {
  return recording !== null && recording.sampleCount > 0;
}

/**
 * Enforces the maximum recording duration/sample cap (FR-017). Returns
 * true when the recorder should auto-stop on this frame.
 */
export function hasReachedRecordingLimit(
  sampleCount: number,
  maxSamples: number
): boolean {
  return sampleCount >= maxSamples;
}

/**
 * Maps elapsed playback time to a looping position within the recording's
 * duration (FR-011: playback loops continuously until Stop or manual drag).
 */
export function wrapPlaybackTime(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return elapsedMs % durationMs;
}
