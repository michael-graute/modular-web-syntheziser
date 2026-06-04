import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PolyOscillator } from '../../src/components/generators/PolyOscillator';
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';
import { audioEngine } from '../../src/core/AudioEngine';
import { SignalType } from '../../src/core/types';
import { VoiceSlot } from '../../src/components/utilities/VoiceAllocator';

function makeSlots(overrides: Partial<VoiceSlot>[] = []): VoiceSlot[] {
  return Array.from({ length: 4 }, (_, i) => ({
    voiceIndex: i as 0 | 1 | 2 | 3,
    frequency: 0,
    gate: 0 as const,
    note: null,
    timestamp: 0,
    ...overrides[i],
  }));
}

describe('PolyOscillator', () => {
  let osc: PolyOscillator;

  beforeEach(() => {
    const ctx = new MockAudioContext();
    (audioEngine as any).context = ctx;
    (audioEngine as any).isInitialized = true;
    osc = new PolyOscillator('test-poly-osc', { x: 0, y: 0 });
    osc.activate();
  });

  afterEach(() => {
    osc.deactivate();
    (audioEngine as any).context = null;
    (audioEngine as any).isInitialized = false;
    (audioEngine as any).nodes = new Map();
    vi.clearAllMocks();
  });

  describe('construction', () => {
    it('registers poly-cv input and single poly-audio output', () => {
      expect(osc.inputs.has('poly-cv')).toBe(true);
      expect(osc.outputs.has('poly-audio')).toBe(true);
      expect(osc.outputs.size).toBe(1);
    });

    it('poly-audio output carries POLY_AUDIO signal type', () => {
      expect(osc.outputs.get('poly-audio')!.type).toBe(SignalType.POLY_AUDIO);
    });

    it('registers waveform parameter', () => {
      expect(osc.getParameter('waveform')).toBeDefined();
    });
  });

  describe('createAudioNodes', () => {
    it('creates 4 internal voice output GainNodes', () => {
      expect((osc as any).voiceOutputs).toHaveLength(4);
    });

    it('each voice output starts silent (gain=0)', () => {
      for (const out of (osc as any).voiceOutputs) {
        expect(out.gain.value).toBe(0);
      }
    });

    it('getOutputNode returns the poly-audio dummy GainNode', () => {
      expect((osc as any).getOutputNode()).toBeTruthy();
    });
  });

  describe('voice slot polling', () => {
    it('skips updates gracefully when no getter is registered', () => {
      expect(() => (osc as any)._applySlots()).not.toThrow();
    });

    it('updates oscillator frequency from slot.frequency', () => {
      const slots = makeSlots([{ frequency: 440, gate: 1 }]);
      osc.setVoiceSlotsGetter(() => slots);
      (osc as any)._applySlots();
      expect((osc as any).oscillators[0].frequency.value).toBe(440);
    });

    it('opens voice output gain when slot.gate=1', () => {
      const slots = makeSlots([{ frequency: 440, gate: 1 }, { frequency: 220, gate: 0 }]);
      osc.setVoiceSlotsGetter(() => slots);
      (osc as any)._applySlots();
      expect((osc as any).voiceOutputs[0].gain.value).toBe(1);
      expect((osc as any).voiceOutputs[1].gain.value).toBe(0);
    });
  });

  describe('clearVoiceSlotsGetter', () => {
    it('zeros all voice output gains and nulls the getter', () => {
      osc.setVoiceSlotsGetter(() => makeSlots([{ gate: 1 }]));
      (osc as any)._applySlots();
      osc.clearVoiceSlotsGetter();
      for (const out of (osc as any).voiceOutputs) {
        expect(out.gain.value).toBe(0);
      }
      expect((osc as any).voiceSlotsGetter).toBeNull();
    });
  });

  describe('poly-audio consumer wiring', () => {
    it('registerPolyAudioConsumer immediately invokes connect with voiceOutputs', () => {
      const connectFn = vi.fn();
      osc.registerPolyAudioConsumer(connectFn, vi.fn());
      expect(connectFn).toHaveBeenCalledWith((osc as any).voiceOutputs);
    });

    it('clearPolyAudioConsumer calls the disconnector', () => {
      const disconnectFn = vi.fn();
      osc.registerPolyAudioConsumer(vi.fn(), disconnectFn);
      osc.clearPolyAudioConsumer();
      expect(disconnectFn).toHaveBeenCalled();
    });
  });

  describe('destroyAudioNodes', () => {
    it('cancels the RAF handle on destroy (no orphaned loops)', () => {
      const spy = vi.spyOn(osc as any, '_stopPolling');
      osc.deactivate();
      expect(spy).toHaveBeenCalled();
    });
  });
});
