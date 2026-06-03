/**
 * SlewLimiter — component tests (≥80% coverage).
 * Feature: 031-slew-limiter-portamento (T005)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MockGainNode,
  MockAnalyserNode,
  MockConstantSourceNode,
} from '../../mocks/WebAudioAPI.mock';
import type { MockConstantSourceNode as MockCSN } from '../../mocks/WebAudioAPI.mock';
import { SignalType } from '../../../src/core/types';

// ---------------------------------------------------------------------------
// Mock AudioEngine — must come before importing SlewLimiter
// ---------------------------------------------------------------------------

const mockGain = () => new MockGainNode() as unknown as GainNode;
const mockAnalyser = () => new MockAnalyserNode() as unknown as AnalyserNode;
const mockConstantSource = () => new MockConstantSourceNode() as unknown as ConstantSourceNode;

const mockCtx = {
  currentTime: 0,
  createGain: vi.fn(mockGain),
  createAnalyser: vi.fn(mockAnalyser),
  createConstantSource: vi.fn(mockConstantSource),
};

vi.mock('../../../src/core/AudioEngine', () => ({
  audioEngine: {
    isReady: () => true,
    getContext: () => mockCtx,
    addNode: vi.fn(),
  },
}));

import { SlewLimiter } from '../../../src/components/utilities/SlewLimiter';

function makeSL(): SlewLimiter {
  return new SlewLimiter('sl-test', { x: 0, y: 0 });
}

function makeActiveSL(): SlewLimiter {
  const sl = makeSL();
  sl.activate();
  return sl;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx.createGain.mockImplementation(mockGain);
  mockCtx.createAnalyser.mockImplementation(mockAnalyser);
  mockCtx.createConstantSource.mockImplementation(mockConstantSource);
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('SlewLimiter constructor', () => {
  it('has input port "input" with SignalType.CV', () => {
    const sl = makeSL();
    const port = sl.inputs.get('input');
    expect(port).toBeDefined();
    expect(port!.type).toBe(SignalType.CV);
    expect(port!.isInput).toBe(true);
  });

  it('has output port "cv" with SignalType.CV', () => {
    const sl = makeSL();
    const port = sl.outputs.get('cv');
    expect(port).toBeDefined();
    expect(port!.type).toBe(SignalType.CV);
    expect(port!.isInput).toBe(false);
  });

  it('has rise parameter with default 50', () => {
    expect(makeSL().getParameter('rise')?.getValue()).toBe(50);
  });

  it('has fall parameter with default 50', () => {
    expect(makeSL().getParameter('fall')?.getValue()).toBe(50);
  });

  it('getOutputValue() returns 0 before activation', () => {
    expect(makeSL().getOutputValue()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// activate / createAudioNodes
// ---------------------------------------------------------------------------

describe('SlewLimiter activate', () => {
  it('creates gain, analyser, and constant source nodes', () => {
    makeActiveSL();
    expect(mockCtx.createGain).toHaveBeenCalledTimes(1);
    expect(mockCtx.createAnalyser).toHaveBeenCalledTimes(1);
    expect(mockCtx.createConstantSource).toHaveBeenCalledTimes(1);
  });

  it('getInputNode() returns non-null after activate', () => {
    expect(makeActiveSL().getInputNode()).not.toBeNull();
  });

  it('getOutputNode() returns non-null after activate', () => {
    expect(makeActiveSL().getOutputNode()).not.toBeNull();
  });

  it('cvNode is started on activate', () => {
    makeActiveSL();
    const cvNode = mockCtx.createConstantSource.mock.results[0]!.value as MockCSN;
    expect(cvNode.isStarted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tick() — slew rises and falls
// ---------------------------------------------------------------------------

describe('SlewLimiter tick', () => {
  it('output rises toward a positive CV target', () => {
    const sl = makeActiveSL();
    const analyser = mockCtx.createAnalyser.mock.results[0]!.value as MockAnalyserNode;

    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => {
      arr.fill(0.8);
    });

    const before = sl.getOutputValue();
    sl.tick(1 / 60);
    expect(sl.getOutputValue()).toBeGreaterThan(before);
  });

  it('output falls toward zero when CV input is zero', () => {
    const sl = makeActiveSL();
    const analyser = mockCtx.createAnalyser.mock.results[0]!.value as MockAnalyserNode;

    // Drive up first
    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(1.0));
    for (let i = 0; i < 30; i++) sl.tick(1 / 60);
    const peak = sl.getOutputValue();
    expect(peak).toBeGreaterThan(0);

    // Now silence
    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(0));
    sl.tick(1 / 60);
    expect(sl.getOutputValue()).toBeLessThan(peak);
  });

  it('pass-through (no slew) when rise = 0 and fall = 0', () => {
    const sl = makeActiveSL();
    sl.setParameterValue('rise', 0);
    sl.setParameterValue('fall', 0);
    const analyser = mockCtx.createAnalyser.mock.results[0]!.value as MockAnalyserNode;

    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(0.7));
    sl.tick(1 / 60);
    // coeff = 1 → output equals target exactly
    expect(sl.getOutputValue()).toBeCloseTo(0.7, 5);
  });

  it('rise coefficient used when target > current', () => {
    const slFast = makeActiveSL();
    const slSlow = makeActiveSL();

    const analysers = mockCtx.createAnalyser.mock.results;
    const aFast = analysers[0]!.value as MockAnalyserNode;
    const aSlow = analysers[1]!.value as MockAnalyserNode;

    vi.spyOn(aFast, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(1.0));
    vi.spyOn(aSlow, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(1.0));

    slFast.setParameterValue('rise', 10);
    slSlow.setParameterValue('rise', 2000);

    slFast.tick(1 / 60);
    slSlow.tick(1 / 60);

    expect(slFast.getOutputValue()).toBeGreaterThan(slSlow.getOutputValue());
  });

  it('fall coefficient used when target < current (asymmetric)', () => {
    const sl = makeActiveSL();
    sl.setParameterValue('rise', 0);   // instant rise
    sl.setParameterValue('fall', 5000); // very slow fall

    const analyser = mockCtx.createAnalyser.mock.results[0]!.value as MockAnalyserNode;

    // Instantly rise to 1.0
    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(1.0));
    sl.tick(1 / 60);
    expect(sl.getOutputValue()).toBeCloseTo(1.0, 5);

    // Now target drops to 0 — with slow fall, output should only decrease a tiny bit
    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(0));
    const before = sl.getOutputValue();
    sl.tick(1 / 60);
    const after = sl.getOutputValue();
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0.99); // barely moved given 5000 ms fall
  });

  it('cvNode.offset.value equals getOutputValue() after tick', () => {
    const sl = makeActiveSL();
    const analyser = mockCtx.createAnalyser.mock.results[0]!.value as MockAnalyserNode;
    const cvNode = mockCtx.createConstantSource.mock.results[0]!.value as MockCSN;

    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(0.5));
    sl.tick(1 / 60);
    expect(cvNode.offset.value).toBe(sl.getOutputValue());
  });

  it('output stays in [0, 1] with extreme inputs', () => {
    const sl = makeActiveSL();
    const analyser = mockCtx.createAnalyser.mock.results[0]!.value as MockAnalyserNode;
    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(2.0));
    for (let i = 0; i < 60; i++) sl.tick(1 / 60);
    expect(sl.getOutputValue()).toBeLessThanOrEqual(1);
    expect(sl.getOutputValue()).toBeGreaterThanOrEqual(0);
  });

  it('does not crash when called before activate', () => {
    const sl = makeSL();
    expect(() => sl.tick(1 / 60)).not.toThrow();
    expect(sl.getOutputValue()).toBe(0);
  });

  it('handles rapid successive CV changes by continuously ramping to latest target', () => {
    const sl = makeActiveSL();
    sl.setParameterValue('rise', 500);
    sl.setParameterValue('fall', 500);
    const analyser = mockCtx.createAnalyser.mock.results[0]!.value as MockAnalyserNode;

    // Rapid alternating targets — output must always be between 0 and 1
    const targets = [0.2, 0.9, 0.1, 0.8, 0.3, 0.7];
    for (const t of targets) {
      vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(t));
      sl.tick(1 / 60);
      expect(sl.getOutputValue()).toBeGreaterThanOrEqual(0);
      expect(sl.getOutputValue()).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// deactivate
// ---------------------------------------------------------------------------

describe('SlewLimiter deactivate', () => {
  it('getOutputValue() returns 0 after deactivate', () => {
    const sl = makeActiveSL();
    const analyser = mockCtx.createAnalyser.mock.results[0]!.value as MockAnalyserNode;
    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(0.5));
    for (let i = 0; i < 10; i++) sl.tick(1 / 60);
    sl.deactivate();
    expect(sl.getOutputValue()).toBe(0);
  });

  it('cvNode is stopped on deactivate', () => {
    makeActiveSL().deactivate();
    const cvNode = mockCtx.createConstantSource.mock.results[0]!.value as MockCSN;
    expect(cvNode.isStopped).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bypass
// ---------------------------------------------------------------------------

describe('SlewLimiter bypass', () => {
  it('isBypassable() returns true', () => {
    expect(makeSL().isBypassable()).toBe(true);
  });

  it('setBypass(true) does not crash', () => {
    const sl = makeActiveSL();
    expect(() => sl.setBypass(true)).not.toThrow();
    expect(sl.isBypassed).toBe(true);
  });

  it('setBypass(false) restores bypass state', () => {
    const sl = makeActiveSL();
    sl.setBypass(true);
    sl.setBypass(false);
    expect(sl.isBypassed).toBe(false);
  });

  it('tick() passes CV through instantly when bypassed (coeff=1)', () => {
    const sl = makeActiveSL();
    sl.setParameterValue('rise', 5000);
    sl.setParameterValue('fall', 5000);
    sl.setBypass(true);

    const analyser = mockCtx.createAnalyser.mock.results[0]!.value as MockAnalyserNode;
    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(0.6));

    sl.tick(1 / 60);
    // With bypass, coeff=1 regardless of rise/fall — output should equal target exactly
    expect(sl.getOutputValue()).toBeCloseTo(0.6, 5);
  });
});

// ---------------------------------------------------------------------------
// serialize / deserialize
// ---------------------------------------------------------------------------

describe('SlewLimiter serialize', () => {
  it('returns correct type string', () => {
    expect(makeSL().serialize().type).toBe('slew-limiter');
  });

  it('serializes default parameters', () => {
    const data = makeSL().serialize();
    expect(data.parameters['rise']).toBe(50);
    expect(data.parameters['fall']).toBe(50);
  });

  it('serializes non-default parameter values', () => {
    const sl = makeSL();
    sl.setParameterValue('rise', 200);
    sl.setParameterValue('fall', 1000);
    const data = sl.serialize();
    expect(data.parameters['rise']).toBe(200);
    expect(data.parameters['fall']).toBe(1000);
  });
});

describe('SlewLimiter deserialize', () => {
  it('restores non-default parameter values', () => {
    const sl = makeSL();
    sl.deserialize({
      id: 'sl-test',
      type: 'slew-limiter' as any,
      position: { x: 10, y: 20 },
      parameters: { rise: 300, fall: 1500 },
    });
    expect(sl.getParameter('rise')?.getValue()).toBe(300);
    expect(sl.getParameter('fall')?.getValue()).toBe(1500);
  });

  it('uses defaults for missing parameters', () => {
    const sl = makeSL();
    sl.deserialize({
      id: 'sl-test',
      type: 'slew-limiter' as any,
      position: { x: 0, y: 0 },
      parameters: {},
    });
    expect(sl.getParameter('rise')?.getValue()).toBe(50);
    expect(sl.getParameter('fall')?.getValue()).toBe(50);
  });

  it('clamps out-of-range values on deserialize', () => {
    const sl = makeSL();
    sl.deserialize({
      id: 'sl-test',
      type: 'slew-limiter' as any,
      position: { x: 0, y: 0 },
      parameters: { rise: -100, fall: 99999 },
    });
    expect(sl.getParameter('rise')?.getValue()).toBe(0);
    expect(sl.getParameter('fall')?.getValue()).toBe(5000);
  });

  it('round-trips: serialize → deserialize preserves asymmetric values', () => {
    const sl1 = makeSL();
    sl1.setParameterValue('rise', 10);
    sl1.setParameterValue('fall', 2000);
    const data = sl1.serialize();

    const sl2 = makeSL();
    sl2.deserialize(data);
    expect(sl2.getParameter('rise')?.getValue()).toBe(10);
    expect(sl2.getParameter('fall')?.getValue()).toBe(2000);
  });
});
