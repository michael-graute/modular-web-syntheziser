/**
 * Type definitions for the X-Y Pad Controller component
 *
 * This file documents the shapes introduced by this feature for use in
 * implementation and tests. Import these types in interface files, not the
 * full data model.
 *
 * @see ../data-model.md for complete type documentation
 */

/** State machine for the X-Y Pad, mirrors LooperState but without an overdub concept. */
export enum XYPadState {
  IDLE = 'idle',
  RECORDING = 'recording',
  PLAYING = 'playing',
}

/** Normalized 2D position, both axes in [0, 1]. */
export interface XYPosition {
  x: number;
  y: number;
}

/**
 * A single captured sample: elapsed milliseconds since recording started,
 * plus the normalized position at that instant.
 */
export interface XYSample {
  t: number;
  x: number;
  y: number;
}

/**
 * The captured movement gesture. Stored internally as an interleaved
 * Float32Array ([t0,x0,y0,t1,x1,y1,...]) and exposed via helpers rather
 * than an array of XYSample objects, to avoid per-sample object allocation
 * during capture/playback.
 */
export interface MovementRecording {
  /** Interleaved (t,x,y) triples, length === sampleCount * 3. */
  samples: Float32Array;
  /** Number of (t,x,y) triples actually captured. */
  sampleCount: number;
  /** Timestamp (ms) of the last captured sample; used for loop-wrap math. */
  durationMs: number;
}

/**
 * Per-connection CV scaler, matching LFO's ConnectionScaler shape exactly
 * (src/components/generators/LFO.ts:29-33). Stored in a
 * `Map<string, ConnectionScaler>` keyed by `${targetId}:${inputId}` — the
 * target/input identity lives in the map key, not as fields here.
 */
export interface ConnectionScaler {
  node: GainNode;
  /** (paramMax − paramMin) / 2 — the range-based part of the gain, independent of depth. */
  fullDepthGain: number;
}
