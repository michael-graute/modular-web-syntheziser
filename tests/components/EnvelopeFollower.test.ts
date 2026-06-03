import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MockGainNode,
  MockAnalyserNode,
  MockConstantSourceNode,
} from '../mocks/WebAudioAPI.mock';
import { SignalType } from '../../src/core/types';
import {
  validateAttack,
  validateRelease,
  validateGain,
  validateEnvelopeFollowerParams,
  clampEnvelope,
  computeSmoothingCoeff,
} from '../../src/components/analyzers/EnvelopeFollowerValidation';

// ---------------------------------------------------------------------------
// Mock AudioEngine — must come before importing EnvelopeFollower
// ---------------------------------------------------------------------------

const mockGain = () => new MockGainNode() as unknown as GainNode;
const mockAnalyser = () => {
  const a = new MockAnalyserNode() as unknown as AnalyserNode;
  return a;
};
const mockConstantSource = () => new MockConstantSourceNode() as unknown as ConstantSourceNode;

const mockCtx = {
  currentTime: 0,
  createGain: vi.fn(mockGain),
  createAnalyser: vi.fn(mockAnalyser),
  createConstantSource: vi.fn(mockConstantSource),
};

vi.mock('../../src/core/AudioEngine', () => ({
  audioEngine: {
    isReady: () => true,
    getContext: () => mockCtx,
    addNode: vi.fn(),
  },
}));

import { EnvelopeFollower } from '../../src/components/analyzers/EnvelopeFollower';

function makeEF(): EnvelopeFollower {
  return new EnvelopeFollower('ef-test', { x: 0, y: 0 });
}

function makeActiveEF(): EnvelopeFollower {
  const ef = makeEF();
  ef.activate();
  return ef;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx.createGain.mockImplementation(mockGain);
  mockCtx.createAnalyser.mockImplementation(mockAnalyser);
  mockCtx.createConstantSource.mockImplementation(mockConstantSource);
});

// ---------------------------------------------------------------------------
// Validation helpers — 100% coverage (T010)
// ---------------------------------------------------------------------------

describe('validateAttack', () => {
  it('accepts valid integer in range', () => {
    expect(validateAttack(50)).toBe(50);
  });

  it('clamps below minimum to 1', () => {
    expect(validateAttack(0)).toBe(1);
    expect(validateAttack(-10)).toBe(1);
  });

  it('clamps above maximum to 500', () => {
    expect(validateAttack(1000)).toBe(500);
  });

  it('rounds to nearest integer', () => {
    expect(validateAttack(10.7)).toBe(11);
  });

  it('uses default 10 for NaN', () => {
    expect(validateAttack(NaN)).toBe(10);
  });

  it('uses default 10 for non-number', () => {
    expect(validateAttack('hello')).toBe(10);
    expect(validateAttack(undefined)).toBe(10);
  });

  it('handles boundary: minimum 1 ms produces finite non-NaN coefficient', () => {
    const coeff = computeSmoothingCoeff(validateAttack(1), 1 / 60);
    expect(isFinite(coeff)).toBe(true);
    expect(isNaN(coeff)).toBe(false);
    expect(coeff).toBeGreaterThan(0);
    expect(coeff).toBeLessThanOrEqual(1);
  });
});

describe('validateRelease', () => {
  it('accepts valid value in range', () => {
    expect(validateRelease(100)).toBe(100);
  });

  it('clamps below minimum to 5', () => {
    expect(validateRelease(0)).toBe(5);
    expect(validateRelease(-100)).toBe(5);
  });

  it('clamps above maximum to 2000', () => {
    expect(validateRelease(5000)).toBe(2000);
  });

  it('rounds to nearest 5 ms multiple', () => {
    expect(validateRelease(103)).toBe(105);
    expect(validateRelease(101)).toBe(100);
  });

  it('uses default 100 for NaN', () => {
    expect(validateRelease(NaN)).toBe(100);
  });

  it('handles boundary: minimum 5 ms produces finite non-NaN coefficient', () => {
    const coeff = computeSmoothingCoeff(validateRelease(5), 1 / 60);
    expect(isFinite(coeff)).toBe(true);
    expect(isNaN(coeff)).toBe(false);
    expect(coeff).toBeGreaterThan(0);
    expect(coeff).toBeLessThanOrEqual(1);
  });
});

