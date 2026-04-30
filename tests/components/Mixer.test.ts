import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockGainNode, MockStereoPannerNode } from '../mocks/WebAudioAPI.mock';

// ---------------------------------------------------------------------------
// Mock AudioEngine — must come before importing Mixer
// ---------------------------------------------------------------------------

const mockGain = () => new MockGainNode() as unknown as GainNode;
const mockPanner = () => new MockStereoPannerNode() as unknown as StereoPannerNode;

const mockCtx = {
  currentTime: 0,
  createGain: vi.fn(mockGain),
  createStereoPanner: vi.fn(mockPanner),
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

import { Mixer } from '../../src/components/utilities/Mixer';

function makeMixer(): Mixer {
  return new Mixer('mix-test', { x: 0, y: 0 });
}

function makeActiveMixer(): Mixer {
  const mixer = makeMixer();
  mixer.activate();
  return mixer;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx.createGain.mockImplementation(mockGain);
  mockCtx.createStereoPanner.mockImplementation(mockPanner);
});

// ---------------------------------------------------------------------------
// Constructor — parameters
// ---------------------------------------------------------------------------

describe('Mixer constructor', () => {
  it('registers gain1–gain4 with default 0.75', () => {
    const mixer = makeMixer();
    for (let i = 1; i <= 4; i++) {
      const p = mixer.getParameter(`gain${i}`);
      expect(p, `gain${i} missing`).toBeDefined();
      expect(p!.getValue()).toBe(0.75);
    }
  });

  it('registers master parameter with default 0.75', () => {
    const mixer = makeMixer();
    const p = mixer.getParameter('master');
    expect(p).toBeDefined();
    expect(p!.getValue()).toBe(0.75);
  });

  it('registers pan1–pan4 with default 0.0', () => {
    const mixer = makeMixer();
    for (let i = 1; i <= 4; i++) {
      const p = mixer.getParameter(`pan${i}`);
      expect(p, `pan${i} missing`).toBeDefined();
      expect(p!.getValue()).toBe(0.0);
    }
  });

  it('pan parameters have range [−1.0, +1.0] and step 0.01', () => {
    const mixer = makeMixer();
    for (let i = 1; i <= 4; i++) {
      const p = mixer.getParameter(`pan${i}`);
      expect(p!.min).toBe(-1.0);
      expect(p!.max).toBe(1.0);
      expect(p!.step).toBe(0.01);
    }
  });
});

// ---------------------------------------------------------------------------
// createAudioNodes — node creation and signal chain
// ---------------------------------------------------------------------------

describe('Mixer createAudioNodes', () => {
  it('creates exactly 4 StereoPannerNodes', () => {
    makeActiveMixer();
    expect(mockCtx.createStereoPanner).toHaveBeenCalledTimes(4);
  });

  it('creates 9 GainNodes (4 input + 4 channel + 1 output)', () => {
    makeActiveMixer();
    expect(mockCtx.createGain).toHaveBeenCalledTimes(9);
  });

  it('wires signal chain: channelGain → stereoPanner → outputGain', () => {
    const mixer = makeActiveMixer();

    // The mock tracks connections via MockAudioNode.connections
    const panners = mockCtx.createStereoPanner.mock.results.map(r => r.value as MockStereoPannerNode);
    const gains = mockCtx.createGain.mock.results.map(r => r.value as MockGainNode);
    // createGain order: outputGain first, then for each channel: inputGain, channelGain
    const outputGain = gains[0];
    for (let i = 0; i < 4; i++) {
      const channelGain = gains[1 + i * 2 + 1]; // interleaved: inputGain[i], channelGain[i]
      const panner = panners[i];
      expect(channelGain!.isConnectedTo(panner as unknown as AudioNode),
        `channelGain${i + 1} must connect to stereoPanner${i + 1}`).toBe(true);
      expect(panner!.isConnectedTo(outputGain as unknown as AudioNode),
        `stereoPanner${i + 1} must connect to outputGain`).toBe(true);
    }
    expect(mixer).toBeDefined();
  });

  it('initialises each panner pan value from parameter default (0.0)', () => {
    makeActiveMixer();
    const panners = mockCtx.createStereoPanner.mock.results.map(r => r.value as MockStereoPannerNode);
    panners.forEach((p, i) => {
      expect(p.pan.value, `panner${i + 1} initial pan`).toBe(0.0);
    });
  });
});

// ---------------------------------------------------------------------------
// updateAudioParameter — pan channels independently
// ---------------------------------------------------------------------------

