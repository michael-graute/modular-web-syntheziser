import { describe, it, expect } from 'vitest';
import {
  clamp,
  isValidBitDepth,
  isValidSampleRatePercent,
  isValidRate,
  isValidDepth,
  isValidFeedback,
  isValidMix,
  isValidPhaserStages,
  safeFeedback,
  depthToFlangerLfoGain,
  depthToPhaserLfoGain,
  tremoloLfoParams,
} from '../../src/components/effects/effectHelpers';

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min when below range', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it('clamps to max when above range', () => {
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('isValidBitDepth', () => {
  it('accepts minimum valid value (1)', () => {
    expect(isValidBitDepth(1)).toBe(true);
  });

  it('accepts maximum valid value (16)', () => {
    expect(isValidBitDepth(16)).toBe(true);
  });

  it('accepts mid-range integer (8)', () => {
    expect(isValidBitDepth(8)).toBe(true);
  });

  it('rejects 0 (below minimum)', () => {
    expect(isValidBitDepth(0)).toBe(false);
  });

  it('rejects 17 (above maximum)', () => {
    expect(isValidBitDepth(17)).toBe(false);
  });

  it('rejects non-integer (4.5)', () => {
    expect(isValidBitDepth(4.5)).toBe(false);
  });
});

describe('isValidSampleRatePercent', () => {
  it('accepts 1 (minimum)', () => {
    expect(isValidSampleRatePercent(1)).toBe(true);
  });

  it('accepts 100 (maximum)', () => {
    expect(isValidSampleRatePercent(100)).toBe(true);
  });

  it('accepts mid value (50)', () => {
    expect(isValidSampleRatePercent(50)).toBe(true);
  });

  it('rejects 0 (below minimum)', () => {
    expect(isValidSampleRatePercent(0)).toBe(false);
  });

  it('rejects 101 (above maximum)', () => {
    expect(isValidSampleRatePercent(101)).toBe(false);
  });
});

describe('isValidRate', () => {
  it('accepts 0.1 (minimum)', () => {
    expect(isValidRate(0.1)).toBe(true);
  });

  it('accepts 20 (maximum)', () => {
    expect(isValidRate(20)).toBe(true);
  });

  it('accepts mid value (5)', () => {
    expect(isValidRate(5)).toBe(true);
  });

  it('rejects 0 (below minimum)', () => {
    expect(isValidRate(0)).toBe(false);
  });

  it('rejects 21 (above maximum)', () => {
    expect(isValidRate(21)).toBe(false);
  });
});

describe('isValidDepth', () => {
  it('accepts 0 (minimum)', () => {
    expect(isValidDepth(0)).toBe(true);
  });

  it('accepts 100 (maximum)', () => {
    expect(isValidDepth(100)).toBe(true);
  });

  it('rejects negative value', () => {
    expect(isValidDepth(-1)).toBe(false);
  });

  it('rejects 101 (above maximum)', () => {
    expect(isValidDepth(101)).toBe(false);
  });
});

describe('isValidFeedback', () => {
  it('accepts 0 (minimum)', () => {
    expect(isValidFeedback(0)).toBe(true);
  });

  it('accepts 95 (maximum)', () => {
    expect(isValidFeedback(95)).toBe(true);
  });

  it('rejects 96 (above maximum)', () => {
    expect(isValidFeedback(96)).toBe(false);
  });

  it('rejects negative value', () => {
    expect(isValidFeedback(-1)).toBe(false);
  });
});

describe('isValidMix', () => {
  it('accepts 0 (fully dry)', () => {
    expect(isValidMix(0)).toBe(true);
  });

  it('accepts 1 (fully wet)', () => {
    expect(isValidMix(1)).toBe(true);
  });

  it('accepts 0.5 (half mix)', () => {
    expect(isValidMix(0.5)).toBe(true);
  });

  it('rejects negative value', () => {
    expect(isValidMix(-0.1)).toBe(false);
  });

  it('rejects value above 1', () => {
    expect(isValidMix(1.1)).toBe(false);
  });
});

