/**
 * T037 — KeyboardController reserved keys (FR-017)
 *
 * Tests that pressing '1', '2', '0' does NOT trigger noteOn on VoiceManager
 * (these keys are reserved for Looper shortcuts).
 * Tests that 'a', 's', 'd' still trigger noteOn normally.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyboardController } from '../../src/keyboard/KeyboardController';

// ---------------------------------------------------------------------------
// Canvas stub
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

function fireKeydown(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KeyboardController — reserved keys (FR-017)', () => {
  it('pressing "1" does not trigger noteOn', () => {
    const controller = makeController();
    const noteOnSpy = vi.fn();
    controller.setNoteOnCallback(noteOnSpy);
    fireKeydown('1');
    expect(noteOnSpy).not.toHaveBeenCalled();
  });

  it('pressing "2" does not trigger noteOn', () => {
    const controller = makeController();
    const noteOnSpy = vi.fn();
    controller.setNoteOnCallback(noteOnSpy);
    fireKeydown('2');
    expect(noteOnSpy).not.toHaveBeenCalled();
  });

  it('pressing "0" does not trigger noteOn', () => {
    const controller = makeController();
    const noteOnSpy = vi.fn();
    controller.setNoteOnCallback(noteOnSpy);
    fireKeydown('0');
    expect(noteOnSpy).not.toHaveBeenCalled();
  });

  it('pressing "a" still triggers noteOn at least once', () => {
    const controller = makeController();
    const noteOnSpy = vi.fn();
    controller.setNoteOnCallback(noteOnSpy);
    fireKeydown('a');
    expect(noteOnSpy).toHaveBeenCalled();
    expect(noteOnSpy).toHaveBeenCalledWith(expect.any(Number), 0.7);
  });

  it('pressing "s" still triggers noteOn', () => {
    const controller = makeController();
    const noteOnSpy = vi.fn();
    controller.setNoteOnCallback(noteOnSpy);
    fireKeydown('s');
    expect(noteOnSpy).toHaveBeenCalled();
  });

  it('pressing "d" still triggers noteOn', () => {
    const controller = makeController();
    const noteOnSpy = vi.fn();
    controller.setNoteOnCallback(noteOnSpy);
    fireKeydown('d');
    expect(noteOnSpy).toHaveBeenCalled();
  });
});
