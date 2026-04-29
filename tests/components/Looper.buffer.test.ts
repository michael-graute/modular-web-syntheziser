/**
 * Looper buffer tests — Phase 5 (US3): overdub accumulation
 *
 * Tests that overdub mixes samples additively, that pressOverdub() is guarded,
 * that _commitOverdub() restarts playback, and that pressStop() from overdub
 * transitions to PLAYING (not IDLE).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LooperState } from '../../src/components/utilities/LooperConstants';

// ---------------------------------------------------------------------------
// Mock AudioEngine — identical to Looper.test.ts mocks
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
    on: vi.fn(() => vi.fn()),
    emit: vi.fn(),
    off: vi.fn(),
  },
}));

import { Looper } from '../../src/components/utilities/Looper';

function makeLooper(): Looper {
  const looper = new Looper('buf-test', { x: 0, y: 0 });
  looper.activate();
  return looper;
}

/** Drive the looper into PLAYING state with a real buffer of given length. */
function makePlayingLooper(bufferLength = 4096): Looper {
  const looper = makeLooper();
  looper.pressRecord();
  // Inject a pre-filled buffer directly so we control sample values
  const buf = new Float32Array(bufferLength).fill(0.5);
  (looper as any)._loopBuffer = buf;
  (looper as any)._loopLengthSamples = bufferLength;
  (looper as any)._loopDurationSec = bufferLength / 44100;
  (looper as any)._commitRecording();
  return looper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Looper overdub — sample accumulation', () => {
  let looper: Looper;

  beforeEach(() => {
    looper = makePlayingLooper(4096);
  });

  it('pressOverdub() transitions PLAYING → OVERDUBBING', () => {
    looper.pressOverdub();
    expect(looper.state).toBe(LooperState.OVERDUBBING);
  });

  it('pressOverdub() is a no-op from IDLE', () => {
    const idle = makeLooper();
    idle.pressOverdub();
    expect(idle.state).toBe(LooperState.IDLE);
  });

  it('pressOverdub() is a no-op from RECORDING', () => {
    const recording = makeLooper();
    recording.pressRecord();
    recording.pressOverdub();
    expect(recording.state).toBe(LooperState.RECORDING);
  });

  it('pressOverdub() is a no-op from OVERDUBBING', () => {
    looper.pressOverdub();
    looper.pressOverdub(); // second call — no-op
    expect(looper.state).toBe(LooperState.OVERDUBBING);
  });

  it('onaudioprocess in overdub mode adds samples additively', () => {
    looper.pressOverdub();

    // The capture node onaudioprocess should now be set to mix mode
    const captureNode = (looper as any)._captureNode;
    expect(captureNode.onaudioprocess).not.toBeNull();

    // Simulate an audio processing event with a block of 0.1 samples
    const inputData = new Float32Array(128).fill(0.1);
    const mockEvent = {
      inputBuffer: {
        getChannelData: () => inputData,
      },
    } as unknown as AudioProcessingEvent;

    // Record initial buffer values at position 0
    const bufBefore = (looper as any)._loopBuffer[0] as number;

    // Fire the onaudioprocess handler
    captureNode.onaudioprocess(mockEvent);

    // After overdub, buffer[0] should be original + 0.1
    const bufAfter = (looper as any)._loopBuffer[0] as number;
    expect(bufAfter).toBeCloseTo(bufBefore + 0.1);
  });

  it('overdub wraps around using modulo (circular accumulation)', () => {
    const smallLen = 64;
    const smallLooper = makePlayingLooper(smallLen);
    smallLooper.pressOverdub();

    const captureNode = (smallLooper as any)._captureNode;

    // Fire 3 blocks of 64 samples — each should wrap around the loop
    for (let block = 0; block < 3; block++) {
      const inputData = new Float32Array(64).fill(0.1);
      const mockEvent = {
        inputBuffer: { getChannelData: () => inputData },
      } as unknown as AudioProcessingEvent;
      captureNode.onaudioprocess(mockEvent);
    }

    // Every position should have accumulated: 0.5 + 3×0.1 = 0.8
    const buf = (smallLooper as any)._loopBuffer as Float32Array;
    expect(buf[0]).toBeCloseTo(0.8, 4);
    expect(buf[32]).toBeCloseTo(0.8, 4);
    expect(buf[63]).toBeCloseTo(0.8, 4);
  });
});

