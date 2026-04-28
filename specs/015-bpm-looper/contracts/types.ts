/**
 * Type contracts for the BPM-Synced Looper (feature 015).
 *
 * These are spec-level contracts. Production code lives in:
 *   src/components/utilities/Looper.ts
 *   src/canvas/displays/LooperDisplay.ts
 */

// ---------------------------------------------------------------------------
// State
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
// Config (persisted)
// ---------------------------------------------------------------------------

export interface LooperConfig {
  /** Loop length in bars. Fixed at record start. */
  barCount: BarCount;
  /** Snapshot of the global BPM at the moment recording started. */
  bpm: number;
  /** Current looper state. */
  state: LooperState;
}

// ---------------------------------------------------------------------------
// Runtime buffer (not serialized directly)
// ---------------------------------------------------------------------------

export interface LoopBuffer {
  /** Raw mono PCM samples (IEEE 754 Float32). */
  samples: Float32Array;
  /** Total length in samples = round(durationSec × sampleRate). */
  lengthSamples: number;
  /** Write head position (0 … lengthSamples-1) — used during recording/overdub. */
  writeHead: number;
  /** Read/play head position (0 … lengthSamples-1) — used during playback. */
  playHead: number;
  /** True once a complete recording pass has filled the buffer. */
  filled: boolean;
}

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
// Serialization
// ---------------------------------------------------------------------------

export interface LooperSerializedParams {
  /** 1 | 2 | 4 | 8 */
  barCount: number;
  /**
   * 0 = idle, 1 = recording (serialized as playing), 2 = playing, 3 = overdubbing (serialized as playing)
   * Mid-session states (recording, overdubbing) are normalized to playing on save.
   */
  stateIndex: number;
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts (reserved keys)
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
// Computed helpers (pure, no Web Audio dependency)
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
