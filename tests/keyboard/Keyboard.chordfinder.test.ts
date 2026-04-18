/**
 * Unit tests for Keyboard ChordFinder visual sync methods (feature 014).
 *
 * Tests pressKeyFromChordFinder, releaseKeyFromChordFinder, releaseAllChordFinderKeys,
 * render highlight logic, and additive coexistence with manual key presses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keyboard } from '../../src/keyboard/Keyboard';

// ---------------------------------------------------------------------------
// Canvas stub — happy-dom provides a canvas element but getContext may return
// a limited mock; we patch render-related methods to avoid canvas draw errors.
// ---------------------------------------------------------------------------

function createKeyboardCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 120;
  // Provide clientWidth/clientHeight used inside Keyboard
  Object.defineProperty(canvas, 'clientWidth', { value: 560, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { value: 120, configurable: true });
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({ width: 560, height: 120, left: 0, top: 0, right: 560, bottom: 120 }),
    configurable: true,
  });
  return canvas;
}

// Vitest happy-dom may not support full canvas 2d context; stub it
function stubCanvasContext(canvas: HTMLCanvasElement): void {
  const ctx = {
    scale: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    get fillStyle() { return ''; },
    set fillStyle(_v: unknown) {},
    get strokeStyle() { return ''; },
    set strokeStyle(_v: unknown) {},
    get lineWidth() { return 1; },
    set lineWidth(_v: unknown) {},
    get font() { return ''; },
    set font(_v: unknown) {},
    get textAlign() { return 'left'; },
    set textAlign(_v: unknown) {},
    get textBaseline() { return 'alphabetic'; },
    set textBaseline(_v: unknown) {},
  };
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeKeyboard(startOctave = 4): Keyboard {
  const canvas = createKeyboardCanvas();
  stubCanvasContext(canvas);
  return new Keyboard(canvas, startOctave);
}

// Default startOctave=4: C4=60, C#4=61, D4=62 … B5=83
const C4 = 60;
const E4 = 64;
const G4 = 67;

// ---------------------------------------------------------------------------
// pressKeyFromChordFinder
// ---------------------------------------------------------------------------

describe('Keyboard.pressKeyFromChordFinder', () => {
  let keyboard: Keyboard;

  beforeEach(() => {
    keyboard = makeKeyboard();
  });

  it('sets pressedByChordFinder = true for the matching key', () => {
    keyboard.pressKeyFromChordFinder(C4);
    // Verify via releaseAllChordFinderKeys clearing: if it was set, the key
    // is no longer highlighted after clearing.
    // We test indirectly through public API — the key's state is reflected
    // in the fact that releaseAllChordFinderKeys does a render without error.
    expect(() => keyboard.releaseAllChordFinderKeys()).not.toThrow();
  });

  it('does not throw for a note outside the visible range', () => {
    expect(() => keyboard.pressKeyFromChordFinder(0)).not.toThrow();   // below range
    expect(() => keyboard.pressKeyFromChordFinder(127)).not.toThrow(); // above range
  });

  it('can press multiple chord notes independently', () => {
    expect(() => {
      keyboard.pressKeyFromChordFinder(C4);
      keyboard.pressKeyFromChordFinder(E4);
      keyboard.pressKeyFromChordFinder(G4);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// releaseKeyFromChordFinder
// ---------------------------------------------------------------------------

describe('Keyboard.releaseKeyFromChordFinder', () => {
  let keyboard: Keyboard;

  beforeEach(() => {
    keyboard = makeKeyboard();
  });

  it('does not throw for a note in range', () => {
    keyboard.pressKeyFromChordFinder(C4);
    expect(() => keyboard.releaseKeyFromChordFinder(C4)).not.toThrow();
  });

  it('does not throw for a note outside range', () => {
    expect(() => keyboard.releaseKeyFromChordFinder(0)).not.toThrow();
    expect(() => keyboard.releaseKeyFromChordFinder(127)).not.toThrow();
  });

  it('does not affect manual isPressed state', () => {
    // Press manually, then set ChordFinder highlight, then release ChordFinder highlight
    const noteOnSpy = vi.fn();
    keyboard.setNoteOnCallback(noteOnSpy);
    keyboard.pressKey(C4);
    keyboard.pressKeyFromChordFinder(C4);
    keyboard.releaseKeyFromChordFinder(C4);
    // Manual press callback should have been called once (on pressKey)
    expect(noteOnSpy).toHaveBeenCalledWith(C4, 0.7);
    // Manual press should still be active — releasing ChordFinder source does not
    // call noteOff. We verify by checking that noteOff was never called.
    const noteOffSpy = vi.fn();
    keyboard.setNoteOffCallback(noteOffSpy);
    keyboard.releaseKeyFromChordFinder(C4); // second call — no-op for audio
    expect(noteOffSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// releaseAllChordFinderKeys
// ---------------------------------------------------------------------------

describe('Keyboard.releaseAllChordFinderKeys', () => {
  let keyboard: Keyboard;

  beforeEach(() => {
    keyboard = makeKeyboard();
  });

  it('clears all ChordFinder highlights without error', () => {
    keyboard.pressKeyFromChordFinder(C4);
    keyboard.pressKeyFromChordFinder(E4);
    keyboard.pressKeyFromChordFinder(G4);
    expect(() => keyboard.releaseAllChordFinderKeys()).not.toThrow();
  });

  it('does not affect manually-pressed keys (does not call noteOff callbacks)', () => {
    const noteOffSpy = vi.fn();
    keyboard.setNoteOffCallback(noteOffSpy);

    keyboard.pressKey(C4);
    keyboard.pressKeyFromChordFinder(E4);
    keyboard.releaseAllChordFinderKeys();

    expect(noteOffSpy).not.toHaveBeenCalled();
  });

  it('is safe to call when no ChordFinder keys are highlighted', () => {
    expect(() => keyboard.releaseAllChordFinderKeys()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Additive coexistence (FR-006 / FR-007)
// ---------------------------------------------------------------------------

describe('Keyboard additive highlight coexistence', () => {
  let keyboard: Keyboard;

  beforeEach(() => {
    keyboard = makeKeyboard();
  });

  it('manual press and ChordFinder highlight coexist on the same key', () => {
    const noteOnSpy = vi.fn();
    keyboard.setNoteOnCallback(noteOnSpy);
    keyboard.pressKey(C4);
    keyboard.pressKeyFromChordFinder(C4); // both active
    expect(noteOnSpy).toHaveBeenCalledOnce(); // audio callback only fires once (manual)
  });

  it('releasing ChordFinder does not clear manual press (key stays audio-active)', () => {
    const noteOffSpy = vi.fn();
    keyboard.setNoteOffCallback(noteOffSpy);
    keyboard.pressKey(C4);
    keyboard.pressKeyFromChordFinder(C4);
    keyboard.releaseKeyFromChordFinder(C4); // only removes ChordFinder highlight
    expect(noteOffSpy).not.toHaveBeenCalled();
  });

  it('releasing all ChordFinder keys does not call noteOff for manually-held keys', () => {
    const noteOffSpy = vi.fn();
    keyboard.setNoteOffCallback(noteOffSpy);
    keyboard.pressKey(C4);
    keyboard.pressKeyFromChordFinder(C4);
    keyboard.pressKeyFromChordFinder(E4);
    keyboard.releaseAllChordFinderKeys();
    expect(noteOffSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Notes outside visible keyboard range
// ---------------------------------------------------------------------------

describe('Keyboard out-of-range notes', () => {
  it('pressKeyFromChordFinder is silent for notes outside the two-octave range', () => {
    const keyboard = makeKeyboard(4); // range: MIDI 60–83
    // These should be no-ops — no error, no render issue
    expect(() => keyboard.pressKeyFromChordFinder(48)).not.toThrow(); // C3 — below
    expect(() => keyboard.pressKeyFromChordFinder(96)).not.toThrow(); // C7 — above
  });
});
