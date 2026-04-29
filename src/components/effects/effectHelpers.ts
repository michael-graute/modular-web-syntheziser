import {
  BITCRUSHER_BIT_DEPTH_MIN, BITCRUSHER_BIT_DEPTH_MAX,
  BITCRUSHER_SAMPLE_RATE_MIN, BITCRUSHER_SAMPLE_RATE_MAX,
  RATE_MIN, RATE_MAX,
  DEPTH_MIN, DEPTH_MAX,
  FEEDBACK_MIN, FEEDBACK_MAX,
  MIX_MIN, MIX_MAX,
  PHASER_STAGES_OPTIONS, PhaserStages,
} from './effectConstants';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function isValidBitDepth(value: number): boolean {
  return Number.isInteger(value) && value >= BITCRUSHER_BIT_DEPTH_MIN && value <= BITCRUSHER_BIT_DEPTH_MAX;
}

export function isValidSampleRatePercent(value: number): boolean {
  return value >= BITCRUSHER_SAMPLE_RATE_MIN && value <= BITCRUSHER_SAMPLE_RATE_MAX;
}

export function isValidRate(value: number): boolean {
  return value >= RATE_MIN && value <= RATE_MAX;
}

export function isValidDepth(value: number): boolean {
  return value >= DEPTH_MIN && value <= DEPTH_MAX;
}

export function isValidFeedback(value: number): boolean {
  return value >= FEEDBACK_MIN && value <= FEEDBACK_MAX;
}

export function isValidMix(value: number): boolean {
  return value >= MIX_MIN && value <= MIX_MAX;
}

export function isValidPhaserStages(value: number): value is PhaserStages {
  return (PHASER_STAGES_OPTIONS as readonly number[]).includes(value);
}

export function safeFeedback(value: number): number {
  return clamp(value, FEEDBACK_MIN, FEEDBACK_MAX) / 100;
}

export function depthToFlangerLfoGain(depth: number, lfoGainScale: number): number {
  return clamp(depth, DEPTH_MIN, DEPTH_MAX) / 100 * lfoGainScale;
}

export function depthToPhaserLfoGain(depth: number, lfoGainScale: number): number {
  return clamp(depth, DEPTH_MIN, DEPTH_MAX) / 100 * lfoGainScale;
}

export function tremoloLfoParams(depth: number): { lfoAmplitude: number; dcOffset: number } {
  const d = clamp(depth, DEPTH_MIN, DEPTH_MAX) / 100;
  return {
    lfoAmplitude: d / 2,
    dcOffset: 1 - d / 2,
  };
}
