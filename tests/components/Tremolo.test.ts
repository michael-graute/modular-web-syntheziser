import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockGainNode, MockOscillatorNode, MockConstantSourceNode } from '../mocks/WebAudioAPI.mock';

// ---------------------------------------------------------------------------
// Mock AudioEngine — must come before importing Tremolo
// ---------------------------------------------------------------------------

const mockGain = () => new MockGainNode() as unknown as GainNode;
const mockOscillator = () => new MockOscillatorNode() as unknown as OscillatorNode;
const mockConstantSource = () => new MockConstantSourceNode() as unknown as ConstantSourceNode;

const mockCtx = {
  currentTime: 0,
  createGain: vi.fn(mockGain),
  createOscillator: vi.fn(mockOscillator),
  createConstantSource: vi.fn(mockConstantSource),
};

vi.mock('../../src/core/AudioEngine', () => ({
  audioEngine: {
    isReady: () => true,
    getContext: () => mockCtx,
    addNode: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import after mock is registered
// ---------------------------------------------------------------------------

import { Tremolo } from '../../src/components/effects/Tremolo';
import { tremoloLfoParams } from '../../src/components/effects/effectHelpers';

function makeTremolo(): Tremolo {
  return new Tremolo('tr-test', { x: 0, y: 0 });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx.createGain.mockImplementation(mockGain);
  mockCtx.createOscillator.mockImplementation(mockOscillator);
  mockCtx.createConstantSource.mockImplementation(mockConstantSource);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Tremolo constructor', () => {
  it('creates input and output ports', () => {
    const tr = makeTremolo();
    expect(tr.getInput('input')).toBeDefined();
    expect(tr.getOutput('output')).toBeDefined();
  });

  it('creates rate parameter defaulting to 4.0 Hz', () => {
    const tr = makeTremolo();
    const p = tr.getParameter('rate');
    expect(p).toBeDefined();
    expect(p!.getValue()).toBe(4.0);
  });

  it('creates depth parameter defaulting to 50%', () => {
    const tr = makeTremolo();
    const p = tr.getParameter('depth');
    expect(p).toBeDefined();
    expect(p!.getValue()).toBe(50);
  });

  it('creates mix parameter defaulting to 1.0 (fully wet)', () => {
    const tr = makeTremolo();
    const p = tr.getParameter('mix');
    expect(p).toBeDefined();
    expect(p!.getValue()).toBe(1.0);
  });

  it('is identified as bypassable', () => {
    expect(makeTremolo().isBypassable()).toBe(true);
  });
});

describe('Tremolo createAudioNodes', () => {
  let tr: Tremolo;

  beforeEach(() => {
    tr = makeTremolo();
    tr.activate();
  });

  it('creates a ConstantSourceNode', () => {
    expect(mockCtx.createConstantSource).toHaveBeenCalled();
  });

  it('creates an OscillatorNode for LFO', () => {
    expect(mockCtx.createOscillator).toHaveBeenCalled();
  });

  it('registers all expected audio nodes', () => {
    expect(tr.getAudioNode('inputGain')).toBeDefined();
    expect(tr.getAudioNode('tremoloGain')).toBeDefined();
    expect(tr.getAudioNode('lfo')).toBeDefined();
    expect(tr.getAudioNode('lfoGain')).toBeDefined();
    expect(tr.getAudioNode('constantSource')).toBeDefined();
    expect(tr.getAudioNode('dryGain')).toBeDefined();
    expect(tr.getAudioNode('wetGain')).toBeDefined();
    expect(tr.getAudioNode('outputGain')).toBeDefined();
  });

  it('getInputNode returns inputGain', () => {
    expect(tr.getInputNode()).toBe(tr.getAudioNode('inputGain'));
  });

  it('getOutputNode returns outputGain', () => {
    expect(tr.getOutputNode()).toBe(tr.getAudioNode('outputGain'));
  });

  it('LFO is started', () => {
    const lfo = tr.getAudioNode('lfo') as any;
    expect(lfo.isStarted).toBe(true);
  });

  it('ConstantSource is started', () => {
    const cs = tr.getAudioNode('constantSource') as any;
    expect(cs.isStarted).toBe(true);
  });
});

describe('tremoloLfoParams helper', () => {
  it('depth=0 → lfoAmplitude=0, dcOffset=1.0 (no modulation)', () => {
    const { lfoAmplitude, dcOffset } = tremoloLfoParams(0);
    expect(lfoAmplitude).toBe(0);
    expect(dcOffset).toBe(1.0);
  });

  it('depth=100 → lfoAmplitude=0.5, dcOffset=0.5 (full depth)', () => {
    const { lfoAmplitude, dcOffset } = tremoloLfoParams(100);
    expect(lfoAmplitude).toBeCloseTo(0.5);
    expect(dcOffset).toBeCloseTo(0.5);
  });

  it('depth=50 → lfoAmplitude=0.25, dcOffset=0.75', () => {
    const { lfoAmplitude, dcOffset } = tremoloLfoParams(50);
    expect(lfoAmplitude).toBeCloseTo(0.25);
    expect(dcOffset).toBeCloseTo(0.75);
  });
});

describe('Tremolo updateAudioParameter', () => {
  let tr: Tremolo;

  beforeEach(() => {
    tr = makeTremolo();
    tr.activate();
  });

  it('rate change is reflected in parameter value', () => {
    tr.setParameterValue('rate', 8.0);
    expect(tr.getParameter('rate')!.getValue()).toBe(8.0);
  });

  it('depth=0 sets lfoGain.gain to 0 and constantSource.offset to 1.0', () => {
    tr.setParameterValue('depth', 0);
    const lfoGain = tr.getAudioNode('lfoGain') as any;
    const cs = tr.getAudioNode('constantSource') as any;
    expect(lfoGain.gain.value).toBeCloseTo(0);
    expect(cs.offset.value).toBeCloseTo(1.0);
  });

  it('depth=100 sets lfoGain.gain to 0.5 and constantSource.offset to 0.5', () => {
    tr.setParameterValue('depth', 100);
    const lfoGain = tr.getAudioNode('lfoGain') as any;
    const cs = tr.getAudioNode('constantSource') as any;
    expect(lfoGain.gain.value).toBeCloseTo(0.5);
    expect(cs.offset.value).toBeCloseTo(0.5);
  });

  it('mix=0 → dryGain≈1, wetGain≈0 (fully dry)', () => {
    tr.setParameterValue('mix', 0);
    const dryGain = tr.getAudioNode('dryGain') as any;
    const wetGain = tr.getAudioNode('wetGain') as any;
    expect(dryGain.gain.value).toBeCloseTo(1.0);
    expect(wetGain.gain.value).toBeCloseTo(0.0);
  });

  it('mix=1 → dryGain≈0, wetGain≈1 (fully wet)', () => {
    tr.setParameterValue('mix', 1);
    const dryGain = tr.getAudioNode('dryGain') as any;
    const wetGain = tr.getAudioNode('wetGain') as any;
    expect(dryGain.gain.value).toBeCloseTo(0.0);
    expect(wetGain.gain.value).toBeCloseTo(1.0);
  });
});

describe('Tremolo bypass', () => {
  let tr: Tremolo;

  beforeEach(() => {
    tr = makeTremolo();
    tr.activate();
  });

  it('setBypass(true) sets isBypassed to true', () => {
    tr.setBypass(true);
    expect(tr.isBypassed).toBe(true);
  });

  it('setBypass(false) after bypass sets isBypassed to false', () => {
    tr.setBypass(true);
    tr.setBypass(false);
    expect(tr.isBypassed).toBe(false);
  });

  it('enableBypass wires inputGain directly to outputGain', () => {
    tr.setBypass(true);
    const inputGain = tr.getAudioNode('inputGain') as any;
    const outputGain = tr.getAudioNode('outputGain');
    expect(inputGain.isConnectedTo(outputGain)).toBe(true);
  });

  it('double-toggle (true→false→true) leaves isBypassed consistent', () => {
    tr.setBypass(true);
    tr.setBypass(false);
    tr.setBypass(true);
    expect(tr.isBypassed).toBe(true);
  });

  it('serialize includes isBypassed:true when bypassed', () => {
    tr.setBypass(true);
    expect(tr.serialize().isBypassed).toBe(true);
  });

  it('serialize omits isBypassed when not bypassed', () => {
    expect(tr.serialize().isBypassed).toBeUndefined();
  });
});
