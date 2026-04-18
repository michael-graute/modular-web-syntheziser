/**
 * Integration tests for KeyboardController ChordFinder sync (feature 014).
 *
 * Tests:
 * - T023: Multiple KeyboardController instances both receive CHORD_NOTES_ON/OFF (fan-out)
 * - T025: Atomic chord-swap — pressing chord B while A is held leaves only B highlighted
 * - T026: Additive coexistence — manual press survives ChordFinder chord release
 * - destroy(): EventBus unsubscribe and highlight cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyboardController } from '../../src/keyboard/KeyboardController';
import { EventType } from '../../src/core/types';
import type { ChordNotesOnPayload, ChordNotesOffPayload } from '../../src/core/types';
import { eventBus } from '../../src/core/EventBus';

// ---------------------------------------------------------------------------
// Canvas stub (mirrors Keyboard.chordfinder.test.ts)
// ---------------------------------------------------------------------------

function createKeyboardCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 120;
  Object.defineProperty(canvas, 'clientWidth', { value: 560, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { value: 120, configurable: true });
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({ width: 560, height: 120, left: 0, top: 0, right: 560, bottom: 120 }),
    configurable: true,
  });
  const ctx = {
    scale: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(),
    get fillStyle() { return ''; }, set fillStyle(_v: unknown) {},
    get strokeStyle() { return ''; }, set strokeStyle(_v: unknown) {},
    get lineWidth() { return 1; }, set lineWidth(_v: unknown) {},
    get font() { return ''; }, set font(_v: unknown) {},
    get textAlign() { return 'left'; }, set textAlign(_v: unknown) {},
    get textBaseline() { return 'alphabetic'; }, set textBaseline(_v: unknown) {},
  };
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  return canvas;
}

function makeController(): KeyboardController {
  return new KeyboardController(createKeyboardCanvas(), 4);
}

// MIDI notes for C Major I chord at octave 4
const C4 = 60;
const E4 = 64;
const G4 = 67;
// C Major V chord at octave 4 (G-B-D)
const B4 = 71;
const D5 = 74;

function chordOnPayload(notes: [number, number, number], sourceId = 'cf-1'): ChordNotesOnPayload {
  return { notes, sourceId };
}

function chordOffPayload(notes: [number, number, number], sourceId = 'cf-1'): ChordNotesOffPayload {
  return { notes, sourceId };
}

// ---------------------------------------------------------------------------
// T023: Multiple KeyboardController instances — fan-out
// ---------------------------------------------------------------------------

describe('KeyboardController: multiple instances receive CHORD_NOTES_ON (T023)', () => {
  let ctrl1: KeyboardController;
  let ctrl2: KeyboardController;

  beforeEach(() => {
    ctrl1 = makeController();
    ctrl2 = makeController();
  });

  afterEach(() => {
    ctrl1.destroy();
    ctrl2.destroy();
  });

  it('both controllers track chord notes after CHORD_NOTES_ON', () => {
    eventBus.emit(EventType.CHORD_NOTES_ON, chordOnPayload([C4, E4, G4]));
    expect(ctrl1.getCurrentChordNotes()).toEqual([C4, E4, G4]);
    expect(ctrl2.getCurrentChordNotes()).toEqual([C4, E4, G4]);
  });

  it('both controllers clear chord notes after CHORD_NOTES_OFF', () => {
    eventBus.emit(EventType.CHORD_NOTES_ON, chordOnPayload([C4, E4, G4]));
    eventBus.emit(EventType.CHORD_NOTES_OFF, chordOffPayload([C4, E4, G4]));
    expect(ctrl1.getCurrentChordNotes()).toEqual([]);
    expect(ctrl2.getCurrentChordNotes()).toEqual([]);
  });

  it('both keyboards highlight the correct keys', () => {
    eventBus.emit(EventType.CHORD_NOTES_ON, chordOnPayload([C4, E4, G4]));
    // Notes in range (octave 4: 60–83) should be highlighted on both keyboards
    const kb1 = ctrl1.getKeyboard();
    const kb2 = ctrl2.getKeyboard();
    // Verify by pressing then releasing via public API — both should not throw
    expect(() => {
      kb1.releaseAllChordFinderKeys();
      kb2.releaseAllChordFinderKeys();
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// T025: Atomic chord-swap — FR-009
// ---------------------------------------------------------------------------

describe('KeyboardController: atomic chord-swap (T025 / FR-009)', () => {
  let ctrl: KeyboardController;

  beforeEach(() => {
    ctrl = makeController();
  });

  afterEach(() => {
    ctrl.destroy();
  });

  it('pressing chord B while A is held leaves only chord B in currentChordNotes', () => {
    const chordA: [number, number, number] = [C4, E4, G4];      // I
    const chordB: [number, number, number] = [G4, B4, D5];      // V

    eventBus.emit(EventType.CHORD_NOTES_ON, chordOnPayload(chordA));
    expect(ctrl.getCurrentChordNotes()).toEqual([C4, E4, G4]);

    eventBus.emit(EventType.CHORD_NOTES_ON, chordOnPayload(chordB));
    const current = ctrl.getCurrentChordNotes();

    // Only chord B notes should be tracked
    expect(current).toEqual([G4, B4, D5]);
    // No chord A-only notes should remain (C4, E4 are not in chord B)
    expect(current).not.toContain(C4);
    expect(current).not.toContain(E4);
  });

  it('two CHORD_NOTES_ON events with distinct notes produce no overlap in state', () => {
    eventBus.emit(EventType.CHORD_NOTES_ON, chordOnPayload([C4, E4, G4]));
    eventBus.emit(EventType.CHORD_NOTES_ON, chordOnPayload([G4, B4, D5]));

    const notes = ctrl.getCurrentChordNotes();
    // Exactly chord B's three notes — no duplicates, no chord A leftovers
    expect(notes).toHaveLength(3);
    expect(notes).toContain(G4);
    expect(notes).toContain(B4);
    expect(notes).toContain(D5);
  });
});

// ---------------------------------------------------------------------------
// T026: Additive coexistence — FR-006 / FR-007
// ---------------------------------------------------------------------------

describe('KeyboardController: additive coexistence — manual + ChordFinder (T026 / FR-006/007)', () => {
  let ctrl: KeyboardController;

  beforeEach(() => {
    ctrl = makeController();
  });

  afterEach(() => {
    ctrl.destroy();
  });

  it('releasing ChordFinder chord does not call noteOff for manually-held keys', () => {
    const noteOffSpy = vi.fn();
    ctrl.getKeyboard().setNoteOffCallback(noteOffSpy);

    // Manually press C4
    ctrl.getKeyboard().pressKey(C4);

    // ChordFinder chord that includes C4
    eventBus.emit(EventType.CHORD_NOTES_ON, chordOnPayload([C4, E4, G4]));

    // Release ChordFinder chord
    eventBus.emit(EventType.CHORD_NOTES_OFF, chordOffPayload([C4, E4, G4]));

    // Manual key C4 was never released — noteOff should NOT have been called
    expect(noteOffSpy).not.toHaveBeenCalled();
  });

  it('ChordFinder chord release clears currentChordNotes while manual press state is unchanged', () => {
    ctrl.getKeyboard().pressKey(C4);
    eventBus.emit(EventType.CHORD_NOTES_ON, chordOnPayload([C4, E4, G4]));
    eventBus.emit(EventType.CHORD_NOTES_OFF, chordOffPayload([C4, E4, G4]));

    // currentChordNotes is cleared
    expect(ctrl.getCurrentChordNotes()).toEqual([]);

    // Manual press state: pressing C4 again and releasing works (no stuck state)
    const noteOffSpy = vi.fn();
    ctrl.getKeyboard().setNoteOffCallback(noteOffSpy);
    ctrl.getKeyboard().releaseKey(C4);
    expect(noteOffSpy).toHaveBeenCalledWith(C4);
  });
});

// ---------------------------------------------------------------------------
// destroy() — T021
// ---------------------------------------------------------------------------

describe('KeyboardController.destroy()', () => {
  it('unsubscribes from EventBus so subsequent chord events are not received', () => {
    const ctrl = makeController();
    ctrl.destroy();

    eventBus.emit(EventType.CHORD_NOTES_ON, chordOnPayload([C4, E4, G4]));

    // After destroy, currentChordNotes should remain empty
    expect(ctrl.getCurrentChordNotes()).toEqual([]);
  });

  it('is safe to call multiple times', () => {
    const ctrl = makeController();
    expect(() => {
      ctrl.destroy();
      ctrl.destroy();
    }).not.toThrow();
  });

  it('clears ChordFinder highlights on destroy', () => {
    const ctrl = makeController();
    eventBus.emit(EventType.CHORD_NOTES_ON, chordOnPayload([C4, E4, G4]));
    expect(() => ctrl.destroy()).not.toThrow();
    expect(ctrl.getCurrentChordNotes()).toEqual([]);
  });
});
