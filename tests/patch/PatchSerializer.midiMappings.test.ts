import { describe, it, expect, beforeEach } from 'vitest';
import { PatchSerializer } from '../../src/patch/PatchSerializer';
import { midiEngine } from '../../src/midi/MidiEngine';
import type { MidiMapping, PatchData } from '../../src/core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validMapping(overrides: Partial<MidiMapping> = {}): MidiMapping {
  return {
    componentId: 'osc-1',
    parameterName: 'frequency',
    channel: 1,
    cc: 74,
    minValue: 20,
    maxValue: 20000,
    ...overrides,
  };
}

function resetMidiEngine(): void {
  midiEngine.clearAllMappings();
  if (midiEngine.isLearnActive()) midiEngine.cancelLearn();
  (midiEngine as any).midiAccess = null;
}

// ---------------------------------------------------------------------------
// T035 — PatchSerializer serializes midiMappings
// ---------------------------------------------------------------------------

describe('PatchSerializer — midiMappings serialization (T035)', () => {
  beforeEach(resetMidiEngine);

  it('serializePatch includes midiMappings when mappings exist', () => {
    // Load a mapping into the engine, then serialize
    const rawPatch: PatchData = {
      name: 'Test',
      version: '1.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      components: [],
      connections: [],
      midiMappings: [validMapping()],
    };
    midiEngine.loadFromPatch(rawPatch);

    const serialized = PatchSerializer.serializePatch('Test', [], []);
    expect(serialized.midiMappings).toBeDefined();
    expect(serialized.midiMappings).toHaveLength(1);
    expect(serialized.midiMappings![0]!.cc).toBe(74);
  });

  it('serializePatch includes empty midiMappings array when no mappings', () => {
    // Engine already cleared — no mappings
    const serialized = PatchSerializer.serializePatch('Test', [], []);
    // midiMappings should be [] (engine writes empty array)
    expect(Array.isArray(serialized.midiMappings)).toBe(true);
    expect(serialized.midiMappings).toHaveLength(0);
  });

  it('serialized JSON string includes midiMappings field', () => {
    midiEngine.loadFromPatch({
      name: 'T',
      version: '1.0',
      created: '',
      modified: '',
      components: [],
      connections: [],
      midiMappings: [validMapping()],
    });
    const patch = PatchSerializer.serializePatch('Test', [], []);
    const json = PatchSerializer.toJSON(patch);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed.midiMappings)).toBe(true);
    expect(parsed.midiMappings[0].cc).toBe(74);
  });
});

// ---------------------------------------------------------------------------
// T035 — validatePatchData preserves midiMappings
// ---------------------------------------------------------------------------

describe('PatchSerializer.validatePatchData — midiMappings preservation (T035)', () => {
  beforeEach(resetMidiEngine);

  it('preserves midiMappings when present in raw object', () => {
    const raw = {
      name: 'Test',
      version: '1.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      components: [],
      connections: [],
      midiMappings: [validMapping()],
    };
    const validated = PatchSerializer.validatePatchData(raw);
    expect(validated.midiMappings).toBeDefined();
    expect(validated.midiMappings).toHaveLength(1);
  });

  it('omits midiMappings when absent (legacy patch) — does not throw', () => {
    const raw = {
      name: 'LegacyPatch',
      version: '1.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      components: [],
      connections: [],
    };
    expect(() => PatchSerializer.validatePatchData(raw)).not.toThrow();
    const validated = PatchSerializer.validatePatchData(raw);
    // midiMappings absent → engine treats it as empty
    expect(validated.midiMappings === undefined || Array.isArray(validated.midiMappings)).toBe(true);
  });

  it('legacy patch loads without error and engine has no mappings', () => {
    const raw = {
      name: 'Legacy',
      version: '1.0',
      created: '',
      modified: '',
      components: [],
      connections: [],
    };
    PatchSerializer.validatePatchData(raw); // triggers midiEngine.loadFromPatch
    expect(midiEngine.getMappings()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T035 — full round-trip
// ---------------------------------------------------------------------------

describe('PatchSerializer — midiMappings round-trip (T035)', () => {
  beforeEach(resetMidiEngine);

  it('toJSON → fromJSON preserves midiMappings', () => {
    const patch: PatchData = {
      name: 'Round Trip',
      version: '1.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      components: [],
      connections: [],
      midiMappings: [validMapping()],
    };

    const json = PatchSerializer.toJSON(patch);
    const restored = PatchSerializer.fromJSON(json);

    expect(restored.midiMappings).toBeDefined();
    expect(restored.midiMappings).toHaveLength(1);
    expect(restored.midiMappings![0]!.cc).toBe(74);
    expect(restored.midiMappings![0]!.componentId).toBe('osc-1');
  });

  it('toJSON → fromJSON with no midiMappings does not throw', () => {
    const patch: PatchData = {
      name: 'No MIDI',
      version: '1.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      components: [],
      connections: [],
    };
    expect(() => {
      const json = PatchSerializer.toJSON(patch);
      PatchSerializer.fromJSON(json);
    }).not.toThrow();
  });

  it('serialize → validate restores midiMappings in engine', () => {
    midiEngine.loadFromPatch({
      name: 'T',
      version: '1.0',
      created: '',
      modified: '',
      components: [],
      connections: [],
      midiMappings: [validMapping({ cc: 1 }), validMapping({ cc: 2, parameterName: 'gain' })],
    });

    const serialized = PatchSerializer.serializePatch('Test', [], []);
    const json = PatchSerializer.toJSON(serialized);

    resetMidiEngine(); // wipe engine state
    PatchSerializer.fromJSON(json); // triggers loadFromPatch internally via validatePatchData

    expect(midiEngine.getMappings()).toHaveLength(2);
  });
});
