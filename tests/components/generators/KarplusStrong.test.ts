/**
 * KarplusStrong — component tests.
 * Feature: 034-karplus-strong-oscillator (T015, T019, T030)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockGainNode, MockAnalyserNode, MockAudioWorkletNode } from '../../mocks/WebAudioAPI.mock';
import { SignalType, KarplusStrongMode } from '../../../src/core/types';
import { KARPLUS_STRONG } from '../../../src/utils/constants';

const mockGain = () => new MockGainNode() as unknown as GainNode;
const mockAnalyser = () => new MockAnalyserNode() as unknown as AnalyserNode;

const mockCtx = {
  currentTime: 0,
  createGain: vi.fn(mockGain),
  createAnalyser: vi.fn(mockAnalyser),
  audioWorklet: {
    addModule: vi.fn(async () => Promise.resolve()),
  },
};

vi.mock('../../../src/core/AudioEngine', () => ({
  audioEngine: {
    isReady: () => true,
    getContext: () => mockCtx,
    addNode: vi.fn(),
  },
}));

// Global AudioWorkletNode constructor mock — captured so tests can inspect instances.
let lastWorkletNodeInstance: MockAudioWorkletNode | null = null;
(globalThis as any).AudioWorkletNode = class {
  constructor(_ctx: unknown, _name: string) {
    const instance = new MockAudioWorkletNode();
    lastWorkletNodeInstance = instance;
    return instance;
  }
};

import { KarplusStrong } from '../../../src/components/generators/KarplusStrong';

function makeKS(): KarplusStrong {
  return new KarplusStrong('ks-test', { x: 0, y: 0 });
}

async function makeActiveKS(): Promise<{ ks: KarplusStrong; worklet: MockAudioWorkletNode }> {
  const ks = makeKS();
  ks.activate();
  // Flush the async loadWorkletModule() microtask chain.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  const worklet = lastWorkletNodeInstance!;
  return { ks, worklet };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx.createGain.mockImplementation(mockGain);
  mockCtx.createAnalyser.mockImplementation(mockAnalyser);
  mockCtx.audioWorklet.addModule.mockImplementation(async () => Promise.resolve());
  lastWorkletNodeInstance = null;
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('KarplusStrong constructor', () => {
  it('has input port "trigger" with SignalType.GATE', () => {
    const ks = makeKS();
    const port = ks.inputs.get('trigger');
    expect(port).toBeDefined();
    expect(port!.type).toBe(SignalType.GATE);
    expect(port!.isInput).toBe(true);
  });

  it('has input port "pitch" with SignalType.CV', () => {
    const ks = makeKS();
    const port = ks.inputs.get('pitch');
    expect(port).toBeDefined();
    expect(port!.type).toBe(SignalType.CV);
  });

  it('has output port "output" with SignalType.AUDIO', () => {
    const ks = makeKS();
    const port = ks.outputs.get('output');
    expect(port).toBeDefined();
    expect(port!.type).toBe(SignalType.AUDIO);
    expect(port!.isInput).toBe(false);
  });

  it('has frequency parameter defaulting to 440 Hz', () => {
    expect(makeKS().getParameter('frequency')?.getValue()).toBe(KARPLUS_STRONG.DEFAULT_FREQUENCY);
  });

  it('has damping parameter defaulting to 0.5', () => {
    expect(makeKS().getParameter('damping')?.getValue()).toBe(KARPLUS_STRONG.DEFAULT_DAMPING);
  });

  it('has tone parameter defaulting to 0.5', () => {
    expect(makeKS().getParameter('tone')?.getValue()).toBe(KARPLUS_STRONG.DEFAULT_TONE);
  });

  it('has mode parameter defaulting to STRING', () => {
    expect(makeKS().getParameter('mode')?.getValue()).toBe(KarplusStrongMode.STRING);
  });
});

// ---------------------------------------------------------------------------
// FR-008 / US1: silent until first trigger; pluck before module ready is queued
// ---------------------------------------------------------------------------

describe('KarplusStrong trigger behavior (US1)', () => {
  it('does not throw when triggerGateOn() is called before the worklet module resolves', () => {
    const ks = makeKS();
    ks.activate(); // kicks off async addModule(), not yet resolved
    expect(() => ks.triggerGateOn()).not.toThrow();
  });

  it('fires a queued pluck once the module becomes ready', async () => {
    const ks = makeKS();
    ks.activate();
    ks.triggerGateOn(); // called before module ready — should queue
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const worklet = lastWorkletNodeInstance!;
    expect(worklet.postedMessages).toContainEqual({ type: 'pluck' });
  });

  it('sends a pluck message immediately when triggered after the module is ready', async () => {
    const { ks, worklet } = await makeActiveKS();
    worklet.postedMessages = [];
    ks.triggerGateOn();
    expect(worklet.postedMessages).toContainEqual({ type: 'pluck' });
  });

  it('triggerGateOff() does not throw (no-op, no release phase)', async () => {
    const { ks } = await makeActiveKS();
    expect(() => ks.triggerGateOff()).not.toThrow();
  });

  it('rapid re-trigger sends multiple pluck messages without throwing', async () => {
    const { ks, worklet } = await makeActiveKS();
    worklet.postedMessages = [];
    for (let i = 0; i < 20; i++) {
      expect(() => ks.triggerGateOn()).not.toThrow();
    }
    const pluckCount = worklet.postedMessages.filter((m: any) => m.type === 'pluck').length;
    expect(pluckCount).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// activate / createAudioNodes
// ---------------------------------------------------------------------------

describe('KarplusStrong activate', () => {
  it('creates a gain node synchronously (before worklet module resolves)', () => {
    const ks = makeKS();
    ks.activate();
    expect(mockCtx.createGain).toHaveBeenCalled();
  });

  it('getOutputNode() returns non-null immediately after activate (before module resolves)', () => {
    const ks = makeKS();
    ks.activate();
    expect(ks.getOutputNode()).not.toBeNull();
  });

  it('getInputNode() returns null (no audio input port)', () => {
    expect(makeKS().getInputNode()).toBeNull();
  });

  it('creates the AudioWorkletNode once the module resolves', async () => {
    await makeActiveKS();
    expect(mockCtx.audioWorklet.addModule).toHaveBeenCalledTimes(1);
    expect(lastWorkletNodeInstance).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pitch CV (US2)
// ---------------------------------------------------------------------------

describe('KarplusStrong pitch CV (US2)', () => {
  it('exposes the frequency AudioParam for the pitch input', async () => {
    const { ks, worklet } = await makeActiveKS();
    expect(ks.getAudioParamForInput('pitch')).toBe(worklet.parameters.get('frequency'));
  });

  it('returns null AudioParam for unknown input ids', async () => {
    const { ks } = await makeActiveKS();
    expect(ks.getAudioParamForInput('trigger')).toBeNull();
  });

  it('zeroes the frequency AudioParam when pitch CV is connected', async () => {
    const { ks, worklet } = await makeActiveKS();
    const freqParam = worklet.parameters.get('frequency')!;
    ks.onInputConnected('pitch');
    expect(freqParam.value).toBe(0);
  });

  it('restores the base frequency when pitch CV is disconnected', async () => {
    const { ks, worklet } = await makeActiveKS();
    ks.setParameterValue('frequency', 660);
    ks.onInputConnected('pitch');
    ks.onInputDisconnected('pitch');
    expect(worklet.parameters.get('frequency')!.value).toBe(660);
  });

  it('getParameterRangeForInput returns the supported frequency range for pitch', () => {
    const ks = makeKS();
    expect(ks.getParameterRangeForInput('pitch')).toEqual({
      min: KARPLUS_STRONG.MIN_FREQUENCY,
      max: KARPLUS_STRONG.MAX_FREQUENCY,
    });
  });
});

// ---------------------------------------------------------------------------
// serialize / deserialize (US5, SC-006)
// ---------------------------------------------------------------------------

describe('KarplusStrong serialize', () => {
  it('returns correct type string', () => {
    expect(makeKS().serialize().type).toBe('karplus-strong');
  });

  it('serializes default parameters', () => {
    const data = makeKS().serialize();
    expect(data.parameters['frequency']).toBe(KARPLUS_STRONG.DEFAULT_FREQUENCY);
    expect(data.parameters['damping']).toBe(KARPLUS_STRONG.DEFAULT_DAMPING);
    expect(data.parameters['tone']).toBe(KARPLUS_STRONG.DEFAULT_TONE);
    expect(data.parameters['mode']).toBe(KarplusStrongMode.STRING);
  });
});

describe('KarplusStrong deserialize', () => {
  it('restores non-default parameter values', () => {
    const ks = makeKS();
    ks.deserialize({
      id: 'ks-test',
      type: 'karplus-strong' as any,
      position: { x: 10, y: 20 },
      parameters: { frequency: 220, damping: 0.9, tone: 0.1, mode: KarplusStrongMode.STRETCHED },
    });
    expect(ks.getParameter('frequency')?.getValue()).toBe(220);
    expect(ks.getParameter('damping')?.getValue()).toBeCloseTo(0.9, 5);
    expect(ks.getParameter('tone')?.getValue()).toBeCloseTo(0.1, 5);
    expect(ks.getParameter('mode')?.getValue()).toBe(KarplusStrongMode.STRETCHED);
  });

  it('uses defaults for missing parameters', () => {
    const ks = makeKS();
    ks.deserialize({
      id: 'ks-test',
      type: 'karplus-strong' as any,
      position: { x: 0, y: 0 },
      parameters: {},
    });
    expect(ks.getParameter('frequency')?.getValue()).toBe(KARPLUS_STRONG.DEFAULT_FREQUENCY);
    expect(ks.getParameter('mode')?.getValue()).toBe(KarplusStrongMode.STRING);
  });

  it('clamps out-of-range values on deserialize', () => {
    const ks = makeKS();
    ks.deserialize({
      id: 'ks-test',
      type: 'karplus-strong' as any,
      position: { x: 0, y: 0 },
      parameters: { frequency: -100, damping: 5, tone: -5, mode: 99 },
    });
    expect(ks.getParameter('frequency')?.getValue()).toBe(KARPLUS_STRONG.MIN_FREQUENCY);
    expect(ks.getParameter('damping')?.getValue()).toBe(1);
    expect(ks.getParameter('tone')?.getValue()).toBe(0);
    expect(ks.getParameter('mode')?.getValue()).toBe(KarplusStrongMode.STRING);
  });

  it('round-trips: serialize → deserialize preserves non-default values (SC-006)', () => {
    const ks1 = makeKS();
    ks1.setParameterValue('frequency', 880);
    ks1.setParameterValue('damping', 0.8);
    ks1.setParameterValue('tone', 0.3);
    ks1.setParameterValue('mode', KarplusStrongMode.STRETCHED);
    const data = ks1.serialize();

    const ks2 = makeKS();
    ks2.deserialize(data);
    expect(ks2.getParameter('frequency')?.getValue()).toBe(880);
    expect(ks2.getParameter('damping')?.getValue()).toBeCloseTo(0.8, 5);
    expect(ks2.getParameter('tone')?.getValue()).toBeCloseTo(0.3, 5);
    expect(ks2.getParameter('mode')?.getValue()).toBe(KarplusStrongMode.STRETCHED);
  });
});

// ---------------------------------------------------------------------------
// Tone / Mode wiring (US3, US4)
// ---------------------------------------------------------------------------

describe('KarplusStrong tone and mode wiring', () => {
  it('sends setTone message when tone parameter changes', async () => {
    const { ks, worklet } = await makeActiveKS();
    worklet.postedMessages = [];
    ks.setParameterValue('tone', 0.9);
    expect(worklet.postedMessages).toContainEqual({ type: 'setTone', value: 0.9 });
  });

  it('sends setMode message when mode parameter changes', async () => {
    const { ks, worklet } = await makeActiveKS();
    worklet.postedMessages = [];
    ks.setParameterValue('mode', KarplusStrongMode.STRETCHED);
    expect(worklet.postedMessages).toContainEqual({ type: 'setMode', mode: KarplusStrongMode.STRETCHED });
  });
});

// ---------------------------------------------------------------------------
// Frequency and Damping knobs must actually drive the worklet's AudioParams
// (regression test: linkAudioParam() only wires the Parameter -> AudioParam
// direction for read-back/CV-visualization, not for pushing knob changes
// out to the worklet — updateAudioParameter() must do that explicitly, the
// same way Oscillator.ts does for its frequency/detune AudioParams).
// ---------------------------------------------------------------------------

describe('KarplusStrong frequency and damping knob wiring', () => {
  it('turning the Frequency knob updates the worklet AudioParam value', async () => {
    const { ks, worklet } = await makeActiveKS();
    ks.setParameterValue('frequency', 880);
    expect(worklet.parameters.get('frequency')!.value).toBe(880);
  });

  it('turning the Damping knob updates the worklet AudioParam value', async () => {
    const { ks, worklet } = await makeActiveKS();
    ks.setParameterValue('damping', 0.9);
    expect(worklet.parameters.get('damping')!.value).toBeCloseTo(0.9, 5);
  });

  it('does not throw when frequency/damping are set before the module is ready', () => {
    const ks = makeKS();
    ks.activate();
    expect(() => ks.setParameterValue('frequency', 660)).not.toThrow();
    expect(() => ks.setParameterValue('damping', 0.2)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// destroyAudioNodes
// ---------------------------------------------------------------------------

describe('KarplusStrong deactivate', () => {
  it('does not throw on deactivate before module resolves', () => {
    const ks = makeKS();
    ks.activate();
    expect(() => ks.deactivate()).not.toThrow();
  });

  it('does not throw on deactivate after module resolves', async () => {
    const { ks } = await makeActiveKS();
    expect(() => ks.deactivate()).not.toThrow();
  });
});
