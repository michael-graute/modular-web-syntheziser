/**
 * Looper unit tests — Phase 3 (US1) + Phase 4 (US2)
 *
 * Tests state machine, BPM sync, display state, bar count selector.
 * Uses vitest-environment-miniflare mock or jsdom; no real AudioContext required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LooperState } from '../../src/components/utilities/LooperConstants';
import { computeLoopDurationSamples } from '../../src/components/utilities/LooperConstants';

// ---------------------------------------------------------------------------
// Mock AudioEngine so Looper can be constructed without a browser context
// ---------------------------------------------------------------------------

vi.mock('../../src/core/AudioEngine', () => {
  const mockCtx = {
    sampleRate: 44100,
    currentTime: 0,
    createGain: () => ({
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createScriptProcessor: () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null as unknown,
    }),
    createBuffer: (channels: number, length: number, rate: number) => ({
      copyToChannel: vi.fn(),
      duration: length / rate,
    }),
    createBufferSource: () => ({
      buffer: null as unknown,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
  };
  return {
    audioEngine: {
      getContext: () => mockCtx,
      addNode: vi.fn(),
    },
  };
});

vi.mock('../../src/core/GlobalBpmController', () => ({
  globalBpmController: { getBpm: () => 120 },
}));

vi.mock('../../src/core/EventBus', () => ({
  eventBus: {
    on: vi.fn(() => vi.fn()), // returns unsubscribe fn
    emit: vi.fn(),
    off: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { Looper } from '../../src/components/utilities/Looper';

function makeLooper(): Looper {
  const looper = new Looper('test-looper', { x: 0, y: 0 });
  looper.activate(); // calls createAudioNodes → subscribes to BPM + keys
  return looper;
}

describe('Looper state machine', () => {
  let looper: Looper;

  beforeEach(() => {
    looper = makeLooper();
  });

  it('starts in IDLE state', () => {
    expect(looper.state).toBe(LooperState.IDLE);
  });

  it('pressRecord() transitions IDLE → RECORDING', () => {
    looper.pressRecord();
    expect(looper.state).toBe(LooperState.RECORDING);
  });

  it('pressRecord() is a no-op from RECORDING', () => {
    looper.pressRecord();
    looper.pressRecord(); // second call — no-op
    expect(looper.state).toBe(LooperState.RECORDING);
  });

  it('pressRecord() is a no-op from PLAYING (FR-001)', () => {
    looper.pressRecord();
    // Simulate buffer fill to reach PLAYING
    (looper as any)._commitRecording();
    expect(looper.state).toBe(LooperState.PLAYING);
    looper.pressRecord(); // no-op
    expect(looper.state).toBe(LooperState.PLAYING);
  });

  it('pressRecord() is a no-op from OVERDUBBING', () => {
    looper.pressRecord();
    (looper as any)._commitRecording();
    looper.pressOverdub();
    expect(looper.state).toBe(LooperState.OVERDUBBING);
    looper.pressRecord();
    expect(looper.state).toBe(LooperState.OVERDUBBING);
  });

  it('pressStop() from PLAYING → IDLE', () => {
    looper.pressRecord();
    (looper as any)._commitRecording();
    expect(looper.state).toBe(LooperState.PLAYING);
    looper.pressStop();
    expect(looper.state).toBe(LooperState.IDLE);
  });

  it('pressStop() from OVERDUBBING → PLAYING (not IDLE)', () => {
    looper.pressRecord();
    (looper as any)._commitRecording();
    looper.pressOverdub();
    looper.pressStop();
    expect(looper.state).toBe(LooperState.PLAYING);
  });

  it('pressStop() from IDLE is a no-op', () => {
    looper.pressStop();
    expect(looper.state).toBe(LooperState.IDLE);
  });

  it('pressClear() returns to IDLE from any state', () => {
    for (const setup of [
      () => {},
      () => { looper.pressRecord(); },
      () => { looper.pressRecord(); (looper as any)._commitRecording(); },
      () => {
        looper.pressRecord();
        (looper as any)._commitRecording();
        looper.pressOverdub();
      },
    ]) {
      looper = makeLooper();
      setup();
      looper.pressClear();
      expect(looper.state).toBe(LooperState.IDLE);
    }
  });
});

describe('Looper BPM integration', () => {
  it('applyGlobalBpm() stores new BPM', () => {
    const looper = makeLooper();
    looper.applyGlobalBpm(90);
    looper.pressRecord();
    // loopLengthSamples should reflect the new BPM (90), not 120
    const expected = computeLoopDurationSamples(2, 90, 44100);
    expect(looper.loopLengthSamples).toBe(expected);
  });

  it('applyGlobalBpm() does not alter an already-recorded buffer', () => {
    const looper = makeLooper();
    looper.pressRecord();
    (looper as any)._commitRecording();
    const before = looper.loopLengthSamples;
    looper.applyGlobalBpm(60); // BPM change while playing
    expect(looper.loopLengthSamples).toBe(before);
  });
});

describe('Looper display state', () => {
  it('getDisplayState() returns IDLE with zero playhead when idle', () => {
    const looper = makeLooper();
    const s = looper.getDisplayState();
    expect(s.state).toBe(LooperState.IDLE);
    expect(s.playHeadNormalized).toBe(0);
    expect(s.filled).toBe(false);
  });

  it('playHeadNormalized reflects write progress during RECORDING', () => {
    const looper = makeLooper();
    looper.pressRecord();
    // Advance write head to halfway through the buffer
    const half = Math.floor(looper.loopLengthSamples / 2);
    (looper as any)._writeHead = half;
    const s = looper.getDisplayState();
    expect(s.playHeadNormalized).toBeCloseTo(0.5, 2);
  });

  it('playHeadNormalized is 0 at start of RECORDING', () => {
    const looper = makeLooper();
    looper.pressRecord();
    expect(looper.getDisplayState().playHeadNormalized).toBe(0);
  });

  it('getDisplayState().filled is true after recording', () => {
    const looper = makeLooper();
    looper.pressRecord();
    (looper as any)._commitRecording();
    expect(looper.getDisplayState().filled).toBe(true);
  });

  it('getDisplayState().barCount reflects current selection', () => {
    const looper = makeLooper();
    expect(looper.getDisplayState().barCount).toBe(2);
    looper.setBarCount(4);
    expect(looper.getDisplayState().barCount).toBe(4);
  });

  it('playHeadNormalized is in [0, 1] during playback', () => {
    const looper = makeLooper();
    looper.pressRecord();
    (looper as any)._commitRecording();
    const s = looper.getDisplayState();
    expect(s.playHeadNormalized).toBeGreaterThanOrEqual(0);
    expect(s.playHeadNormalized).toBeLessThanOrEqual(1);
  });
});

describe('Looper playback node properties (FR-007 seamless loop)', () => {
  it('playbackSource.loopStart === 0 after _startPlayback()', () => {
    const looper = makeLooper();
    looper.pressRecord();
    (looper as any)._commitRecording();
    expect(looper.playbackSource?.loopStart).toBe(0);
  });

  it('playbackSource.loopEnd === loopLengthSamples / sampleRate', () => {
    const looper = makeLooper();
    looper.pressRecord();
    (looper as any)._commitRecording();
    const expectedEnd = looper.loopLengthSamples / 44100;
    expect(looper.playbackSource?.loopEnd).toBeCloseTo(expectedEnd);
  });

  it('playbackSource.loop === true', () => {
    const looper = makeLooper();
    looper.pressRecord();
    (looper as any)._commitRecording();
    expect(looper.playbackSource?.loop).toBe(true);
  });
});

describe('Looper buffer after clear', () => {
  it('loopBuffer is null after pressClear()', () => {
    const looper = makeLooper();
    looper.pressRecord();
    (looper as any)._commitRecording();
    looper.pressClear();
    expect(looper.loopBuffer).toBeNull();
    expect(looper.filled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 4 (US2): Bar count selection (T025)
// ---------------------------------------------------------------------------

describe('Looper setBarCount()', () => {
  it('accepts all valid bar counts (1/2/4/8)', () => {
    for (const bc of [1, 2, 4, 8] as const) {
      const looper = makeLooper();
      looper.setBarCount(bc);
      expect(looper.barCount).toBe(bc);
    }
  });

  it('rejects invalid bar counts (no-op)', () => {
    const looper = makeLooper();
    looper.setBarCount(2);
    // @ts-expect-error testing invalid input
    looper.setBarCount(3);
    expect(looper.barCount).toBe(2);
  });

  it('does not alter an already-recorded loop (FR-003)', () => {
    const looper = makeLooper();
    looper.setBarCount(4);
    looper.pressRecord();
    (looper as any)._commitRecording();
    looper.setBarCount(1); // should be ignored
    expect(looper.barCount).toBe(4);
  });

  it('computes correct loopLengthSamples for 1 bar at 120 BPM', () => {
    const looper = makeLooper();
    looper.setBarCount(1);
    looper.pressRecord();
    // 1 bar × 4 beats × 60/120 s/beat = 2 s × 44100 = 88200
    expect(looper.loopLengthSamples).toBe(88200);
  });

  it('computes correct loopLengthSamples for 4 bars at 120 BPM', () => {
    const looper = makeLooper();
    looper.setBarCount(4);
    looper.pressRecord();
    // 4 × 4 × 60/120 = 8 s × 44100 = 352800
    expect(looper.loopLengthSamples).toBe(352800);
  });

  it('computes correct loopLengthSamples for 8 bars at 120 BPM', () => {
    const looper = makeLooper();
    looper.setBarCount(8);
    looper.pressRecord();
    // 8 × 4 × 60/120 = 16 s × 44100 = 705600
    expect(looper.loopLengthSamples).toBe(705600);
  });
});

// ---------------------------------------------------------------------------
// Phase 8 (T040): serialize / deserialize
// ---------------------------------------------------------------------------

describe('Looper serialize()', () => {
  it('serialize() includes barCount in parameters', () => {
    const looper = makeLooper();
    looper.setBarCount(4);
    const data = looper.serialize();
    expect(data.parameters['barCount']).toBe(4);
  });

  it('serialize() does NOT include audioBlob when no buffer recorded', () => {
    const looper = makeLooper();
    const data = looper.serialize();
    expect(data.audioBlob).toBeUndefined();
  });

  it('serialize() includes audioBlob as valid Base64 when buffer exists', () => {
    const looper = makeLooper();
    looper.pressRecord();
    (looper as any)._commitRecording();
    const data = looper.serialize();
    expect(typeof data.audioBlob).toBe('string');
    // Valid Base64 — atob should not throw
    expect(() => atob(data.audioBlob!)).not.toThrow();
  });

  it('serialize() stateIndex is 0 for IDLE', () => {
    const looper = makeLooper();
    const data = looper.serialize();
    expect(data.parameters['stateIndex']).toBe(0);
  });

  it('serialize() stateIndex is 2 for PLAYING', () => {
    const looper = makeLooper();
    looper.pressRecord();
    (looper as any)._commitRecording();
    const data = looper.serialize();
    expect(data.parameters['stateIndex']).toBe(2);
  });
});

describe('Looper deserialize()', () => {
  it('deserialize() restores barCount', () => {
    const looper = makeLooper();
    looper.setBarCount(8);
    const data = looper.serialize();

    const restored = makeLooper();
    restored.deserialize(data);
    expect(restored.barCount).toBe(8);
  });

  it('deserialize() restores state to IDLE when stateIndex is 0', () => {
    const looper = makeLooper();
    const data = looper.serialize();
    data.parameters['stateIndex'] = 0;

    const restored = makeLooper();
    restored.deserialize(data);
    expect(restored.state).toBe(LooperState.IDLE);
  });

  it('deserialize() restores state to PLAYING when audioBlob present', () => {
    const looper = makeLooper();
    looper.pressRecord();
    (looper as any)._commitRecording();
    const data = looper.serialize();

    const restored = makeLooper();
    restored.deserialize(data);
    expect(restored.state).toBe(LooperState.PLAYING);
  });

  it('deserialize() restores loop buffer — filled is true', () => {
    const looper = makeLooper();
    looper.pressRecord();
    (looper as any)._commitRecording();
    const data = looper.serialize();

    const restored = makeLooper();
    restored.deserialize(data);
    expect(restored.filled).toBe(true);
    expect(restored.loopBuffer).not.toBeNull();
  });

  it('deserialize() does not restore RECORDING or OVERDUBBING state', () => {
    const looper = makeLooper();
    looper.pressRecord();
    (looper as any)._commitRecording();
    looper.pressOverdub();
    const data = looper.serialize(); // stateIndex = 2 (OVERDUBBING → maps to PLAYING on restore)

    const restored = makeLooper();
    restored.deserialize(data);
    expect(restored.state).not.toBe(LooperState.RECORDING);
    expect(restored.state).not.toBe(LooperState.OVERDUBBING);
  });

  it('deserialize() with invalid audioBlob falls back to IDLE', () => {
    const looper = makeLooper();
    looper.pressRecord();
    (looper as any)._commitRecording();
    const data = looper.serialize();
    data.audioBlob = 'not-valid-base64!!!';

    const restored = makeLooper();
    restored.deserialize(data);
    expect(restored.state).toBe(LooperState.IDLE);
    expect(restored.filled).toBe(false);
  });
});
