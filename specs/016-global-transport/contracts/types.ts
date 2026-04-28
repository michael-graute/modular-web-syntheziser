/**
 * Type contracts for Global Transport Controller (feature 016)
 *
 * These types are the source of truth for transport state, events, and
 * the public API surface of GlobalTransportController.
 */

// ---------------------------------------------------------------------------
// Transport state
// ---------------------------------------------------------------------------

export enum TransportState {
  STOPPED = 'stopped',
  PLAYING = 'playing',
}

// ---------------------------------------------------------------------------
// Position
// ---------------------------------------------------------------------------

/** Bar and beat position within the timeline. Both values are 1-based. */
export interface TransportPosition {
  /** Current bar number (≥ 1). */
  bar: number;
  /** Current beat within the bar (1–4 for 4/4 time). */
  beat: number;
}

// ---------------------------------------------------------------------------
// EventBus payload types
// ---------------------------------------------------------------------------

/** Payload for TRANSPORT_BEAT events. */
export interface TransportBeatPayload {
  bar: number;
  beat: number;
}

// ---------------------------------------------------------------------------
// Public API contract for GlobalTransportController
// ---------------------------------------------------------------------------

export interface IGlobalTransportController {
  /** Returns the current transport state. */
  getState(): TransportState;

  /** Returns the current bar/beat position. Always { bar:1, beat:1 } when STOPPED. */
  getPosition(): TransportPosition;

  /**
   * Starts transport. Emits TRANSPORT_PLAY and begins emitting TRANSPORT_BEAT.
   * No-op if already PLAYING.
   */
  play(): void;

  /**
   * Stops transport. Emits TRANSPORT_STOP. Resets position to bar 1, beat 1.
   * No-op if already STOPPED.
   */
  stop(): void;
}

// ---------------------------------------------------------------------------
// Scheduling constants
// ---------------------------------------------------------------------------

/** How far ahead (ms) the scheduler looks when computing the next beat time. */
export const TRANSPORT_LOOKAHEAD_MS = 25;

/** Beats per bar (4/4 time, fixed for this version). */
export const BEATS_PER_BAR = 4;