describe('Mixer updateAudioParameter pan', () => {
  it('sets pan on stereoPanner1 when pan1 is updated', () => {
    const mixer = makeActiveMixer();
    const panners = mockCtx.createStereoPanner.mock.results.map(r => r.value as MockStereoPannerNode);

    mixer.setParameterValue('pan1', -0.8);

    expect(panners[0]!.pan.value).toBe(-0.8);
  });

  it('sets pan on stereoPanner4 when pan4 is updated', () => {
    const mixer = makeActiveMixer();
    const panners = mockCtx.createStereoPanner.mock.results.map(r => r.value as MockStereoPannerNode);

    mixer.setParameterValue('pan4', 0.5);

    expect(panners[3]!.pan.value).toBe(0.5);
  });

  it('updating pan1 does not affect stereoPanner2–4', () => {
    const mixer = makeActiveMixer();
    const panners = mockCtx.createStereoPanner.mock.results.map(r => r.value as MockStereoPannerNode);

    mixer.setParameterValue('pan1', -1.0);

    expect(panners[1]!.pan.value).toBe(0.0);
    expect(panners[2]!.pan.value).toBe(0.0);
    expect(panners[3]!.pan.value).toBe(0.0);
  });

  it('all four panners can be set to independent values', () => {
    const mixer = makeActiveMixer();
    const panners = mockCtx.createStereoPanner.mock.results.map(r => r.value as MockStereoPannerNode);

    mixer.setParameterValue('pan1', -1.0);
    mixer.setParameterValue('pan2', -0.5);
    mixer.setParameterValue('pan3', 0.5);
    mixer.setParameterValue('pan4', 1.0);

    expect(panners[0]!.pan.value).toBe(-1.0);
    expect(panners[1]!.pan.value).toBe(-0.5);
    expect(panners[2]!.pan.value).toBe(0.5);
    expect(panners[3]!.pan.value).toBe(1.0);
  });

  it('calls setValueAtTime on the correct AudioParam', () => {
    const mixer = makeActiveMixer();
    const panners = mockCtx.createStereoPanner.mock.results.map(r => r.value as MockStereoPannerNode);
    const spy = vi.spyOn(panners[1]!.pan, 'setValueAtTime');

    mixer.setParameterValue('pan2', 0.7);

    expect(spy).toHaveBeenCalledWith(0.7, mockCtx.currentTime);
  });
});

// ---------------------------------------------------------------------------
// Patch serialization — US2
// ---------------------------------------------------------------------------

describe('Mixer patch round-trip', () => {
  it('serialize includes pan1–pan4 in parameters', () => {
    const mixer = makeActiveMixer();
    mixer.setParameterValue('pan1', -0.5);
    mixer.setParameterValue('pan2', 0.0);
    mixer.setParameterValue('pan3', 0.5);
    mixer.setParameterValue('pan4', 1.0);

    const data = mixer.serialize();
    expect(data.parameters['pan1']).toBe(-0.5);
    expect(data.parameters['pan2']).toBe(0.0);
    expect(data.parameters['pan3']).toBe(0.5);
    expect(data.parameters['pan4']).toBe(1.0);
  });

  it('deserialize restores pan values and applies them to panners', () => {
    const mixer = makeActiveMixer();
    const panners = mockCtx.createStereoPanner.mock.results.map(r => r.value as MockStereoPannerNode);

    mixer.deserialize({
      id: 'mix-test',
      type: 'MIXER',
      position: { x: 0, y: 0 },
      parameters: {
        gain1: 0.75, gain2: 0.75, gain3: 0.75, gain4: 0.75,
        master: 0.75,
        pan1: -0.4, pan2: 0.1, pan3: 0.6, pan4: -0.9,
      },
      inputs: {},
      outputs: {},
    });

    expect(mixer.getParameter('pan1')!.getValue()).toBe(-0.4);
    expect(mixer.getParameter('pan2')!.getValue()).toBe(0.1);
    expect(mixer.getParameter('pan3')!.getValue()).toBe(0.6);
    expect(mixer.getParameter('pan4')!.getValue()).toBe(-0.9);
    // Applied to audio nodes
    expect(panners[0]!.pan.value).toBe(-0.4);
    expect(panners[3]!.pan.value).toBe(-0.9);
  });

  it('legacy patch without pan keys loads without error, defaults all pans to 0.0', () => {
    const mixer = makeActiveMixer();

    expect(() => {
      mixer.deserialize({
        id: 'mix-test',
        type: 'MIXER',
        position: { x: 0, y: 0 },
        parameters: {
          gain1: 0.6, gain2: 0.6, gain3: 0.6, gain4: 0.6, master: 0.6,
          // no pan keys
        },
        inputs: {},
        outputs: {},
      });
    }).not.toThrow();

    for (let i = 1; i <= 4; i++) {
      expect(mixer.getParameter(`pan${i}`)!.getValue()).toBe(0.0);
    }
  });
});

// ---------------------------------------------------------------------------
// Bypass — pan nodes included in bypass connections
// ---------------------------------------------------------------------------

describe('Mixer bypass', () => {
  it('disconnects panners when bypass is enabled', () => {
    const mixer = makeActiveMixer();
    const panners = mockCtx.createStereoPanner.mock.results.map(r => r.value as MockStereoPannerNode);
    const spies = panners.map(p => vi.spyOn(p, 'disconnect'));

    mixer.setBypass(true);

    spies.forEach((spy, i) => {
      expect(spy, `panner${i + 1} disconnect not called`).toHaveBeenCalled();
    });
  });

  it('restores panner connections after disabling bypass', () => {
    const mixer = makeActiveMixer();
    const panners = mockCtx.createStereoPanner.mock.results.map(r => r.value as MockStereoPannerNode);

    mixer.setBypass(true);
    // Clear connections state to verify restore
    panners.forEach(p => { (p as unknown as MockStereoPannerNode).connections = []; });

    mixer.setBypass(false);

    // After restore each panner should be reconnected to outputGain
    const gains = mockCtx.createGain.mock.results.map(r => r.value as MockGainNode);
    const outputGain = gains[0];
    panners.forEach((p, i) => {
      expect(p.isConnectedTo(outputGain as unknown as AudioNode),
        `panner${i + 1} not reconnected to outputGain after bypass disabled`).toBe(true);
    });
  });
});
