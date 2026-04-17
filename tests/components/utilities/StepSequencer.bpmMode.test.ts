/**
 * StepSequencer BPM Mode Unit Tests
 *
 * Verifies US2 behaviour: global-mode subscription and local-mode override.
 *
 * Feature: 013-global-bpm — T015
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StepSequencer } from '../../../src/components/utilities/StepSequencer';
import { GlobalBpmController } from '../../../src/core/GlobalBpmController';
import { EventType } from '../../../src/core/types';
import { eventBus } from '../../../src/core/EventBus';
import { globalBpmController } from '../../../src/core/GlobalBpmController';
import { audioEngine } from '../../../src/core/AudioEngine';
import { MockAudioContext } from '../../mocks/WebAudioAPI.mock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSequencer(): StepSequencer {
  return new StepSequencer('test-seq-bpm', { x: 0, y: 0 });
}

// ---------------------------------------------------------------------------
// Tests — no audio nodes, purely parameter-level
// ---------------------------------------------------------------------------

describe('StepSequencer BPM Mode (no audio)', () => {
  let seq: StepSequencer;

  beforeEach(() => {
    // Reset global BPM to known state
    eventBus.clear(EventType.GLOBAL_BPM_CHANGED);
    // Reset singleton to 120 by bypassing clamping edge-case
    globalBpmController.setBpm(120);
    seq = makeSequencer();
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------

  it('defaults to bpmMode=0 (global)', () => {
    expect(seq.getParameter('bpmMode')?.getValue()).toBe(0);
  });

  it('defaults to bpm=120 (BPM_DEFAULT)', () => {
    expect(seq.getParameter('bpm')?.getValue()).toBe(120);
  });

  // -----------------------------------------------------------------------
  // applyGlobalBpm — global mode (bpmMode=0)
  // -----------------------------------------------------------------------

  it('applyGlobalBpm updates bpm parameter when bpmMode=0', () => {
    seq.applyGlobalBpm(160);
    expect(seq.getParameter('bpm')?.getValue()).toBe(160);
  });

  it('applyGlobalBpm does NOT update bpm when bpmMode=1 (local)', () => {
    seq.setParameterValue('bpmMode', 1);
    seq.applyGlobalBpm(200);
    // bpm should remain at whatever it was before (120 default)
    expect(seq.getParameter('bpm')?.getValue()).toBe(120);
  });

  // -----------------------------------------------------------------------
  // GLOBAL_BPM_CHANGED event propagation — subscribeToGlobalBpm
  // -----------------------------------------------------------------------

  it('subscribeToGlobalBpm updates bpm when global BPM changes and mode=0', () => {
    seq.subscribeToGlobalBpm();
    // Emit a global BPM change
    eventBus.emit(EventType.GLOBAL_BPM_CHANGED, { bpm: 180 });
    expect(seq.getParameter('bpm')?.getValue()).toBe(180);
    seq.unsubscribeFromGlobalBpm();
  });

  it('subscribeToGlobalBpm does NOT update bpm when mode=1 (local)', () => {
    seq.setParameterValue('bpmMode', 1);
    seq.subscribeToGlobalBpm();
    eventBus.emit(EventType.GLOBAL_BPM_CHANGED, { bpm: 240 });
    expect(seq.getParameter('bpm')?.getValue()).not.toBe(240);
    seq.unsubscribeFromGlobalBpm();
  });

  it('subscribeToGlobalBpm immediately adopts current global BPM (mode=0)', () => {
    globalBpmController.setBpm(90);
    seq.subscribeToGlobalBpm();
    expect(seq.getParameter('bpm')?.getValue()).toBe(90);
    seq.unsubscribeFromGlobalBpm();
    globalBpmController.setBpm(120); // reset
  });

  it('unsubscribeFromGlobalBpm stops further updates', () => {
    seq.subscribeToGlobalBpm();
    eventBus.emit(EventType.GLOBAL_BPM_CHANGED, { bpm: 150 });
    expect(seq.getParameter('bpm')?.getValue()).toBe(150);

    seq.unsubscribeFromGlobalBpm();
    eventBus.emit(EventType.GLOBAL_BPM_CHANGED, { bpm: 250 });
    // bpm should remain at 150, not updated to 250
    expect(seq.getParameter('bpm')?.getValue()).toBe(150);
  });

  // -----------------------------------------------------------------------
  // subscribeToGlobalBpm syncs on activation regardless of prior local BPM
  // (simulates what happens when a component in local mode is deactivated then
  //  reactivated in global mode: createAudioNodes() calls subscribeToGlobalBpm())
  // -----------------------------------------------------------------------

  it('subscribeToGlobalBpm while mode=0 resets bpm to current global value', () => {
    globalBpmController.setBpm(85);
    seq.setParameterValue('bpmMode', 0); // ensure global mode
    seq.subscribeToGlobalBpm(); // called by createAudioNodes() on activation
    expect(seq.getParameter('bpm')?.getValue()).toBe(85);
    seq.unsubscribeFromGlobalBpm();
    globalBpmController.setBpm(120); // reset
  });
});

