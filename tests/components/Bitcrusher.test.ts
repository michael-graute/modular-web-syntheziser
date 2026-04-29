import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockGainNode, MockScriptProcessorNode } from '../mocks/WebAudioAPI.mock';

// ---------------------------------------------------------------------------
// Mock AudioEngine — must come before importing Bitcrusher
// ---------------------------------------------------------------------------

const mockGain = () => {
  const node = new MockGainNode();
  return node as unknown as GainNode;
};

const mockScriptProcessor = () => {
  const node = new MockScriptProcessorNode(256);
  return node as unknown as ScriptProcessorNode;
};

const mockCtx = {
  currentTime: 0,
  createGain: vi.fn(mockGain),
  createScriptProcessor: vi.fn(mockScriptProcessor),
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

import { Bitcrusher } from '../../src/components/effects/Bitcrusher';

function makeBitcrusher(): Bitcrusher {
  return new Bitcrusher('bc-test', { x: 0, y: 0 });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx.createGain.mockImplementation(mockGain);
  mockCtx.createScriptProcessor.mockImplementation(mockScriptProcessor);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Bitcrusher constructor', () => {
  it('creates input and output ports', () => {
    const bc = makeBitcrusher();
    expect(bc.getInput('input')).toBeDefined();
    expect(bc.getOutput('output')).toBeDefined();
  });

  it('creates bitDepth parameter with correct defaults', () => {
    const bc = makeBitcrusher();
    const p = bc.getParameter('bitDepth');
    expect(p).toBeDefined();
    expect(p!.getValue()).toBe(16);
  });

  it('creates sampleRate parameter with correct defaults', () => {
    const bc = makeBitcrusher();
    const p = bc.getParameter('sampleRate');
    expect(p).toBeDefined();
    expect(p!.getValue()).toBe(100);
  });

  it('creates mix parameter defaulting to 1.0 (fully wet)', () => {
    const bc = makeBitcrusher();
    const p = bc.getParameter('mix');
    expect(p).toBeDefined();
    expect(p!.getValue()).toBe(1.0);
  });

  it('is identified as bypassable', () => {
    const bc = makeBitcrusher();
    expect(bc.isBypassable()).toBe(true);
  });
});

describe('Bitcrusher createAudioNodes', () => {
  let bc: Bitcrusher;

  beforeEach(() => {
    bc = makeBitcrusher();
    bc.activate();
  });

  it('creates a ScriptProcessorNode', () => {
    expect(mockCtx.createScriptProcessor).toHaveBeenCalledWith(256, 1, 1);
  });

  it('registers inputGain, dryGain, wetGain, outputGain, scriptNode', () => {
    expect(bc.getAudioNode('inputGain')).toBeDefined();
    expect(bc.getAudioNode('dryGain')).toBeDefined();
    expect(bc.getAudioNode('wetGain')).toBeDefined();
    expect(bc.getAudioNode('outputGain')).toBeDefined();
    expect(bc.getAudioNode('scriptNode')).toBeDefined();
  });

  it('getInputNode returns inputGain', () => {
    expect(bc.getInputNode()).toBe(bc.getAudioNode('inputGain'));
  });

  it('getOutputNode returns outputGain', () => {
    expect(bc.getOutputNode()).toBe(bc.getAudioNode('outputGain'));
  });

  it('attaches onaudioprocess handler to scriptNode', () => {
    const scriptNode = bc.getAudioNode('scriptNode') as any;
    expect(scriptNode.onaudioprocess).toBeTypeOf('function');
  });
});

describe('Bitcrusher updateAudioParameter', () => {
  let bc: Bitcrusher;

  beforeEach(() => {
    bc = makeBitcrusher();
    bc.activate();
  });

  it('bitDepth change is reflected in parameter value', () => {
    bc.setParameterValue('bitDepth', 4);
    expect(bc.getParameter('bitDepth')!.getValue()).toBe(4);
  });

  it('sampleRate change is reflected in parameter value', () => {
    bc.setParameterValue('sampleRate', 25);
    expect(bc.getParameter('sampleRate')!.getValue()).toBe(25);
  });

  it('mix=0.5 applies equal-power crossfade to both gains', () => {
    bc.setParameterValue('mix', 0.5);
    const dryGain = bc.getAudioNode('dryGain') as any;
    const wetGain = bc.getAudioNode('wetGain') as any;
    expect(dryGain.gain.value).toBeCloseTo(Math.cos(0.5 * 0.5 * Math.PI));
    expect(wetGain.gain.value).toBeCloseTo(Math.cos(0.5 * 0.5 * Math.PI));
  });

  it('mix=0 → dryGain≈1, wetGain≈0 (fully dry)', () => {
    bc.setParameterValue('mix', 0);
    const dryGain = bc.getAudioNode('dryGain') as any;
    const wetGain = bc.getAudioNode('wetGain') as any;
    expect(dryGain.gain.value).toBeCloseTo(1.0);
    expect(wetGain.gain.value).toBeCloseTo(0.0);
  });

  it('mix=1 → dryGain≈0, wetGain≈1 (fully wet)', () => {
    bc.setParameterValue('mix', 1);
    const dryGain = bc.getAudioNode('dryGain') as any;
    const wetGain = bc.getAudioNode('wetGain') as any;
    expect(dryGain.gain.value).toBeCloseTo(0.0);
    expect(wetGain.gain.value).toBeCloseTo(1.0);
  });
});

describe('Bitcrusher bypass', () => {
  let bc: Bitcrusher;

  beforeEach(() => {
    bc = makeBitcrusher();
    bc.activate();
  });

  it('setBypass(true) sets isBypassed to true', () => {
    bc.setBypass(true);
    expect(bc.isBypassed).toBe(true);
  });

  it('setBypass(false) after bypass sets isBypassed to false', () => {
    bc.setBypass(true);
    bc.setBypass(false);
    expect(bc.isBypassed).toBe(false);
  });

  it('enableBypass wires inputGain directly to outputGain', () => {
    bc.setBypass(true);
    const inputGain = bc.getAudioNode('inputGain') as any;
    const outputGain = bc.getAudioNode('outputGain');
    expect(inputGain.isConnectedTo(outputGain)).toBe(true);
  });

  it('double-toggle (true→false→true) leaves isBypassed consistent', () => {
    bc.setBypass(true);
    bc.setBypass(false);
    bc.setBypass(true);
    expect(bc.isBypassed).toBe(true);
  });

  it('serialize includes isBypassed:true when bypassed', () => {
    bc.setBypass(true);
    expect(bc.serialize().isBypassed).toBe(true);
  });

  it('serialize omits isBypassed when not bypassed', () => {
    expect(bc.serialize().isBypassed).toBeUndefined();
  });
});
