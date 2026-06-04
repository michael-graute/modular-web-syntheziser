/**
 * Validation helpers for 032-polyphony feature.
 *
 * Pure functions — no side effects, no imports from src/.
 * Tested at 100% coverage (utility functions per constitution).
 */

import type { VoiceSlot, VoiceIndex } from './types';

// ---------------------------------------------------------------------------
// Voice slot validation
// ---------------------------------------------------------------------------

/** True when the index is a valid voice lane (0–3). */
export function isValidVoiceIndex(index: number): index is VoiceIndex {
  return Number.isInteger(index) && index >= 0 && index <= 3;
}

/** True when a voice slot is in a valid state. */
export function isValidVoiceSlot(slot: unknown): slot is VoiceSlot {
  if (typeof slot !== 'object' || slot === null) return false;
  const s = slot as Record<string, unknown>;
  return (
    isValidVoiceIndex(s['voiceIndex'] as number) &&
    typeof s['frequency'] === 'number' &&
    s['frequency'] >= 0 &&
    (s['gate'] === 0 || s['gate'] === 1) &&
    (s['note'] === null || (typeof s['note'] === 'number' && Number.isInteger(s['note']) && s['note'] >= 0 && s['note'] <= 127)) &&
    typeof s['timestamp'] === 'number' &&
    s['timestamp'] >= 0
  );
}

/** True when all 4 slots in the voice slot array are structurally valid. */
export function isValidVoiceSlotArray(slots: unknown): slots is VoiceSlot[] {
  if (!Array.isArray(slots)) return false;
  if (slots.length !== 4) return false;
  return slots.every((slot, i) => isValidVoiceSlot(slot) && (slot as VoiceSlot).voiceIndex === i);
}

// ---------------------------------------------------------------------------
// Poly mode parameter validation
// ---------------------------------------------------------------------------

/** True when the polyMode parameter value is valid (0 or 1). */
export function isValidPolyMode(value: number): value is 0 | 1 {
  return value === 0 || value === 1;
}

// ---------------------------------------------------------------------------
// ADSR parameter validation (reused from mono; applied per-slot)
// ---------------------------------------------------------------------------

const ADSR_TIME_MIN = 0.001;
const ADSR_TIME_MAX = 5.0;
const ADSR_SUSTAIN_MIN = 0.0;
const ADSR_SUSTAIN_MAX = 1.0;

/** True when an ADSR time parameter (attack/decay/release) is in range. */
export function isValidAdsrTime(value: number): boolean {
  return Number.isFinite(value) && value >= ADSR_TIME_MIN && value <= ADSR_TIME_MAX;
}

/** True when a sustain level is in range. */
export function isValidSustainLevel(value: number): boolean {
  return Number.isFinite(value) && value >= ADSR_SUSTAIN_MIN && value <= ADSR_SUSTAIN_MAX;
}

// ---------------------------------------------------------------------------
// Waveform parameter validation
// ---------------------------------------------------------------------------

/** True when a waveform index (0–3) is valid. */
export function isValidWaveformIndex(value: number): value is 0 | 1 | 2 | 3 {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

// ---------------------------------------------------------------------------
// Voice stealing helpers
// ---------------------------------------------------------------------------

/**
 * Returns the index (0–3) of the oldest active voice slot.
 * "Oldest" = lowest timestamp.
 * Returns -1 if no active voice is found (all gates are 0).
 */
export function findOldestActiveVoiceIndex(slots: Readonly<VoiceSlot[]>): number {
  let oldestIndex = -1;
  let oldestTimestamp = Infinity;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot && slot.gate === 1 && slot.timestamp < oldestTimestamp) {
      oldestTimestamp = slot.timestamp;
      oldestIndex = i;
    }
  }

  return oldestIndex;
}

/**
 * Returns the index (0–3) of the first idle voice slot (gate === 0).
 * Returns -1 if all 4 slots are active.
 */
export function findFirstIdleVoiceIndex(slots: Readonly<VoiceSlot[]>): number {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] && slots[i]!.gate === 0) return i;
  }
  return -1;
}

/**
 * Returns the voice index currently holding the given MIDI note number.
 * Returns -1 if the note is not found in any active slot.
 */
export function findVoiceIndexForNote(slots: Readonly<VoiceSlot[]>, note: number): number {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] && slots[i]!.note === note) return i;
  }
  return -1;
}