describe('validateGain', () => {
  it('accepts valid value in range', () => {
    expect(validateGain(1.0)).toBe(1.0);
  });

  it('clamps below minimum to 0.1', () => {
    expect(validateGain(0)).toBe(0.1);
    expect(validateGain(-1)).toBe(0.1);
  });

  it('clamps above maximum to 4.0', () => {
    expect(validateGain(10)).toBe(4.0);
  });

  it('rounds to 2 decimal places', () => {
    expect(validateGain(1.555)).toBe(1.56);
  });

  it('uses default 1.0 for NaN', () => {
    expect(validateGain(NaN)).toBe(1.0);
  });
});

describe('validateEnvelopeFollowerParams', () => {
  it('passes through valid params unchanged', () => {
    const result = validateEnvelopeFollowerParams({ attack: 20, release: 200, gain: 2.0 });
    expect(result).toEqual({ attack: 20, release: 200, gain: 2.0 });
  });

  it('fills missing keys with defaults', () => {
    const result = validateEnvelopeFollowerParams({});
    expect(result).toEqual({ attack: 10, release: 100, gain: 1.0 });
  });

  it('clamps out-of-range values', () => {
    const result = validateEnvelopeFollowerParams({ attack: 9999, release: -1, gain: 99 });
    expect(result.attack).toBe(500);
    expect(result.release).toBe(5);
    expect(result.gain).toBe(4.0);
  });
});

describe('clampEnvelope', () => {
  it('returns value unchanged when in [0, 1]', () => {
    expect(clampEnvelope(0.5)).toBe(0.5);
  });

  it('clamps to 0 for negative values', () => {
    expect(clampEnvelope(-0.5)).toBe(0);
  });

  it('clamps to 1 for values above 1', () => {
    expect(clampEnvelope(1.5)).toBe(1);
  });

  it('handles 0 and 1 boundary exactly', () => {
    expect(clampEnvelope(0)).toBe(0);
    expect(clampEnvelope(1)).toBe(1);
  });
});

