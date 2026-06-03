/**
 * Type contracts for 032-polyphony feature.
 *
 * These types are the source-of-truth for the feature design.
 * The implementation in src/ must satisfy all shapes defined here.
 */

// ---------------------------------------------------------------------------
// Voice slot — the atomic unit of polyphonic data
// ---------------------------------------------------------------------------

/** Index of a voice lane within the 4-voice pool. */
export type VoiceIndex = 0 | 1 | 2 | 3;

/**
 * One voice lane maintained by the VoiceAllocator inside KeyboardInput.
 * Mutable internally; consumers receive a Readonly snapshot via getSlots().
 */
export interface VoiceSlot {
  /** Immutable lane index (0–3). */
  readonly voiceIndex: VoiceIndex;
  /** Current pitch in Hz. Meaningless when gate === 0. */
  frequency: number;
  /** 1 = note held, 0 = note released. */
  gate: 0 | 1;
  /** MIDI note number held in this slot, or null when idle. */
  note: number | null;
  /** performance.now() at last note-on; used for oldest-voice stealing. */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Voice Allocator public interface
// ---------------------------------------------------------------------------

/**
 * Voice allocation policy for the 4-voice pool.
 * Implemented as a plain JS class embedded in KeyboardInput.
 */
export interface IVoiceAllocator {
  /**
   * Allocate or retrigger a voice for the given note.
   * Uses oldest-voice stealing when all 4 slots are active.
   */
  noteOn(note: number, frequency: number): void;

  /** Release the voice holding the given MIDI note number. No-op if not found. */
  noteOff(note: number): void;

  /** Zero all slots — called on destroy or mode switch. */
  releaseAll(): void;

  /** Read-only snapshot of all 4 slots, indexed by voiceIndex. */
  getSlots(): Readonly<VoiceSlot[]>;
}

// ---------------------------------------------------------------------------
// Poly consumer getter type (registered by ConnectionManager)
// ---------------------------------------------------------------------------

/** Function type polled by poly components to read live voice slot data. */
export type VoiceSlotsGetter = () => Readonly<VoiceSlot[]>;

// ---------------------------------------------------------------------------
// Poly component public API (shared contract for PolyOscillator and PolyADSR)
// ---------------------------------------------------------------------------

/**
 * Any component that accepts a POLY_CV input and needs a getter registered
 * must implement this interface.
 */
export interface PolyConsumer {
  /** Called by ConnectionManager when a POLY_CV cable is connected. */
  setVoiceSlotsGetter(getter: VoiceSlotsGetter): void;

  /** Called by ConnectionManager when the POLY_CV cable is removed. */
  clearVoiceSlotsGetter(): void;
}

// ---------------------------------------------------------------------------
// PolyOscillator parameter shape
// ---------------------------------------------------------------------------

export interface PolyOscillatorParams {
  /** Waveform type index: 0=sine, 1=square, 2=sawtooth, 3=triangle. */
  waveform: 0 | 1 | 2 | 3;
}

// ---------------------------------------------------------------------------
// PolyADSR parameter shape
// ---------------------------------------------------------------------------

export interface PolyAdsrParams {
  /** Attack time in seconds (0.001–5.0). */
  attack: number;
  /** Decay time in seconds (0.001–5.0). */
  decay: number;
  /** Sustain level (0.0–1.0). */
  sustain: number;
  /** Release time in seconds (0.001–5.0). */
  release: number;
}

// ---------------------------------------------------------------------------
// Keyboard poly extension parameters
// ---------------------------------------------------------------------------

export interface KeyboardPolyParams {
  /**
   * 0 = mono mode (existing behaviour).
   * 1 = poly mode (4-voice VoiceAllocator active).
   * Stored as a numeric parameter for automatic patch serialisation.
   */
  polyMode: 0 | 1;
}

// ---------------------------------------------------------------------------
// Keyboard poly extension: public methods added to KeyboardInput
// ---------------------------------------------------------------------------

export interface KeyboardPolyExtension {
  /** Read-only snapshot of the 4-voice allocator state. */
  getVoiceSlots(): Readonly<VoiceSlot[]>;

  /** True when polyMode parameter equals 1. */
  isPolyMode(): boolean;

  /** Switch between mono (0) and poly (1) mode. Stops all active voices. */
  setPolyMode(mode: 0 | 1): void;
}

// ---------------------------------------------------------------------------
// Connection-level contract for POLY_CV cables
// ---------------------------------------------------------------------------

/**
 * Expected shape of the source component when registering POLY_CV getters
 * in ConnectionManager.createConnection().
 */
export interface PolyCvSource {
  getVoiceSlots(): Readonly<VoiceSlot[]>;
}

/**
 * Expected shape of a poly consumer when registering getters.
 */
export interface PolyCvTarget extends PolyConsumer {
  type: string; // ComponentType value
}

// ---------------------------------------------------------------------------
// PolyVCA port naming constants (used in both implementation and tests)
// ---------------------------------------------------------------------------

export const POLY_VCA_AUDIO_INPUT_IDS = ['audio-0', 'audio-1', 'audio-2', 'audio-3'] as const;
export const POLY_VCA_CV_INPUT_IDS    = ['cv-0',    'cv-1',    'cv-2',    'cv-3']    as const;
export const POLY_VCA_OUTPUT_ID       = 'output'                                       as const;

export const POLY_ADSR_ENV_OUTPUT_IDS = ['env-0', 'env-1', 'env-2', 'env-3'] as const;

export const VOICE_COUNT = 4 as const;
