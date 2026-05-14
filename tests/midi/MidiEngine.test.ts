import { describe, it, expect, beforeEach, vi } from 'vitest';
import { midiEngine } from '../../src/midi/MidiEngine';
import { eventBus } from '../../src/core/EventBus';
import { EventType } from '../../src/core/types';
import type { MidiMapping, PatchData } from '../../src/core/types';

// ---------------------------------------------------------------------------
// Mock MIDIAccess / MIDIInput helpers
// ---------------------------------------------------------------------------

function makeMidiInput(id: string, name: string): MIDIInput {
  return {
    id,
    name,
    type: 'input',
    state: 'connected',
    connection: 'open',
    manufacturer: '',
    version: '',
    onmidimessage: null,
    onstatechange: null,
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MIDIInput;
}

function makeMidiAccess(inputs: MIDIInput[]): MIDIAccess {
  const inputMap = new Map(inputs.map((i) => [i.id, i]));
  return {
    inputs: inputMap,
    outputs: new Map(),
    sysexEnabled: false,
    onstatechange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MIDIAccess;
}

function makeMidiMessageEvent(data: number[]): MIDIMessageEvent {
  return {
    data: new Uint8Array(data),
  } as unknown as MIDIMessageEvent;
}

function makeValidMapping(overrides: Partial<MidiMapping> = {}): MidiMapping {
  return {
    componentId: 'comp-1',
    parameterName: 'gain',
    channel: 1,
    cc: 7,
    minValue: 0,
    maxValue: 1,
    ...overrides,
  };
}

function emptyPatch(extras: Partial<PatchData> = {}): PatchData {
  return {
    name: 'Test',
    version: '1.0',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    components: [],
    connections: [],
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// Reset engine state between tests
// ---------------------------------------------------------------------------

function resetEngine(): void {
  // Drain any active learn state
  if (midiEngine.isLearnActive()) midiEngine.cancelLearn();
  // Clear all mappings
  midiEngine.clearAllMappings();
  // Detach any active input
  midiEngine.setActiveInput(null);
  // Wipe midiAccess reference (set to null via init path or direct assignment)
  (midiEngine as any).midiAccess = null;
  (midiEngine as any).learnSession = null;
  (midiEngine as any).learnModeEnabled = false;
  (midiEngine as any).componentResolver = null;
}

// ---------------------------------------------------------------------------
// Device enumeration
// ---------------------------------------------------------------------------

describe('MidiEngine — device enumeration', () => {
  beforeEach(resetEngine);

  it('getAvailableInputs returns [] when midiAccess is null', () => {
    expect(midiEngine.getAvailableInputs()).toEqual([]);
  });

  it('getAvailableInputs returns entries from midiAccess.inputs', () => {
    const input = makeMidiInput('dev-1', 'Keyboard A');
    (midiEngine as any).midiAccess = makeMidiAccess([input]);

    const inputs = midiEngine.getAvailableInputs();
    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.id).toBe('dev-1');
    expect(inputs[0]!.name).toBe('Keyboard A');
    expect(inputs[0]!.connected).toBe(true);
  });

  it('getAvailableInputs returns multiple entries', () => {
    const a = makeMidiInput('dev-1', 'Keyboard A');
    const b = makeMidiInput('dev-2', 'Keyboard B');
    (midiEngine as any).midiAccess = makeMidiAccess([a, b]);
    expect(midiEngine.getAvailableInputs()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// setActiveInput
// ---------------------------------------------------------------------------

describe('MidiEngine — setActiveInput', () => {
  beforeEach(resetEngine);

  it('registers onmidimessage on the selected input', () => {
    const input = makeMidiInput('dev-1', 'KB');
    (midiEngine as any).midiAccess = makeMidiAccess([input]);

    midiEngine.setActiveInput('dev-1');

    expect(input.onmidimessage).toBeTruthy();
    expect(midiEngine.activeInputId).toBe('dev-1');
  });

  it('clears onmidimessage on the previous input when switching', () => {
    const a = makeMidiInput('dev-1', 'KB A');
    const b = makeMidiInput('dev-2', 'KB B');
    (midiEngine as any).midiAccess = makeMidiAccess([a, b]);

    midiEngine.setActiveInput('dev-1');
    midiEngine.setActiveInput('dev-2');

    expect(a.onmidimessage).toBeNull();
    expect(b.onmidimessage).toBeTruthy();
  });

  it('sets activeInputId to null when called with null', () => {
    const input = makeMidiInput('dev-1', 'KB');
    (midiEngine as any).midiAccess = makeMidiAccess([input]);
    midiEngine.setActiveInput('dev-1');
    midiEngine.setActiveInput(null);
    expect(midiEngine.activeInputId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Note-on / note-off dispatch via handleMidiMessage
// ---------------------------------------------------------------------------

describe('MidiEngine — note routing', () => {
  beforeEach(resetEngine);

  function dispatchMessage(data: number[]): void {
    const input = makeMidiInput('dev-1', 'KB');
    (midiEngine as any).midiAccess = makeMidiAccess([input]);
    midiEngine.setActiveInput('dev-1');
    // Call handleMidiMessage directly
    (midiEngine as any).handleMidiMessage(makeMidiMessageEvent(data));
  }

  it('0x90 with velocity > 0 emits NOTE_ON with {note, velocity, frequency}', () => {
    const received: unknown[] = [];
    const unsub = eventBus.on(EventType.NOTE_ON, (d) => received.push(d));

    dispatchMessage([0x90, 60, 100]); // ch1 note-on C4 vel=100

    expect(received).toHaveLength(1);
    const payload = received[0] as { note: number; velocity: number; frequency: number };
    expect(payload.note).toBe(60);
    expect(payload.velocity).toBeCloseTo(100 / 127, 3);
    expect(payload.frequency).toBeGreaterThan(0);
    unsub();
  });

  it('0x80 emits NOTE_OFF with {note}', () => {
    const received: unknown[] = [];
    const unsub = eventBus.on(EventType.NOTE_OFF, (d) => received.push(d));

    dispatchMessage([0x80, 60, 0]);

    expect(received).toHaveLength(1);
    expect((received[0] as { note: number }).note).toBe(60);
    unsub();
  });

  it('0x90 with velocity=0 emits NOTE_OFF (running status)', () => {
    const received: unknown[] = [];
    const unsub = eventBus.on(EventType.NOTE_OFF, (d) => received.push(d));

    dispatchMessage([0x90, 60, 0]);

    expect(received).toHaveLength(1);
    unsub();
  });

  it('does not emit NOTE_ON for CC messages (0xB0)', () => {
    const received: unknown[] = [];
    const unsub = eventBus.on(EventType.NOTE_ON, (d) => received.push(d));

    dispatchMessage([0xb0, 7, 64]);

    expect(received).toHaveLength(0);
    unsub();
  });
});

// ---------------------------------------------------------------------------
// MIDI Learn state machine
// ---------------------------------------------------------------------------

describe('MidiEngine — MIDI Learn state machine', () => {
  beforeEach(resetEngine);

  it('isLearnActive() is false initially', () => {
    expect(midiEngine.isLearnActive()).toBe(false);
  });

  it('enableLearnMode() sets learnModeEnabled and emits MIDI_LEARN_STARTED', () => {
    const events: unknown[] = [];
    const unsub = eventBus.on(EventType.MIDI_LEARN_STARTED, (d) => events.push(d));

    midiEngine.enableLearnMode();

    expect(midiEngine.isLearnActive()).toBe(true);
    expect(events).toHaveLength(1);
    unsub();
    midiEngine.cancelLearn();
  });

  it('startLearn() sets learnSession and emits MIDI_LEARN_STARTED', () => {
    const events: unknown[] = [];
    const unsub = eventBus.on(EventType.MIDI_LEARN_STARTED, (d) => events.push(d));

    midiEngine.startLearn('comp-1', 'gain');

    expect(midiEngine.isLearnActive()).toBe(true);
    expect(events).toHaveLength(1);
    const payload = events[0] as { componentId: string; parameterName: string };
    expect(payload.componentId).toBe('comp-1');
    expect(payload.parameterName).toBe('gain');
    unsub();
    midiEngine.cancelLearn();
  });

  it('cancelLearn() clears state and emits MIDI_LEARN_CANCELLED', () => {
    midiEngine.startLearn('comp-1', 'gain');

    const events: unknown[] = [];
    const unsub = eventBus.on(EventType.MIDI_LEARN_CANCELLED, (d) => events.push(d));

    midiEngine.cancelLearn();

    expect(midiEngine.isLearnActive()).toBe(false);
    expect(events).toHaveLength(1);
    unsub();
  });

  it('receiving a CC while learnSession is active completes learn and saves mapping', () => {
    const mockComponent = {
      id: 'comp-1',
      getParameterRange: vi.fn().mockReturnValue({ min: 0, max: 1 }),
      setParameterValue: vi.fn(),
    };
    midiEngine.setComponentResolver((id) => (id === 'comp-1' ? (mockComponent as any) : null));

    const completedEvents: unknown[] = [];
    const unsub = eventBus.on(EventType.MIDI_LEARN_COMPLETED, (d) => completedEvents.push(d));

    midiEngine.startLearn('comp-1', 'gain');
    // Inject a CC message directly
    (midiEngine as any).handleMidiMessage(makeMidiMessageEvent([0xb1, 7, 64])); // ch2, cc7, val64

    expect(midiEngine.isLearnActive()).toBe(false);
    expect(completedEvents).toHaveLength(1);
    const mappings = midiEngine.getMappings();
    expect(mappings).toHaveLength(1);
    expect(mappings[0]!.cc).toBe(7);
    expect(mappings[0]!.componentId).toBe('comp-1');
    expect(mappings[0]!.parameterName).toBe('gain');

    unsub();
  });
});

// ---------------------------------------------------------------------------
// CC dispatch + omni-channel matching
// ---------------------------------------------------------------------------

describe('MidiEngine — CC dispatch', () => {
  beforeEach(resetEngine);

  function loadMapping(m: MidiMapping): void {
    midiEngine.loadFromPatch(emptyPatch({ midiMappings: [m] }));
  }

  it('dispatches CC to matching mapping and calls setParameterValue', () => {
    const setParam = vi.fn();
    midiEngine.setComponentResolver((_id) => ({ setParameterValue: setParam } as any));

    loadMapping(makeValidMapping({ channel: 1, cc: 7, minValue: 0, maxValue: 1 }));
    (midiEngine as any).dispatchCc(1, 7, 127);

    expect(setParam).toHaveBeenCalledOnce();
    expect(setParam).toHaveBeenCalledWith('gain', 1);
  });

  it('channel=0 mapping (omni) matches any incoming channel', () => {
    const setParam = vi.fn();
    midiEngine.setComponentResolver((_id) => ({ setParameterValue: setParam } as any));

    loadMapping(makeValidMapping({ channel: 0, cc: 7 }));
    (midiEngine as any).dispatchCc(5, 7, 64); // ch5 → should still match omni mapping

    expect(setParam).toHaveBeenCalledOnce();
  });

  it('does not dispatch when CC number does not match', () => {
    const setParam = vi.fn();
    midiEngine.setComponentResolver((_id) => ({ setParameterValue: setParam } as any));

    loadMapping(makeValidMapping({ channel: 1, cc: 7 }));
    (midiEngine as any).dispatchCc(1, 10, 64); // cc=10 ≠ mapped cc=7

    expect(setParam).not.toHaveBeenCalled();
  });

  it('does not dispatch when channel is specific and incoming channel differs', () => {
    const setParam = vi.fn();
    midiEngine.setComponentResolver((_id) => ({ setParameterValue: setParam } as any));

    loadMapping(makeValidMapping({ channel: 2, cc: 7 }));
    (midiEngine as any).dispatchCc(3, 7, 64); // ch3 ≠ mapped ch2

    expect(setParam).not.toHaveBeenCalled();
  });

  it('scales cc value using scaleCcToParam', () => {
    const setParam = vi.fn();
    midiEngine.setComponentResolver((_id) => ({ setParameterValue: setParam } as any));

    loadMapping(makeValidMapping({ channel: 1, cc: 7, minValue: 0, maxValue: 100 }));
    (midiEngine as any).dispatchCc(1, 7, 0);

    expect(setParam).toHaveBeenCalledWith('gain', 0);
  });
});

// ---------------------------------------------------------------------------
// removeMapping / clearAllMappings
// ---------------------------------------------------------------------------

describe('MidiEngine — mapping management', () => {
  beforeEach(resetEngine);

  it('getMappings returns all loaded mappings', () => {
    midiEngine.loadFromPatch(emptyPatch({ midiMappings: [makeValidMapping({ cc: 1 }), makeValidMapping({ cc: 2, parameterName: 'cutoff' })] }));
    expect(midiEngine.getMappings()).toHaveLength(2);
  });

  it('removeMapping deletes the target mapping and emits MIDI_MAPPINGS_CHANGED', () => {
    midiEngine.loadFromPatch(emptyPatch({ midiMappings: [makeValidMapping()] }));
    const events: unknown[] = [];
    const unsub = eventBus.on(EventType.MIDI_MAPPINGS_CHANGED, (d) => events.push(d));

    midiEngine.removeMapping('comp-1', 'gain');

    expect(midiEngine.getMappings()).toHaveLength(0);
    expect(events).toHaveLength(1);
    unsub();
  });

  it('clearAllMappings removes all and emits MIDI_MAPPINGS_CHANGED', () => {
    midiEngine.loadFromPatch(emptyPatch({ midiMappings: [makeValidMapping({ cc: 1 }), makeValidMapping({ cc: 2, parameterName: 'cutoff' })] }));
    const events: unknown[] = [];
    const unsub = eventBus.on(EventType.MIDI_MAPPINGS_CHANGED, (d) => events.push(d));

    midiEngine.clearAllMappings();

    expect(midiEngine.getMappings()).toHaveLength(0);
    expect(events).toHaveLength(1);
    unsub();
  });
});

// ---------------------------------------------------------------------------
// saveToPatch / loadFromPatch round-trip
// ---------------------------------------------------------------------------

describe('MidiEngine — patch round-trip', () => {
  beforeEach(resetEngine);

  it('saveToPatch writes midiMappings into the patch object', () => {
    midiEngine.loadFromPatch(emptyPatch({ midiMappings: [makeValidMapping()] }));
    const patch = emptyPatch();
    midiEngine.saveToPatch(patch);
    expect(patch.midiMappings).toHaveLength(1);
    expect(patch.midiMappings![0]!.cc).toBe(7);
  });

  it('loadFromPatch restores mappings from valid midiMappings array', () => {
    const m = makeValidMapping({ cc: 74 });
    midiEngine.loadFromPatch(emptyPatch({ midiMappings: [m] }));
    const mappings = midiEngine.getMappings();
    expect(mappings).toHaveLength(1);
    expect(mappings[0]!.cc).toBe(74);
  });

  it('loadFromPatch with undefined midiMappings results in empty registry', () => {
    midiEngine.loadFromPatch(emptyPatch({ midiMappings: [makeValidMapping()] })); // pre-populate
    midiEngine.loadFromPatch(emptyPatch()); // no midiMappings field
    expect(midiEngine.getMappings()).toHaveLength(0);
  });

  it('loadFromPatch filters out invalid entries', () => {
    const patch = emptyPatch({ midiMappings: [makeValidMapping(), { cc: -1 } as any] });
    midiEngine.loadFromPatch(patch);
    expect(midiEngine.getMappings()).toHaveLength(1);
  });

  it('full round-trip: save → load restores same mappings', () => {
    midiEngine.loadFromPatch(emptyPatch({ midiMappings: [makeValidMapping()] }));
    const patch = emptyPatch();
    midiEngine.saveToPatch(patch);

    resetEngine();
    midiEngine.loadFromPatch(patch);

    const mappings = midiEngine.getMappings();
    expect(mappings).toHaveLength(1);
    expect(mappings[0]!.cc).toBe(7);
    expect(mappings[0]!.componentId).toBe('comp-1');
  });
});
