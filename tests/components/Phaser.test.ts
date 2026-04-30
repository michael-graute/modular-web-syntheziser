import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockGainNode, MockOscillatorNode, MockBiquadFilterNode } from '../mocks/WebAudioAPI.mock';

// ---------------------------------------------------------------------------
// Mock AudioEngine — must come before importing Phaser
// ---------------------------------------------------------------------------

const mockGain = () => new MockGainNode() as unknown as GainNode;
const mockOscillator = () => new MockOscillatorNode() as unknown as OscillatorNode;
const mockBiquad = () => new MockBiquadFilterNode() as unknown as BiquadFilterNode;

const mockCtx = {
  currentTime: 0,
  createGain: vi.fn(mockGain),
  createOscillator: vi.fn(mockOscillator),
  createBiquadFilter: vi.fn(mockBiquad),
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

import { Phaser } from '../../src/components/effects/Phaser';
import { isValidPhaserStages } from '../../src/components/effects/effectHelpers';

function makePhaser(): Phaser {
  return new Phaser('ph-test', { x: 0, y: 0 });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx.createGain.mockImplementation(mockGain);
  mockCtx.createOscillator.mockImplementation(mockOscillator);
  mockCtx.createBiquadFilter.mockImplementation(mockBiquad);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phaser constructor', () => {
  it('creates input and output ports', () => {
    const ph = makePhaser();
    expect(ph.getInput('input')).toBeDefined();
    expect(ph.getOutput('output')).toBeDefined();
  });

  it('creates rate parameter with correct defaults', () => {
    const ph = makePhaser();
    const p = ph.getParameter('rate');
    expect(p).toBeDefined();
    expect(p!.getValue()).toBe(0.5);
  });

  it('creates stages parameter defaulting to 4', () => {
    const ph = makePhaser();
    const p = ph.getParameter('stages');
    expect(p).toBeDefined();
    expect(p!.getValue()).toBe(4);
  });

  it('creates mix parameter defaulting to 0.5', () => {
    const ph = makePhaser();
    const p = ph.getParameter('mix');
    expect(p).toBeDefined();
    expect(p!.getValue()).toBe(0.5);
  });

  it('is identified as bypassable', () => {
    expect(makePhaser().isBypassable()).toBe(true);
  });
});

describe('Phaser createAudioNodes', () => {
  let ph: Phaser;

  beforeEach(() => {
    ph = makePhaser();
    ph.activate();
  });

  it('creates 4 allpass BiquadFilterNodes by default', () => {
    // stages=4 default → 4 createBiquadFilter calls
    expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(4);
  });

  it('all created filters have type allpass', () => {
    // Each call returns a MockBiquadFilterNode whose type we can inspect
    const calls = mockCtx.createBiquadFilter.mock.results;
    for (const call of calls) {
      expect((call.value as any).type).toBe('allpass');
    }
  });

  it('creates an OscillatorNode for LFO', () => {
    expect(mockCtx.createOscillator).toHaveBeenCalled();
  });

  it('registers allpass0 through allpass3', () => {
    expect(ph.getAudioNode('allpass0')).toBeDefined();
    expect(ph.getAudioNode('allpass1')).toBeDefined();
    expect(ph.getAudioNode('allpass2')).toBeDefined();
    expect(ph.getAudioNode('allpass3')).toBeDefined();
  });

  it('registers inputGain, dryGain, wetGain, outputGain, feedbackGain, lfo, lfoGain', () => {
    expect(ph.getAudioNode('inputGain')).toBeDefined();
    expect(ph.getAudioNode('dryGain')).toBeDefined();
    expect(ph.getAudioNode('wetGain')).toBeDefined();
    expect(ph.getAudioNode('outputGain')).toBeDefined();
    expect(ph.getAudioNode('feedbackGain')).toBeDefined();
    expect(ph.getAudioNode('lfo')).toBeDefined();
    expect(ph.getAudioNode('lfoGain')).toBeDefined();
  });

  it('getInputNode returns inputGain', () => {
    expect(ph.getInputNode()).toBe(ph.getAudioNode('inputGain'));
  });

  it('getOutputNode returns outputGain', () => {
    expect(ph.getOutputNode()).toBe(ph.getAudioNode('outputGain'));
  });

  it('LFO is started', () => {
    const lfo = ph.getAudioNode('lfo') as any;
    expect(lfo.isStarted).toBe(true);
  });
});

