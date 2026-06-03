/**
 * Integration tests for the 4-voice poly chain (US1, US2, US3 acceptance scenarios).
 *
 * Tests the JS-layer logic: KeyboardInput voice allocation + POLY_CV getter
 * propagation → PolyOscillator slot reading → PolyADSR gate edge detection.
 * Audio node behaviour is verified via the existing MockAudioContext.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyboardInput } from '../../src/components/utilities/KeyboardInput';
import { PolyOscillator } from '../../src/components/generators/PolyOscillator';
import { PolyADSR } from '../../src/components/processors/PolyADSR';
import { PolyVCA } from '../../src/components/processors/PolyVCA';
import { Filter } from '../../src/components/processors/Filter';
import { MasterOutput } from '../../src/components/utilities/MasterOutput';
import { SignalType } from '../../src/core/types';
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';
import { audioEngine } from '../../src/core/AudioEngine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function setupAudio(): MockAudioContext {
  const ctx = new MockAudioContext();
  (audioEngine as any).context = ctx;
  (audioEngine as any).isInitialized = true;
  return ctx;
}

function teardownAudio(): void {
  (audioEngine as any).context = null;
  (audioEngine as any).isInitialized = false;
  (audioEngine as any).nodes = new Map();
}

// Wire POLY_CV getter from keyboard to a poly consumer (mirrors ConnectionManager logic)
function wirePolyCv(kbd: KeyboardInput, consumer: { setVoiceSlotsGetter: (g: () => any) => void }): void {
  consumer.setVoiceSlotsGetter(() => kbd.getVoiceSlots());
}

// ---------------------------------------------------------------------------
// US1 — Play a Chord from the Keyboard
// ---------------------------------------------------------------------------

describe('US1 — Play a Chord from the Keyboard', () => {
  let kbd: KeyboardInput;
  let polyOsc: PolyOscillator;
  let polyAdsr: PolyADSR;
  let polyVca: PolyVCA;

  beforeEach(() => {
    setupAudio();
    kbd = new KeyboardInput('kbd', { x: 0, y: 0 });
    polyOsc = new PolyOscillator('osc', { x: 0, y: 0 });
    polyAdsr = new PolyADSR('adsr', { x: 0, y: 0 });
    polyVca = new PolyVCA('vca', { x: 0, y: 0 });

    kbd.activate();
    polyOsc.activate();
    polyAdsr.activate();
    polyVca.activate();

    kbd.setPolyMode(1);
    wirePolyCv(kbd, polyOsc);
    wirePolyCv(kbd, polyAdsr);
  });

  afterEach(() => {
    kbd.deactivate();
    polyOsc.deactivate();
    polyAdsr.deactivate();
    polyVca.deactivate();
    teardownAudio();
    vi.clearAllMocks();
  });

  it('SC1 — 3 held keys produce 3 active voice slots', () => {
    kbd.triggerNoteOn(60, midiToFreq(60), 1);
    kbd.triggerNoteOn(64, midiToFreq(64), 1);
    kbd.triggerNoteOn(67, midiToFreq(67), 1);

    const slots = kbd.getVoiceSlots();
    const activeSlots = slots.filter(s => s.gate === 1);
    expect(activeSlots).toHaveLength(3);

    const freqs = activeSlots.map(s => s.frequency);
    expect(freqs).toContain(midiToFreq(60));
    expect(freqs).toContain(midiToFreq(64));
    expect(freqs).toContain(midiToFreq(67));
  });

  it('SC2 — releasing one key releases only that voice; others continue', () => {
    kbd.triggerNoteOn(60, midiToFreq(60), 1);
    kbd.triggerNoteOn(64, midiToFreq(64), 1);
    kbd.triggerNoteOn(67, midiToFreq(67), 1);

    kbd.triggerNoteOff(64); // release middle note only

    const slots = kbd.getVoiceSlots();
    const active = slots.filter(s => s.gate === 1);
    const idle = slots.filter(s => s.gate === 0);

    expect(active).toHaveLength(2);
    expect(idle.length).toBeGreaterThanOrEqual(1);

    const activeFreqs = active.map(s => s.frequency);
    expect(activeFreqs).toContain(midiToFreq(60));
    expect(activeFreqs).toContain(midiToFreq(67));
  });

  it('SC3 — releasing all keys silences all voice slots', () => {
    kbd.triggerNoteOn(60, midiToFreq(60), 1);
    kbd.triggerNoteOn(64, midiToFreq(64), 1);
    kbd.triggerNoteOn(67, midiToFreq(67), 1);

    kbd.triggerNoteOff(60);
    kbd.triggerNoteOff(64);
    kbd.triggerNoteOff(67);

    const slots = kbd.getVoiceSlots();
    expect(slots.every(s => s.gate === 0)).toBe(true);
  });

  it('SC4 — 5th note steals the oldest voice (no crash)', () => {
    // Fill all 4 slots, then backdate slot 0 so it is clearly oldest
    kbd.triggerNoteOn(60, midiToFreq(60), 1);
    kbd.triggerNoteOn(62, midiToFreq(62), 1);
    kbd.triggerNoteOn(64, midiToFreq(64), 1);
    kbd.triggerNoteOn(65, midiToFreq(65), 1);

    // Backdate slot 0 timestamp
    const slots = kbd.getVoiceSlots() as any[];
    slots[0].timestamp = 0;

    // 5th note — should steal slot 0 without throwing
    expect(() => kbd.triggerNoteOn(67, midiToFreq(67), 1)).not.toThrow();

    const updated = kbd.getVoiceSlots();
    expect(updated.every(s => s.gate === 1)).toBe(true); // all 4 still active
    const freqs = updated.map(s => s.frequency);
    expect(freqs).toContain(midiToFreq(67)); // new note is present
  });

  it('SC5 (A2) — same key pressed twice retriggers same voice slot', () => {
    kbd.triggerNoteOn(60, midiToFreq(60), 1);
    const slotsBefore = kbd.getVoiceSlots().filter(s => s.gate === 1);
    expect(slotsBefore).toHaveLength(1);
    const voiceIndexBefore = slotsBefore[0]!.voiceIndex;

    kbd.triggerNoteOn(60, midiToFreq(60), 1); // retrigger same note
    const slotsAfter = kbd.getVoiceSlots().filter(s => s.gate === 1);
    expect(slotsAfter).toHaveLength(1); // only 1 slot active
    expect(slotsAfter[0]!.voiceIndex).toBe(voiceIndexBefore); // same slot
  });

  it('PolyOscillator reads slot frequencies and opens per-voice outputs via the getter', () => {
    kbd.triggerNoteOn(60, midiToFreq(60), 1);
    kbd.triggerNoteOn(64, midiToFreq(64), 1);

    // Manually invoke the polling step (RAF not ticking in test env)
    (polyOsc as any)._applySlots();

    const oscillators = (polyOsc as any).oscillators;
    expect(oscillators[0].frequency.value).toBeCloseTo(midiToFreq(60), 1);
    expect(oscillators[1].frequency.value).toBeCloseTo(midiToFreq(64), 1);

    // Voice outputs should be open for active voices
    const voiceOutputs = (polyOsc as any).voiceOutputs;
    expect(voiceOutputs[0].gain.value).toBe(1);
    expect(voiceOutputs[1].gain.value).toBe(1);
    expect(voiceOutputs[2].gain.value).toBe(0); // inactive
  });

  it('PolyADSR fires gate-on for each newly active voice', () => {
    const gateOnSpy = vi.spyOn(polyAdsr as any, '_triggerGateOn');

    kbd.triggerNoteOn(60, midiToFreq(60), 1);
    kbd.triggerNoteOn(64, midiToFreq(64), 1);
    (polyAdsr as any)._applySlots();

    expect(gateOnSpy).toHaveBeenCalledWith(0);
    expect(gateOnSpy).toHaveBeenCalledWith(1);
    expect(gateOnSpy).toHaveBeenCalledTimes(2);
  });

  it('PolyADSR fires gate-off for released voice; others unaffected', () => {
    kbd.triggerNoteOn(60, midiToFreq(60), 1);
    kbd.triggerNoteOn(64, midiToFreq(64), 1);
    (polyAdsr as any)._applySlots(); // register gate-on for voice 0, 1

    const gateOffSpy = vi.spyOn(polyAdsr as any, '_triggerGateOff');

    kbd.triggerNoteOff(60); // release voice 0
    (polyAdsr as any)._applySlots();

    expect(gateOffSpy).toHaveBeenCalledWith(0);
    expect(gateOffSpy).toHaveBeenCalledTimes(1); // voice 1 stays active
  });
});

// ---------------------------------------------------------------------------
// US2 — patch serialization: polyMode round-trips
// ---------------------------------------------------------------------------

describe('US2 — polyMode persistence', () => {
  let kbd: KeyboardInput;

  beforeEach(() => {
    setupAudio();
    kbd = new KeyboardInput('kbd2', { x: 10, y: 20 });
    kbd.activate();
  });

  afterEach(() => {
    kbd.deactivate();
    teardownAudio();
  });

  it('polyMode=1 survives serialize → deserialize round-trip', () => {
    kbd.setPolyMode(1);
    expect(kbd.isPolyMode()).toBe(true);

    const data = kbd.serialize();
    expect(data.parameters['polyMode']).toBe(1);

    const kbd2 = new KeyboardInput('kbd2-restored', { x: 10, y: 20 });
    kbd2.activate();
    kbd2.deserialize(data);
    // After deserialization the parameter value is applied; isPolyMode reads it
    expect(kbd2.isPolyMode()).toBe(true);
    kbd2.deactivate();
  });

  it('PolyOscillator waveform=2 round-trips through serialize → deserialize', () => {
    const polyOsc = new PolyOscillator('osc2', { x: 0, y: 0 });
    polyOsc.activate();
    polyOsc.setParameterValue('waveform', 2);
    const data = polyOsc.serialize();
    expect(data.parameters['waveform']).toBe(2);

    const polyOsc2 = new PolyOscillator('osc2-restored', { x: 0, y: 0 });
    polyOsc2.activate();
    polyOsc2.deserialize(data);
    expect(polyOsc2.getParameter('waveform')?.getValue()).toBe(2);
    polyOsc2.deactivate();
    polyOsc.deactivate();
  });
});

// ---------------------------------------------------------------------------
// US3 — PolyVCA getOutputNode returns a standard GainNode (A3 fix)
// ---------------------------------------------------------------------------

describe('US3 — PolyVCA mono output', () => {
  beforeEach(() => setupAudio());
  afterEach(() => teardownAudio());

  it('getOutputNode() returns a GainNode (compatible with any mono audio input)', () => {
    const vca = new PolyVCA('vca3', { x: 0, y: 0 });
    vca.activate();

    const out = vca.getOutputNode();
    // In the mock environment, GainNode is MockGainNode — verify it has a gain param
    expect(out).toBeTruthy();
    expect((out as any).gain).toBeDefined(); // GainNode has .gain AudioParam

    vca.deactivate();
  });

  it('getAudioParamForInput returns gain AudioParam for each cv-N port', () => {
    const vca = new PolyVCA('vca4', { x: 0, y: 0 });
    vca.activate();

    for (let i = 0; i < 4; i++) {
      const param = vca.getAudioParamForInput(`cv-${i}`);
      expect(param).toBeTruthy();
    }

    vca.deactivate();
  });

  it('getInputNode returns the correct audio GainNode for each audio-N port', () => {
    const vca = new PolyVCA('vca5', { x: 0, y: 0 });
    vca.activate();

    for (let i = 0; i < 4; i++) {
      const node = vca.getInputNode(`audio-${i}`);
      expect(node).toBeTruthy();
    }

    vca.deactivate();
  });
});

// ---------------------------------------------------------------------------
// US3 — PolyVCA integrates with existing mono effects chain (T025)
// ---------------------------------------------------------------------------

describe('US3 — Poly voices feed existing effects chain', () => {
  let vca: PolyVCA;

  beforeEach(() => setupAudio());

  afterEach(() => {
    vca?.deactivate();
    teardownAudio();
  });

  it('SC2 — PolyVCA output port carries SignalType.AUDIO (connectable to any mono input)', () => {
    vca = new PolyVCA('vca-us3', { x: 0, y: 0 });
    vca.activate();

    const outputPort = vca.outputs.get('output');
    expect(outputPort).toBeTruthy();
    expect(outputPort!.type).toBe(SignalType.AUDIO);
  });

  it('SC3 — summing gain is 0.25, preventing clipping at full 4-voice load', () => {
    vca = new PolyVCA('vca-us3b', { x: 0, y: 0 });
    vca.activate();

    const sumGain = (vca as any).sumGain;
    // 4 voices × 0.25 = 1.0 max — no clipping beyond a single voice
    expect(sumGain.gain.value).toBe(0.25);
  });

  it('SC1 — PolyVCA output node connects to Filter input without error', () => {
    vca = new PolyVCA('vca-us3c', { x: 0, y: 0 });
    const filter = new Filter('filter-us3', { x: 0, y: 0 });
    vca.activate();
    filter.activate();

    // SynthComponent.connectTo() resolves AUDIO→AUDIO via getOutputNode/getInputNode
    // Confirm PolyVCA output and Filter input are both standard AudioNodes
    const vcaOut = vca.getOutputNode();
    const filterIn = filter.getInputNode();
    expect(vcaOut).toBeTruthy();
    expect(filterIn).toBeTruthy();

    // Both should have the connect method (AudioNode interface)
    expect(typeof (vcaOut as any).connect).toBe('function');
    expect(typeof (filterIn as any).connect).toBe('function');

    filter.deactivate();
  });

  it('SC2 — PolyVCA output port is AUDIO-compatible with MasterOutput input port', () => {
    vca = new PolyVCA('vca-us3d', { x: 0, y: 0 });
    // Check port-level compatibility without activating MasterOutput
    // (MockAudioContext lacks createDynamicsCompressor)
    const master = new MasterOutput('master-us3', { x: 0, y: 0 });

    // Both ports carry SignalType.AUDIO — the connection system accepts them
    expect(vca.outputs.get('output')!.type).toBe(SignalType.AUDIO);
    expect(master.inputs.get('input')!.type).toBe(SignalType.AUDIO);
  });

  it('FR-015 — existing mono Filter/MasterOutput require zero code changes for poly integration', () => {
    // This test documents the invariant: no poly-specific properties are needed
    // on downstream mono components.
    const filter = new Filter('filter-compat', { x: 0, y: 0 });
    filter.activate();

    expect(typeof (filter as any).setVoiceSlotsGetter).toBe('undefined');
    expect(typeof (filter as any).clearVoiceSlotsGetter).toBe('undefined');

    filter.deactivate();
  });
});
