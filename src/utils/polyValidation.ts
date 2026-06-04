/**
 * Validation helpers for the 4-voice polyphony feature (032-polyphony).
 * Pure functions — no side effects, no Web Audio dependency.
 */

import { SignalType } from '../core/types';
import type { VoiceSlot } from '../components/utilities/VoiceAllocator';

export type VoiceIndex = 0 | 1 | 2 | 3;

export function isValidVoiceIndex(index: number): index is VoiceIndex {
  return Number.isInteger(index) && index >= 0 && index <= 3;
}

export function isValidVoiceSlot(slot: unknown): slot is VoiceSlot {
  if (typeof slot !== 'object' || slot === null) return false;
  const s = slot as Record<string, unknown>;
  return (
    isValidVoiceIndex(s['voiceIndex'] as number) &&
    typeof s['frequency'] === 'number' &&
    (s['frequency'] as number) >= 0 &&
    (s['gate'] === 0 || s['gate'] === 1) &&
    (s['note'] === null ||
      (typeof s['note'] === 'number' &&
        Number.isInteger(s['note'] as number) &&
        (s['note'] as number) >= 0 &&
        (s['note'] as number) <= 127)) &&
    typeof s['timestamp'] === 'number' &&
    (s['timestamp'] as number) >= 0
  );
}

export function isValidVoiceSlotArray(slots: unknown): slots is VoiceSlot[] {
  if (!Array.isArray(slots) || slots.length !== 4) return false;
  return slots.every((slot, i) => isValidVoiceSlot(slot) && (slot as VoiceSlot).voiceIndex === i);
}

export function isValidPolyMode(value: number): value is 0 | 1 {
  return value === 0 || value === 1;
}

const ADSR_TIME_MIN = 0.001;
const ADSR_TIME_MAX = 5.0;

export function isValidAdsrTime(value: number): boolean {
  return Number.isFinite(value) && value >= ADSR_TIME_MIN && value <= ADSR_TIME_MAX;
}

export function isValidSustainLevel(value: number): boolean {
  return Number.isFinite(value) && value >= 0.0 && value <= 1.0;
}

export function isValidWaveformIndex(value: number): value is 0 | 1 | 2 | 3 {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

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

export function findFirstIdleVoiceIndex(slots: Readonly<VoiceSlot[]>): number {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]?.gate === 0) return i;
  }
  return -1;
}

export function findVoiceIndexForNote(slots: Readonly<VoiceSlot[]>, note: number): number {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]?.note === note) return i;
  }
  return -1;
}

/** True when POLY_CV port type is strict-isolated from other signal types (FR-002). */
export function isPolyCompatible(source: SignalType, target: SignalType): boolean {
  if (source === SignalType.POLY_CV) return target === SignalType.POLY_CV;
  if (target === SignalType.POLY_CV) return false;
  return true; // defer to main areSignalTypesCompatible for non-poly
}
