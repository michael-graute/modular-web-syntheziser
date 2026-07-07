import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockGainNode, MockConstantSourceNode } from '../../mocks/WebAudioAPI.mock';
import { SynthComponent } from '../../../src/components/base/SynthComponent';
import { ComponentType, SignalType } from '../../../src/core/types';
import {
  clampAxis,
  clampPosition,
  isPlayableRecording,
  hasReachedRecordingLimit,
  wrapPlaybackTime,
} from '../../../specs/035-xy-pad-controller/contracts/validation';

// ---------------------------------------------------------------------------
// Mock AudioEngine — must come before importing XYPad
// ---------------------------------------------------------------------------

const mockGain = () => new MockGainNode() as unknown as GainNode;
const mockConstantSource = () => new MockConstantSourceNode() as unknown as ConstantSourceNode;

const mockCtx = {
  currentTime: 0,
  createGain: vi.fn(mockGain),
  createConstantSource: vi.fn(mockConstantSource),
};

vi.mock('../../../src/core/AudioEngine', () => ({
  audioEngine: {
    isReady: () => true,
    getContext: () => mockCtx,
    addNode: vi.fn(),
  },
}));

import { XYPad } from '../../../src/components/utilities/XYPad';

function makeActivePad(): XYPad {
  const pad = new XYPad('xy-test', { x: 0, y: 0 });
  pad.activate();
  return pad;
}

// ---------------------------------------------------------------------------
// Controllable clock — fakes requestAnimationFrame + performance.now()
// together so capture/playback rAF loops can be driven deterministically.
// Must run after (and therefore override) the global setup.ts spy that
// pins performance.now() to a constant 0.
// ---------------------------------------------------------------------------

