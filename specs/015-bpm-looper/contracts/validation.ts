/**
 * Validation helpers for the BPM-Synced Looper (feature 015).
 *
 * Pure functions — no Web Audio or DOM dependencies.
 * 100% test coverage required (per constitution).
 */

import {
  LooperState,
  LooperSerializedParams,
  VALID_BAR_COUNTS,
  type BarCount,
} from './types';

// ---------------------------------------------------------------------------
// BarCount
// ---------------------------------------------------------------------------

export function isValidBarCount(value: unknown): value is BarCount {
  return VALID_BAR_COUNTS.includes(value as BarCount);
}

export function validateBarCount(value: unknown): string | null {
  if (!isValidBarCount(value)) {
    return `barCount must be one of ${VALID_BAR_COUNTS.join(', ')}, got ${String(value)}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// BPM
// ---------------------------------------------------------------------------

export function validateBpm(bpm: unknown): string | null {
  if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm < 30 || bpm > 300) {
    return `bpm must be a finite number in [30, 300], got ${String(bpm)}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// LooperState
// ---------------------------------------------------------------------------

const VALID_STATES = new Set<string>(Object.values(LooperState));

export function isValidLooperState(value: unknown): value is LooperState {
  return typeof value === 'string' && VALID_STATES.has(value);
}

export function stateIndexToLooperState(index: number): LooperState {
  const map: Record<number, LooperState> = {
    0: LooperState.IDLE,
    1: LooperState.PLAYING,  // recording mid-session → restore as playing
    2: LooperState.PLAYING,
    3: LooperState.PLAYING,  // overdubbing mid-session → restore as playing
  };
  return map[index] ?? LooperState.IDLE;
}

export function looperStateToIndex(state: LooperState): number {
  const map: Record<LooperState, number> = {
    [LooperState.IDLE]:        0,
    [LooperState.RECORDING]:   2, // normalize to playing for serialization
    [LooperState.PLAYING]:     2,
    [LooperState.OVERDUBBING]: 2, // normalize to playing for serialization
  };
  return map[state];
}

// ---------------------------------------------------------------------------
// Serialized params
// ---------------------------------------------------------------------------

export function validateLooperSerializedParams(params: unknown): string | null {
  if (!params || typeof params !== 'object') {
    return 'params must be a non-null object';
  }

  const p = params as Partial<LooperSerializedParams>;

  const barCountError = validateBarCount(p.barCount);
  if (barCountError) return barCountError;

  if (
    typeof p.stateIndex !== 'number' ||
    !Number.isInteger(p.stateIndex) ||
    p.stateIndex < 0 ||
    p.stateIndex > 3
  ) {
    return `stateIndex must be an integer in [0, 3], got ${String(p.stateIndex)}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Audio blob
// ---------------------------------------------------------------------------

export function isValidBase64(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    // Standard base64 character set + padding
    return /^[A-Za-z0-9+/]*={0,2}$/.test(value) && value.length % 4 === 0;
  } catch {
    return false;
  }
}

export function validateAudioBlob(audioBlob: unknown): string | null {
  if (audioBlob === undefined || audioBlob === null) return null; // Optional field
  if (!isValidBase64(audioBlob)) {
    return 'audioBlob must be a valid Base64 string when present';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Loop duration
// ---------------------------------------------------------------------------

export function validateLoopDuration(barCount: BarCount, bpm: number): string | null {
  const barCountError = validateBarCount(barCount);
  if (barCountError) return barCountError;
  const bpmError = validateBpm(bpm);
  if (bpmError) return bpmError;
  return null;
}

// ---------------------------------------------------------------------------
// State transition guard
// ---------------------------------------------------------------------------

/**
 * Returns true if the transition from `from` to `to` is valid per the spec.
 * Clear → idle is always valid and is not checked here (handled separately).
 */
export function isValidStateTransition(from: LooperState, to: LooperState): boolean {
  const allowed: Record<LooperState, LooperState[]> = {
    [LooperState.IDLE]:        [LooperState.RECORDING],
    [LooperState.RECORDING]:   [LooperState.PLAYING],   // auto transition at loop end
    [LooperState.PLAYING]:     [LooperState.OVERDUBBING, LooperState.IDLE],
    [LooperState.OVERDUBBING]: [LooperState.PLAYING],
  };
  return allowed[from]?.includes(to) ?? false;
}
