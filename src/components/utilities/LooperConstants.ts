/**
 * Shared types and constants for the BPM-Synced Looper (feature 015).
 *
 * Imported by Looper.ts, LooperDisplay.ts, and KeyboardController.ts.
 * Kept separate from Looper.ts to avoid circular imports.
 */

// ---------------------------------------------------------------------------
// State enum
// ---------------------------------------------------------------------------

export enum LooperState {
  IDLE        = 'idle',
  RECORDING   = 'recording',
  PLAYING     = 'playing',
  OVERDUBBING = 'overdubbing',
}

// ---------------------------------------------------------------------------
// Bar count
// ---------------------------------------------------------------------------

export type BarCount = 1 | 2 | 4 | 8;

export const VALID_BAR_COUNTS: ReadonlyArray<BarCount> = [1, 2, 4, 8];

// ---------------------------------------------------------------------------
// Display state (passed to LooperDisplay each animation frame)
// ---------------------------------------------------------------------------

export interface LooperDisplayState {
  state: LooperState;
  /** Normalised playhead position in [0, 1]. Drives ring indicator angle. */
  playHeadNormalized: number;
  barCount: BarCount;
  /** Whether a loop has been recorded (drives whether playhead is drawn). */
  filled: boolean;
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

export const LOOPER_SHORTCUT_RECORD = '1';
export const LOOPER_SHORTCUT_STOP   = '2';
export const LOOPER_SHORTCUT_CLEAR  = '0';

export const LOOPER_RESERVED_KEYS: ReadonlySet<string> = new Set([
  LOOPER_SHORTCUT_RECORD,
  LOOPER_SHORTCUT_STOP,
  LOOPER_SHORTCUT_CLEAR,
]);

// ---------------------------------------------------------------------------
// Ring colours by state
// ---------------------------------------------------------------------------

export const LOOPER_STATE_COLORS: Readonly<Record<LooperState, string>> = {
  [LooperState.IDLE]:        '#4a4a4a',
  [LooperState.RECORDING]:   '#e05555',
  [LooperState.PLAYING]:     '#4caf50',
  [LooperState.OVERDUBBING]: '#f5a623',
};

// ---------------------------------------------------------------------------
// Pure computed helpers (no Web Audio dependency)
// ---------------------------------------------------------------------------

export function computeLoopDurationSeconds(barCount: BarCount, bpm: number): number {
  return (barCount * 4 * 60) / bpm;
}

export function computeLoopDurationSamples(barCount: BarCount, bpm: number, sampleRate: number): number {
  return Math.round(computeLoopDurationSeconds(barCount, bpm) * sampleRate);
}

export function normalizePlayHead(playHead: number, lengthSamples: number): number {
  if (lengthSamples <= 0) return 0;
  return Math.max(0, Math.min(1, playHead / lengthSamples));
}

export function playHeadToAngle(normalized: number): number {
  // 0 = top of ring (−π/2), clockwise
  return normalized * 2 * Math.PI - Math.PI / 2;
}
