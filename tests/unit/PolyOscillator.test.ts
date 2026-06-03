import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PolyOscillator } from '../../src/components/generators/PolyOscillator';
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';
import { audioEngine } from '../../src/core/AudioEngine';
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
  let mockCtx: MockAudioContext;

  beforeEach(() => {
    mockCtx = new MockAudioContext();
    (audioEngine as any).context = mockCtx;
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
    it('registers poly-cv input and 4 voice audio output ports', () => {
      expect(osc.inputs.has('poly-cv')).toBe(true);
      for (let i = 0; i < 4; i++) {
        expect(osc.outputs.has(`voice-${i}`)).toBe(true);
      }
    });

    it('registers waveform parameter', () => {
      expect(osc.getParameter('waveform')).toBeDefined();
    });
  });

  describe('createAudioNodes', () => {
    it('creates 4 independent voice output nodes', () => {
      for (let i = 0; i < 4; i++) {
        const node = (osc as any).getOutputNodeByPort(`voice-${i}`);
        expect(node).toBeTruthy();
      }
    });

    it('each voice output starts silent (gain=0)', () => {
      const voiceOutputs = (osc as any).voiceOutputs;
      for (const out of voiceOutputs) {
        expect(out.gain.value).toBe(0);
      }
    });

    it('getOutputNodeByPort returns distinct node for each voice port', () => {
      const node0 = (osc as any).getOutputNodeByPort('voice-0');
      const node1 = (osc as any).getOutputNodeByPort('voice-1');
      expect(node0).not.toBe(node1);
    });
  });

  describe('voice slot polling', () => {
    it('skips updates gracefully when no getter is registered (null getter)', () => {
      expect(() => (osc as any)._applySlots()).not.toThrow();
    });

    it('updates oscillator frequencies from slot.frequency', () => {
      const slots = makeSlots([{ frequency: 440, gate: 1 }]);
      osc.setVoiceSlotsGetter(() => slots);
      (osc as any)._applySlots();

      const oscillators = (osc as any).oscillators;
      expect(oscillators[0].frequency.value).toBe(440);
    });

    it('opens the voice output gain when slot.gate=1', () => {
      const slots = makeSlots([{ frequency: 440, gate: 1 }, { frequency: 220, gate: 0 }]);
      osc.setVoiceSlotsGetter(() => slots);
      (osc as any)._applySlots();

      const voiceOutputs = (osc as any).voiceOutputs;
      expect(voiceOutputs[0].gain.value).toBe(1);
      expect(voiceOutputs[1].gain.value).toBe(0);
    });

    it('reads only slot.frequency — frequency updates even when gate=0', () => {
      // FR-001a: PolyOscillator uses frequency for pitch, gate for output enable
      const slots = makeSlots([{ frequency: 880, gate: 0 }]);
      osc.setVoiceSlotsGetter(() => slots);
      (osc as any)._applySlots();

      const oscillators = (osc as any).oscillators;
      expect(oscillators[0].frequency.value).toBe(880);
    });
  });

  describe('clearVoiceSlotsGetter', () => {
    it('zeros all voice output gains', () => {
      const slots = makeSlots([{ frequency: 440, gate: 1 }]);
      osc.setVoiceSlotsGetter(() => slots);
      (osc as any)._applySlots();

      osc.clearVoiceSlotsGetter();

      const voiceOutputs = (osc as any).voiceOutputs;
      for (const out of voiceOutputs) {
        expect(out.gain.value).toBe(0);
      }
      expect((osc as any).voiceSlotsGetter).toBeNull();
    });
  });

  describe('destroyAudioNodes', () => {
    it('cancels the RAF handle on destroy (T029 — no orphaned loops)', () => {
      const stopPollingSpy = vi.spyOn(osc as any, '_stopPolling');
      osc.deactivate();
      expect(stopPollingSpy).toHaveBeenCalled();
    });
  });
});
