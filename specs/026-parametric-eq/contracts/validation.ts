/**
 * Validation and serialization helpers for the Parametric EQ (feature 026-parametric-eq)
 */

import {
  ParametricEQConfig,
  EQValidationResult,
  EQParameterKey,
  DEFAULT_EQ_CONFIG,
  EQ_GAIN_MIN, EQ_GAIN_MAX,
  LOW_FREQ_MIN, LOW_FREQ_MAX,
  MID_FREQ_MIN, MID_FREQ_MAX,
  MID_Q_MIN, MID_Q_MAX,
  HIGH_FREQ_MIN, HIGH_FREQ_MAX,
} from './types';

// ---------------------------------------------------------------------------
// Clamping helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampGain(db: number): number {
  return clamp(db, EQ_GAIN_MIN, EQ_GAIN_MAX);
}

export function clampLowFreq(hz: number): number {
  return clamp(hz, LOW_FREQ_MIN, LOW_FREQ_MAX);
}

export function clampMidFreq(hz: number): number {
  return clamp(hz, MID_FREQ_MIN, MID_FREQ_MAX);
}

export function clampMidQ(q: number): number {
  return clamp(q, MID_Q_MIN, MID_Q_MAX);
}

export function clampHighFreq(hz: number): number {
  return clamp(hz, HIGH_FREQ_MIN, HIGH_FREQ_MAX);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateEQConfig(config: unknown): EQValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { isValid: false, errors: ['Config must be a non-null object'] };
  }

  const c = config as Record<string, unknown>;

  const numericChecks: Array<[string, number, number]> = [
    ['lowGain',  EQ_GAIN_MIN,   EQ_GAIN_MAX],
    ['lowFreq',  LOW_FREQ_MIN,  LOW_FREQ_MAX],
    ['midGain',  EQ_GAIN_MIN,   EQ_GAIN_MAX],
    ['midFreq',  MID_FREQ_MIN,  MID_FREQ_MAX],
    ['midQ',     MID_Q_MIN,     MID_Q_MAX],
    ['highGain', EQ_GAIN_MIN,   EQ_GAIN_MAX],
    ['highFreq', HIGH_FREQ_MIN, HIGH_FREQ_MAX],
  ];

  for (const [key, min, max] of numericChecks) {
    const val = c[key];
    if (typeof val !== 'number' || isNaN(val) || val < min || val > max) {
      errors.push(`${key} must be a number in [${min}, ${max}], got: ${String(val)}`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export function serializeEQConfig(config: ParametricEQConfig): Record<EQParameterKey, number> {
  return {
    lowGain:  config.lowGain,
    lowFreq:  config.lowFreq,
    midGain:  config.midGain,
    midFreq:  config.midFreq,
    midQ:     config.midQ,
    highGain: config.highGain,
    highFreq: config.highFreq,
  };
}

export function deserializeEQConfig(params: Record<string, number>): ParametricEQConfig {
  return {
    lowGain:  clampGain(params['lowGain']   ?? DEFAULT_EQ_CONFIG.lowGain),
    lowFreq:  clampLowFreq(params['lowFreq'] ?? DEFAULT_EQ_CONFIG.lowFreq),
    midGain:  clampGain(params['midGain']   ?? DEFAULT_EQ_CONFIG.midGain),
    midFreq:  clampMidFreq(params['midFreq'] ?? DEFAULT_EQ_CONFIG.midFreq),
    midQ:     clampMidQ(params['midQ']       ?? DEFAULT_EQ_CONFIG.midQ),
    highGain: clampGain(params['highGain']  ?? DEFAULT_EQ_CONFIG.highGain),
    highFreq: clampHighFreq(params['highFreq'] ?? DEFAULT_EQ_CONFIG.highFreq),
  };
}