describe('isValidPhaserStages', () => {
  it('accepts 2 stages', () => {
    expect(isValidPhaserStages(2)).toBe(true);
  });

  it('accepts 4 stages', () => {
    expect(isValidPhaserStages(4)).toBe(true);
  });

  it('accepts 6 stages', () => {
    expect(isValidPhaserStages(6)).toBe(true);
  });

  it('accepts 8 stages', () => {
    expect(isValidPhaserStages(8)).toBe(true);
  });

  it('rejects 3 (not in options)', () => {
    expect(isValidPhaserStages(3)).toBe(false);
  });

  it('rejects 0', () => {
    expect(isValidPhaserStages(0)).toBe(false);
  });

  it('rejects 10 (above maximum option)', () => {
    expect(isValidPhaserStages(10)).toBe(false);
  });
});

describe('safeFeedback', () => {
  it('converts 0% to 0.0', () => {
    expect(safeFeedback(0)).toBe(0);
  });

  it('converts 95% to 0.95', () => {
    expect(safeFeedback(95)).toBeCloseTo(0.95);
  });

  it('converts 50% to 0.5', () => {
    expect(safeFeedback(50)).toBeCloseTo(0.5);
  });

  it('clamps values above 95% to 0.95', () => {
    expect(safeFeedback(100)).toBeCloseTo(0.95);
  });

  it('clamps negative values to 0', () => {
    expect(safeFeedback(-10)).toBe(0);
  });
});

describe('depthToFlangerLfoGain', () => {
  it('returns 0 when depth is 0', () => {
    expect(depthToFlangerLfoGain(0, 0.003)).toBe(0);
  });

  it('returns full scale when depth is 100', () => {
    expect(depthToFlangerLfoGain(100, 0.003)).toBeCloseTo(0.003);
  });

  it('returns half scale when depth is 50', () => {
    expect(depthToFlangerLfoGain(50, 0.003)).toBeCloseTo(0.0015);
  });

  it('clamps depth above 100 to scale', () => {
    expect(depthToFlangerLfoGain(200, 0.003)).toBeCloseTo(0.003);
  });
});

describe('depthToPhaserLfoGain', () => {
  it('returns 0 when depth is 0', () => {
    expect(depthToPhaserLfoGain(0, 700)).toBe(0);
  });

  it('returns full scale when depth is 100', () => {
    expect(depthToPhaserLfoGain(100, 700)).toBeCloseTo(700);
  });

  it('returns half scale when depth is 50', () => {
    expect(depthToPhaserLfoGain(50, 700)).toBeCloseTo(350);
  });
});

describe('tremoloLfoParams', () => {
  it('returns no modulation when depth is 0', () => {
    const result = tremoloLfoParams(0);
    expect(result.lfoAmplitude).toBe(0);
    expect(result.dcOffset).toBe(1.0);
  });

  it('returns full modulation when depth is 100', () => {
    const result = tremoloLfoParams(100);
    expect(result.lfoAmplitude).toBeCloseTo(0.5);
    expect(result.dcOffset).toBeCloseTo(0.5);
  });

  it('returns half modulation when depth is 50', () => {
    const result = tremoloLfoParams(50);
    expect(result.lfoAmplitude).toBeCloseTo(0.25);
    expect(result.dcOffset).toBeCloseTo(0.75);
  });

  it('gain never goes below 0 at depth 100 (trough = dcOffset - lfoAmplitude)', () => {
    const result = tremoloLfoParams(100);
    expect(result.dcOffset - result.lfoAmplitude).toBeCloseTo(0);
  });

  it('gain never goes above 1 at depth 100 (peak = dcOffset + lfoAmplitude)', () => {
    const result = tremoloLfoParams(100);
    expect(result.dcOffset + result.lfoAmplitude).toBeCloseTo(1);
  });

  it('clamps depth above 100', () => {
    const result = tremoloLfoParams(150);
    expect(result.lfoAmplitude).toBeCloseTo(0.5);
    expect(result.dcOffset).toBeCloseTo(0.5);
  });
});