describe('computeSmoothingCoeff', () => {
  it('returns 1 for timeMs <= 0 (instantaneous)', () => {
    expect(computeSmoothingCoeff(0, 0.016)).toBe(1);
    expect(computeSmoothingCoeff(-10, 0.016)).toBe(1);
  });

  it('returns a value in (0, 1] for positive time constants', () => {
    const c = computeSmoothingCoeff(100, 0.016);
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThanOrEqual(1);
  });

  it('larger time constant → smaller coefficient (slower response)', () => {
    const slow = computeSmoothingCoeff(500, 0.016);
    const fast = computeSmoothingCoeff(10, 0.016);
    expect(fast).toBeGreaterThan(slow);
  });

  it('produces finite result for very large time constants', () => {
    const c = computeSmoothingCoeff(2000, 0.016);
    expect(isFinite(c)).toBe(true);
    expect(c).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Constructor (T009)
// ---------------------------------------------------------------------------

describe('EnvelopeFollower constructor', () => {
  it('has one input port "input" with SignalType.AUDIO', () => {
    const ef = makeEF();
    const port = ef.inputs.get('input');
    expect(port).toBeDefined();
    expect(port!.type).toBe(SignalType.AUDIO);
    expect(port!.isInput).toBe(true);
  });

  it('has one output port "cv" with SignalType.CV', () => {
    const ef = makeEF();
    const port = ef.outputs.get('cv');
    expect(port).toBeDefined();
    expect(port!.type).toBe(SignalType.CV);
    expect(port!.isInput).toBe(false);
  });

  it('has three parameters: attack, release, gain', () => {
    const ef = makeEF();
    expect(ef.parameters.has('attack')).toBe(true);
    expect(ef.parameters.has('release')).toBe(true);
    expect(ef.parameters.has('gain')).toBe(true);
  });

  it('attack default is 10', () => {
    expect(makeEF().getParameter('attack')?.getValue()).toBe(10);
  });

  it('release default is 100', () => {
    expect(makeEF().getParameter('release')?.getValue()).toBe(100);
  });

  it('gain default is 1.0', () => {
    expect(makeEF().getParameter('gain')?.getValue()).toBe(1.0);
  });

  it('getEnvelopeValue() returns 0 before activation', () => {
    expect(makeEF().getEnvelopeValue()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// activate / createAudioNodes (T009)
// ---------------------------------------------------------------------------

describe('EnvelopeFollower activate', () => {
  it('creates gain, analyser, and constant source nodes', () => {
    makeActiveEF();
    expect(mockCtx.createGain).toHaveBeenCalledTimes(1);
    expect(mockCtx.createAnalyser).toHaveBeenCalledTimes(1);
    expect(mockCtx.createConstantSource).toHaveBeenCalledTimes(1);
  });

  it('getInputNode() returns non-null after activate', () => {
    expect(makeActiveEF().getInputNode()).not.toBeNull();
  });

  it('getOutputNode() returns non-null after activate (ConstantSourceNode)', () => {
    expect(makeActiveEF().getOutputNode()).not.toBeNull();
  });

  it('cvNode is started on activate', () => {
    makeActiveEF();
    const cvNode = mockCtx.createConstantSource.mock.results[0]!.value as MockConstantSourceNode;
    expect(cvNode.isStarted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tick() — envelope rises and falls (T009)
// ---------------------------------------------------------------------------

describe('EnvelopeFollower tick', () => {
  it('envelope rises toward a positive RMS signal', () => {
    const ef = makeActiveEF();
    const analyser = mockCtx.createAnalyser.mock.results[0]!.value as MockAnalyserNode;

    // Override getFloatTimeDomainData to simulate a signal with amplitude 0.5
    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => {
      arr.fill(0.5);
    });

    const before = ef.getEnvelopeValue();
    ef.tick(1 / 60);
    expect(ef.getEnvelopeValue()).toBeGreaterThan(before);
  });

  it('envelope falls toward silence when input is zero', () => {
    const ef = makeActiveEF();
    const analyser = mockCtx.createAnalyser.mock.results[0]!.value as MockAnalyserNode;

    // First drive envelope up
    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => {
      arr.fill(1.0);
    });
    for (let i = 0; i < 30; i++) ef.tick(1 / 60);
    const peak = ef.getEnvelopeValue();
    expect(peak).toBeGreaterThan(0);

    // Now silence — envelope must fall
    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => {
      arr.fill(0);
    });
    ef.tick(1 / 60);
    expect(ef.getEnvelopeValue()).toBeLessThan(peak);
  });

  it('cvNode.offset.value equals envelopeValue after tick', () => {
    const ef = makeActiveEF();
    const analyser = mockCtx.createAnalyser.mock.results[0]!.value as MockAnalyserNode;
    const cvNode = mockCtx.createConstantSource.mock.results[0]!.value as MockConstantSourceNode;

    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => {
      arr.fill(0.3);
    });
    ef.tick(1 / 60);

    expect(cvNode.offset.value).toBe(ef.getEnvelopeValue());
  });

  it('slower attack (higher ms) produces smaller rise per frame', () => {
    // Use fresh mocks for two independent instances
    const efFast = makeActiveEF();
    const efSlow = makeActiveEF();

    const analysers = mockCtx.createAnalyser.mock.results;
    const aFast = analysers[0]!.value as MockAnalyserNode;
    const aSlow = analysers[1]!.value as MockAnalyserNode;

    vi.spyOn(aFast, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(1.0));
    vi.spyOn(aSlow, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(1.0));

    efFast.setParameterValue('attack', 1);
    efSlow.setParameterValue('attack', 500);

    efFast.tick(1 / 60);
    efSlow.tick(1 / 60);

    expect(efFast.getEnvelopeValue()).toBeGreaterThan(efSlow.getEnvelopeValue());
  });

  it('envelopeValue stays in [0, 1] with extreme gain', () => {
    const ef = makeActiveEF();
    const analyser = mockCtx.createAnalyser.mock.results[0]!.value as MockAnalyserNode;
    ef.setParameterValue('gain', 4.0);
    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(1.0));
    for (let i = 0; i < 60; i++) ef.tick(1 / 60);
    expect(ef.getEnvelopeValue()).toBeLessThanOrEqual(1);
    expect(ef.getEnvelopeValue()).toBeGreaterThanOrEqual(0);
  });

  it('does not crash when called before activate', () => {
    const ef = makeEF();
    expect(() => ef.tick(1 / 60)).not.toThrow();
    expect(ef.getEnvelopeValue()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// destroyAudioNodes
// ---------------------------------------------------------------------------

describe('EnvelopeFollower destroyAudioNodes', () => {
  it('getEnvelopeValue() returns 0 after deactivate', () => {
    const ef = makeActiveEF();
    const analyser = mockCtx.createAnalyser.mock.results[0]!.value as MockAnalyserNode;
    vi.spyOn(analyser, 'getFloatTimeDomainData').mockImplementation((arr) => arr.fill(1.0));
    for (let i = 0; i < 10; i++) ef.tick(1 / 60);
    ef.deactivate();
    expect(ef.getEnvelopeValue()).toBe(0);
  });

  it('cvNode is stopped on deactivate', () => {
    makeActiveEF().deactivate();
    const cvNode = mockCtx.createConstantSource.mock.results[0]!.value as MockConstantSourceNode;
    expect(cvNode.isStopped).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// serialize / deserialize — round-trip (T019 preview)
// ---------------------------------------------------------------------------

describe('EnvelopeFollower serialize', () => {
  it('returns correct type string', () => {
    expect(makeEF().serialize().type).toBe('envelope-follower');
  });

  it('serializes default parameters', () => {
    const data = makeEF().serialize();
    expect(data.parameters['attack']).toBe(10);
    expect(data.parameters['release']).toBe(100);
    expect(data.parameters['gain']).toBe(1.0);
  });

  it('serializes non-default parameter values', () => {
    const ef = makeEF();
    ef.setParameterValue('attack', 250);
    ef.setParameterValue('release', 1500);
    ef.setParameterValue('gain', 2.5);
    const data = ef.serialize();
    expect(data.parameters['attack']).toBe(250);
    expect(data.parameters['release']).toBe(1500);
    expect(data.parameters['gain']).toBe(2.5);
  });
});

describe('EnvelopeFollower deserialize', () => {
  it('restores non-default parameter values', () => {
    const ef = makeEF();
    ef.deserialize({
      id: 'ef-test',
      type: 'envelope-follower' as any,
      position: { x: 10, y: 20 },
      parameters: { attack: 300, release: 1000, gain: 3.0 },
    });
    expect(ef.getParameter('attack')?.getValue()).toBe(300);
    expect(ef.getParameter('release')?.getValue()).toBe(1000);
    expect(ef.getParameter('gain')?.getValue()).toBe(3.0);
  });

  it('uses defaults for missing parameters', () => {
    const ef = makeEF();
    ef.deserialize({
      id: 'ef-test',
      type: 'envelope-follower' as any,
      position: { x: 0, y: 0 },
      parameters: {},
    });
    expect(ef.getParameter('attack')?.getValue()).toBe(10);
    expect(ef.getParameter('release')?.getValue()).toBe(100);
    expect(ef.getParameter('gain')?.getValue()).toBe(1.0);
  });

  it('clamps out-of-range values on deserialize', () => {
    const ef = makeEF();
    ef.deserialize({
      id: 'ef-test',
      type: 'envelope-follower' as any,
      position: { x: 0, y: 0 },
      parameters: { attack: 9999, release: -1, gain: 99 },
    });
    expect(ef.getParameter('attack')?.getValue()).toBe(500);
    expect(ef.getParameter('release')?.getValue()).toBe(5);
    expect(ef.getParameter('gain')?.getValue()).toBe(4.0);
  });

  it('round-trips: serialize → deserialize preserves values', () => {
    const ef1 = makeEF();
    ef1.setParameterValue('attack', 150);
    ef1.setParameterValue('release', 750);
    ef1.setParameterValue('gain', 1.5);
    const data = ef1.serialize();

    const ef2 = makeEF();
    ef2.deserialize(data);
    expect(ef2.getParameter('attack')?.getValue()).toBe(150);
    expect(ef2.getParameter('release')?.getValue()).toBe(750);
    expect(ef2.getParameter('gain')?.getValue()).toBe(1.5);
  });
});
