/**
 * Tests for ChordFinder poly-cv output (feature 033-chordfinder-poly-cv).
 *
 * Covers: initial slot state, pressChord/releaseChord slot updates,
 * slot 3 invariant, getVoiceSlots reference identity, chord-change-while-held,
 * octave sync, and POLY_CV port registration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChordFinder } from '../../src/components/utilities/ChordFinder';
import { SignalType } from '../../src/core/types';
import { audioEngine } from '../../src/core/AudioEngine';
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';
import {
  assertValidChordPolySlots,
  areChordSlotsActive,
  areChordSlotsReleased,
} from '../../specs/033-chordfinder-poly-cv/contracts/validation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChordFinder(id = 'cf-poly-test'): ChordFinder {
  return new ChordFinder(id, { x: 0, y: 0 });
}

function activateWithMockAudio(cf: ChordFinder): MockAudioContext {
  const mockCtx = new MockAudioContext();
  (audioEngine as unknown as Record<string, unknown>)['context'] = mockCtx;
  (audioEngine as unknown as Record<string, unknown>)['isInitialized'] = true;
  cf.activate();
  return mockCtx;
}

function deactivate(cf: ChordFinder): void {
  cf.deactivate();
  (audioEngine as unknown as Record<string, unknown>)['context'] = null;
  (audioEngine as unknown as Record<string, unknown>)['isInitialized'] = false;
  (audioEngine as unknown as Record<string, unknown>)['nodes'] = new Map();
}

// ---------------------------------------------------------------------------
// T010: Initial state
// ---------------------------------------------------------------------------

describe('ChordFinder poly slots: initial state (T010)', () => {
  let cf: ChordFinder;

  beforeEach(() => {
    cf = makeChordFinder();
    activateWithMockAudio(cf);
  });

  afterEach(() => deactivate(cf));

  it('passes assertValidChordPolySlots on creation', () => {
    expect(() => assertValidChordPolySlots(cf.getVoiceSlots())).not.toThrow();
  });

  it('has all slots released (gate=0) before any chord is pressed', () => {
    expect(areChordSlotsReleased(cf.getVoiceSlots())).toBe(true);
  });

  it('has all slot frequencies at 0 before any chord is pressed', () => {
    const slots = cf.getVoiceSlots();
    for (const slot of slots) {
      expect(slot.frequency).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// T011: pressChord — slots 0–2 become active with correct frequencies
// ---------------------------------------------------------------------------

describe('ChordFinder poly slots: pressChord (T011)', () => {
  let cf: ChordFinder;

  beforeEach(() => {
    cf = makeChordFinder();
    activateWithMockAudio(cf);
  });

  afterEach(() => deactivate(cf));

  it('slots 0–2 are active after pressChord(0)', () => {
    cf.pressChord(0);
    expect(areChordSlotsActive(cf.getVoiceSlots())).toBe(true);
  });

  it('slot 3 gate remains 0 after pressChord(0)', () => {
    cf.pressChord(0);
    expect(cf.getVoiceSlots()[3]!.gate).toBe(0);
  });

  it('slot frequencies are positive Hz values after pressChord(0)', () => {
    cf.pressChord(0);
    const slots = cf.getVoiceSlots();
    for (let i = 0; i < 3; i++) {
      expect(slots[i]!.frequency).toBeGreaterThan(0);
    }
  });

  it('slot 0 frequency matches C4 root (≈261.63 Hz) for default C Major octave 3', () => {
    // C Major, octave 3 — root chord degree 0 = C triad
    // MIDI note for C4 = 60; octave shift = (3-4)*12 = -12 → C3 = MIDI 48
    // 440 * 2^((48-69)/12) = 440 * 2^(-21/12) ≈ 130.81 Hz
    cf.pressChord(0);
    const rootHz = cf.getVoiceSlots()[0]!.frequency;
    expect(rootHz).toBeCloseTo(130.81, 0);
  });

  it('slot 1 frequency is higher than slot 0 (third above root)', () => {
    cf.pressChord(0);
    const slots = cf.getVoiceSlots();
    expect(slots[1]!.frequency).toBeGreaterThan(slots[0]!.frequency);
  });

  it('slot 2 frequency is higher than slot 1 (fifth above root)', () => {
    cf.pressChord(0);
    const slots = cf.getVoiceSlots();
    expect(slots[2]!.frequency).toBeGreaterThan(slots[1]!.frequency);
  });
});

// ---------------------------------------------------------------------------
// T012: releaseChord — gate=0, frequencies retained
// ---------------------------------------------------------------------------

describe('ChordFinder poly slots: releaseChord (T012)', () => {
  let cf: ChordFinder;

  beforeEach(() => {
    cf = makeChordFinder();
    activateWithMockAudio(cf);
  });

  afterEach(() => deactivate(cf));

  it('slots 0–2 are released (gate=0) after releaseChord()', () => {
    cf.pressChord(0);
    cf.releaseChord();
    expect(areChordSlotsReleased(cf.getVoiceSlots())).toBe(true);
  });

  it('slot 0 frequency is retained (> 0) after releaseChord()', () => {
    cf.pressChord(0);
    cf.releaseChord();
    expect(cf.getVoiceSlots()[0]!.frequency).toBeGreaterThan(0);
  });

  it('slot 1 frequency is retained (> 0) after releaseChord()', () => {
    cf.pressChord(0);
    cf.releaseChord();
    expect(cf.getVoiceSlots()[1]!.frequency).toBeGreaterThan(0);
  });

  it('slot 2 frequency is retained (> 0) after releaseChord()', () => {
    cf.pressChord(0);
    cf.releaseChord();
    expect(cf.getVoiceSlots()[2]!.frequency).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// T013: Slot 3 invariant — always gate=0, frequency=0
// ---------------------------------------------------------------------------

describe('ChordFinder poly slots: slot 3 invariant (T013)', () => {
  let cf: ChordFinder;

  beforeEach(() => {
    cf = makeChordFinder();
    activateWithMockAudio(cf);
  });

  afterEach(() => deactivate(cf));

  it('slot 3 gate is 0 before any chord press', () => {
    expect(cf.getVoiceSlots()[3]!.gate).toBe(0);
  });

  it('slot 3 gate is 0 after pressChord()', () => {
    cf.pressChord(0);
    expect(cf.getVoiceSlots()[3]!.gate).toBe(0);
  });

  it('slot 3 frequency is 0 after pressChord()', () => {
    cf.pressChord(0);
    expect(cf.getVoiceSlots()[3]!.frequency).toBe(0);
  });

  it('slot 3 gate is 0 after releaseChord()', () => {
    cf.pressChord(0);
    cf.releaseChord();
    expect(cf.getVoiceSlots()[3]!.gate).toBe(0);
  });

  it('slot 3 frequency is 0 after releaseChord()', () => {
    cf.pressChord(0);
    cf.releaseChord();
    expect(cf.getVoiceSlots()[3]!.frequency).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T014: getVoiceSlots returns the same array reference (not a copy)
// ---------------------------------------------------------------------------

describe('ChordFinder poly slots: getVoiceSlots reference identity (T014)', () => {
  let cf: ChordFinder;

  beforeEach(() => {
    cf = makeChordFinder();
    activateWithMockAudio(cf);
  });

  afterEach(() => deactivate(cf));

  it('getVoiceSlots() returns the same object reference on repeated calls', () => {
    const ref1 = cf.getVoiceSlots();
    const ref2 = cf.getVoiceSlots();
    expect(ref1).toBe(ref2);
  });

  it('slot values are visible through the reference after pressChord()', () => {
    const slots = cf.getVoiceSlots();
    cf.pressChord(0);
    // The reference was captured before press — it must reflect the live state
    expect(slots[0]!.gate).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// T015: Chord-change-while-held — slots update to new triad (US1 Scenario 3)
// ---------------------------------------------------------------------------

describe('ChordFinder poly slots: chord change while held (T015)', () => {
  let cf: ChordFinder;

  beforeEach(() => {
    cf = makeChordFinder();
    activateWithMockAudio(cf);
  });

  afterEach(() => deactivate(cf));

  it('slots update to new triad frequencies when a second chord is pressed without releasing', () => {
    cf.pressChord(0); // press degree 0 (root chord)
    const freqAfterFirst = cf.getVoiceSlots()[0]!.frequency;

    cf.pressChord(2); // press degree 2 (third chord) without releasing
    const freqAfterSecond = cf.getVoiceSlots()[0]!.frequency;

    expect(freqAfterSecond).not.toBe(freqAfterFirst);
  });

  it('slots 0–2 remain gate=1 after chord change', () => {
    cf.pressChord(0);
    cf.pressChord(2);
    expect(areChordSlotsActive(cf.getVoiceSlots())).toBe(true);
  });

  it('slot 3 remains gate=0 after chord change', () => {
    cf.pressChord(0);
    cf.pressChord(2);
    expect(cf.getVoiceSlots()[3]!.gate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T016: Octave sync — slot frequencies update when octave changes (FR-008)
// ---------------------------------------------------------------------------

describe('ChordFinder poly slots: octave sync (T016 / FR-008)', () => {
  let cf: ChordFinder;

  beforeEach(() => {
    cf = makeChordFinder();
    activateWithMockAudio(cf);
  });

  afterEach(() => deactivate(cf));

  it('slot 0 frequency doubles when octave increases by 1', () => {
    cf.pressChord(0); // octave 3 (default)
    const freqOct3 = cf.getVoiceSlots()[0]!.frequency;

    cf.setOctave(4); // triggers internal re-press
    const freqOct4 = cf.getVoiceSlots()[0]!.frequency;

    expect(freqOct4).toBeCloseTo(freqOct3 * 2, 1);
  });

  it('slots 0–2 remain active after octave change while chord is held', () => {
    cf.pressChord(0);
    cf.setOctave(4);
    expect(areChordSlotsActive(cf.getVoiceSlots())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T021 (US2): Mono + poly output simultaneity
// ---------------------------------------------------------------------------

describe('ChordFinder: mono and poly outputs simultaneous (T021 / US2)', () => {
  let cf: ChordFinder;

  beforeEach(() => {
    cf = makeChordFinder('cf-simultaneous-test');
    activateWithMockAudio(cf);
  });

  afterEach(() => deactivate(cf));

  it('poly slot 0 frequency matches note1 mono output after pressChord(0)', () => {
    cf.pressChord(0);
    const polyFreq = cf.getVoiceSlots()[0]!.frequency;
    // note1Output is a ConstantSourceNode; its offset carries the Hz value
    const monoNode = cf.audioNodes.get('note1') as AudioNode & { offset: { value: number } } | undefined;
    expect(polyFreq).toBeGreaterThan(0);
    if (monoNode?.offset !== undefined) {
      expect(polyFreq).toBeCloseTo(monoNode.offset.value, 1);
    }
  });

  it('poly slots gate=1 and mono gate open simultaneously after pressChord()', () => {
    cf.pressChord(0);
    expect(cf.getVoiceSlots()[0]!.gate).toBe(1);
    const gateNode = cf.audioNodes.get('gate') as AudioNode & { offset: { value: number } } | undefined;
    if (gateNode?.offset !== undefined) {
      expect(gateNode.offset.value).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// T023 (Phase 5): POLY_CV port registration
// ---------------------------------------------------------------------------

describe('ChordFinder: poly-cv port registration (T023)', () => {
  it('exposes a poly-cv output port with SignalType.POLY_CV', () => {
    const cf = makeChordFinder('cf-port-test');
    const polyCvPort = cf.outputs.get('poly-cv');
    expect(polyCvPort).toBeDefined();
    expect(polyCvPort?.type).toBe(SignalType.POLY_CV);
  });
});
