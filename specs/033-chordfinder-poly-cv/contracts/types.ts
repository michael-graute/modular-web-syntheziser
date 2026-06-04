/**
 * Type contracts for 033-chordfinder-poly-cv feature.
 *
 * ChordFinder reuses VoiceSlot from 032-polyphony without modification.
 * This file documents the ChordFinder-specific slot mapping and the
 * PolyCvSource shape ChordFinder must satisfy.
 */

// Re-export for test convenience — the canonical definition lives in VoiceAllocator.
export type { VoiceSlot } from '../../../../src/components/utilities/VoiceAllocator';

// ---------------------------------------------------------------------------
// Slot index constants
// ---------------------------------------------------------------------------

/** Slot index used for the chord root note. */
export const CHORD_SLOT_ROOT = 0 as const;

/** Slot index used for the chord third. */
export const CHORD_SLOT_THIRD = 1 as const;

/** Slot index used for the chord fifth. */
export const CHORD_SLOT_FIFTH = 2 as const;

/** Slot index that is always inactive (gate=0, frequency=0). */
export const CHORD_SLOT_INACTIVE = 3 as const;

/** Total number of voice slots published on the poly-cv port. */
export const CHORD_POLY_VOICE_COUNT = 4 as const;

// ---------------------------------------------------------------------------
// PolyCvSource contract (satisfied by ChordFinder)
// ---------------------------------------------------------------------------

/**
 * The duck-type interface ConnectionManager checks for on POLY_CV source
 * components. ChordFinder must expose this method.
 *
 * Source: src/canvas/ConnectionManager.ts line 176
 * `typeof src.getVoiceSlots === 'function'`
 */
export interface ChordFinderPolyCvSource {
  getVoiceSlots(): Readonly<import('../../../../src/components/utilities/VoiceAllocator').VoiceSlot[]>;
}