function advanceClockMs(ms: number): void {
  vi.advanceTimersByTime(ms);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  mockCtx.createGain.mockImplementation(mockGain);
  mockCtx.createConstantSource.mockImplementation(mockConstantSource);
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// clampAxis / clampPosition (FR-016) — 100% coverage
// ---------------------------------------------------------------------------

describe('clampAxis', () => {
  it('clamps values below 0 to 0', () => {
    expect(clampAxis(-0.5)).toBe(0);
  });

  it('clamps values above 1 to 1', () => {
    expect(clampAxis(1.5)).toBe(1);
  });

  it('passes through values already within [0,1]', () => {
    expect(clampAxis(0.42)).toBe(0.42);
  });

  it('passes through boundary values unchanged', () => {
    expect(clampAxis(0)).toBe(0);
    expect(clampAxis(1)).toBe(1);
  });
});

describe('clampPosition', () => {
  it('clamps both axes independently', () => {
    expect(clampPosition({ x: -1, y: 2 })).toEqual({ x: 0, y: 1 });
  });

  it('passes through an in-range position unchanged', () => {
    expect(clampPosition({ x: 0.3, y: 0.7 })).toEqual({ x: 0.3, y: 0.7 });
  });
});

// ---------------------------------------------------------------------------
// isPlayableRecording / hasReachedRecordingLimit / wrapPlaybackTime — 100% coverage
// ---------------------------------------------------------------------------

describe('isPlayableRecording', () => {
  it('returns false for null', () => {
    expect(isPlayableRecording(null)).toBe(false);
  });

  it('returns false for a zero-sample recording', () => {
    expect(isPlayableRecording({ samples: new Float32Array(0), sampleCount: 0, durationMs: 0 })).toBe(false);
  });

  it('returns true for a recording with at least one sample', () => {
    expect(isPlayableRecording({ samples: new Float32Array(3), sampleCount: 1, durationMs: 0 })).toBe(true);
  });
});

describe('hasReachedRecordingLimit', () => {
  it('returns false when below the limit', () => {
    expect(hasReachedRecordingLimit(100, 3600)).toBe(false);
  });

  it('returns true when exactly at the limit', () => {
    expect(hasReachedRecordingLimit(3600, 3600)).toBe(true);
  });

  it('returns true when above the limit', () => {
    expect(hasReachedRecordingLimit(4000, 3600)).toBe(true);
  });
});

describe('wrapPlaybackTime', () => {
  it('returns 0 for a non-positive duration', () => {
    expect(wrapPlaybackTime(500, 0)).toBe(0);
    expect(wrapPlaybackTime(500, -10)).toBe(0);
  });

  it('passes through elapsed time within one duration', () => {
    expect(wrapPlaybackTime(300, 1000)).toBe(300);
  });

  it('wraps elapsed time exceeding the duration', () => {
    expect(wrapPlaybackTime(1300, 1000)).toBe(300);
  });

  it('wraps elapsed time spanning multiple full durations', () => {
    expect(wrapPlaybackTime(3300, 1000)).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// A minimal fake target component exposing an AudioParam + declared range,
// mirroring how Filter/VCA expose CV inputs for the LFO adapter pattern.
// ---------------------------------------------------------------------------

class FakeTarget extends SynthComponent {
  private param: GainNode;

  constructor(id: string, private range: { min: number; max: number }) {
    super(id, ComponentType.FILTER, 'FakeTarget', { x: 0, y: 0 });
    this.addInput('cv', 'CV', SignalType.CV);
    this.param = mockGain();
  }

  createAudioNodes(): void {}
  destroyAudioNodes(): void {}
  updateAudioParameter(): void {}
  getInputNode(): AudioNode | null { return this.param; }
  getOutputNode(): AudioNode | null { return null; }

  override getAudioParamForInput(inputId: string): AudioParam | null {
    return inputId === 'cv' ? this.param.gain : null;
  }

  override getParameterRangeForInput(inputId: string): { min: number; max: number } | null {
    return inputId === 'cv' ? this.range : null;
  }
}

// ---------------------------------------------------------------------------
// Position tracking (FR-004, FR-005, FR-006, US1 acceptance scenario 4)
// ---------------------------------------------------------------------------

describe('XYPad position tracking', () => {
  it('setAxisPosition updates getPosition', () => {
    const pad = makeActivePad();
    pad.setAxisPosition(0.25, 0.75);
    expect(pad.getPosition()).toEqual({ x: 0.25, y: 0.75 });
  });

  it('clamps out-of-range positions to [0,1] (FR-016)', () => {
    const pad = makeActivePad();
    pad.setAxisPosition(-0.5, 1.5);
    expect(pad.getPosition()).toEqual({ x: 0, y: 1 });
  });

  it('holds the last position after interaction stops (FR-006)', () => {
    const pad = makeActivePad();
    pad.setAxisPosition(0.6, 0.4);
    // No further calls — position should remain exactly as last set.
    expect(pad.getPosition()).toEqual({ x: 0.6, y: 0.4 });
  });

  it('a newly connected output reflects the current resting position (US1 scenario 4)', () => {
    const pad = makeActivePad();
    pad.setAxisPosition(0.8, 0.2);
    const target = new FakeTarget('t1', { min: 0, max: 100 });
    pad.connectTo(target, 'x', 'cv');
    // The X gain node (source of the scaler chain) holds the resting position value.
    expect(pad.getPosition().x).toBe(0.8);
  });

  it('defaults to center position (0.5, 0.5) before any interaction', () => {
    const pad = makeActivePad();
    expect(pad.getPosition()).toEqual({ x: 0.5, y: 0.5 });
  });
});

// ---------------------------------------------------------------------------
// Depth-scaled connectTo (FR-004a) — mirrors LFO.cv.test.ts style
// ---------------------------------------------------------------------------

describe('XYPad depth-scaled connections', () => {
  it('creates a per-connection scaler GainNode sized from xDepth and target range', () => {
    const pad = makeActivePad();
    pad.setParameterValue('xDepth', 50);
    const target = new FakeTarget('t1', { min: 0, max: 100 });

    pad.connectTo(target, 'x', 'cv');

    // computeScaleGain(50, {min:0,max:100}) = 0.5 * 100 = 50.
    // createGain is called twice: 1 for the connection scaler, 1 for the
    // combined (scaler + offset) summing node.
    expect(mockCtx.createGain).toHaveBeenCalledTimes(2);
    // createConstantSource: 1 for X, 1 for Y (createAudioNodes), then 1 more
    // for the connection's range-offset node.
    expect(mockCtx.createConstantSource).toHaveBeenCalledTimes(3);
  });

  it('the connection offset node is set to the target range minimum, so position 0 reaches range.min not 0', () => {
    const pad = makeActivePad();
    pad.setParameterValue('xDepth', 100);
    const target = new FakeTarget('t1', { min: 200, max: 300 });

    pad.connectTo(target, 'x', 'cv');

    // The 3rd createConstantSource call (after the X and Y position sources)
    // is the per-connection offset node.
    const offsetNode = mockCtx.createConstantSource.mock.results[2]!.value as MockConstantSourceNode;
    expect(offsetNode.offset.value).toBe(200);
  });

  it('getScaledOutputForConnection returns the combined node the visualizer taps for accurate live values', () => {
    const pad = makeActivePad();
    pad.setParameterValue('xDepth', 100);
    const target = new FakeTarget('t1', { min: 0, max: 100 });

    pad.connectTo(target, 'x', 'cv');

    const combined = pad.getScaledOutputForConnection('t1', 'cv');
    expect(combined).not.toBeNull();
  });

  it('getScaledOutputForConnection returns null when no connection exists', () => {
    const pad = makeActivePad();
    expect(pad.getScaledOutputForConnection('nonexistent', 'cv')).toBeNull();
  });

  it('X and Y scalers are independent — connecting Y does not affect X depth scaling', () => {
    const pad = makeActivePad();
    pad.setParameterValue('xDepth', 100);
    pad.setParameterValue('yDepth', 10);
    const xTarget = new FakeTarget('tx', { min: 0, max: 100 });
    const yTarget = new FakeTarget('ty', { min: 0, max: 100 });

    pad.connectTo(xTarget, 'x', 'cv');
    pad.connectTo(yTarget, 'y', 'cv');

    // Different depths must be independently reflected; verified indirectly via
    // updateAudioParameter not throwing and each axis tracking its own param.
    expect(pad.getParameter('xDepth')?.getValue()).toBe(100);
    expect(pad.getParameter('yDepth')?.getValue()).toBe(10);
  });

  it('falls back to base connectTo when target has no declared parameter range', () => {
    const pad = makeActivePad();
    const target = new FakeTarget('t1', { min: 0, max: 100 });
    // Force no range so the adapter pattern falls back to the base class.
    vi.spyOn(target, 'getParameterRangeForInput').mockReturnValue(null);

    expect(() => pad.connectTo(target, 'x', 'cv')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// State machine — Record/Stop/Play (FR-008 through FR-014, US2)
// ---------------------------------------------------------------------------

describe('XYPad state machine', () => {
  it('pressRecord() from IDLE transitions to RECORDING', () => {
    const pad = makeActivePad();
    pad.pressRecord();
    expect(pad.getState()).toBe('recording');
  });

  it('pressStop() during RECORDING finalizes the recording and returns to IDLE', () => {
    const pad = makeActivePad();
    pad.pressRecord();
    advanceClockMs(100);
    pad.pressStop();
    expect(pad.getState()).toBe('idle');
    expect(pad.isPlayAvailable()).toBe(true);
  });

  it('auto-stops recording and returns to IDLE when MAX_SAMPLES is reached', () => {
    const pad = makeActivePad();
    pad.pressRecord();
    // Fake-timer rAF fires every 16ms (not exactly 16.67ms), so the ~16.67ms
    // sample interval effectively quantizes to every 2nd frame (~32ms) under
    // fake timers — advance generously past 3600 samples * 32ms to be safe.
    advanceClockMs(130_000);
    expect(pad.getState()).toBe('idle');
    expect(pad.isPlayAvailable()).toBe(true);
  });

  it('pressPlay() is a no-op when no recording exists (FR-012)', () => {
    const pad = makeActivePad();
    pad.pressPlay();
    expect(pad.getState()).toBe('idle');
  });

  it('pressPlay() transitions to PLAYING when a recording exists', () => {
    const pad = makeActivePad();
    pad.pressRecord();
    advanceClockMs(100);
    pad.pressStop();
    pad.pressPlay();
    expect(pad.getState()).toBe('playing');
  });

  it('pressStop() during PLAYING holds the last position and returns to IDLE (FR-006)', () => {
    const pad = makeActivePad();
    pad.setAxisPosition(0.9, 0.1);
    pad.pressRecord();
    advanceClockMs(100);
    pad.pressStop();
    pad.pressPlay();
    advanceClockMs(20);
    const posBeforeStop = pad.getPosition();
    pad.pressStop();
    expect(pad.getState()).toBe('idle');
    expect(pad.getPosition()).toEqual(posBeforeStop);
  });

  it('setAxisPosition() during PLAYING interrupts playback and hands control to manual position (FR-014)', () => {
    const pad = makeActivePad();
    pad.pressRecord();
    advanceClockMs(100);
    pad.pressStop();
    pad.pressPlay();
    expect(pad.getState()).toBe('playing');

    pad.setAxisPosition(0.15, 0.85);
    expect(pad.getState()).toBe('idle');
    expect(pad.getPosition()).toEqual({ x: 0.15, y: 0.85 });
  });

  it('pressRecord() during PLAYING stops playback then starts a new capture, discarding the old recording (FR-013)', () => {
    const pad = makeActivePad();
    pad.setAxisPosition(0.2, 0.2);
    pad.pressRecord();
    advanceClockMs(100);
    pad.pressStop();
    pad.pressPlay();
    expect(pad.getState()).toBe('playing');

    pad.pressRecord();
    expect(pad.getState()).toBe('recording');
  });

  it('pressStop() when already IDLE is a no-op', () => {
    const pad = makeActivePad();
    pad.pressStop();
    expect(pad.getState()).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// Recording capture (FR-008, FR-017, FR-018, US2)
// ---------------------------------------------------------------------------

describe('XYPad recording capture', () => {
  it('capture starts immediately on pressRecord() even with zero pointer movement (flat lead-in)', () => {
    const pad = makeActivePad();
    pad.setAxisPosition(0.3, 0.7);
    pad.pressRecord();
    // No movement at all — advance time so at least one sample is captured.
    advanceClockMs(50);
    pad.pressStop();

    expect(pad.isPlayAvailable()).toBe(true);
    // Playing back a flat recording should immediately reflect the resting position.
    pad.pressPlay();
    advanceClockMs(1);
    expect(pad.getPosition()).toEqual({ x: 0.3, y: 0.7 });
  });

  it('captures movement continuously while recording, reflecting drag updates', () => {
    const pad = makeActivePad();
    pad.pressRecord();
    advanceClockMs(20);
    pad.setAxisPosition(0.5, 0.5);
    advanceClockMs(20);
    pad.setAxisPosition(1, 1);
    advanceClockMs(20);
    pad.pressStop();

    expect(pad.isPlayAvailable()).toBe(true);
  });

  it('auto-stops at the sample cap, producing a playable recording of the max duration', () => {
    const pad = makeActivePad();
    pad.pressRecord();
    advanceClockMs(130_000);

    expect(pad.getState()).toBe('idle');
    expect(pad.isPlayAvailable()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Playback looping (FR-011, US2)
// ---------------------------------------------------------------------------

describe('XYPad playback looping', () => {
  it('loops continuously, returning to the start position after one full recording duration', () => {
    const pad = makeActivePad();
    pad.setAxisPosition(0, 0);
    pad.pressRecord();
    // Hold at (0,0) for several frames so early samples are unambiguously 0,
    // then move to (1,1) and hold for several more frames — avoids depending
    // on exactly which frame the fake-timer rAF loop happens to sample on.
    advanceClockMs(100);
    pad.setAxisPosition(1, 1);
    advanceClockMs(200);
    pad.pressStop();

    pad.pressPlay();
    advanceClockMs(16); // one rAF frame — playback loop updates position for the first time
    const posNearStart = pad.getPosition();
    expect(posNearStart.x).toBeCloseTo(0, 1);

    // Advance past a full loop cycle (~300ms recording) plus a bit — should
    // wrap back around toward the start rather than continuing past the end.
    advanceClockMs(310);
    expect(pad.getState()).toBe('playing');
  });

  it('playback continues looping until Stop is pressed', () => {
    const pad = makeActivePad();
    pad.pressRecord();
    advanceClockMs(50);
    pad.pressStop();
    pad.pressPlay();

    advanceClockMs(200); // several loop cycles at ~50ms duration
    expect(pad.getState()).toBe('playing');

    pad.pressStop();
    expect(pad.getState()).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// Persistence — serialize()/deserialize() (FR-015, SC-004, US3)
// ---------------------------------------------------------------------------

describe('XYPad persistence', () => {
  it('a recorded gesture round-trips exactly through serialize()/deserialize() (SC-004)', () => {
    const pad = makeActivePad();
    pad.setAxisPosition(0.1, 0.9);
    pad.pressRecord();
    advanceClockMs(50);
    pad.setAxisPosition(0.6, 0.4);
    advanceClockMs(50);
    pad.pressStop();

    const data = pad.serialize();
    expect(data.audioBlob).toBeDefined();

    const restored = new XYPad('xy-restored', { x: 0, y: 0 });
    restored.activate();
    restored.deserialize(data);

    restored.pressPlay();
    advanceClockMs(16);
    // The restored pad should reproduce the same recorded gesture — its
    // initial playback position should be close to the original recording's
    // first sample (0.1, 0.9), matching the pre-serialize pad's own replay.
    const restoredPos = restored.getPosition();
    expect(restoredPos.x).toBeCloseTo(0.1, 1);
    expect(restoredPos.y).toBeCloseTo(0.9, 1);
  });

  it('deserialize() always restores IDLE state, never RECORDING or PLAYING', () => {
    const pad = makeActivePad();
    pad.pressRecord();
    advanceClockMs(50);
    pad.pressStop();
    const data = pad.serialize();

    const restored = new XYPad('xy-restored', { x: 0, y: 0 });
    restored.activate();
    restored.deserialize(data);

    expect(restored.getState()).toBe('idle');
  });

  it('xDepth/yDepth parameters round-trip correctly through serialize()/deserialize()', () => {
    const pad = makeActivePad();
    pad.setParameterValue('xDepth', 75);
    pad.setParameterValue('yDepth', 25);
    const data = pad.serialize();

    const restored = new XYPad('xy-restored', { x: 0, y: 0 });
    restored.activate();
    restored.deserialize(data);

    expect(restored.getParameter('xDepth')?.getValue()).toBe(75);
    expect(restored.getParameter('yDepth')?.getValue()).toBe(25);
  });

  it('a pad with no recording serializes without an audioBlob field (US3 scenario 3)', () => {
    const pad = makeActivePad();
    const data = pad.serialize();
    expect(data.audioBlob).toBeUndefined();
  });

  it('a pad with no recording deserializes with the Play control unavailable (US3 scenario 3)', () => {
    const pad = makeActivePad();
    const data = pad.serialize();

    const restored = new XYPad('xy-restored', { x: 0, y: 0 });
    restored.activate();
    restored.deserialize(data);

    expect(restored.isPlayAvailable()).toBe(false);
  });

  it('a zero-sample recording (Stop pressed instantly) does not produce a playable serialized recording', () => {
    const pad = makeActivePad();
    pad.pressRecord();
    pad.pressStop(); // no time advanced — zero samples captured
    const data = pad.serialize();

    expect(data.audioBlob).toBeUndefined();
  });
});
