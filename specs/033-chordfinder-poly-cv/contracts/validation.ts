/**
 * Validation helpers for 033-chordfinder-poly-cv.
 *
 * Used by tests to assert invariants on the ChordFinder poly slot state.
 */

import type { VoiceSlot } from '../../../../src/components/utilities/VoiceAllocator';
import {
  CHORD_POLY_VOICE_COUNT,
  CHORD_SLOT_INACTIVE,
} from './types';

/**
 * Assert that a voice slot array satisfies all ChordFinder invariants.
 * Throws a descriptive error on the first violation.
 */
export function assertValidChordPolySlots(slots: Readonly<VoiceSlot[]>): void {
  if (slots.length !== CHORD_POLY_VOICE_COUNT) {
    throw new Error(`Expected ${CHORD_POLY_VOICE_COUNT} slots, got ${slots.length}`);
  }

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    if (slot.voiceIndex !== i) {
      throw new Error(`Slot ${i}: voiceIndex must equal index, got ${slot.voiceIndex}`);
    }
  }

  const inactive = slots[CHORD_SLOT_INACTIVE]!;
  if (inactive.gate !== 0) {
    throw new Error(`Slot 3 (inactive) must always have gate=0, got ${inactive.gate}`);
  }
  if (inactive.frequency !== 0) {
    throw new Error(`Slot 3 (inactive) must always have frequency=0, got ${inactive.frequency}`);
  }
}

/**
 * Returns true if the active chord slots (0–2) all have gate=1 and
 * a positive frequency.
 */
export function areChordSlotsActive(slots: Readonly<VoiceSlot[]>): boolean {
  for (let i = 0; i < CHORD_SLOT_INACTIVE; i++) {
    const slot = slots[i]!;
    if (slot.gate !== 1 || slot.frequency <= 0) return false;
  }
  return true;
}

/**
 * Returns true if the active chord slots (0–2) all have gate=0.
 * Frequencies may be any value (retained after release).
 */
export function areChordSlotsReleased(slots: Readonly<VoiceSlot[]>): boolean {
  for (let i = 0; i < CHORD_SLOT_INACTIVE; i++) {
    if (slots[i]!.gate !== 0) return false;
  }
  return true;
}
