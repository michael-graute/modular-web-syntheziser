/**
 * Looper Transport Integration Tests
 * Verifies that the Looper integrates correctly with the global transport.
 * Feature: 016-global-transport — T024
 *
 * Uses the real EventBus and MockAudioContext so transport event wiring
 * is exercised end-to-end. Fake timers prevent ScriptProcessor scheduling issues.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Looper } from '../../src/components/utilities/Looper';
import { LooperState } from '../../src/components/utilities/LooperConstants';
import { EventType } from '../../src/core/types';
import { eventBus } from '../../src/core/EventBus';
import { audioEngine } from '../../src/core/AudioEngine';
import { globalBpmController } from '../../src/core/GlobalBpmController';

// ---------------------------------------------------------------------------
// Minimal AudioContext stub for Looper — needs createScriptProcessor,
// createBuffer, createBufferSource, and createGain.
// ---------------------------------------------------------------------------

function makeLooperMockCtx() {
  const makeNode = () => ({
    gain: { value: 1 },
    buffer: null as unknown,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onaudioprocess: null as unknown,
    copyToChannel: vi.fn(),
    duration: 1,
  });

  return {
    sampleRate: 44100,
    currentTime: 0,
    createGain: () => makeNode(),
    createScriptProcessor: () => makeNode(),
    createBuffer: (_ch: number, length: number, rate: number) => ({
      ...makeNode(),
      duration: length / rate,
      copyToChannel: vi.fn(),
    }),
    createBufferSource: () => makeNode(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeActivatedLooper(): Looper {
  const looper = new Looper('test-looper-transport', { x: 0, y: 0 });
  looper.activate();
  return looper;
}

/** Force-fill a looper so _filled=true and state=PLAYING without going through
 *  the real ScriptProcessorNode recording path (which requires live audio data).
 *  We access private fields directly via `as any` — acceptable in unit tests. */
function fillLooper(looper: Looper): void {
  // Simulate a completed recording: set up the internal buffer state
  (looper as any)._filled = true;
  (looper as any)._loopBuffer = new Float32Array(44100); // 1s of silence
  (looper as any)._loopLengthSamples = 44100;
  (looper as any)._loopDurationSec = 1;
  // Manually call _startPlayback() to put the looper into PLAYING state
  (looper as any)._startPlayback();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Looper — global transport integration', () => {
  let looper: Looper;

  beforeEach(() => {
    vi.useFakeTimers();
    const mockCtx = makeLooperMockCtx();
    (audioEngine as any).context = mockCtx;
    (audioEngine as any).isInitialized = true;
    vi.spyOn(audioEngine, 'getContext').mockReturnValue(mockCtx as unknown as AudioContext);
    vi.spyOn(globalBpmController, 'getBpm').mockReturnValue(120);
    looper = makeActivatedLooper();
  });

  afterEach(() => {
    looper.deactivate();
    (audioEngine as any).context = null;
    (audioEngine as any).isInitialized = false;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // TRANSPORT_STOP
  // -------------------------------------------------------------------------

  it('transitions PLAYING → IDLE on TRANSPORT_STOP', () => {
    fillLooper(looper);
    expect(looper.state).toBe(LooperState.PLAYING);

    eventBus.emit(EventType.TRANSPORT_STOP, undefined);

    expect(looper.state).toBe(LooperState.IDLE);
  });

  it('preserves _filled flag after TRANSPORT_STOP', () => {
    fillLooper(looper);
    eventBus.emit(EventType.TRANSPORT_STOP, undefined);

    expect((looper as any)._filled).toBe(true);
  });

  it('preserves loop buffer after TRANSPORT_STOP', () => {
    fillLooper(looper);
    const bufferRef = (looper as any)._loopBuffer;
    eventBus.emit(EventType.TRANSPORT_STOP, undefined);

    expect((looper as any)._loopBuffer).toBe(bufferRef);
  });

  it('TRANSPORT_STOP is a no-op when looper is already IDLE', () => {
    expect(looper.state).toBe(LooperState.IDLE);
    expect(() => eventBus.emit(EventType.TRANSPORT_STOP, undefined)).not.toThrow();
    expect(looper.state).toBe(LooperState.IDLE);
  });

  // -------------------------------------------------------------------------
  // TRANSPORT_PLAY — loop recorded
  // -------------------------------------------------------------------------

  it('resumes playback on TRANSPORT_PLAY when loop is recorded', () => {
    fillLooper(looper);
    eventBus.emit(EventType.TRANSPORT_STOP, undefined); // stop first
    expect(looper.state).toBe(LooperState.IDLE);

    eventBus.emit(EventType.TRANSPORT_PLAY, undefined);

    expect(looper.state).toBe(LooperState.PLAYING);
  });

  it('_filled remains true after TRANSPORT_PLAY resume', () => {
    fillLooper(looper);
    eventBus.emit(EventType.TRANSPORT_STOP, undefined);
    eventBus.emit(EventType.TRANSPORT_PLAY, undefined);

    expect((looper as any)._filled).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TRANSPORT_PLAY — no loop recorded
  // -------------------------------------------------------------------------

  it('stays IDLE on TRANSPORT_PLAY when no loop is recorded', () => {
    expect((looper as any)._filled).toBe(false);
    eventBus.emit(EventType.TRANSPORT_PLAY, undefined);

    expect(looper.state).toBe(LooperState.IDLE);
  });

  it('does not start recording on TRANSPORT_PLAY (FR-008)', () => {
    eventBus.emit(EventType.TRANSPORT_PLAY, undefined);

    expect(looper.state).not.toBe(LooperState.RECORDING);
  });

  // -------------------------------------------------------------------------
  // Teardown
  // -------------------------------------------------------------------------

  it('does not respond to transport events after deactivate()', () => {
    looper.deactivate();
    expect(() => eventBus.emit(EventType.TRANSPORT_PLAY, undefined)).not.toThrow();
    expect(() => eventBus.emit(EventType.TRANSPORT_STOP, undefined)).not.toThrow();
  });
});
