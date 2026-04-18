/**
 * Type contracts for feature 014: ChordFinder–Keyboard Visual Sync
 *
 * These types extend src/core/types.ts and src/keyboard/Keyboard.ts.
 * They are the source of truth for implementation.
 */

// ---------------------------------------------------------------------------
// Event payload types (to be added to src/core/types.ts)
// ---------------------------------------------------------------------------

/**
 * Payload for EventType.CHORD_NOTES_ON.
 * Emitted by ChordFinder.pressChord() after CV/gate outputs are set.
 */
export interface ChordNotesOnPayload {
  /** MIDI note numbers of the three chord tones, octave-shifted to match config. */
  notes: [number, number, number];
  /** ID of the ChordFinder component that emitted this event. */
  sourceId: string;
}

/**
 * Payload for EventType.CHORD_NOTES_OFF.
 * Emitted by ChordFinder.releaseChord() after gate output is cleared.
 */
export interface ChordNotesOffPayload {
  /** The same MIDI note numbers that were sent in the preceding CHORD_NOTES_ON. */
  notes: [number, number, number];
  /** ID of the ChordFinder component that emitted this event. */
  sourceId: string;
}

// ---------------------------------------------------------------------------
// Keyboard key extension (to be merged into Keyboard.ts Key interface)
// ---------------------------------------------------------------------------

/**
 * Extension to the existing Key interface inside Keyboard.ts.
 * The `pressedByChordFinder` flag tracks ChordFinder-sourced highlights
 * independently from manual (`isPressed`) key presses.
 *
 * Render rule:  highlighted = isPressed || pressedByChordFinder
 */
export interface KeyExtension {
  pressedByChordFinder: boolean;
}

// ---------------------------------------------------------------------------
// New public methods added to KeyboardController
// ---------------------------------------------------------------------------

/**
 * Added to KeyboardController to support cleanup of EventBus subscriptions.
 */
export interface KeyboardControllerExtension {
  /** Release EventBus subscriptions and clean up chord highlight state. */
  destroy(): void;
}

// ---------------------------------------------------------------------------
// New EventType values (to be added to the EventType enum in types.ts)
// ---------------------------------------------------------------------------

export const CHORD_EVENT_TYPES = {
  CHORD_NOTES_ON: 'chord:notes-on',
  CHORD_NOTES_OFF: 'chord:notes-off',
} as const;
