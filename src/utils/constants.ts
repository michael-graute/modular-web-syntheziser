/**
 * Application Constants
 * Modular Synthesizer Application
 */

/**
 * Canvas constants
 */
export const CANVAS = {
  GRID_SIZE: 20,
  MIN_ZOOM: 0.5,
  MAX_ZOOM: 2.0,
  ZOOM_STEP: 0.1,
} as const;

/**
 * Component dimensions
 */
export const COMPONENT = {
  MIN_WIDTH: 120,
  MIN_HEIGHT: 80,
  HEADER_HEIGHT: 32,
  PORT_SIZE: 12,
  PORT_PADDING: 8,
  PADDING: 16,
} as const;

/**
 * Connection constants
 */
export const CONNECTION = {
  CABLE_WIDTH: 3,
  CABLE_HIT_TOLERANCE: 8,
  BEZIER_CURVE_OFFSET: 50,
} as const;

/**
 * Audio constants
 */
export const AUDIO = {
  SAMPLE_RATE: 44100,
  MIN_FREQUENCY: 0,
  MAX_FREQUENCY: 20000,
  MIN_DETUNE: -100,
  MAX_DETUNE: 100,
  MIN_GAIN: 0,
  MAX_GAIN: 2,
  MIN_Q: 0.0001,
  MAX_Q: 20,
} as const;

/**
 * Envelope constants
 */
export const ENVELOPE = {
  MIN_TIME: 0,
  MAX_TIME: 5,
  MIN_LEVEL: 0,
  MAX_LEVEL: 1,
  DEFAULT_ATTACK: 0.1,
  DEFAULT_DECAY: 0.2,
  DEFAULT_SUSTAIN: 0.7,
  DEFAULT_RELEASE: 0.3,
} as const;

/**
 * LFO constants
 */
export const LFO = {
  MIN_RATE: 0.01,
  MAX_RATE: 20,
  MIN_DEPTH: 0,
  MAX_DEPTH: 1,
} as const;

/**
 * Effect constants
 */
export const EFFECTS = {
  DELAY_MIN_TIME: 0,
  DELAY_MAX_TIME: 2,
  DELAY_MIN_FEEDBACK: 0,
  DELAY_MAX_FEEDBACK: 0.95,
  MIN_MIX: 0,
  MAX_MIX: 1,
} as const;

/**
 * Keyboard constants
 */
export const KEYBOARD = {
  NUM_KEYS: 24, // 2 octaves
  OCTAVE_COUNT: 2, // Number of octaves to display
  BASE_OCTAVE: 3, // C3 to B4
  MIN_OCTAVE: 0,
  MAX_OCTAVE: 8,
  MAX_POLYPHONY: 8,
  WHITE_KEY_WIDTH: 40,
  WHITE_KEY_HEIGHT: 120,
  BLACK_KEY_WIDTH: 28,
  BLACK_KEY_HEIGHT: 80,
} as const;

/**
 * QWERTY to MIDI note mapping
 * White keys: A S D F G H J K L ; '
 * Black keys: W E   T Y U   O P
 */
export const KEYBOARD_MAPPING = {
  // White keys (C D E F G A B C D E F G A B ...)
  a: 0, // C
  s: 2, // D
  d: 4, // E
  f: 5, // F
  g: 7, // G
  h: 9, // A
  j: 11, // B
  k: 12, // C
  l: 14, // D
  ';': 16, // E
  "'": 17, // F

  // Black keys (C# D# F# G# A# C# D# F# G# A#)
  w: 1, // C#
  e: 3, // D#
  t: 6, // F#
  y: 8, // G#
  u: 10, // A#
  o: 13, // C#
  p: 15, // D#

  // Octave controls
  z: 'octave-down',
  x: 'octave-up',
  ' ': 'sustain',
} as const;

/**
 * Color constants
 */
export const COLORS = {
  AUDIO: '#4ade80',
  CV: '#60a5fa',
  GATE: '#f87171',
  SELECTED: '#4a9eff',
  GRID: 'rgba(255, 255, 255, 0.05)',
  COMPONENT_BG: '#2a2a2a',
  COMPONENT_BORDER: '#505050',
} as const;

/**
 * Storage keys for localStorage
 */
export const STORAGE_KEYS = {
  PATCHES: 'modular-synth-patches',
  CURRENT_PATCH: 'modular-synth-current-patch',
  SETTINGS: 'modular-synth-settings',
} as const;

/**
 * Patch version
 */
export const PATCH_VERSION = '1.0.0';

/**
 * Component categories
 */
export const COMPONENT_CATEGORIES = {
  GENERATORS: 'Generators',
  PROCESSORS: 'Processors',
  EFFECTS: 'Effects',
  UTILITIES: 'Utilities',
} as const;

/**
 * Waveform types
 */
export const WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle'] as const;

/**
 * Filter types
 */
export const FILTER_TYPES = [
  'lowpass',
  'highpass',
  'bandpass',
  'notch',
  'allpass',
] as const;

/**
 * Noise types
 */
export const NOISE_TYPES = ['white', 'pink'] as const;

/**
 * Performance constants
 */
export const PERFORMANCE = {
  TARGET_FPS: 60,
  FRAME_TIME: 1000 / 60, // ~16.67ms
  MAX_AUDIO_LATENCY: 10, // milliseconds
} as const;
