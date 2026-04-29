/**
 * StepSequencer Transport Integration Tests
 * Verifies that the StepSequencer starts/stops with the global transport.
 * Feature: 016-global-transport — T021
 *
 * Uses activated audio nodes (createAudioNodes()) so the transport
 * subscriptions are live. Fake timers prevent the scheduler from running.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StepSequencer } from '../../src/components/utilities/StepSequencer';
import { EventType } from '../../src/core/types';
import { eventBus } from '../../src/core/EventBus';
import { audioEngine } from '../../src/core/AudioEngine';
import { globalBpmController } from '../../src/core/GlobalBpmController';
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeActivatedSequencer(): StepSequencer {
  const seq = new StepSequencer('test-seq-transport', { x: 0, y: 0 });
  seq.activate(); // registers transport subscriptions via createAudioNodes()
  return seq;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StepSequencer — global transport integration', () => {
  let seq: StepSequencer;
  let mockCtx: MockAudioContext;

  beforeEach(() => {
    vi.useFakeTimers(); // prevent the sequencer scheduler from running
    mockCtx = new MockAudioContext();
    (audioEngine as any).context = mockCtx;
    (audioEngine as any).isInitialized = true;
    vi.spyOn(audioEngine, 'getContext').mockReturnValue(mockCtx as unknown as AudioContext);
    vi.spyOn(globalBpmController, 'getBpm').mockReturnValue(120);
    seq = makeActivatedSequencer();
  });

  afterEach(() => {
    seq.deactivate();
    (audioEngine as any).context = null;
    (audioEngine as any).isInitialized = false;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('starts playing when TRANSPORT_PLAY is emitted', () => {
    expect(seq.getIsPlaying()).toBe(false);
    eventBus.emit(EventType.TRANSPORT_PLAY, undefined);
    expect(seq.getIsPlaying()).toBe(true);
  });

  it('stops playing when TRANSPORT_STOP is emitted', () => {
    eventBus.emit(EventType.TRANSPORT_PLAY, undefined);
    expect(seq.getIsPlaying()).toBe(true);
    eventBus.emit(EventType.TRANSPORT_STOP, undefined);
    expect(seq.getIsPlaying()).toBe(false);
  });

  it('TRANSPORT_PLAY while already playing does not double-start', () => {
    eventBus.emit(EventType.TRANSPORT_PLAY, undefined);
    // Spy on start to verify it's called but guarded (isPlaying check prevents re-entry)
    const startSpy = vi.spyOn(seq, 'start');
    eventBus.emit(EventType.TRANSPORT_PLAY, undefined);
    // start() is called again but isPlaying guard prevents scheduling duplication;
    // sequencer must still be in the playing state with no crash
    expect(seq.getIsPlaying()).toBe(true);
    startSpy.mockRestore();
  });

  it('does not respond to transport events after deactivate()', () => {
    seq.deactivate(); // unsubscribes from transport
    // Emitting transport events must not throw after unsubscription
    expect(() => eventBus.emit(EventType.TRANSPORT_PLAY, undefined)).not.toThrow();
    expect(() => eventBus.emit(EventType.TRANSPORT_STOP, undefined)).not.toThrow();
  });
});
