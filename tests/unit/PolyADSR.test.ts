import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PolyADSR } from '../../src/components/processors/PolyADSR';
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';
import { audioEngine } from '../../src/core/AudioEngine';
import { SignalType } from '../../src/core/types';
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

  beforeEach(() => {
    const ctx = new MockAudioContext();
    (audioEngine as any).context = ctx;
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
    it('registers poly-cv input and single poly-env output', () => {
      expect(adsr.inputs.has('poly-cv')).toBe(true);
      expect(adsr.outputs.has('poly-env')).toBe(true);
      expect(adsr.outputs.size).toBe(1);
    });

    it('poly-env output carries POLY_ENV signal type', () => {
      expect(adsr.outputs.get('poly-env')!.type).toBe(SignalType.POLY_ENV);
    });

    it('registers ADSR parameters', () => {
      expect(adsr.getParameter('attack')).toBeDefined();
      expect(adsr.getParameter('decay')).toBeDefined();
      expect(adsr.getParameter('sustain')).toBeDefined();
      expect(adsr.getParameter('release')).toBeDefined();
    });
  });

  describe('gate edge detection', () => {
    it('fires _triggerGateOn for a 0→1 transition', () => {
      adsr.setVoiceSlotsGetter(() => makeSlots([0, 0, 0, 0]));
      const gateOnSpy = vi.spyOn(adsr as any, '_triggerGateOn');

      adsr.setVoiceSlotsGetter(() => makeSlots([0, 1, 0, 0]));
      (adsr as any)._applySlots();

      expect(gateOnSpy).toHaveBeenCalledWith(1);
      expect(gateOnSpy).toHaveBeenCalledTimes(1);
    });

    it('fires _triggerGateOff for a 1→0 transition', () => {
      (adsr as any).previousGates[2] = 1;
      adsr.setVoiceSlotsGetter(() => makeSlots([0, 0, 0, 0]));
      const gateOffSpy = vi.spyOn(adsr as any, '_triggerGateOff');
      (adsr as any)._applySlots();
      expect(gateOffSpy).toHaveBeenCalledWith(2);
    });

    it('does not fire for stable gate state', () => {
      (adsr as any).previousGates = [1, 1, 0, 0];
      adsr.setVoiceSlotsGetter(() => makeSlots([1, 1, 0, 0]));
      const onSpy  = vi.spyOn(adsr as any, '_triggerGateOn');
      const offSpy = vi.spyOn(adsr as any, '_triggerGateOff');
      (adsr as any)._applySlots();
      expect(onSpy).not.toHaveBeenCalled();
      expect(offSpy).not.toHaveBeenCalled();
    });

    it('handles independent per-voice envelopes without cross-slot interference', () => {
      adsr.setVoiceSlotsGetter(() => makeSlots([0, 0, 0, 0]));
      const onSpy = vi.spyOn(adsr as any, '_triggerGateOn');
      adsr.setVoiceSlotsGetter(() => makeSlots([0, 0, 0, 1]));
      (adsr as any)._applySlots();
      expect(onSpy).toHaveBeenCalledWith(3);
      expect(onSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('poly-env consumer wiring', () => {
    it('registerPolyEnvConsumer immediately invokes connect with outputGains', () => {
      const connectFn = vi.fn();
      adsr.registerPolyEnvConsumer(connectFn, vi.fn());
      expect(connectFn).toHaveBeenCalledWith((adsr as any).outputGains);
    });

    it('clearPolyEnvConsumer calls the disconnector', () => {
      const disconnectFn = vi.fn();
      adsr.registerPolyEnvConsumer(vi.fn(), disconnectFn);
      adsr.clearPolyEnvConsumer();
      expect(disconnectFn).toHaveBeenCalled();
    });
  });

  describe('no getter registered', () => {
    it('skips updates without throwing when voiceSlotsGetter is null', () => {
      expect(() => (adsr as any)._applySlots()).not.toThrow();
    });
  });

  describe('destroyAudioNodes', () => {
    it('cancels RAF handle on destroy (no orphaned loops)', () => {
      const spy = vi.spyOn(adsr as any, '_stopPolling');
      adsr.deactivate();
      expect(spy).toHaveBeenCalled();
    });
  });
});
