/**
 * ParametricEQ — pure-function contract tests + component integration tests
 *
 * Phase 2 (T006–T009): clampGain, clampLowFreq, clampMidFreq, clampMidQ,
 * clampHighFreq, validateEQConfig, serializeEQConfig, deserializeEQConfig.
 * Phase 3 (T018): component lifecycle, filter types, bypass graph topology.
 * Phase 4 (T020): mid peak frequency and Q routing.
 * Phase 5 (T022): shelf corner frequency routing.
 * Phase 6 (T025, T026): CV port routing and gain clamping.
 * Phase 7 (T029, T030): round-trip serialization and graceful fallback.
 *
 * Feature: 026-parametric-eq
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAudioContext } from '../../mocks/WebAudioAPI.mock';
import { audioEngine } from '../../../src/core/AudioEngine';
import { ParametricEQ } from '../../../src/components/processors/ParametricEQ';
import { DEFAULT_EQ_CONFIG } from '../../../specs/026-parametric-eq/contracts/types';
import {
  clampGain,
  clampLowFreq,
  clampMidFreq,
  clampMidQ,
  clampHighFreq,
  validateEQConfig,
  serializeEQConfig,
  deserializeEQConfig,
} from '../../../specs/026-parametric-eq/contracts/validation';
import {
  DEFAULT_EQ_CONFIG,
  EQ_GAIN_MIN,
  EQ_GAIN_MAX,
  LOW_FREQ_MIN,
  LOW_FREQ_MAX,
  MID_FREQ_MIN,
  MID_FREQ_MAX,
  MID_Q_MIN,
  MID_Q_MAX,
  HIGH_FREQ_MIN,
  HIGH_FREQ_MAX,
} from '../../../specs/026-parametric-eq/contracts/types';

// ---------------------------------------------------------------------------
// clampGain
// ---------------------------------------------------------------------------

describe('clampGain', () => {
  it('passes through value within range', () => {
    expect(clampGain(0)).toBe(0);
    expect(clampGain(6)).toBe(6);
    expect(clampGain(-6)).toBe(-6);
  });

  it('clamps at lower boundary', () => {
    expect(clampGain(EQ_GAIN_MIN)).toBe(EQ_GAIN_MIN);
    expect(clampGain(EQ_GAIN_MIN - 1)).toBe(EQ_GAIN_MIN);
    expect(clampGain(-100)).toBe(EQ_GAIN_MIN);
  });

  it('clamps at upper boundary', () => {
    expect(clampGain(EQ_GAIN_MAX)).toBe(EQ_GAIN_MAX);
    expect(clampGain(EQ_GAIN_MAX + 1)).toBe(EQ_GAIN_MAX);
    expect(clampGain(100)).toBe(EQ_GAIN_MAX);
  });
});

// ---------------------------------------------------------------------------
// clampLowFreq
// ---------------------------------------------------------------------------

describe('clampLowFreq', () => {
  it('passes through value within range', () => {
    expect(clampLowFreq(80)).toBe(80);
    expect(clampLowFreq(400)).toBe(400);
  });

  it('clamps at lower boundary', () => {
    expect(clampLowFreq(LOW_FREQ_MIN)).toBe(LOW_FREQ_MIN);
    expect(clampLowFreq(0)).toBe(LOW_FREQ_MIN);
    expect(clampLowFreq(-1)).toBe(LOW_FREQ_MIN);
  });

  it('clamps at upper boundary', () => {
    expect(clampLowFreq(LOW_FREQ_MAX)).toBe(LOW_FREQ_MAX);
    expect(clampLowFreq(999)).toBe(LOW_FREQ_MAX);
  });
});

// ---------------------------------------------------------------------------
// clampMidFreq
// ---------------------------------------------------------------------------

describe('clampMidFreq', () => {
  it('passes through value within range', () => {
    expect(clampMidFreq(1000)).toBe(1000);
    expect(clampMidFreq(4000)).toBe(4000);
  });

  it('clamps at lower boundary', () => {
    expect(clampMidFreq(MID_FREQ_MIN)).toBe(MID_FREQ_MIN);
    expect(clampMidFreq(0)).toBe(MID_FREQ_MIN);
  });

  it('clamps at upper boundary', () => {
    expect(clampMidFreq(MID_FREQ_MAX)).toBe(MID_FREQ_MAX);
    expect(clampMidFreq(20000)).toBe(MID_FREQ_MAX);
  });
});

// ---------------------------------------------------------------------------
// clampMidQ
// ---------------------------------------------------------------------------

describe('clampMidQ', () => {
  it('passes through value within range', () => {
    expect(clampMidQ(1.0)).toBe(1.0);
    expect(clampMidQ(5.0)).toBe(5.0);
  });

  it('clamps at lower boundary', () => {
    expect(clampMidQ(MID_Q_MIN)).toBe(MID_Q_MIN);
    expect(clampMidQ(0)).toBe(MID_Q_MIN);
    expect(clampMidQ(-1)).toBe(MID_Q_MIN);
  });

  it('clamps at upper boundary', () => {
    expect(clampMidQ(MID_Q_MAX)).toBe(MID_Q_MAX);
    expect(clampMidQ(100)).toBe(MID_Q_MAX);
  });
});

// ---------------------------------------------------------------------------
// clampHighFreq
// ---------------------------------------------------------------------------

describe('clampHighFreq', () => {
  it('passes through value within range', () => {
    expect(clampHighFreq(8000)).toBe(8000);
    expect(clampHighFreq(12000)).toBe(12000);
  });

  it('clamps at lower boundary', () => {
    expect(clampHighFreq(HIGH_FREQ_MIN)).toBe(HIGH_FREQ_MIN);
    expect(clampHighFreq(0)).toBe(HIGH_FREQ_MIN);
  });

  it('clamps at upper boundary', () => {
    expect(clampHighFreq(HIGH_FREQ_MAX)).toBe(HIGH_FREQ_MAX);
    expect(clampHighFreq(30000)).toBe(HIGH_FREQ_MAX);
  });
});

// ---------------------------------------------------------------------------
// validateEQConfig
// ---------------------------------------------------------------------------

describe('validateEQConfig', () => {
  it('returns isValid=true for the default config', () => {
    const result = validateEQConfig({ ...DEFAULT_EQ_CONFIG });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns isValid=true for a non-default valid config', () => {
    const result = validateEQConfig({
      lowGain: 6, lowFreq: 200,
      midGain: -12, midFreq: 500, midQ: 5.0,
      highGain: 3, highFreq: 12000,
    });
    expect(result.isValid).toBe(true);
  });

  it('returns isValid=false when config is not an object', () => {
    expect(validateEQConfig(null).isValid).toBe(false);
    expect(validateEQConfig(undefined).isValid).toBe(false);
    expect(validateEQConfig(42).isValid).toBe(false);
  });

  it('returns errors for NaN values', () => {
    const result = validateEQConfig({ ...DEFAULT_EQ_CONFIG, lowGain: NaN });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('lowGain'))).toBe(true);
  });

  it('returns errors for out-of-range gain', () => {
    const result = validateEQConfig({ ...DEFAULT_EQ_CONFIG, midGain: -100 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('midGain'))).toBe(true);
  });

  it('returns errors for out-of-range frequency', () => {
    const result = validateEQConfig({ ...DEFAULT_EQ_CONFIG, highFreq: 30000 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('highFreq'))).toBe(true);
  });

  it('returns errors for non-numeric values', () => {
    const result = validateEQConfig({ ...DEFAULT_EQ_CONFIG, midQ: 'fast' as any });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('midQ'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// serializeEQConfig / deserializeEQConfig
// ---------------------------------------------------------------------------

describe('serializeEQConfig and deserializeEQConfig', () => {
  it('round-trips the default config exactly', () => {
    const serialized = serializeEQConfig({ ...DEFAULT_EQ_CONFIG });
    const restored = deserializeEQConfig(serialized);
    expect(restored).toEqual(DEFAULT_EQ_CONFIG);
  });

  it('round-trips a non-default config exactly', () => {
    const config = {
      lowGain: 6, lowFreq: 200,
      midGain: -12, midFreq: 500, midQ: 5.0,
      highGain: 3, highFreq: 12000,
    };
    const serialized = serializeEQConfig(config);
    const restored = deserializeEQConfig(serialized);
    expect(restored).toEqual(config);
  });

  it('deserialize falls back to defaults for missing keys', () => {
    const restored = deserializeEQConfig({});
    expect(restored).toEqual(DEFAULT_EQ_CONFIG);
  });

  it('deserialize clamps out-of-range values on restore', () => {
    const restored = deserializeEQConfig({
      lowGain: -100,
      lowFreq: 0,
      midGain: 999,
      midFreq: 0,
      midQ: -5,
      highGain: 100,
      highFreq: 99999,
    });
    expect(restored.lowGain).toBe(EQ_GAIN_MIN);
    expect(restored.lowFreq).toBe(LOW_FREQ_MIN);
    expect(restored.midGain).toBe(EQ_GAIN_MAX);
    expect(restored.midFreq).toBe(MID_FREQ_MIN);
    expect(restored.midQ).toBe(MID_Q_MIN);
    expect(restored.highGain).toBe(EQ_GAIN_MAX);
    expect(restored.highFreq).toBe(HIGH_FREQ_MAX);
  });

  it('serialized output contains all 7 parameter keys', () => {
    const serialized = serializeEQConfig({ ...DEFAULT_EQ_CONFIG });
    const keys = ['lowGain', 'lowFreq', 'midGain', 'midFreq', 'midQ', 'highGain', 'highFreq'];
    for (const key of keys) {
      expect(Object.prototype.hasOwnProperty.call(serialized, key)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Component integration tests (T018) — Phase 3
// ---------------------------------------------------------------------------

function makeEQ(): ParametricEQ {
  return new ParametricEQ('eq-test', { x: 0, y: 0 });
}

function setupMockAudio(): MockAudioContext {
  const ctx = new MockAudioContext();
  (audioEngine as any).context = ctx;
  (audioEngine as any).isInitialized = true;
  (audioEngine as any).nodes = new Map();
  return ctx;
}

function teardownMockAudio(): void {
  (audioEngine as any).context = null;
  (audioEngine as any).isInitialized = false;
  (audioEngine as any).nodes = new Map();
}

describe('ParametricEQ component lifecycle (T018)', () => {
  let eq: ParametricEQ;

  beforeEach(() => {
    setupMockAudio();
    eq = makeEQ();
    eq.activate();
  });

  afterEach(() => {
    eq.deactivate();
    teardownMockAudio();
  });

  it('lowShelf filter type is lowshelf', () => {
    const node = eq.getAudioNode('lowShelf') as any;
    expect(node?.type).toBe('lowshelf');
  });

  it('midPeak filter type is peaking', () => {
    const node = eq.getAudioNode('midPeak') as any;
    expect(node?.type).toBe('peaking');
  });

  it('highShelf filter type is highshelf', () => {
    const node = eq.getAudioNode('highShelf') as any;
    expect(node?.type).toBe('highshelf');
  });

  it('initial lowShelf gain is 0 dB', () => {
    const node = eq.getAudioNode('lowShelf') as any;
    expect(node?.gain.value).toBe(0);
  });

  it('initial midPeak gain is 0 dB', () => {
    const node = eq.getAudioNode('midPeak') as any;
    expect(node?.gain.value).toBe(0);
  });

  it('initial highShelf gain is 0 dB', () => {
    const node = eq.getAudioNode('highShelf') as any;
    expect(node?.gain.value).toBe(0);
  });

  it('getInputNode returns inputGain', () => {
    expect(eq.getInputNode()).toBe(eq.getAudioNode('inputGain'));
  });

  it('getOutputNode returns outputGain', () => {
    expect(eq.getOutputNode()).toBe(eq.getAudioNode('outputGain'));
  });

  it('isBypassable returns true', () => {
    expect(eq.isBypassable()).toBe(true);
  });

  it('enableBypass connects inputGain directly to outputGain', () => {
    const inputGain = eq.getAudioNode('inputGain') as any;
    const outputGain = eq.getAudioNode('outputGain') as any;

    eq.setBypass(true);

    expect(inputGain.isConnectedTo(outputGain)).toBe(true);
  });

  it('enableBypass disconnects the filter chain', () => {
    const inputGain = eq.getAudioNode('inputGain') as any;
    const lowShelf = eq.getAudioNode('lowShelf') as any;

    eq.setBypass(true);

    expect(inputGain.isConnectedTo(lowShelf)).toBe(false);
  });

  it('disableBypass restores inputGain → lowShelf connection', () => {
    const inputGain = eq.getAudioNode('inputGain') as any;
    const lowShelf = eq.getAudioNode('lowShelf') as any;
    const outputGain = eq.getAudioNode('outputGain') as any;

    eq.setBypass(true);
    eq.setBypass(false);

    expect(inputGain.isConnectedTo(lowShelf)).toBe(true);
    expect(inputGain.isConnectedTo(outputGain)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 4 (T020) — Mid peak frequency and Q routing
// ---------------------------------------------------------------------------

describe('ParametricEQ mid peak parameter routing (T020)', () => {
  let eq: ParametricEQ;

  beforeEach(() => {
    setupMockAudio();
    eq = makeEQ();
    eq.activate();
  });

  afterEach(() => {
    eq.deactivate();
    teardownMockAudio();
  });

  it('setParameterValue midFreq updates midPeak.frequency', () => {
    eq.setParameterValue('midFreq', 500);
    const node = eq.getAudioNode('midPeak') as any;
    expect(node?.frequency.value).toBe(500);
  });

  it('setParameterValue midQ updates midPeak.Q', () => {
    eq.setParameterValue('midQ', 5.0);
    const node = eq.getAudioNode('midPeak') as any;
    expect(node?.Q.value).toBe(5.0);
  });

  it('setParameterValue midGain updates midPeak.gain', () => {
    eq.setParameterValue('midGain', -12);
    const node = eq.getAudioNode('midPeak') as any;
    expect(node?.gain.value).toBe(-12);
  });
});

// ---------------------------------------------------------------------------
// Phase 5 (T022) — Shelf corner frequency routing
// ---------------------------------------------------------------------------

describe('ParametricEQ shelf frequency routing (T022)', () => {
  let eq: ParametricEQ;

  beforeEach(() => {
    setupMockAudio();
    eq = makeEQ();
    eq.activate();
  });

  afterEach(() => {
    eq.deactivate();
    teardownMockAudio();
  });

  it('setParameterValue lowFreq updates lowShelf.frequency', () => {
    eq.setParameterValue('lowFreq', 200);
    const node = eq.getAudioNode('lowShelf') as any;
    expect(node?.frequency.value).toBe(200);
  });

  it('setParameterValue highFreq updates highShelf.frequency', () => {
    eq.setParameterValue('highFreq', 12000);
    const node = eq.getAudioNode('highShelf') as any;
    expect(node?.frequency.value).toBe(12000);
  });
});

// ---------------------------------------------------------------------------
// Phase 6 (T025, T026) — CV routing and gain clamping
// ---------------------------------------------------------------------------

describe('ParametricEQ CV routing (T025)', () => {
  let eq: ParametricEQ;

  beforeEach(() => {
    setupMockAudio();
    eq = makeEQ();
    eq.activate();
  });

  afterEach(() => {
    eq.deactivate();
    teardownMockAudio();
  });

  it('getAudioParamForInput low-gain-cv returns lowShelf.gain AudioParam', () => {
    const param = eq.getAudioParamForInput('low-gain-cv');
    const lowShelf = eq.getAudioNode('lowShelf') as any;
    expect(param).toBe(lowShelf?.gain);
  });

  it('getAudioParamForInput mid-gain-cv returns midPeak.gain AudioParam', () => {
    const param = eq.getAudioParamForInput('mid-gain-cv');
    const midPeak = eq.getAudioNode('midPeak') as any;
    expect(param).toBe(midPeak?.gain);
  });

  it('getAudioParamForInput high-gain-cv returns highShelf.gain AudioParam', () => {
    const param = eq.getAudioParamForInput('high-gain-cv');
    const highShelf = eq.getAudioNode('highShelf') as any;
    expect(param).toBe(highShelf?.gain);
  });

  it('getAudioParamForInput unknown port returns null', () => {
    expect(eq.getAudioParamForInput('audio-in')).toBeNull();
  });

  it('getParameterRangeForInput low-gain-cv returns { min: -18, max: 18 }', () => {
    expect(eq.getParameterRangeForInput('low-gain-cv')).toEqual({ min: -18, max: 18 });
  });

  it('getParameterRangeForInput mid-gain-cv returns { min: -18, max: 18 }', () => {
    expect(eq.getParameterRangeForInput('mid-gain-cv')).toEqual({ min: -18, max: 18 });
  });

  it('getParameterRangeForInput high-gain-cv returns { min: -18, max: 18 }', () => {
    expect(eq.getParameterRangeForInput('high-gain-cv')).toEqual({ min: -18, max: 18 });
  });

  it('FR-015: when no CV connected, band gain equals knob value (lowGain)', () => {
    eq.setParameterValue('lowGain', 6);
    const node = eq.getAudioNode('lowShelf') as any;
    // No LFO connected — gain AudioParam value should equal the knob setting
    expect(node?.gain.value).toBe(6);
  });

  it('FR-015: when no CV connected, band gain equals knob value (midGain)', () => {
    eq.setParameterValue('midGain', -9);
    const node = eq.getAudioNode('midPeak') as any;
    expect(node?.gain.value).toBe(-9);
  });

  it('FR-015: when no CV connected, band gain equals knob value (highGain)', () => {
    eq.setParameterValue('highGain', 3);
    const node = eq.getAudioNode('highShelf') as any;
    expect(node?.gain.value).toBe(3);
  });
});

describe('ParametricEQ CV gain clamping (T026)', () => {
  it('clampGain clamps at -18 dB lower boundary', () => {
    expect(clampGain(-18)).toBe(-18);
    expect(clampGain(-19)).toBe(-18);
    expect(clampGain(-100)).toBe(-18);
  });

  it('clampGain clamps at +18 dB upper boundary', () => {
    expect(clampGain(18)).toBe(18);
    expect(clampGain(19)).toBe(18);
    expect(clampGain(100)).toBe(18);
  });
});

// ---------------------------------------------------------------------------
// Phase 7 (T029, T030) — Round-trip serialization and graceful fallback
// ---------------------------------------------------------------------------

describe('ParametricEQ serialization round-trip (T029)', () => {
  let eq: ParametricEQ;

  beforeEach(() => {
    setupMockAudio();
    eq = makeEQ();
    eq.activate();
  });

  afterEach(() => {
    eq.deactivate();
    teardownMockAudio();
  });

  it('serialize then deserialize preserves all 7 non-default parameters', () => {
    eq.setParameterValue('lowGain',  6);
    eq.setParameterValue('lowFreq',  200);
    eq.setParameterValue('midGain',  -12);
    eq.setParameterValue('midFreq',  800);
    eq.setParameterValue('midQ',     4.0);
    eq.setParameterValue('highGain', -3);
    eq.setParameterValue('highFreq', 10000);

    const data = eq.serialize();

    const eq2 = makeEQ();
    eq2.activate();
    eq2.deserialize(data);

    expect(eq2.getParameter('lowGain')?.getValue()).toBe(6);
    expect(eq2.getParameter('lowFreq')?.getValue()).toBe(200);
    expect(eq2.getParameter('midGain')?.getValue()).toBe(-12);
    expect(eq2.getParameter('midFreq')?.getValue()).toBe(800);
    expect(eq2.getParameter('midQ')?.getValue()).toBe(4.0);
    expect(eq2.getParameter('highGain')?.getValue()).toBe(-3);
    expect(eq2.getParameter('highFreq')?.getValue()).toBe(10000);

    eq2.deactivate();
  });
});

describe('ParametricEQ graceful fallback for missing parameters (T030)', () => {
  let eq: ParametricEQ;

  beforeEach(() => {
    setupMockAudio();
    eq = makeEQ();
    eq.activate();
  });

  afterEach(() => {
    eq.deactivate();
    teardownMockAudio();
  });

  it('deserialize with empty parameters restores all defaults', () => {
    eq.deserialize({
      id: 'eq-test',
      type: 'parametric-eq' as any,
      position: { x: 0, y: 0 },
      parameters: {},
    });

    expect(eq.getParameter('lowGain')?.getValue()).toBe(DEFAULT_EQ_CONFIG.lowGain);
    expect(eq.getParameter('lowFreq')?.getValue()).toBe(DEFAULT_EQ_CONFIG.lowFreq);
    expect(eq.getParameter('midGain')?.getValue()).toBe(DEFAULT_EQ_CONFIG.midGain);
    expect(eq.getParameter('midFreq')?.getValue()).toBe(DEFAULT_EQ_CONFIG.midFreq);
    expect(eq.getParameter('midQ')?.getValue()).toBe(DEFAULT_EQ_CONFIG.midQ);
    expect(eq.getParameter('highGain')?.getValue()).toBe(DEFAULT_EQ_CONFIG.highGain);
    expect(eq.getParameter('highFreq')?.getValue()).toBe(DEFAULT_EQ_CONFIG.highFreq);
  });
});
