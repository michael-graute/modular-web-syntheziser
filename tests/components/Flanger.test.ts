import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockGainNode, MockOscillatorNode, MockDelayNode } from '../mocks/WebAudioAPI.mock';

// ---------------------------------------------------------------------------
// Mock AudioEngine — must come before importing Flanger
// ---------------------------------------------------------------------------

const mockGain = () => new MockGainNode() as unknown as GainNode;
const mockOscillator = () => new MockOscillatorNode() as unknown as OscillatorNode;
const mockDelay = () => new MockDelayNode() as unknown as DelayNode;

const mockCtx = {
  currentTime: 0,
  createGain: vi.fn(mockGain),
  createOscillator: vi.fn(mockOscillator),
  createDelay: vi.fn(mockDelay),
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

import { Flanger } from '../../src/components/effects/Flanger';

function makeFlanger(): Flanger {
  return new Flanger('fl-test', { x: 0, y: 0 });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx.createGain.mockImplementation(mockGain);
  mockCtx.createOscillator.mockImplementation(mockOscillator);
  mockCtx.createDelay.mockImplementation(mockDelay);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Flanger constructor', () => {
  it('creates input and output ports', () => {
    const fl = makeFlanger();
    expect(fl.getInput('input')).toBeDefined();
    expect(fl.getOutput('output')).toBeDefined();
  });

  it('creates rate parameter with correct defaults', () => {
    const fl = makeFlanger();
    const p = fl.getParameter('rate');
    expect(p).toBeDefined();
    expect(p!.getValue()).toBe(0.5);
  });

  it('creates depth parameter with correct defaults', () => {
    const fl = makeFlanger();
    const p = fl.getParameter('depth');
    expect(p).toBeDefined();
    expect(p!.getValue()).toBe(50);
  });

  it('creates feedback parameter with correct defaults', () => {
    const fl = makeFlanger();
    const p = fl.getParameter('feedback');
    expect(p).toBeDefined();
    expect(p!.getValue()).toBe(0);
  });

  it('creates mix parameter defaulting to 0.5', () => {
    const fl = makeFlanger();
    const p = fl.getParameter('mix');
    expect(p).toBeDefined();
    expect(p!.getValue()).toBe(0.5);
  });

  it('is identified as bypassable', () => {
    expect(makeFlanger().isBypassable()).toBe(true);
  });
});

describe('Flanger createAudioNodes', () => {
  let fl: Flanger;

  beforeEach(() => {
    fl = makeFlanger();
    fl.activate();
  });

  it('creates a DelayNode', () => {
    expect(mockCtx.createDelay).toHaveBeenCalledWith(0.02);
  });

  it('creates an OscillatorNode for LFO', () => {
    expect(mockCtx.createOscillator).toHaveBeenCalled();
  });

  it('registers all expected audio nodes', () => {
    expect(fl.getAudioNode('inputGain')).toBeDefined();
    expect(fl.getAudioNode('delayNode')).toBeDefined();
    expect(fl.getAudioNode('feedbackGain')).toBeDefined();
    expect(fl.getAudioNode('lfo')).toBeDefined();
    expect(fl.getAudioNode('lfoGain')).toBeDefined();
    expect(fl.getAudioNode('dryGain')).toBeDefined();
    expect(fl.getAudioNode('wetGain')).toBeDefined();
    expect(fl.getAudioNode('outputGain')).toBeDefined();
  });

  it('getInputNode returns inputGain', () => {
    expect(fl.getInputNode()).toBe(fl.getAudioNode('inputGain'));
  });

  it('getOutputNode returns outputGain', () => {
    expect(fl.getOutputNode()).toBe(fl.getAudioNode('outputGain'));
  });

  it('LFO is started', () => {
    const lfo = fl.getAudioNode('lfo') as any;
    expect(lfo.isStarted).toBe(true);
  });
});

describe('Flanger updateAudioParameter', () => {
  let fl: Flanger;

  beforeEach(() => {
    fl = makeFlanger();
    fl.activate();
  });

  it('rate change is reflected in parameter value', () => {
    fl.setParameterValue('rate', 5.0);
    expect(fl.getParameter('rate')!.getValue()).toBe(5.0);
  });

  it('depth change is reflected in parameter value', () => {
    fl.setParameterValue('depth', 75);
    expect(fl.getParameter('depth')!.getValue()).toBe(75);
  });

  it('feedback is clamped: setting 100 keeps feedbackGain.gain ≤ 0.95', () => {
    fl.setParameterValue('feedback', 100);
    const feedbackGain = fl.getAudioNode('feedbackGain') as any;
    expect(feedbackGain.gain.value).toBeLessThanOrEqual(0.95);
  });

  it('feedback=0 sets feedbackGain.gain to 0', () => {
    fl.setParameterValue('feedback', 0);
    const feedbackGain = fl.getAudioNode('feedbackGain') as any;
    expect(feedbackGain.gain.value).toBeCloseTo(0);
  });

  it('feedback=95 sets feedbackGain.gain to 0.95', () => {
    fl.setParameterValue('feedback', 95);
    const feedbackGain = fl.getAudioNode('feedbackGain') as any;
    expect(feedbackGain.gain.value).toBeCloseTo(0.95);
  });

  it('mix=0 → dryGain≈1, wetGain≈0 (fully dry)', () => {
    fl.setParameterValue('mix', 0);
    const dryGain = fl.getAudioNode('dryGain') as any;
    const wetGain = fl.getAudioNode('wetGain') as any;
    expect(dryGain.gain.value).toBeCloseTo(1.0);
    expect(wetGain.gain.value).toBeCloseTo(0.0);
  });

  it('mix=1 → dryGain≈0, wetGain≈1 (fully wet)', () => {
    fl.setParameterValue('mix', 1);
    const dryGain = fl.getAudioNode('dryGain') as any;
    const wetGain = fl.getAudioNode('wetGain') as any;
    expect(dryGain.gain.value).toBeCloseTo(0.0);
    expect(wetGain.gain.value).toBeCloseTo(1.0);
  });
});

describe('Flanger bypass', () => {
  let fl: Flanger;

  beforeEach(() => {
    fl = makeFlanger();
    fl.activate();
  });

  it('setBypass(true) sets isBypassed to true', () => {
    fl.setBypass(true);
    expect(fl.isBypassed).toBe(true);
  });

  it('setBypass(false) after bypass sets isBypassed to false', () => {
    fl.setBypass(true);
    fl.setBypass(false);
    expect(fl.isBypassed).toBe(false);
  });

  it('enableBypass wires inputGain directly to outputGain', () => {
    fl.setBypass(true);
    const inputGain = fl.getAudioNode('inputGain') as any;
    const outputGain = fl.getAudioNode('outputGain');
    expect(inputGain.isConnectedTo(outputGain)).toBe(true);
  });

  it('double-toggle (true→false→true) leaves isBypassed consistent', () => {
    fl.setBypass(true);
    fl.setBypass(false);
    fl.setBypass(true);
    expect(fl.isBypassed).toBe(true);
  });

  it('serialize includes isBypassed:true when bypassed', () => {
    fl.setBypass(true);
    expect(fl.serialize().isBypassed).toBe(true);
  });

  it('serialize omits isBypassed when not bypassed', () => {
    expect(fl.serialize().isBypassed).toBeUndefined();
  });
});
