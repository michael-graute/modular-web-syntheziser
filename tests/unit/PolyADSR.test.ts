import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PolyADSR } from '../../src/components/processors/PolyADSR';
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';
import { audioEngine } from '../../src/core/AudioEngine';
import { VoiceSlot } from '../../src/components/utilities/VoiceAllocator';

function makeSlots(gates: (0 | 1)[] = [0, 0, 0, 0]): VoiceSlot[] {
  return Array.from({ length: 4 }, (_, i) => ({
    voiceIndex: i as 0 | 1 | 2 | 3,
    frequency: 440,
    gate: gates[i] ?? 0,
    note: null,
    timestamp: 0,
  }));
}

describe('PolyADSR', () => {
  let adsr: PolyADSR;
  let mockCtx: MockAudioContext;

  beforeEach(() => {
    mockCtx = new MockAudioContext();
    (audioEngine as any).context = mockCtx;
    (audioEngine as any).isInitialized = true;
    adsr = new PolyADSR('test-poly-adsr', { x: 0, y: 0 });
    adsr.activate();
  });

  afterEach(() => {
    adsr.deactivate();
    (audioEngine as any).context = null;
    (audioEngine as any).isInitialized = false;
    (audioEngine as any).nodes = new Map();
    vi.clearAllMocks();
  });

  describe('construction', () => {
    it('registers poly-cv input and 4 envelope output ports', () => {
      expect(adsr.inputs.has('poly-cv')).toBe(true);
      for (let i = 0; i < 4; i++) {
        expect(adsr.outputs.has(`env-${i}`)).toBe(true);
      }
    });

    it('registers ADSR parameters', () => {
      expect(adsr.getParameter('attack')).toBeDefined();
      expect(adsr.getParameter('decay')).toBeDefined();
      expect(adsr.getParameter('sustain')).toBeDefined();
      expect(adsr.getParameter('release')).toBeDefined();
    });
  });

  describe('getOutputNodeByPort', () => {
    it('returns the correct output GainNode for each env-N port', () => {
      for (let i = 0; i < 4; i++) {
        const node = (adsr as any).getOutputNodeByPort(`env-${i}`);
        expect(node).toBe((adsr as any).outputGains[i]);
      }
    });
  });

  describe('gate edge detection', () => {
    it('fires triggerGateOn for a 0→1 transition', () => {
      adsr.setVoiceSlotsGetter(() => makeSlots([0, 0, 0, 0]));
      const gateOnSpy = vi.spyOn(adsr as any, '_triggerGateOn');

      // Simulate gate going high on voice 1
      adsr.setVoiceSlotsGetter(() => makeSlots([0, 1, 0, 0]));
      (adsr as any)._applySlots();

      expect(gateOnSpy).toHaveBeenCalledWith(1);
      expect(gateOnSpy).toHaveBeenCalledTimes(1);
    });

    it('fires triggerGateOff for a 1→0 transition', () => {
      // Set voice 2 as already active
      (adsr as any).previousGates[2] = 1;
      adsr.setVoiceSlotsGetter(() => makeSlots([0, 0, 0, 0]));
      const gateOffSpy = vi.spyOn(adsr as any, '_triggerGateOff');

      (adsr as any)._applySlots();

      expect(gateOffSpy).toHaveBeenCalledWith(2);
    });

    it('does not fire for stable gate state (no transition)', () => {
      adsr.setVoiceSlotsGetter(() => makeSlots([1, 1, 0, 0]));
      (adsr as any).previousGates = [1, 1, 0, 0];
      const gateOnSpy = vi.spyOn(adsr as any, '_triggerGateOn');
      const gateOffSpy = vi.spyOn(adsr as any, '_triggerGateOff');

      (adsr as any)._applySlots();

      expect(gateOnSpy).not.toHaveBeenCalled();
      expect(gateOffSpy).not.toHaveBeenCalled();
    });

    it('handles independent per-voice envelopes without cross-slot interference', () => {
      adsr.setVoiceSlotsGetter(() => makeSlots([0, 0, 0, 0]));
      const gateOnSpy = vi.spyOn(adsr as any, '_triggerGateOn');

      // Only voice 3 goes high
      adsr.setVoiceSlotsGetter(() => makeSlots([0, 0, 0, 1]));
      (adsr as any)._applySlots();

      expect(gateOnSpy).toHaveBeenCalledWith(3);
      expect(gateOnSpy).toHaveBeenCalledTimes(1); // only voice 3, not others
    });

    it('reads only slot.gate — FR-001a: frequency field is ignored', () => {
      // Different frequencies on each slot but only gate matters
      const slots: VoiceSlot[] = [
        { voiceIndex: 0, frequency: 100, gate: 1, note: 60, timestamp: 0 },
        { voiceIndex: 1, frequency: 200, gate: 0, note: null, timestamp: 0 },
        { voiceIndex: 2, frequency: 300, gate: 0, note: null, timestamp: 0 },
        { voiceIndex: 3, frequency: 400, gate: 0, note: null, timestamp: 0 },
      ];
      adsr.setVoiceSlotsGetter(() => slots);
      const gateOnSpy = vi.spyOn(adsr as any, '_triggerGateOn');

      (adsr as any)._applySlots();

      // Only voice 0 triggered (gate=1), regardless of frequency values
      expect(gateOnSpy).toHaveBeenCalledWith(0);
      expect(gateOnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('no getter registered', () => {
    it('skips updates without throwing when voiceSlotsGetter is null', () => {
      expect(() => {
        (adsr as any)._applySlots();
      }).not.toThrow();
    });
  });

  describe('destroyAudioNodes', () => {
    it('cancels RAF handle on destroy (T029 — no orphaned loops)', () => {
      const stopPollingSpy = vi.spyOn(adsr as any, '_stopPolling');
      adsr.deactivate();
      expect(stopPollingSpy).toHaveBeenCalled();
    });
  });
});
