/**
 * GestureHelpers unit tests — Phase 1 (T005)
 * All functions are pure; no DOM mocking required except for
 * getEventPosition (needs getBoundingClientRect) and isCoarsePointerDevice (needs matchMedia).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GESTURE_CONFIG,
  getEventPosition,
  isDragIntent,
  pointerDistance,
  pointerMidpoint,
  isCoarsePointerDevice,
  type ActivePointer,
  type ScreenPosition,
} from '../../src/canvas/GestureHelpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePointer(overrides: Partial<ActivePointer> = {}): ActivePointer {
  return {
    pointerId: 1,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    longPressTimer: null,
    ...overrides,
  };
}

function makePos(screenX: number, screenY: number): ScreenPosition {
  return { screenX, screenY };
}

function makePointerEvent(clientX: number, clientY: number): PointerEvent {
  return { clientX, clientY } as unknown as PointerEvent;
}

function makeCanvas(left: number, top: number): HTMLCanvasElement {
  return {
    getBoundingClientRect: () => ({ left, top, right: left + 800, bottom: top + 600, width: 800, height: 600 }),
  } as unknown as HTMLCanvasElement;
}

// ---------------------------------------------------------------------------
// GESTURE_CONFIG
// ---------------------------------------------------------------------------

describe('GESTURE_CONFIG', () => {
  it('has DRAG_THRESHOLD_PX of 8', () => {
    expect(GESTURE_CONFIG.DRAG_THRESHOLD_PX).toBe(8);
  });

  it('has LONG_PRESS_MS of 500', () => {
    expect(GESTURE_CONFIG.LONG_PRESS_MS).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// getEventPosition
// ---------------------------------------------------------------------------

describe('getEventPosition', () => {
  it('returns position relative to canvas top-left', () => {
    const canvas = makeCanvas(100, 50);
    const event = makePointerEvent(250, 130);
    const pos = getEventPosition(event, canvas);
    expect(pos.screenX).toBe(150);
    expect(pos.screenY).toBe(80);
  });

  it('returns (0, 0) when event is exactly at canvas origin', () => {
    const canvas = makeCanvas(200, 100);
    const event = makePointerEvent(200, 100);
    const pos = getEventPosition(event, canvas);
    expect(pos.screenX).toBe(0);
    expect(pos.screenY).toBe(0);
  });

  it('works with canvas at document origin', () => {
    const canvas = makeCanvas(0, 0);
    const event = makePointerEvent(42, 17);
    const pos = getEventPosition(event, canvas);
    expect(pos.screenX).toBe(42);
    expect(pos.screenY).toBe(17);
  });
});

// ---------------------------------------------------------------------------
// isDragIntent
// ---------------------------------------------------------------------------

describe('isDragIntent', () => {
  it('returns false when pointer has not moved', () => {
    expect(isDragIntent(makePointer())).toBe(false);
  });

  it('returns false when movement is exactly at the threshold', () => {
    // distance = 8px exactly — NOT greater than, so still false
    const pointer = makePointer({ currentX: 8, currentY: 0 });
    expect(isDragIntent(pointer)).toBe(false);
  });

  it('returns true when horizontal movement exceeds threshold', () => {
    const pointer = makePointer({ currentX: 9, currentY: 0 });
    expect(isDragIntent(pointer)).toBe(true);
  });

  it('returns true when vertical movement exceeds threshold', () => {
    const pointer = makePointer({ currentX: 0, currentY: 9 });
    expect(isDragIntent(pointer)).toBe(true);
  });

  it('returns true when diagonal movement exceeds threshold', () => {
    // distance = hypot(6, 6) ≈ 8.49 > 8
    const pointer = makePointer({ currentX: 6, currentY: 6 });
    expect(isDragIntent(pointer)).toBe(true);
  });

  it('returns false when diagonal movement is below threshold', () => {
    // distance = hypot(4, 4) ≈ 5.66 < 8
    const pointer = makePointer({ currentX: 4, currentY: 4 });
    expect(isDragIntent(pointer)).toBe(false);
  });

  it('works correctly with negative offsets', () => {
    const pointer = makePointer({ startX: 100, startY: 100, currentX: 91, currentY: 100 });
    expect(isDragIntent(pointer)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pointerDistance
// ---------------------------------------------------------------------------

describe('pointerDistance', () => {
  it('returns 0 for identical positions', () => {
    expect(pointerDistance(makePos(5, 10), makePos(5, 10))).toBe(0);
  });

  it('returns correct horizontal distance', () => {
    expect(pointerDistance(makePos(0, 0), makePos(5, 0))).toBe(5);
  });

  it('returns correct vertical distance', () => {
    expect(pointerDistance(makePos(0, 0), makePos(0, 12))).toBe(12);
  });

  it('returns correct diagonal distance (3-4-5 triangle)', () => {
    expect(pointerDistance(makePos(0, 0), makePos(3, 4))).toBe(5);
  });

  it('is symmetric', () => {
    const a = makePos(10, 20);
    const b = makePos(30, 50);
    expect(pointerDistance(a, b)).toBeCloseTo(pointerDistance(b, a));
  });
});

// ---------------------------------------------------------------------------
// pointerMidpoint
// ---------------------------------------------------------------------------

describe('pointerMidpoint', () => {
  it('returns the midpoint of two positions', () => {
    const mid = pointerMidpoint(makePos(0, 0), makePos(10, 20));
    expect(mid.screenX).toBe(5);
    expect(mid.screenY).toBe(10);
  });

  it('returns the same point for identical positions', () => {
    const mid = pointerMidpoint(makePos(7, 3), makePos(7, 3));
    expect(mid.screenX).toBe(7);
    expect(mid.screenY).toBe(3);
  });

  it('is symmetric', () => {
    const a = makePos(4, 8);
    const b = makePos(12, 16);
    const midAB = pointerMidpoint(a, b);
    const midBA = pointerMidpoint(b, a);
    expect(midAB.screenX).toBe(midBA.screenX);
    expect(midAB.screenY).toBe(midBA.screenY);
  });

  it('handles fractional midpoints', () => {
    const mid = pointerMidpoint(makePos(0, 0), makePos(1, 1));
    expect(mid.screenX).toBe(0.5);
    expect(mid.screenY).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// Pinch-zoom scenarios (T019) — pointerDistance + pointerMidpoint under
// realistic two-finger spread and squeeze gestures
// ---------------------------------------------------------------------------

describe('pinch-zoom: spread gesture (zoom in)', () => {
  it('distance increases when fingers move apart', () => {
    const frame1A = makePos(300, 300);
    const frame1B = makePos(500, 300);
    const frame2A = makePos(250, 300);
    const frame2B = makePos(550, 300);
    const dist1 = pointerDistance(frame1A, frame1B); // 200px
    const dist2 = pointerDistance(frame2A, frame2B); // 300px
    expect(dist2).toBeGreaterThan(dist1);
    expect(dist2 / dist1).toBeCloseTo(1.5);
  });

  it('midpoint stays stable during symmetric spread', () => {
    const mid1 = pointerMidpoint(makePos(300, 300), makePos(500, 300));
    const mid2 = pointerMidpoint(makePos(250, 300), makePos(550, 300));
    expect(mid1.screenX).toBe(mid2.screenX);
    expect(mid1.screenY).toBe(mid2.screenY);
  });
});

describe('pinch-zoom: squeeze gesture (zoom out)', () => {
  it('distance decreases when fingers move together', () => {
    const distBefore = pointerDistance(makePos(200, 400), makePos(600, 400)); // 400px
    const distAfter = pointerDistance(makePos(300, 400), makePos(500, 400));  // 200px
    expect(distAfter).toBeLessThan(distBefore);
    expect(distAfter / distBefore).toBeCloseTo(0.5);
  });
});

describe('pinch-zoom: zero distance guard', () => {
  it('distance is 0 when both fingers are at the same point', () => {
    expect(pointerDistance(makePos(400, 400), makePos(400, 400))).toBe(0);
  });

  it('scaleFactor computation is safe when prevDist > 0', () => {
    const prev = pointerDistance(makePos(300, 300), makePos(500, 300)); // 200
    const curr = pointerDistance(makePos(250, 300), makePos(550, 300)); // 300
    expect(prev).toBeGreaterThan(0);
    const scaleFactor = curr / prev;
    expect(scaleFactor).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// isCoarsePointerDevice
// ---------------------------------------------------------------------------

describe('isCoarsePointerDevice', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when matchMedia reports coarse pointer', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    expect(isCoarsePointerDevice()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(pointer: coarse)');
  });

  it('returns false when matchMedia reports fine pointer (mouse)', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    expect(isCoarsePointerDevice()).toBe(false);
  });
});
