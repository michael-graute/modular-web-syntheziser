import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockGainNode } from '../mocks/WebAudioAPI.mock';

// ---------------------------------------------------------------------------
// Mock AudioEngine — must come before importing RingModulator
// ---------------------------------------------------------------------------

const mockGain = () => new MockGainNode() as unknown as GainNode;

const mockCtx = {
  currentTime: 0,
  createGain: vi.fn(mockGain),
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

import { RingModulator } from '../../src/components/effects/RingModulator';

function makeRM(): RingModulator {
  return new RingModulator('rm-test', { x: 0, y: 0 });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx.createGain.mockImplementation(mockGain);
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('RingModulator constructor', () => {
  it('creates audio-in and modulator input ports', () => {
    const rm = makeRM();
    expect(rm.getInput('audio-in')).toBeDefined();
    expect(rm.getInput('modulator')).toBeDefined();
  });

  it('creates a single audio output port', () => {
    const rm = makeRM();
    expect(rm.getOutput('output')).toBeDefined();
  });

  it('has no user-adjustable parameters', () => {
    const rm = makeRM();
    expect(rm.getParameterIds()).toHaveLength(0);
  });

  it('is identified as bypassable', () => {
    const rm = makeRM();
    expect(rm.isBypassable()).toBe(true);
  });

  it('is not bypassed by default', () => {
    const rm = makeRM();
    expect(rm.isBypassed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createAudioNodes
// ---------------------------------------------------------------------------

describe('RingModulator createAudioNodes', () => {
  let rm: RingModulator;

  beforeEach(() => {
    rm = makeRM();
    rm.activate();
  });

  it('creates exactly four GainNodes', () => {
    expect(mockCtx.createGain).toHaveBeenCalledTimes(4);
  });

  it('registers all four named nodes', () => {
    expect(rm.getAudioNode('carrierBypassGain')).toBeDefined();
    expect(rm.getAudioNode('modulatorEntry')).toBeDefined();
    expect(rm.getAudioNode('multiplierGain')).toBeDefined();
    expect(rm.getAudioNode('outputGain')).toBeDefined();
  });

  it('sets multiplierGain.gain base value to 0.0 (silence when modulator absent)', () => {
    const multiplierGain = rm.getAudioNode('multiplierGain') as any;
    expect(multiplierGain.gain.value).toBe(0.0);
  });

  it('sets carrierBypassGain and outputGain to gain 1.0', () => {
    const carrier = rm.getAudioNode('carrierBypassGain') as any;
    const output = rm.getAudioNode('outputGain') as any;
    expect(carrier.gain.value).toBe(1.0);
    expect(output.gain.value).toBe(1.0);
  });

  it('wires carrierBypassGain → multiplierGain', () => {
    const carrier = rm.getAudioNode('carrierBypassGain') as any;
    const multiplier = rm.getAudioNode('multiplierGain');
    expect(carrier.isConnectedTo(multiplier)).toBe(true);
  });

  it('wires modulatorEntry → multiplierGain.gain (AudioParam)', () => {
    const modEntry = rm.getAudioNode('modulatorEntry') as any;
    const multiplierGain = rm.getAudioNode('multiplierGain') as any;
    // connect(AudioParam) pushes to connections array via MockAudioNode.connect
    expect(modEntry.isConnectedTo(multiplierGain.gain)).toBe(true);
  });

  it('wires multiplierGain → outputGain', () => {
    const multiplier = rm.getAudioNode('multiplierGain') as any;
    const output = rm.getAudioNode('outputGain');
    expect(multiplier.isConnectedTo(output)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getInputNode routing
// ---------------------------------------------------------------------------

describe('RingModulator getInputNode routing', () => {
  let rm: RingModulator;

  beforeEach(() => {
    rm = makeRM();
    rm.activate();
  });

  it('"audio-in" returns carrierBypassGain', () => {
    expect(rm.getInputNode('audio-in')).toBe(rm.getAudioNode('carrierBypassGain'));
  });

  it('"modulator" returns modulatorEntry', () => {
    expect(rm.getInputNode('modulator')).toBe(rm.getAudioNode('modulatorEntry'));
  });

  it('default (no portId) returns carrierBypassGain', () => {
    expect(rm.getInputNode()).toBe(rm.getAudioNode('carrierBypassGain'));
  });

  it('unknown portId falls back to carrierBypassGain', () => {
    expect(rm.getInputNode('unknown')).toBe(rm.getAudioNode('carrierBypassGain'));
  });
});

// ---------------------------------------------------------------------------
// getOutputNode
// ---------------------------------------------------------------------------

describe('RingModulator getOutputNode', () => {
  it('returns outputGain', () => {
    const rm = makeRM();
    rm.activate();
    expect(rm.getOutputNode()).toBe(rm.getAudioNode('outputGain'));
  });
});

// ---------------------------------------------------------------------------
// updateAudioParameter (no-op)
// ---------------------------------------------------------------------------

describe('RingModulator updateAudioParameter', () => {
  it('does not throw for any parameter id', () => {
    const rm = makeRM();
    rm.activate();
    expect(() => rm.updateAudioParameter('anything', 42)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Bypass
// ---------------------------------------------------------------------------

describe('RingModulator bypass', () => {
  let rm: RingModulator;

  beforeEach(() => {
    rm = makeRM();
    rm.activate();
  });

  it('setBypass(true) sets isBypassed to true', () => {
    rm.setBypass(true);
    expect(rm.isBypassed).toBe(true);
  });

  it('setBypass(false) after bypass sets isBypassed to false', () => {
    rm.setBypass(true);
    rm.setBypass(false);
    expect(rm.isBypassed).toBe(false);
  });

  it('enableBypass connects carrierBypassGain directly to outputGain', () => {
    rm.setBypass(true);
    const carrier = rm.getAudioNode('carrierBypassGain') as any;
    const output = rm.getAudioNode('outputGain');
    expect(carrier.isConnectedTo(output)).toBe(true);
  });

  it('enableBypass disconnects carrierBypassGain from multiplierGain', () => {
    rm.setBypass(true);
    const carrier = rm.getAudioNode('carrierBypassGain') as any;
    const multiplier = rm.getAudioNode('multiplierGain');
    expect(carrier.isConnectedTo(multiplier)).toBe(false);
  });

  it('disableBypass restores carrierBypassGain → multiplierGain', () => {
    rm.setBypass(true);
    rm.setBypass(false);
    const carrier = rm.getAudioNode('carrierBypassGain') as any;
    const multiplier = rm.getAudioNode('multiplierGain');
    expect(carrier.isConnectedTo(multiplier)).toBe(true);
  });

  it('disableBypass restores multiplierGain → outputGain', () => {
    rm.setBypass(true);
    rm.setBypass(false);
    const multiplier = rm.getAudioNode('multiplierGain') as any;
    const output = rm.getAudioNode('outputGain');
    expect(multiplier.isConnectedTo(output)).toBe(true);
  });

  it('double-toggle (true→false→true) leaves isBypassed consistent', () => {
    rm.setBypass(true);
    rm.setBypass(false);
    rm.setBypass(true);
    expect(rm.isBypassed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

describe('RingModulator serialization', () => {
  it('serialize includes isBypassed:true when bypassed', () => {
    const rm = makeRM();
    rm.activate();
    rm.setBypass(true);
    expect(rm.serialize().isBypassed).toBe(true);
  });

  it('serialize omits isBypassed when not bypassed', () => {
    const rm = makeRM();
    rm.activate();
    expect(rm.serialize().isBypassed).toBeUndefined();
  });

  it('serialize produces an empty parameters object', () => {
    const rm = makeRM();
    rm.activate();
    expect(rm.serialize().parameters).toEqual({});
  });

  it('serialize includes type as ring-modulator', () => {
    const rm = makeRM();
    expect(rm.serialize().type).toBe('ring-modulator');
  });
});
