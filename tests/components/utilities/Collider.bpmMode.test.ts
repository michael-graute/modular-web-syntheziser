/**
 * Collider BPM Mode Unit Tests
 *
 * Verifies US2 behaviour: global-mode subscription and local-mode override.
 * Tests use parameter-level access only — no audio nodes required.
 *
 * Feature: 013-global-bpm — T016
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Collider } from '../../../src/components/utilities/Collider';
import { EventType } from '../../../src/core/types';
import { eventBus } from '../../../src/core/EventBus';
import { globalBpmController } from '../../../src/core/GlobalBpmController';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCollider(): Collider {
  return new Collider('test-col-bpm', 'Collider', { x: 0, y: 0 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Collider BPM Mode (no audio)', () => {
  let collider: Collider;

  beforeEach(() => {
    // Clear subscriptions and reset global BPM
    eventBus.clear(EventType.GLOBAL_BPM_CHANGED);
    globalBpmController.setBpm(120);
    collider = makeCollider();
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------

  it('defaults to bpmMode=0 (global)', () => {
    expect(collider.getParameter('bpmMode')?.getValue()).toBe(0);
  });

  it('defaults to bpm=120 (BPM_DEFAULT)', () => {
    expect(collider.getParameter('bpm')?.getValue()).toBe(120);
  });

  // -----------------------------------------------------------------------
  // applyGlobalBpm — global mode
  // -----------------------------------------------------------------------

  it('applyGlobalBpm updates bpm parameter when bpmMode=0', () => {
    collider.applyGlobalBpm(160);
    expect(collider.getParameter('bpm')?.getValue()).toBe(160);
  });

  it('applyGlobalBpm also updates config.bpm when bpmMode=0', () => {
    collider.applyGlobalBpm(175);
    expect(collider.getConfiguration().bpm).toBe(175);
  });

  it('applyGlobalBpm does NOT update bpm when bpmMode=1 (local)', () => {
    collider.setParameterValue('bpmMode', 1);
    collider.applyGlobalBpm(200);
    // bpm should remain at 120 (the default)
    expect(collider.getParameter('bpm')?.getValue()).toBe(120);
  });

  it('applyGlobalBpm does NOT update config.bpm when bpmMode=1', () => {
    collider.setParameterValue('bpmMode', 1);
    collider.applyGlobalBpm(200);
    expect(collider.getConfiguration().bpm).toBe(120);
  });

  // -----------------------------------------------------------------------
  // GLOBAL_BPM_CHANGED event propagation — subscribeToGlobalBpm
  // -----------------------------------------------------------------------

  it('subscribeToGlobalBpm immediately adopts current global BPM (mode=0)', () => {
    globalBpmController.setBpm(90);
    collider.subscribeToGlobalBpm();
    expect(collider.getParameter('bpm')?.getValue()).toBe(90);
    collider.unsubscribeFromGlobalBpm();
    globalBpmController.setBpm(120); // reset
  });

  it('subscribeToGlobalBpm responds to future GLOBAL_BPM_CHANGED when mode=0', () => {
    collider.subscribeToGlobalBpm();
    eventBus.emit(EventType.GLOBAL_BPM_CHANGED, { bpm: 180 });
    expect(collider.getParameter('bpm')?.getValue()).toBe(180);
    collider.unsubscribeFromGlobalBpm();
  });

  it('subscribeToGlobalBpm does NOT update bpm when mode=1 (local)', () => {
    collider.setParameterValue('bpmMode', 1);
    collider.subscribeToGlobalBpm();
    eventBus.emit(EventType.GLOBAL_BPM_CHANGED, { bpm: 240 });
    expect(collider.getParameter('bpm')?.getValue()).not.toBe(240);
    collider.unsubscribeFromGlobalBpm();
  });

  it('unsubscribeFromGlobalBpm stops further updates', () => {
    collider.subscribeToGlobalBpm();
    eventBus.emit(EventType.GLOBAL_BPM_CHANGED, { bpm: 150 });
    expect(collider.getParameter('bpm')?.getValue()).toBe(150);

    collider.unsubscribeFromGlobalBpm();
    eventBus.emit(EventType.GLOBAL_BPM_CHANGED, { bpm: 250 });
    // Should stay at 150, not jump to 250
    expect(collider.getParameter('bpm')?.getValue()).toBe(150);
  });

  // -----------------------------------------------------------------------
  // subscribeToGlobalBpm syncs on activation regardless of prior local BPM
  // (simulates what happens when a component in global mode gets activated:
  //  createAudioNodes() calls subscribeToGlobalBpm() which resets bpm)
  // -----------------------------------------------------------------------

  it('subscribeToGlobalBpm while mode=0 resets bpm and config.bpm to current global value', () => {
    globalBpmController.setBpm(85);
    collider.setParameterValue('bpmMode', 0); // ensure global mode
    collider.subscribeToGlobalBpm(); // called by createAudioNodes() on activation
    expect(collider.getParameter('bpm')?.getValue()).toBe(85);
    expect(collider.getConfiguration().bpm).toBe(85);
    collider.unsubscribeFromGlobalBpm();
    globalBpmController.setBpm(120); // reset
  });
});

