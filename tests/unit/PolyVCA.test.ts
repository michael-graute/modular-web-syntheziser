import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PolyVCA } from '../../src/components/processors/PolyVCA';
import { MockAudioContext, MockGainNode } from '../mocks/WebAudioAPI.mock';
import { audioEngine } from '../../src/core/AudioEngine';
import { SignalType } from '../../src/core/types';

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
    it('registers 2 inputs: poly-audio and poly-env', () => {
      expect(vca.inputs.has('poly-audio')).toBe(true);
      expect(vca.inputs.has('poly-env')).toBe(true);
      expect(vca.inputs.size).toBe(2);
    });

    it('poly-audio input carries POLY_AUDIO signal type', () => {
      expect(vca.inputs.get('poly-audio')!.type).toBe(SignalType.POLY_AUDIO);
    });

    it('poly-env input carries POLY_ENV signal type', () => {
      expect(vca.inputs.get('poly-env')!.type).toBe(SignalType.POLY_ENV);
    });

    it('registers a single audio output port', () => {
      expect(vca.outputs.has('output')).toBe(true);
      expect(vca.outputs.size).toBe(1);
    });
  });

  describe('audio graph', () => {
    it('getOutputNode() returns a GainNode (standard AUDIO-compatible node)', () => {
      const out = vca.getOutputNode();
      expect(out).toBeTruthy();
      expect((out as any).gain).toBeDefined();
    });

    it('summing GainNode uses 0.25 gain (prevents clipping at 4-voice load)', () => {
      expect((vca as any).sumGain.gain.value).toBe(0.25);
    });

    it('voice gain AudioParams start at 0 (silent until PolyADSR drives them)', () => {
      for (const g of (vca as any).voiceGains) {
        expect(g.gain.value).toBe(0);
      }
    });
  });

  describe('connectPolyAudio / disconnectPolyAudio', () => {
    it('wires 4 mock GainNodes into the 4 voice inputs without error', () => {
      const fakeOutputs = Array.from({ length: 4 }, () => new MockGainNode()) as unknown as GainNode[];
      expect(() => vca.connectPolyAudio(fakeOutputs)).not.toThrow();
    });

    it('disconnects them without error', () => {
      const fakeOutputs = Array.from({ length: 4 }, () => new MockGainNode()) as unknown as GainNode[];
      vca.connectPolyAudio(fakeOutputs);
      expect(() => vca.disconnectPolyAudio(fakeOutputs)).not.toThrow();
    });
  });

  describe('connectPolyEnv / disconnectPolyEnv', () => {
    it('wires 4 envelope GainNodes into the 4 voice gain AudioParams without error', () => {
      const fakeEnvs = Array.from({ length: 4 }, () => new MockGainNode()) as unknown as GainNode[];
      expect(() => vca.connectPolyEnv(fakeEnvs)).not.toThrow();
    });

    it('disconnects them without error', () => {
      const fakeEnvs = Array.from({ length: 4 }, () => new MockGainNode()) as unknown as GainNode[];
      vca.connectPolyEnv(fakeEnvs);
      expect(() => vca.disconnectPolyEnv(fakeEnvs)).not.toThrow();
    });
  });
});
