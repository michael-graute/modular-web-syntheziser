import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PolyVCA } from '../../src/components/processors/PolyVCA';
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';
import { audioEngine } from '../../src/core/AudioEngine';

describe('PolyVCA', () => {
  let vca: PolyVCA;

  beforeEach(() => {
    const ctx = new MockAudioContext();
    (audioEngine as any).context = ctx;
    (audioEngine as any).isInitialized = true;
    vca = new PolyVCA('test-poly-vca', { x: 0, y: 0 });
    vca.activate();
  });

  afterEach(() => {
    vca.deactivate();
    (audioEngine as any).context = null;
    (audioEngine as any).isInitialized = false;
    (audioEngine as any).nodes = new Map();
  });

  describe('construction', () => {
    it('registers 8 input ports (audio-0..3 and cv-0..3)', () => {
      for (let i = 0; i < 4; i++) {
        expect(vca.inputs.has(`audio-${i}`)).toBe(true);
        expect(vca.inputs.has(`cv-${i}`)).toBe(true);
      }
    });

    it('registers a single audio output port', () => {
      expect(vca.outputs.has('output')).toBe(true);
    });
  });

  describe('audio graph', () => {
    it('getOutputNode() returns a GainNode (A3 fix — standard AUDIO node, no special handling needed)', () => {
      const out = vca.getOutputNode();
      // GainNode has a .gain AudioParam — confirms it is a standard Web Audio GainNode
      expect(out).toBeTruthy();
      expect((out as any).gain).toBeDefined();
    });

    it('getOutputNode() returns the summing GainNode with gain=0.25 (FR-012 — prevents clipping)', () => {
      const sumGain = (vca as any).sumGain;
      expect(sumGain.gain.value).toBe(0.25);
    });

    it('getInputNode() returns a GainNode for each audio-N port', () => {
      for (let i = 0; i < 4; i++) {
        const node = vca.getInputNode(`audio-${i}`);
        expect(node).toBeTruthy();
        expect((node as any).gain).toBeDefined();
      }
    });

    it('getInputNode() returns null for cv-N ports (CV uses AudioParam, not AudioNode)', () => {
      for (let i = 0; i < 4; i++) {
        expect(vca.getInputNode(`cv-${i}`)).toBeNull();
      }
    });

    it('getAudioParamForInput() returns a distinct AudioParam for each cv-N port', () => {
      const params = [];
      for (let i = 0; i < 4; i++) {
        const param = vca.getAudioParamForInput(`cv-${i}`);
        expect(param).toBeTruthy();
        params.push(param);
      }
      // Each cv port maps to a different gain param
      expect(new Set(params).size).toBe(4);
    });

    it('getAudioParamForInput() returns null for unknown port IDs', () => {
      expect(vca.getAudioParamForInput('audio-0')).toBeNull();
      expect(vca.getAudioParamForInput('output')).toBeNull();
    });

    it('voice gain AudioParams start at 0 (silent until PolyADSR CV drives them)', () => {
      for (let i = 0; i < 4; i++) {
        const param = vca.getAudioParamForInput(`cv-${i}`);
        expect((param as any).value).toBe(0);
      }
    });
  });
});
