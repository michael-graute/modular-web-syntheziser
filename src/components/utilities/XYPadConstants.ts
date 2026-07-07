/**
 * Shared types and constants for the X-Y Pad controller (feature 035).
 *
 * Kept separate from XYPad.ts to avoid circular imports with XYPadDisplay.ts,
 * following the LooperConstants.ts precedent.
 */

// ---------------------------------------------------------------------------
// State enum
// ---------------------------------------------------------------------------

export enum XYPadState {
  IDLE = 'idle',
  RECORDING = 'recording',
  PLAYING = 'playing',
}

// ---------------------------------------------------------------------------
// Recording capture constants
// ---------------------------------------------------------------------------

export const XY_PAD = {
  SAMPLE_RATE_HZ: 60,
  MAX_DURATION_MS: 60_000,
  MAX_SAMPLES: 3_600, // SAMPLE_RATE_HZ * (MAX_DURATION_MS / 1000)
} as const;

// ---------------------------------------------------------------------------
// Display state (passed to XYPadDisplay each animation frame)
// ---------------------------------------------------------------------------

export interface XYPadDisplayState {
  state: XYPadState;
  x: number;
  y: number;
  hasRecording: boolean;
}
