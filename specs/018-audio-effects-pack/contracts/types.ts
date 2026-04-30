/**
 * Type contracts for 018-audio-effects-pack
 * Bitcrusher, Flanger, Phaser, Tremolo
 */

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

export const RATE_MIN = 0.1;
export const RATE_MAX = 20;
export const RATE_DEFAULT_MODULATION = 0.5; // Hz — Flanger / Phaser
export const RATE_DEFAULT_TREMOLO = 4.0;    // Hz — Tremolo

export const DEPTH_MIN = 0;
export const DEPTH_MAX = 100;
export const DEPTH_DEFAULT = 50;

export const FEEDBACK_MIN = 0;
export const FEEDBACK_MAX = 95;
export const FEEDBACK_DEFAULT = 0;

export const MIX_MIN = 0;
export const MIX_MAX = 1;
export const MIX_DEFAULT_WET = 1.0;  // Bitcrusher, Tremolo
export const MIX_DEFAULT_HALF = 0.5; // Flanger, Phaser

// ---------------------------------------------------------------------------
// Bitcrusher
// ---------------------------------------------------------------------------

export const BITCRUSHER_BIT_DEPTH_MIN = 1;
export const BITCRUSHER_BIT_DEPTH_MAX = 16;
export const BITCRUSHER_BIT_DEPTH_DEFAULT = 16; // 16-bit = transparent

export const BITCRUSHER_SAMPLE_RATE_MIN = 1;   // % of full sample rate
export const BITCRUSHER_SAMPLE_RATE_MAX = 100;
export const BITCRUSHER_SAMPLE_RATE_DEFAULT = 100; // 100% = no reduction

export interface BitcrusherParams {
  bitDepth: number;   // [1, 16]
  sampleRate: number; // [1, 100] percent
  mix: number;        // [0, 1]
}

// ---------------------------------------------------------------------------
// Flanger
// ---------------------------------------------------------------------------

export const FLANGER_DELAY_BASE_S = 0.003;  // 3ms base delay
export const FLANGER_DELAY_MAX_S = 0.010;   // 10ms max (LFO sweeps up to this)
export const FLANGER_LFO_GAIN_SCALE = 0.003; // maps depth 0-100% → 0-3ms modulation

export interface FlangerParams {
  rate: number;     // [0.1, 20] Hz
  depth: number;    // [0, 100] %
  feedback: number; // [0, 95] %
  mix: number;      // [0, 1]
}

// ---------------------------------------------------------------------------
// Phaser
// ---------------------------------------------------------------------------

export const PHASER_STAGES_OPTIONS = [2, 4, 6, 8] as const;
export type PhaserStages = typeof PHASER_STAGES_OPTIONS[number];

export const PHASER_STAGES_DEFAULT: PhaserStages = 4;
export const PHASER_ALLPASS_FREQ_MIN = 200;  // Hz — LFO sweep bottom
export const PHASER_ALLPASS_FREQ_MAX = 1600; // Hz — LFO sweep top
export const PHASER_LFO_GAIN_SCALE = 700;    // maps depth 0-100% → 0-700 Hz modulation

export interface PhaserParams {
  rate: number;     // [0.1, 20] Hz
  depth: number;    // [0, 100] %
  feedback: number; // [0, 95] %
  stages: number;   // one of PHASER_STAGES_OPTIONS
  mix: number;      // [0, 1]
}

// ---------------------------------------------------------------------------
// Tremolo
// ---------------------------------------------------------------------------

export const TREMOLO_DC_OFFSET = 1.0; // ConstantSourceNode offset before LFO blend

export interface TremoloParams {
  rate: number;  // [0.1, 20] Hz
  depth: number; // [0, 100] %
  mix: number;   // [0, 1]
}

// ---------------------------------------------------------------------------
// Union type for all new effects
// ---------------------------------------------------------------------------

export type EffectParams = BitcrusherParams | FlangerParams | PhaserParams | TremoloParams;
