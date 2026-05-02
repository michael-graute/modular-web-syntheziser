import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockGainNode, MockOscillatorNode } from '../../mocks/WebAudioAPI.mock';

// ---------------------------------------------------------------------------
// Mock AudioEngine — must come before importing FMOscillator
// ---------------------------------------------------------------------------

const mockOscillator = () => {
  const node = new MockOscillatorNode();
  return node as unknown as OscillatorNode;
};

const mockGain = () => {
  const node = new MockGainNode();
  return node as unknown as GainNode;
};

const mockCtx = {
  currentTime: 0,
  createOscillator: vi.fn(mockOscillator),
  createGain: vi.fn(mockGain),
};

vi.mock('../../../src/core/AudioEngine', () => ({
  audioEngine: {
    isReady: () => true,
    getContext: () => mockCtx,
    addNode: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import after mock is registered
// ---------------------------------------------------------------------------

import { FMOscillator } from '../../../src/components/generators/FMOscillator';
import { ComponentType, SignalType } from '../../../src/core/types';

function makeFMOscillator(): FMOscillator {
  return new FMOscillator('fm-osc-test', { x: 0, y: 0 });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx.createOscillator.mockImplementation(mockOscillator);
  mockCtx.createGain.mockImplementation(mockGain);
  // Provide a no-op setInterval so the Oscillator frequency monitor doesn't fail
  vi.stubGlobal('setInterval', vi.fn(() => 1));
  vi.stubGlobal('clearInterval', vi.fn());
});

// ---------------------------------------------------------------------------
// T010 — Constructor
// ---------------------------------------------------------------------------

describe('FMOscillator constructor', () => {
  it('has type FM_OSCILLATOR', () => {
    const osc = makeFMOscillator();
    expect(osc.type).toBe(ComponentType.FM_OSCILLATOR);
  });

  it('has name "FM Oscillator"', () => {
    const osc = makeFMOscillator();
    expect(osc.name).toBe('FM Oscillator');
  });

  it('has frequency input port', () => {
    const osc = makeFMOscillator();
    const port = osc.getInput('frequency');
    expect(port).toBeDefined();
    expect(port!.type).toBe(SignalType.CV);
    expect(port!.isInput).toBe(true);
  });

  it('has detune input port', () => {
    const osc = makeFMOscillator();
    const port = osc.getInput('detune');
    expect(port).toBeDefined();
    expect(port!.type).toBe(SignalType.CV);
    expect(port!.isInput).toBe(true);
  });

  it('has fm input port of AUDIO type', () => {
    const osc = makeFMOscillator();
    const port = osc.getInput('fm');
    expect(port).toBeDefined();
    expect(port!.type).toBe(SignalType.AUDIO);
    expect(port!.isInput).toBe(true);
  });

  it('has output port', () => {
    const osc = makeFMOscillator();
    const port = osc.getOutput('output');
    expect(port).toBeDefined();
    expect(port!.isInput).toBe(false);
  });

  it('has fmDepth parameter with default value 100', () => {
    const osc = makeFMOscillator();
    const param = osc.getParameter('fmDepth');
    expect(param).toBeDefined();
    expect(param!.getValue()).toBe(100);
    expect(param!.min).toBe(0);
    expect(param!.max).toBe(1000);
    expect(param!.step).toBe(1);
    expect(param!.unit).toBe('Hz');
  });
});

// ---------------------------------------------------------------------------
// T011 — After activate(), getAudioNode('fmInput') returns a GainNode
// ---------------------------------------------------------------------------

describe('FMOscillator after activate()', () => {
  let osc: FMOscillator;

  beforeEach(() => {
    osc = makeFMOscillator();
    osc.activate();
  });

  it('T011 — getAudioNode("fmInput") returns a GainNode', () => {
    const node = osc.getAudioNode('fmInput');
    expect(node).toBeDefined();
    // MockGainNode has a 'gain' property — use that as a GainNode discriminator
    expect((node as any).gain).toBeDefined();
  });

  // T012 — getInputNode('fm') returns the same GainNode as getAudioNode('fmInput')
  it('T012 — getInputNode("fm") returns the same node as getAudioNode("fmInput")', () => {
    const fromRegistry = osc.getAudioNode('fmInput');
    const fromPort = osc.getInputNode('fm');
    expect(fromPort).toBe(fromRegistry);
  });

  // T013 — getInputNode for a non-FM port falls through to super (returns null)
  it('T013 — getInputNode("output") falls through to super and returns null', () => {
    expect(osc.getInputNode('output')).toBeNull();
  });

  // T014 — getOutputNode() returns an OscillatorNode (inherited)
  it('T014 — getOutputNode() returns an OscillatorNode', () => {
    const node = osc.getOutputNode();
    expect(node).toBeDefined();
    // MockOscillatorNode has start/stop — use that as an OscillatorNode discriminator
    expect(typeof (node as any).start).toBe('function');
    expect(typeof (node as any).stop).toBe('function');
    expect(typeof (node as any).frequency).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// T015 — End-to-end FM connection path note
// ---------------------------------------------------------------------------
// No code change is needed in ConnectionManager.ts. When an AUDIO output port
// is connected to the FMOscillator's 'fm' input port, SynthComponent.connectTo()
// takes the audio branch (line ~276 of SynthComponent.ts):
//
//   const inputNode = target.getInputNode(inputId);  // inputId === 'fm'
//   outputNode.connect(inputNode);
//
// FMOscillator.getInputNode('fm') returns this.fmGain, so the modulator signal
// flows:  modulator → fmGain → carrierOscillator.frequency
// This test simply confirms that the routing works without additional code.

// ---------------------------------------------------------------------------
// Phase 4 — User Story 2: FM Depth parameter control (T017–T019)
// ---------------------------------------------------------------------------

describe('FMOscillator FM Depth parameter control', () => {
  let osc: FMOscillator;

  beforeEach(() => {
    osc = makeFMOscillator();
    osc.activate();
  });

  // T017 — setParameterValue('fmDepth', 200) updates fmGain.gain.value to 200
  it('T017 — setParameterValue("fmDepth", 200) sets fmGain.gain.value to 200', () => {
    osc.setParameterValue('fmDepth', 200);
    const gainNode = osc.getAudioNode('fmInput') as any;
    expect(gainNode.gain.value).toBe(200);
  });

  // T018 — setParameterValue('fmDepth', 0) sets fmGain.gain.value to 0
  it('T018 — setParameterValue("fmDepth", 0) sets fmGain.gain.value to 0', () => {
    osc.setParameterValue('fmDepth', 0);
    const gainNode = osc.getAudioNode('fmInput') as any;
    expect(gainNode.gain.value).toBe(0);
  });

  // T019 — serialize() captures fmDepth; a fresh instance deserializes it correctly
  it('T019 — serialize() includes fmDepth; deserialize() restores it', () => {
    osc.setParameterValue('fmDepth', 750);
    const data = osc.serialize();

    expect(data.parameters['fmDepth']).toBe(750);

    // Restore into a fresh instance
    const osc2 = makeFMOscillator();
    osc2.activate();
    osc2.deserialize(data);

    expect(osc2.getParameter('fmDepth')!.getValue()).toBe(750);
  });
});

// ---------------------------------------------------------------------------
// Phase 5 — User Story 3: CV modulation of FM Depth (T022–T023)
// ---------------------------------------------------------------------------

describe('FMOscillator CV modulation of FM Depth', () => {
  let osc: FMOscillator;

  beforeEach(() => {
    osc = makeFMOscillator();
    osc.activate();
  });

  // T022 — after linkAudioParam is called on fmDepth, fmGain.gain.connect was called
  it('T022 — fmDepth parameter is linked to fmGain.gain (linkAudioParam called during createAudioNodes)', () => {
    const gainNode = osc.getAudioNode('fmInput') as any;
    // The fmDepth parameter links to fmGain.gain inside createAudioNodes().
    // MockGainNode.gain tracks connect calls — verify the AudioParam was connected.
    // linkAudioParam() sets parameter.audioParam = fmGain.gain.
    // The key observable fact is that the fmDepth Parameter's audioParam points to fmGain.gain.
    const fmDepthParam = osc.getParameter('fmDepth');
    expect(fmDepthParam).toBeDefined();
    expect((fmDepthParam as any).audioParam).toBe(gainNode.gain);
  });

  // T023 — getAudioParamForInput('fm') returns null (FM port is AudioNode-routed, not AudioParam-routed)
  it('T023 — getAudioParamForInput("fm") returns null', () => {
    expect((osc as any).getAudioParamForInput('fm')).toBeNull();
  });

  // fmDepth_cv port exists and is a CV input
  it('has fmDepth_cv input port of CV type', () => {
    const port = osc.getInput('fmDepth_cv');
    expect(port).toBeDefined();
    expect(port!.type).toBe(SignalType.CV);
    expect(port!.isInput).toBe(true);
  });

  // getAudioParamForInput('fmDepth_cv') returns fmGain.gain — enables LFO→fmDepth modulation
  it('getAudioParamForInput("fmDepth_cv") returns fmGain.gain AudioParam', () => {
    const gainNode = osc.getAudioNode('fmInput') as any;
    const audioParam = (osc as any).getAudioParamForInput('fmDepth_cv');
    expect(audioParam).toBeDefined();
    expect(audioParam).toBe(gainNode.gain);
  });
});
