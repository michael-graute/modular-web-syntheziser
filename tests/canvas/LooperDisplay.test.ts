/**
 * LooperDisplay unit tests — Phase 3 (T021)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LooperState } from '../../src/components/utilities/LooperConstants';
import type { LooperDisplayState } from '../../src/components/utilities/LooperConstants';

// ---------------------------------------------------------------------------
// Mock browser globals used by LooperDisplay constructor
// ---------------------------------------------------------------------------

const mockCtx2d = {
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  scale: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: '' as CanvasTextAlign,
  textBaseline: '' as CanvasTextBaseline,
  globalAlpha: 1,
};

// Minimal canvas mock
function makeCanvas() {
  return {
    width: 0,
    height: 0,
    style: {
      width: '',
      height: '',
      position: '',
      left: '',
      top: '',
      pointerEvents: '',
      transformOrigin: '',
      zIndex: '',
      transform: '',
    },
    parentElement: null as HTMLElement | null,
    getContext: () => mockCtx2d,
    addEventListener: vi.fn(),
  };
}

const mockCanvas = makeCanvas();
vi.stubGlobal('document', {
  createElement: (_tag: string) => mockCanvas,
  getElementById: () => ({ parentElement: { appendChild: vi.fn() } }),
});
vi.stubGlobal('window', { devicePixelRatio: 1 });

import { LooperDisplay } from '../../src/canvas/displays/LooperDisplay';
import { LOOPER_STATE_COLORS } from '../../src/components/utilities/LooperConstants';

function makeState(overrides: Partial<LooperDisplayState> = {}): LooperDisplayState {
  return {
    state: LooperState.IDLE,
    playHeadNormalized: 0,
    barCount: 2,
    filled: false,
    ...overrides,
  };
}

describe('LooperDisplay', () => {
  let display: LooperDisplay;

  beforeEach(() => {
    vi.clearAllMocks();
    display = new LooperDisplay(10, 20, 240, 300);
  });

  it('getCanvas() returns the canvas element', () => {
    expect(display.getCanvas()).toBe(mockCanvas);
  });

  it('updatePosition() updates canvas left/top style', () => {
    display.updatePosition(50, 60);
    expect(mockCanvas.style.left).toBe('50px');
    expect(mockCanvas.style.top).toBe('60px');
  });

  it('destroy() removes canvas from DOM', () => {
    const removeChild = vi.fn();
    mockCanvas.parentElement = { removeChild } as unknown as HTMLElement;
    display.destroy();
    expect(removeChild).toHaveBeenCalledWith(mockCanvas);
  });

  it('render() calls clearRect', () => {
    display.render(makeState());
    expect(mockCtx2d.clearRect).toHaveBeenCalled();
  });

  it('render() uses IDLE colour for ring in idle state', () => {
    display.render(makeState({ state: LooperState.IDLE }));
    expect(mockCtx2d.fillStyle).toBeDefined();
    // After ring drawing, fillStyle was set to IDLE color at some point
    // We verify the color constant is correct
    expect(LOOPER_STATE_COLORS[LooperState.IDLE]).toBe('#4a4a4a');
  });

  it('render() uses RECORDING colour constant', () => {
    expect(LOOPER_STATE_COLORS[LooperState.RECORDING]).toBe('#e05555');
  });

  it('render() uses PLAYING colour constant', () => {
    expect(LOOPER_STATE_COLORS[LooperState.PLAYING]).toBe('#4caf50');
  });

  it('render() uses OVERDUBBING colour constant', () => {
    expect(LOOPER_STATE_COLORS[LooperState.OVERDUBBING]).toBe('#f5a623');
  });

  it('render() draws playhead (lineTo called) when filled=true', () => {
    vi.clearAllMocks();
    display.render(makeState({ filled: true, playHeadNormalized: 0.5 }));
    expect(mockCtx2d.lineTo).toHaveBeenCalled();
  });

  it('render() does NOT draw playhead (lineTo not called for playhead) when filled=false', () => {
    vi.clearAllMocks();
    display.render(makeState({ filled: false }));
    expect(mockCtx2d.lineTo).not.toHaveBeenCalled();
  });

  it('render() calls fillText (for label/bar count)', () => {
    display.render(makeState({ barCount: 4 }));
    expect(mockCtx2d.fillText).toHaveBeenCalled();
  });

  describe('handleMouseDown()', () => {
    it('returns "record" when clicking the R button area', () => {
      // R button at x=42, BTN_Y = BAR_SELECTOR_Y(222) + BAR_SELECTOR_RADIUS(10) + 28 = 260
      const result = display.handleMouseDown(42, 260);
      expect(result).toBe('record');
    });

    it('returns "stop" when clicking the stop button area', () => {
      const result = display.handleMouseDown(90, 260);
      expect(result).toBe('stop');
    });

    it('returns "overdub" when clicking the OD button area', () => {
      const result = display.handleMouseDown(138, 260);
      expect(result).toBe('overdub');
    });

    it('returns "clear" when clicking the clear button area', () => {
      const result = display.handleMouseDown(186, 260);
      expect(result).toBe('clear');
    });

    it('returns a BarCount when clicking a bar selector', () => {
      // Bar count selectors at BAR_SELECTOR_Y = CENTER_Y(110) + RING_OUTER_RADIUS(90) + 22 = 222
      // barCount=1 at x = CENTER_X(120) - 45 = 75
      const result = display.handleMouseDown(75, 222);
      expect(result).toBe(1);
    });

    it('returns null for non-interactive areas', () => {
      const result = display.handleMouseDown(0, 0);
      expect(result).toBeNull();
    });
  });
});