describe('Phaser updateAudioParameter — stages graph rebuild', () => {
  let ph: Phaser;

  beforeEach(() => {
    ph = makePhaser(); // stages default = 4
    ph.activate();
    vi.clearAllMocks();
    // Re-wire mocks after clearAllMocks so the rebuilt graph gets new instances
    mockCtx.createGain.mockImplementation(mockGain);
    mockCtx.createOscillator.mockImplementation(mockOscillator);
    mockCtx.createBiquadFilter.mockImplementation(mockBiquad);
  });

  it('changing stages to 2 triggers graph rebuild → 2 allpass filters', () => {
    ph.setParameterValue('stages', 2);
    // After rebuild, createBiquadFilter called exactly 2 times
    expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(2);
    expect(ph.getAudioNode('allpass0')).toBeDefined();
    expect(ph.getAudioNode('allpass1')).toBeDefined();
    expect(ph.getAudioNode('allpass2')).toBeUndefined();
  });

  it('changing stages to 8 triggers graph rebuild → 8 allpass filters', () => {
    ph.setParameterValue('stages', 8);
    expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(8);
    expect(ph.getAudioNode('allpass7')).toBeDefined();
  });

  it('invalid stages value (3) does not crash — defaults back to 4', () => {
    ph.setParameterValue('stages', 3);
    // graph rebuilt with default 4
    expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(4);
  });
});

describe('Phaser updateAudioParameter — parameters', () => {
  let ph: Phaser;

  beforeEach(() => {
    ph = makePhaser();
    ph.activate();
  });

  it('rate change is reflected in parameter value', () => {
    ph.setParameterValue('rate', 5.0);
    expect(ph.getParameter('rate')!.getValue()).toBe(5.0);
  });

  it('feedback is clamped: setting 100 keeps feedbackGain.gain ≤ 0.95', () => {
    ph.setParameterValue('feedback', 100);
    const feedbackGain = ph.getAudioNode('feedbackGain') as any;
    expect(feedbackGain.gain.value).toBeLessThanOrEqual(0.95);
  });

  it('feedback=95 sets feedbackGain.gain to 0.95', () => {
    ph.setParameterValue('feedback', 95);
    const feedbackGain = ph.getAudioNode('feedbackGain') as any;
    expect(feedbackGain.gain.value).toBeCloseTo(0.95);
  });

  it('mix=0 → dryGain≈1, wetGain≈0', () => {
    ph.setParameterValue('mix', 0);
    const dryGain = ph.getAudioNode('dryGain') as any;
    const wetGain = ph.getAudioNode('wetGain') as any;
    expect(dryGain.gain.value).toBeCloseTo(1.0);
    expect(wetGain.gain.value).toBeCloseTo(0.0);
  });

  it('mix=1 → dryGain≈0, wetGain≈1', () => {
    ph.setParameterValue('mix', 1);
    const dryGain = ph.getAudioNode('dryGain') as any;
    const wetGain = ph.getAudioNode('wetGain') as any;
    expect(dryGain.gain.value).toBeCloseTo(0.0);
    expect(wetGain.gain.value).toBeCloseTo(1.0);
  });
});

describe('Phaser isValidPhaserStages helper', () => {
  it('returns false for 3', () => expect(isValidPhaserStages(3)).toBe(false));
  it('returns false for 0', () => expect(isValidPhaserStages(0)).toBe(false));
  it('returns false for 10', () => expect(isValidPhaserStages(10)).toBe(false));
  it('returns true for 2', () => expect(isValidPhaserStages(2)).toBe(true));
  it('returns true for 4', () => expect(isValidPhaserStages(4)).toBe(true));
  it('returns true for 6', () => expect(isValidPhaserStages(6)).toBe(true));
  it('returns true for 8', () => expect(isValidPhaserStages(8)).toBe(true));
});

describe('Phaser bypass', () => {
  let ph: Phaser;

  beforeEach(() => {
    ph = makePhaser();
    ph.activate();
  });

  it('setBypass(true) sets isBypassed to true', () => {
    ph.setBypass(true);
    expect(ph.isBypassed).toBe(true);
  });

  it('setBypass(false) after bypass sets isBypassed to false', () => {
    ph.setBypass(true);
    ph.setBypass(false);
    expect(ph.isBypassed).toBe(false);
  });

  it('enableBypass wires inputGain directly to outputGain', () => {
    ph.setBypass(true);
    const inputGain = ph.getAudioNode('inputGain') as any;
    const outputGain = ph.getAudioNode('outputGain');
    expect(inputGain.isConnectedTo(outputGain)).toBe(true);
  });

  it('bypass works after stage-count change (stages=2)', () => {
    vi.clearAllMocks();
    mockCtx.createGain.mockImplementation(mockGain);
    mockCtx.createOscillator.mockImplementation(mockOscillator);
    mockCtx.createBiquadFilter.mockImplementation(mockBiquad);

    ph.setParameterValue('stages', 2);
    ph.setBypass(true);
    expect(ph.isBypassed).toBe(true);
    const inputGain = ph.getAudioNode('inputGain') as any;
    const outputGain = ph.getAudioNode('outputGain');
    expect(inputGain.isConnectedTo(outputGain)).toBe(true);
  });

  it('double-toggle leaves isBypassed consistent', () => {
    ph.setBypass(true);
    ph.setBypass(false);
    ph.setBypass(true);
    expect(ph.isBypassed).toBe(true);
  });

  it('serialize includes isBypassed:true when bypassed', () => {
    ph.setBypass(true);
    expect(ph.serialize().isBypassed).toBe(true);
  });

  it('serialize omits isBypassed when not bypassed', () => {
    expect(ph.serialize().isBypassed).toBeUndefined();
  });
});
