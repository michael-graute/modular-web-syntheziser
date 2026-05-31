/**
 * Type contracts for the 3-Band Parametric EQ component (feature 026-parametric-eq)
 */

// ---------------------------------------------------------------------------
// Parameter ranges
// ---------------------------------------------------------------------------

export const EQ_GAIN_MIN = -18;   // dB
export const EQ_GAIN_MAX = 18;    // dB
export const EQ_GAIN_DEFAULT = 0; // dB

export const LOW_FREQ_MIN = 20;
export const LOW_FREQ_MAX = 800;
export const LOW_FREQ_DEFAULT = 80; // Hz

export const MID_FREQ_MIN = 200;
export const MID_FREQ_MAX = 8000;
export const MID_FREQ_DEFAULT = 1000; // Hz

export const MID_Q_MIN = 0.1;
export const MID_Q_MAX = 10.0;
export const MID_Q_DEFAULT = 1.0;

export const HIGH_FREQ_MIN = 1000;
export const HIGH_FREQ_MAX = 20000;
export const HIGH_FREQ_DEFAULT = 8000; // Hz

// CV scaling: 1V = 1 dB (gain AudioParam range for LFO scaler)
export const GAIN_CV_RANGE = { min: EQ_GAIN_MIN, max: EQ_GAIN_MAX } as const;

// ---------------------------------------------------------------------------
// Config type
// ---------------------------------------------------------------------------

export interface ParametricEQConfig {
  lowGain: number;   // dB, clamped to [EQ_GAIN_MIN, EQ_GAIN_MAX]
  lowFreq: number;   // Hz, clamped to [LOW_FREQ_MIN, LOW_FREQ_MAX]
  midGain: number;   // dB
  midFreq: number;   // Hz
  midQ: number;      // dimensionless
  highGain: number;  // dB
  highFreq: number;  // Hz
}

export const DEFAULT_EQ_CONFIG: Readonly<ParametricEQConfig> = {
  lowGain:  EQ_GAIN_DEFAULT,
  lowFreq:  LOW_FREQ_DEFAULT,
  midGain:  EQ_GAIN_DEFAULT,
  midFreq:  MID_FREQ_DEFAULT,
  midQ:     MID_Q_DEFAULT,
  highGain: EQ_GAIN_DEFAULT,
  highFreq: HIGH_FREQ_DEFAULT,
};

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface EQValidationResult {
  isValid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Serialized parameter keys (must match ComponentData.parameters keys)
// ---------------------------------------------------------------------------

export type EQParameterKey =
  | 'lowGain'
  | 'lowFreq'
  | 'midGain'
  | 'midFreq'
  | 'midQ'
  | 'highGain'
  | 'highFreq';

export const EQ_PARAMETER_KEYS: readonly EQParameterKey[] = [
  'lowGain', 'lowFreq', 'midGain', 'midFreq', 'midQ', 'highGain', 'highFreq',
];