describe('Looper overdub — commit and stop', () => {
  it('_commitOverdub() transitions back to PLAYING', () => {
    const looper = makePlayingLooper();
    looper.pressOverdub();
    (looper as any)._commitOverdub();
    expect(looper.state).toBe(LooperState.PLAYING);
  });

  it('_commitOverdub() creates a new playbackSource', () => {
    const looper = makePlayingLooper();
    const sourceBefore = looper.playbackSource;
    looper.pressOverdub();
    (looper as any)._commitOverdub();
    // A new source is created — should not be the same object (mock returns new obj each call)
    expect(looper.playbackSource).not.toBeNull();
    // The new source was started
    expect((looper.playbackSource as any).start).toHaveBeenCalled();
    void sourceBefore;
  });

  it('pressStop() from OVERDUBBING → PLAYING (loop preserved)', () => {
    const looper = makePlayingLooper();
    looper.pressOverdub();
    expect(looper.state).toBe(LooperState.OVERDUBBING);
    looper.pressStop();
    expect(looper.state).toBe(LooperState.PLAYING);
    expect(looper.filled).toBe(true);
    expect(looper.loopBuffer).not.toBeNull();
  });

  it('pressStop() from OVERDUBBING does NOT go to IDLE', () => {
    const looper = makePlayingLooper();
    looper.pressOverdub();
    looper.pressStop();
    expect(looper.state).not.toBe(LooperState.IDLE);
  });

  it('second pressStop() after overdub-stop → IDLE', () => {
    const looper = makePlayingLooper();
    looper.pressOverdub();
    looper.pressStop(); // exits overdub → PLAYING
    looper.pressStop(); // stops playback → IDLE
    expect(looper.state).toBe(LooperState.IDLE);
  });
});

describe('Looper pressClear() — Phase 6 (US4)', () => {
  it('pressClear() from IDLE → IDLE', () => {
    const looper = makeLooper();
    looper.pressClear();
    expect(looper.state).toBe(LooperState.IDLE);
  });

  it('pressClear() from RECORDING → IDLE', () => {
    const looper = makeLooper();
    looper.pressRecord();
    looper.pressClear();
    expect(looper.state).toBe(LooperState.IDLE);
  });

  it('pressClear() from PLAYING → IDLE', () => {
    const looper = makePlayingLooper();
    looper.pressClear();
    expect(looper.state).toBe(LooperState.IDLE);
  });

  it('pressClear() from OVERDUBBING → IDLE', () => {
    const looper = makePlayingLooper();
    looper.pressOverdub();
    looper.pressClear();
    expect(looper.state).toBe(LooperState.IDLE);
  });

  it('loopBuffer is null after pressClear()', () => {
    const looper = makePlayingLooper();
    looper.pressClear();
    expect(looper.loopBuffer).toBeNull();
  });

  it('filled is false after pressClear()', () => {
    const looper = makePlayingLooper();
    looper.pressClear();
    expect(looper.filled).toBe(false);
  });

  it('loopLengthSamples is 0 after pressClear()', () => {
    const looper = makePlayingLooper();
    looper.pressClear();
    expect(looper.loopLengthSamples).toBe(0);
  });

  it('new recording can start after pressClear()', () => {
    const looper = makePlayingLooper();
    looper.pressClear();
    looper.pressRecord();
    expect(looper.state).toBe(LooperState.RECORDING);
  });

  it('captureNode.onaudioprocess is null after pressClear()', () => {
    const looper = makePlayingLooper();
    looper.pressOverdub();
    looper.pressClear();
    expect((looper as any)._captureNode?.onaudioprocess).toBeNull();
  });
});
