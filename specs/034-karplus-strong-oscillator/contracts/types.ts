/**
 * Type contracts for the Karplus-Strong String Synthesizer component.
 * Feature: 034-karplus-strong-oscillator
 *
 * These are design-time contracts consumed by /speckit.tasks and implementation;
 * final types live in src/core/types.ts, src/components/generators/KarplusStrong.ts,
 * and src/worklets/karplus-strong.worklet.ts.
 */

/** Discrete decay-algorithm variant. Persisted as a numeric enum index (0/1). */
export enum KarplusStrongMode {
  STRING = 0,
  STRETCHED = 1,
}

/** Supported fundamental frequency range, in Hz. Per spec clarification (2026-07-04). */
export const KARPLUS_STRONG_MIN_FREQUENCY_HZ = 40;
export const KARPLUS_STRONG_MAX_FREQUENCY_HZ = 4000;
export const KARPLUS_STRONG_DEFAULT_FREQUENCY_HZ = 440;

/** Normalized (0-1) control ranges. */
export const KARPLUS_STRONG_DEFAULT_DAMPING = 0.5;
export const KARPLUS_STRONG_DEFAULT_TONE = 0.5;

/**
 * Damping maps linearly to a target decay time (seconds to -60dB), not
 * directly to the feedback coefficient — see dampingToFeedbackCoefficient.
 * The coefficient-to-decay-time relationship is exponential, so a linear
 * Damping-to-coefficient mapping would concentrate nearly all audible change
 * in the last ~10-20% of the knob's range.
 */
export const KARPLUS_STRONG_MIN_DECAY_TIME_SEC = 0.3;
export const KARPLUS_STRONG_MAX_DECAY_TIME_SEC = 5.0;

/**
 * Parameters that live on the main-thread component and are persisted via
 * ComponentData.parameters (packed as a flat Record<string, number>).
 */
export interface KarplusStrongParameters {
  frequency: number; // Hz, clamped [KARPLUS_STRONG_MIN_FREQUENCY_HZ, KARPLUS_STRONG_MAX_FREQUENCY_HZ]
  damping: number; // 0-1, clamped
  tone: number; // 0-1, clamped
  mode: KarplusStrongMode;
}

/** Messages sent from the main-thread component to the AudioWorkletProcessor via port.postMessage. */
export type KarplusStrongWorkletMessage =
  | { type: 'pluck' }
  | { type: 'setMode'; mode: KarplusStrongMode }
  | { type: 'setTone'; value: number };

/**
 * Custom AudioParam names exposed by the AudioWorkletNode/Processor.
 * `frequency` accepts 1V/octave-style CV connections via getAudioParamForInput();
 * `damping` is k-rate (changes take effect per-render-quantum, not per-sample).
 */
export interface KarplusStrongWorkletParameterDescriptor {
  name: 'frequency' | 'damping';
  automationRate: 'a-rate' | 'k-rate';
  defaultValue: number;
  minValue: number;
  maxValue: number;
}

/**
 * Pure DSP helper contract — extracted so it is unit-testable via Vitest without
 * an AudioWorklet runtime (Constitution: Test Coverage requires ≥80% on critical logic;
 * jsdom/Vitest cannot execute an actual AudioWorkletGlobalScope).
 */
export interface KarplusStrongDspHelpers {
  /** Converts a frequency in Hz + sample rate into an integer delay-line length (samples). */
  frequencyToDelayLineLength(frequencyHz: number, sampleRate: number): number;

  /** Converts the normalized 0-1 Damping control + sample rate into a feedback coefficient < 1.0, via a linear decay-time interpolation. */
  dampingToFeedbackCoefficient(damping: number, sampleRate: number): number;

  /** Applies mode-specific feedback filtering to a single delay-line output sample. */
  applyFeedbackFilter(
    mode: KarplusStrongMode,
    coefficient: number,
    prev1: number,
    prev2: number,
    rng: () => number,
  ): number;

  /** Generates one sample of tone-filtered noise-burst excitation. */
  generateExcitationSample(tone: number, rng: () => number, prevExcitation: number): number;
}
