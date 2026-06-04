import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyboardInput } from '../../src/components/utilities/KeyboardInput';
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';
import { audioEngine } from '../../src/core/AudioEngine';

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

describe('KeyboardInput — poly mode switching', () => {
  let kbd: KeyboardInput;

  beforeEach(() => {
    const ctx = new MockAudioContext();
    (audioEngine as any).context = ctx;
    (audioEngine as any).isInitialized = true;
    kbd = new KeyboardInput('test-kbd', { x: 0, y: 0 });
    kbd.activate();
  });

  afterEach(() => {
    kbd.deactivate();
    (audioEngine as any).context = null;
    (audioEngine as any).isInitialized = false;
    (audioEngine as any).nodes = new Map();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Default state
  // -------------------------------------------------------------------------

  describe('default state', () => {
    it('starts in mono mode (polyMode parameter = 0)', () => {
      expect(kbd.isPolyMode()).toBe(false);
      expect(kbd.getParameter('polyMode')?.getValue()).toBe(0);
    });

    it('exposes a poly-cv output port', () => {
      expect(kbd.outputs.has('poly-cv')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Switching to poly mode
  // -------------------------------------------------------------------------

  describe('switching to poly mode', () => {
    it('isPolyMode() returns true after setPolyMode(1)', () => {
      kbd.setPolyMode(1);
      expect(kbd.isPolyMode()).toBe(true);
    });

    it('populates voice slots when keys are pressed in poly mode', () => {
      kbd.setPolyMode(1);
      kbd.triggerNoteOn(60, midiToFreq(60), 1);
      kbd.triggerNoteOn(64, midiToFreq(64), 1);
      kbd.triggerNoteOn(67, midiToFreq(67), 1);

      const active = kbd.getVoiceSlots().filter(s => s.gate === 1);
      expect(active).toHaveLength(3);
    });

    it('getGateValue() returns 0 in poly mode (mono gate is frozen, U3 fix)', () => {
      kbd.setPolyMode(1);
      kbd.triggerNoteOn(60, midiToFreq(60), 1);
      // Mono gate is locked to 0; poly consumers use getVoiceSlots() instead
      expect(kbd.getGateValue()).toBe(0);
    });

    it('freezes the mono gateNode to 0 when entering poly mode (SC-003)', () => {
      kbd.setPolyMode(1);
      const gateNode = (kbd as any).gateNode;
      expect(gateNode.offset.value).toBe(0);
    });

    it('freezes the mono velocityNode to 0 when entering poly mode', () => {
      kbd.setPolyMode(1);
      const velocityNode = (kbd as any).velocityNode;
      expect(velocityNode.offset.value).toBe(0);
    });

    it('releases all voice allocator slots when switching to poly mode', () => {
      // Pre-load some mono notes to prove releaseAll is called
      kbd.triggerNoteOn(60, midiToFreq(60), 1);
      kbd.setPolyMode(1);
      // VoiceAllocator should start fresh
      expect(kbd.getVoiceSlots().every(s => s.gate === 0)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Switching back to mono mode
  // -------------------------------------------------------------------------

  describe('switching back to mono mode', () => {
    beforeEach(() => {
      kbd.setPolyMode(1);
      kbd.triggerNoteOn(60, midiToFreq(60), 1);
      kbd.triggerNoteOn(64, midiToFreq(64), 1);
    });

    it('isPolyMode() returns false after setPolyMode(0)', () => {
      kbd.setPolyMode(0);
      expect(kbd.isPolyMode()).toBe(false);
    });

    it('releases all poly voices when switching to mono', () => {
      kbd.setPolyMode(0);
      expect(kbd.getVoiceSlots().every(s => s.gate === 0)).toBe(true);
    });

    it('restores mono gate node to 0 (ready state) on switch to mono', () => {
      kbd.setPolyMode(0);
      const gateNode = (kbd as any).gateNode;
      expect(gateNode.offset.value).toBe(0);
    });

    it('mono mode: multiple keys → only last-key frequency active, single gate', () => {
      kbd.setPolyMode(0);
      kbd.triggerNoteOn(60, midiToFreq(60), 1);
      kbd.triggerNoteOn(64, midiToFreq(64), 1);

      // In mono, last note wins for frequency; gate is 1
      expect(kbd.getGateValue()).toBe(1);
      expect(kbd.getCurrentFrequency()).toBeCloseTo(midiToFreq(64), 1);
    });

    it('mono mode: releasing last key closes the gate', () => {
      kbd.setPolyMode(0);
      kbd.triggerNoteOn(60, midiToFreq(60), 1);
      kbd.triggerNoteOff(60);
      expect(kbd.getGateValue()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  describe('serialization', () => {
    it('polyMode=1 is persisted in serialize() output', () => {
      kbd.setPolyMode(1);
      const data = kbd.serialize();
      expect(data.parameters['polyMode']).toBe(1);
    });

    it('polyMode=0 is persisted in serialize() output', () => {
      // Default is 0; verify it is explicitly in parameters
      const data = kbd.serialize();
      expect(data.parameters['polyMode']).toBe(0);
    });

    it('polyMode survives deserialize round-trip', () => {
      kbd.setPolyMode(1);
      const data = kbd.serialize();

      const kbd2 = new KeyboardInput('test-kbd2', { x: 0, y: 0 });
      kbd2.activate();
      kbd2.deserialize(data);
      expect(kbd2.isPolyMode()).toBe(true);
      kbd2.deactivate();
    });
  });
});
