/**
 * GlobalBpmController Unit Tests
 *
 * Verifies the global BPM singleton: clamping, event emission,
 * patch serialization/deserialization, and legacy patch compatibility.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GlobalBpmController } from '../../../src/core/GlobalBpmController';
import { EventType } from '../../../src/core/types';
import { eventBus } from '../../../src/core/EventBus';
import { BPM_DEFAULT } from '../../../src/core/bpmValidation';

describe('GlobalBpmController', () => {
  let controller: GlobalBpmController;

  beforeEach(() => {
    // Use a fresh instance per test to avoid singleton state bleed
    controller = new GlobalBpmController();
    eventBus.clear(EventType.GLOBAL_BPM_CHANGED);
  });

  // -------------------------------------------------------------------------
  // getBpm
  // -------------------------------------------------------------------------

  describe('getBpm', () => {
    it('returns BPM_DEFAULT (120) on a fresh instance', () => {
      expect(controller.getBpm()).toBe(BPM_DEFAULT);
    });
  });

  // -------------------------------------------------------------------------
  // setBpm — clamping
  // -------------------------------------------------------------------------

  describe('setBpm — clamping', () => {
    it('clamps values below 30 to 30', () => {
      controller.setBpm(10);
      expect(controller.getBpm()).toBe(30);
    });

    it('clamps values above 300 to 300', () => {
      controller.setBpm(999);
      expect(controller.getBpm()).toBe(300);
    });

    it('accepts the minimum boundary value (30)', () => {
      controller.setBpm(30);
      expect(controller.getBpm()).toBe(30);
    });

    it('accepts the maximum boundary value (300)', () => {
      controller.setBpm(300);
      expect(controller.getBpm()).toBe(300);
    });

    it('rounds fractional values to the nearest integer', () => {
      controller.setBpm(120.6);
      expect(controller.getBpm()).toBe(121);
    });

    it('clamps non-finite values (Infinity) to BPM_MIN', () => {
      controller.setBpm(Infinity);
      expect(controller.getBpm()).toBe(30);
    });

    it('clamps non-finite values (-Infinity) to BPM_MIN', () => {
      controller.setBpm(-Infinity);
      expect(controller.getBpm()).toBe(30);
    });
  });

  // -------------------------------------------------------------------------
  // setBpm — event emission
  // -------------------------------------------------------------------------

  describe('setBpm — event emission', () => {
    it('emits GLOBAL_BPM_CHANGED with the clamped BPM when the value changes', () => {
      const handler = vi.fn();
      eventBus.on(EventType.GLOBAL_BPM_CHANGED, handler);

      controller.setBpm(140);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ bpm: 140 });
    });

    it('does NOT emit GLOBAL_BPM_CHANGED when the value is unchanged', () => {
      controller.setBpm(120); // first call — changes from default 120 to 120 (no-op, same value)
      const handler = vi.fn();
      eventBus.on(EventType.GLOBAL_BPM_CHANGED, handler);

      controller.setBpm(120); // same value again
      expect(handler).not.toHaveBeenCalled();
    });

    it('emits with the clamped value, not the raw input', () => {
      const handler = vi.fn();
      eventBus.on(EventType.GLOBAL_BPM_CHANGED, handler);

      controller.setBpm(500); // above max
      expect(handler).toHaveBeenCalledWith({ bpm: 300 });
    });

    // SC-001 timing gate: event is dispatched synchronously (same call-stack turn)
    it('dispatches the event synchronously so subscribers receive it before setBpm returns', () => {
      let receivedInsideCall = false;

      eventBus.on(EventType.GLOBAL_BPM_CHANGED, () => {
        receivedInsideCall = true;
      });

      controller.setBpm(160);

      // If the event were async, receivedInsideCall would still be false here
      expect(receivedInsideCall).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // loadFromPatch
  // -------------------------------------------------------------------------

  describe('loadFromPatch', () => {
    const basePatch = {
      name: 'Test',
      version: '1.0',
      created: '',
      modified: '',
      components: [],
      connections: [],
    };

    it('reads the globalBpm field when present', () => {
      controller.loadFromPatch({ ...basePatch, globalBpm: 95 });
      expect(controller.getBpm()).toBe(95);
    });

    it('defaults to BPM_DEFAULT (120) when globalBpm is absent (legacy patch)', () => {
      controller.setBpm(180); // set to something other than default first
      controller.loadFromPatch(basePatch); // no globalBpm field
      expect(controller.getBpm()).toBe(BPM_DEFAULT);
    });

    it('clamps an out-of-range globalBpm value in the patch', () => {
      controller.loadFromPatch({ ...basePatch, globalBpm: 999 });
      expect(controller.getBpm()).toBe(300);
    });

    it('emits GLOBAL_BPM_CHANGED after loading a patch with a different BPM', () => {
      const handler = vi.fn();
      eventBus.on(EventType.GLOBAL_BPM_CHANGED, handler);

      controller.loadFromPatch({ ...basePatch, globalBpm: 95 });
      expect(handler).toHaveBeenCalledWith({ bpm: 95 });
    });
  });

  // -------------------------------------------------------------------------
  // saveToPatch
  // -------------------------------------------------------------------------

  describe('saveToPatch', () => {
    it('injects the current BPM as globalBpm into the returned patch', () => {
      controller.setBpm(140);
      const patch = { name: 'p', version: '1.0', created: '', modified: '', components: [], connections: [] };
      const saved = controller.saveToPatch(patch);
      expect(saved.globalBpm).toBe(140);
    });

    it('does not mutate the original patch object', () => {
      const patch = { name: 'p', version: '1.0', created: '', modified: '', components: [], connections: [] };
      controller.saveToPatch(patch);
      expect((patch as any).globalBpm).toBeUndefined();
    });

    it('preserves all existing patch fields', () => {
      const patch = { name: 'MyPatch', version: '1.0', created: 'c', modified: 'm', components: [], connections: [] };
      controller.setBpm(88);
      const saved = controller.saveToPatch(patch);
      expect(saved.name).toBe('MyPatch');
      expect(saved.globalBpm).toBe(88);
    });
  });
});
