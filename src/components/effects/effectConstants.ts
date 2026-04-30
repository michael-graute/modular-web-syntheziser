export const RATE_MIN = 0.1;
export const RATE_MAX = 20;
export const RATE_DEFAULT_MODULATION = 0.5;
export const RATE_DEFAULT_TREMOLO = 4.0;

export const DEPTH_MIN = 0;
export const DEPTH_MAX = 100;
export const DEPTH_DEFAULT = 50;

export const FEEDBACK_MIN = 0;
export const FEEDBACK_MAX = 95;
export const FEEDBACK_DEFAULT = 0;

export const MIX_MIN = 0;
export const MIX_MAX = 1;
export const MIX_DEFAULT_WET = 1.0;
export const MIX_DEFAULT_HALF = 0.5;

export const BITCRUSHER_BIT_DEPTH_MIN = 1;
export const BITCRUSHER_BIT_DEPTH_MAX = 16;
export const BITCRUSHER_BIT_DEPTH_DEFAULT = 16;

export const BITCRUSHER_SAMPLE_RATE_MIN = 1;
export const BITCRUSHER_SAMPLE_RATE_MAX = 100;
export const BITCRUSHER_SAMPLE_RATE_DEFAULT = 100;

export const FLANGER_DELAY_BASE_S = 0.003;
export const FLANGER_DELAY_MAX_S = 0.020;
export const FLANGER_LFO_GAIN_SCALE = 0.003;

export const PHASER_STAGES_OPTIONS = [2, 4, 6, 8] as const;
export type PhaserStages = typeof PHASER_STAGES_OPTIONS[number];

export const PHASER_STAGES_DEFAULT: PhaserStages = 4;
export const PHASER_ALLPASS_FREQ_MIN = 200;
export const PHASER_ALLPASS_FREQ_MAX = 1600;
export const PHASER_LFO_GAIN_SCALE = 700;

export const TREMOLO_DC_OFFSET = 1.0;
