/**
 * GlobalTransportController Unit Tests
 * State machine, beat scheduling, and BPM-change behaviour.
 * Feature: 016-global-transport — T009, T017, T019
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventType, TransportBeatPayload } from '../../src/core/types';
import { eventBus } from '../../src/core/EventBus';
import { audioEngine } from '../../src/core/AudioEngine';
import { globalBpmController } from '../../src/core/GlobalBpmController';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// We import the class directly so we can create fresh instances per test,
// bypassing the singleton for isolation.
import { GlobalTransportController, TransportState } from '../../src/core/GlobalTransportController';

let mockCurrentTime = 0;

function makeController(): GlobalTransportController {
  return new GlobalTransportController();
}

// ---------------------------------------------------------------------------
// State Machine (T009)
// ---------------------------------------------------------------------------

describe('GlobalTransportController — state machine', () => {
  let ctrl: GlobalTransportController;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCurrentTime = 0;
    (audioEngine as any).context = { currentTime: mockCurrentTime };
    (audioEngine as any).isInitialized = true;
    // Stub getContext to return mocked context
    vi.spyOn(audioEngine, 'getContext').mockReturnValue({ currentTime: mockCurrentTime } as AudioContext);
    vi.spyOn(globalBpmController, 'getBpm').mockReturnValue(120);
    ctrl = makeController();
  });

  afterEach(() => {
    ctrl.stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('starts in STOPPED state', () => {
    expect(ctrl.getState()).toBe(TransportState.STOPPED);
  });

  it('transitions to PLAYING on play()', () => {
    ctrl.play();
    expect(ctrl.getState()).toBe(TransportState.PLAYING);
  });

  it('transitions back to STOPPED on stop()', () => {
    ctrl.play();
    ctrl.stop();
    expect(ctrl.getState()).toBe(TransportState.STOPPED);
  });

  it('play() is a no-op when already PLAYING', () => {
    ctrl.play();
    const playEmit = vi.spyOn(eventBus, 'emit');
    ctrl.play(); // second call
    const transportPlayCalls = playEmit.mock.calls.filter(
      ([event]) => event === EventType.TRANSPORT_PLAY
    );
    expect(transportPlayCalls).toHaveLength(0);
    expect(ctrl.getState()).toBe(TransportState.PLAYING);
  });

  it('stop() is a no-op when already STOPPED', () => {
    const stopEmit = vi.spyOn(eventBus, 'emit');
    ctrl.stop(); // never played
    const transportStopCalls = stopEmit.mock.calls.filter(
      ([event]) => event === EventType.TRANSPORT_STOP
    );
    expect(transportStopCalls).toHaveLength(0);
    expect(ctrl.getState()).toBe(TransportState.STOPPED);
  });

  it('emits TRANSPORT_PLAY on play()', () => {
    const emit = vi.spyOn(eventBus, 'emit');
    ctrl.play();
    expect(emit).toHaveBeenCalledWith(EventType.TRANSPORT_PLAY, undefined);
  });

  it('emits TRANSPORT_STOP on stop()', () => {
    ctrl.play();
    const emit = vi.spyOn(eventBus, 'emit');
    ctrl.stop();
    expect(emit).toHaveBeenCalledWith(EventType.TRANSPORT_STOP, undefined);
  });

  it('position resets to bar 1 beat 1 on stop()', () => {
    ctrl.play();
    // Advance fake timers to generate beats
    vi.advanceTimersByTime(2000);
    ctrl.stop();
    const pos = ctrl.getPosition();
    expect(pos.bar).toBe(1);
    expect(pos.beat).toBe(1);
  });

  it('position is bar 1 beat 1 immediately after play()', () => {
    ctrl.play();
    const pos = ctrl.getPosition();
    expect(pos.bar).toBe(1);
    expect(pos.beat).toBe(1);
  });

  it('getPosition() returns a copy, not a mutable reference', () => {
    ctrl.play();
    const pos = ctrl.getPosition();
    pos.bar = 999;
    expect(ctrl.getPosition().bar).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Beat clock (T017)
// ---------------------------------------------------------------------------

describe('GlobalTransportController — beat clock', () => {
  let ctrl: GlobalTransportController;
  const BPM = 120; // beat interval = 500ms

  beforeEach(() => {
    vi.useFakeTimers();
    mockCurrentTime = 0;
    vi.spyOn(audioEngine, 'getContext').mockReturnValue({ currentTime: 0 } as AudioContext);
    vi.spyOn(globalBpmController, 'getBpm').mockReturnValue(BPM);
    ctrl = makeController();
  });

  afterEach(() => {
    ctrl.stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('emits TRANSPORT_BEAT on the first beat tick', () => {
    const beats: TransportBeatPayload[] = [];
    eventBus.on(EventType.TRANSPORT_BEAT, (payload) => {
      beats.push(payload as TransportBeatPayload);
    });
    ctrl.play();
    vi.advanceTimersByTime(600); // one beat at 120 BPM = 500ms
    expect(beats.length).toBeGreaterThanOrEqual(1);
    expect(beats[0]).toMatchObject({ bar: 1, beat: 1 });
  });

  it('beat position advances: 1.1 → 1.2 → 1.3 → 1.4 → 2.1', () => {
    // With static AudioContext.currentTime=0, each scheduler tick accumulates
    // delay = (nextBeatTime - 0) * 1000 - 25. Advance far enough for 5 ticks.
    const beats: TransportBeatPayload[] = [];
    eventBus.on(EventType.TRANSPORT_BEAT, (payload) => {
      beats.push(payload as TransportBeatPayload);
    });
    ctrl.play();
    vi.advanceTimersByTime(6000); // covers 5 beats with static ctx.currentTime
    expect(beats[0]).toMatchObject({ bar: 1, beat: 1 });
    expect(beats[1]).toMatchObject({ bar: 1, beat: 2 });
    expect(beats[2]).toMatchObject({ bar: 1, beat: 3 });
    expect(beats[3]).toMatchObject({ bar: 1, beat: 4 });
    expect(beats[4]).toMatchObject({ bar: 2, beat: 1 });
  });

  it('no TRANSPORT_BEAT emitted after stop()', () => {
    const beats: TransportBeatPayload[] = [];
    eventBus.on(EventType.TRANSPORT_BEAT, (payload) => {
      beats.push(payload as TransportBeatPayload);
    });
    ctrl.play();
    vi.advanceTimersByTime(600);
    const countBeforeStop = beats.length;
    ctrl.stop();
    vi.advanceTimersByTime(2000);
    expect(beats.length).toBe(countBeforeStop);
  });
});

// ---------------------------------------------------------------------------
// BPM change while playing (T019)
// ---------------------------------------------------------------------------

describe('GlobalTransportController — BPM change while playing', () => {
  let ctrl: GlobalTransportController;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(audioEngine, 'getContext').mockReturnValue({ currentTime: 0 } as AudioContext);
    vi.spyOn(globalBpmController, 'getBpm').mockReturnValue(120);
    ctrl = makeController();
  });

  afterEach(() => {
    ctrl.stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('transport remains PLAYING after BPM change', () => {
    ctrl.play();
    vi.advanceTimersByTime(300);
    // Simulate BPM change event
    eventBus.emit(EventType.GLOBAL_BPM_CHANGED, { bpm: 60 });
    expect(ctrl.getState()).toBe(TransportState.PLAYING);
  });

  it('position is not reset by BPM change', () => {
    ctrl.play();
    vi.advanceTimersByTime(600); // advance past first beat
    const posBefore = ctrl.getPosition();
    eventBus.emit(EventType.GLOBAL_BPM_CHANGED, { bpm: 60 });
    const posAfter = ctrl.getPosition();
    // Position should be the same (not reset to 1.1)
    expect(posAfter.bar).toBe(posBefore.bar);
    expect(posAfter.beat).toBe(posBefore.beat);
  });

  it('BPM change while stopped has no effect on state', () => {
    eventBus.emit(EventType.GLOBAL_BPM_CHANGED, { bpm: 60 });
    expect(ctrl.getState()).toBe(TransportState.STOPPED);
    expect(ctrl.getPosition()).toMatchObject({ bar: 1, beat: 1 });
  });
});
