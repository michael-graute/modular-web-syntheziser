import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockGainNode, MockAnalyserNode } from '../mocks/WebAudioAPI.mock';
import { SignalType } from '../../src/core/types';

// ---------------------------------------------------------------------------
// Mock AudioEngine — must come before importing VuMeter
// ---------------------------------------------------------------------------

const mockGain = () => new MockGainNode() as unknown as GainNode;
const mockAnalyser = () => new MockAnalyserNode() as unknown as AnalyserNode;

const mockCtx = {
  currentTime: 0,
  createGain: vi.fn(mockGain),
  createAnalyser: vi.fn(mockAnalyser),
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

import { VuMeter } from '../../src/components/analyzers/VuMeter';

function makeVuMeter(): VuMeter {
  return new VuMeter('vu-test', { x: 0, y: 0 });
}

function makeActiveVuMeter(): VuMeter {
  const vm = makeVuMeter();
  vm.activate();
  return vm;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx.createGain.mockImplementation(mockGain);
  mockCtx.createAnalyser.mockImplementation(mockAnalyser);
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('VuMeter constructor', () => {
  it('has one input port "input" with SignalType.AUDIO', () => {
    const vm = makeVuMeter();
    const port = vm.inputs.get('input');
    expect(port).toBeDefined();
    expect(port!.type).toBe(SignalType.AUDIO);
    expect(port!.isInput).toBe(true);
  });

  it('has zero output ports', () => {
    const vm = makeVuMeter();
    expect(vm.outputs.size).toBe(0);
  });

  it('has zero parameters', () => {
    const vm = makeVuMeter();
    expect(vm.parameters.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getPeakLevel before activate
// ---------------------------------------------------------------------------

describe('VuMeter getPeakLevel before activate', () => {
  it('returns 0 when analyser is null', () => {
    const vm = makeVuMeter();
    expect(vm.getPeakLevel()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// activate / createAudioNodes
// ---------------------------------------------------------------------------

describe('VuMeter activate', () => {
  it('calls createGain and createAnalyser on the context', () => {
    makeActiveVuMeter();
    expect(mockCtx.createGain).toHaveBeenCalledTimes(1);
    expect(mockCtx.createAnalyser).toHaveBeenCalledTimes(1);
  });

  it('getInputNode() returns non-null after activate', () => {
    const vm = makeActiveVuMeter();
    expect(vm.getInputNode()).not.toBeNull();
  });

  it('getOutputNode() returns null after activate', () => {
    const vm = makeActiveVuMeter();
    expect(vm.getOutputNode()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getPeakLevel after activate
// ---------------------------------------------------------------------------

describe('VuMeter getPeakLevel after activate', () => {
  it('returns a value in [0, 1] (mock fills zeros → expects 0)', () => {
    const vm = makeActiveVuMeter();
    const level = vm.getPeakLevel();
    expect(level).toBeGreaterThanOrEqual(0);
    expect(level).toBeLessThanOrEqual(1);
    expect(level).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// destroyAudioNodes
// ---------------------------------------------------------------------------

describe('VuMeter destroyAudioNodes', () => {
  it('disconnects gain and analyser nodes', () => {
    const vm = makeActiveVuMeter();
    const gain = mockCtx.createGain.mock.results[0]!.value as MockGainNode;
    const analyser = mockCtx.createAnalyser.mock.results[0]!.value as MockAnalyserNode;

    vm.deactivate();

    expect(gain.connections).toHaveLength(0);
    expect(analyser.connections).toHaveLength(0);
  });

  it('getPeakLevel() returns 0 after deactivate', () => {
    const vm = makeActiveVuMeter();
    vm.deactivate();
    expect(vm.getPeakLevel()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// serialize (US3 verification)
// ---------------------------------------------------------------------------

describe('VuMeter serialize', () => {
  it('returns type === "vu-meter"', () => {
    const vm = makeVuMeter();
    const data = vm.serialize();
    expect(data.type).toBe('vu-meter');
  });

  it('returns parameters as empty object', () => {
    const vm = makeVuMeter();
    const data = vm.serialize();
    expect(data.parameters).toEqual({});
  });
});
