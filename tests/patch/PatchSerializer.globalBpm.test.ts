/**
 * PatchSerializer globalBpm round-trip tests
 *
 * Verifies US3 behaviour: globalBpm is serialized into PatchData and restored
 * via GlobalBpmController.loadFromPatch on load. Legacy patches default to 120.
 *
 * Feature: 013-global-bpm — T019
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PatchSerializer } from '../../src/patch/PatchSerializer';
import { GlobalBpmController } from '../../src/core/GlobalBpmController';
import { globalBpmController } from '../../src/core/GlobalBpmController';
import { EventType } from '../../src/core/types';
import { eventBus } from '../../src/core/EventBus';
import { BPM_DEFAULT } from '../../src/core/bpmValidation';
import type { PatchData } from '../../src/core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyPatch(globalBpm?: number): PatchData {
  const patch: PatchData = {
    name: 'Test',
    version: '1.0',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    components: [],
    connections: [],
  };
  if (globalBpm !== undefined) {
    patch.globalBpm = globalBpm;
  }
  return patch;
}

// ---------------------------------------------------------------------------
// T019 — PatchSerializer.serializePatch includes globalBpm
// ---------------------------------------------------------------------------

describe('PatchSerializer — globalBpm serialization (T019)', () => {
  beforeEach(() => {
    // Reset global BPM singleton
    eventBus.clear(EventType.GLOBAL_BPM_CHANGED);
    globalBpmController.setBpm(120);
  });

  it('serializePatch includes globalBpm matching globalBpmController.getBpm()', () => {
    globalBpmController.setBpm(95);
    const patch = PatchSerializer.serializePatch('Test', [], []);
    expect(patch.globalBpm).toBe(95);
  });

  it('serializePatch reflects the current globalBpmController value', () => {
    globalBpmController.setBpm(180);
    const patch = PatchSerializer.serializePatch('Test', [], []);
    expect(patch.globalBpm).toBe(180);
  });

  it('serialized JSON string includes globalBpm field', () => {
    globalBpmController.setBpm(140);
    const patch = PatchSerializer.serializePatch('Test', [], []);
    const json = PatchSerializer.toJSON(patch);
    const parsed = JSON.parse(json);
    expect(parsed.globalBpm).toBe(140);
  });
});

// ---------------------------------------------------------------------------
// T019 — validatePatchData preserves globalBpm from stored JSON
// ---------------------------------------------------------------------------

describe('PatchSerializer.validatePatchData — globalBpm preservation', () => {
  it('preserves globalBpm when present in raw JSON object', () => {
    const raw = {
      name: 'Test',
      version: '1.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      components: [],
      connections: [],
      globalBpm: 95,
    };
    const validated = PatchSerializer.validatePatchData(raw);
    expect(validated.globalBpm).toBe(95);
  });

  it('omits globalBpm when absent in raw JSON object (legacy patch)', () => {
    const raw = {
      name: 'LegacyPatch',
      version: '1.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      components: [],
      connections: [],
    };
    const validated = PatchSerializer.validatePatchData(raw);
    expect(validated.globalBpm).toBeUndefined();
  });

  it('round-trips globalBpm through toJSON → fromJSON', () => {
    const patch = emptyPatch(95);
    const json = PatchSerializer.toJSON(patch);
    const restored = PatchSerializer.fromJSON(json);
    expect(restored.globalBpm).toBe(95);
  });
});

// ---------------------------------------------------------------------------
// T019 — GlobalBpmController.loadFromPatch restores BPM state
// ---------------------------------------------------------------------------

describe('GlobalBpmController.loadFromPatch (T019)', () => {
  let controller: GlobalBpmController;

  beforeEach(() => {
    eventBus.clear(EventType.GLOBAL_BPM_CHANGED);
    controller = new GlobalBpmController();
  });

  it('sets BPM from patch.globalBpm when present', () => {
    controller.loadFromPatch(emptyPatch(95));
    expect(controller.getBpm()).toBe(95);
  });

  it('defaults to BPM_DEFAULT (120) when globalBpm is absent (legacy patch)', () => {
    controller.setBpm(200); // set to something different first
    controller.loadFromPatch(emptyPatch()); // no globalBpm
    expect(controller.getBpm()).toBe(BPM_DEFAULT);
  });

  it('does not throw when loading a legacy patch', () => {
    expect(() => controller.loadFromPatch(emptyPatch())).not.toThrow();
  });

  it('emits GLOBAL_BPM_CHANGED when patch value differs from current', () => {
    let received = 0;
    eventBus.on(EventType.GLOBAL_BPM_CHANGED, () => { received++; });
    controller.loadFromPatch(emptyPatch(95)); // differs from 120 default
    expect(received).toBe(1);
  });

  it('does not emit GLOBAL_BPM_CHANGED when value is unchanged', () => {
    controller.setBpm(120);
    let received = 0;
    eventBus.on(EventType.GLOBAL_BPM_CHANGED, () => { received++; });
    controller.loadFromPatch(emptyPatch(120)); // same as current
    expect(received).toBe(0);
  });
});
