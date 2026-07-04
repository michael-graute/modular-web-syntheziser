/**
 * KarplusStrongProcessor — AudioWorkletProcessor implementing the classic
 * Karplus-Strong delay-line-with-feedback-filter algorithm.
 *
 * This is this codebase's first AudioWorkletNode. Runs entirely on the audio
 * rendering thread. Noise excitation happens only once, at pluck time (when
 * a 'pluck' message re-seeds the delay line); the steady-state process() loop
 * never injects new noise — it only reads, filters, and writes back into the
 * circular delay line.
 *
 * Feature: 034-karplus-strong-oscillator
 */

/// <reference lib="webworker" />

import {
  maxDelayLineLength,
  frequencyToDelayLineLength,
  dampingToFeedbackCoefficient,
  applyFeedbackFilter,
  applyToneFilter,
  createSeededRng,
  clampTone,
} from './karplus-strong-dsp';
import { KarplusStrongMode } from '../core/types';
import { KARPLUS_STRONG } from '../utils/constants';

type KarplusStrongWorkletMessage =
  | { type: 'pluck' }
  | { type: 'setMode'; mode: KarplusStrongMode }
  | { type: 'setTone'; value: number };

declare const sampleRate: number;
declare const currentFrame: number;

/** Not available in this project's ES2020 DOM lib target — declared locally. */
interface KarplusStrongAudioParamDescriptor {
  name: string;
  automationRate: 'a-rate' | 'k-rate';
  defaultValue: number;
  minValue: number;
  maxValue: number;
}

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: (new (options?: unknown) => AudioWorkletProcessor) & {
    parameterDescriptors?: KarplusStrongAudioParamDescriptor[];
  }
): void;

class KarplusStrongProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): KarplusStrongAudioParamDescriptor[] {
    return [
      {
        name: 'frequency',
        automationRate: 'a-rate',
        defaultValue: KARPLUS_STRONG.DEFAULT_FREQUENCY,
        minValue: KARPLUS_STRONG.MIN_FREQUENCY,
        maxValue: KARPLUS_STRONG.MAX_FREQUENCY,
      },
      {
        name: 'damping',
        automationRate: 'k-rate',
        defaultValue: KARPLUS_STRONG.DEFAULT_DAMPING,
        minValue: 0,
        maxValue: 1,
      },
    ];
  }

  private readonly delayLine: Float32Array;
  private writeIndex = 0;
  private mode: KarplusStrongMode = KarplusStrongMode.STRING;
  private tone: number = KARPLUS_STRONG.DEFAULT_TONE;
  private toneFilterState = 0;
  private readonly rng: () => number;
  private hasBeenPlucked = false;

  constructor() {
    super();
    // Pre-allocated once at construction — process() never allocates.
    this.delayLine = new Float32Array(maxDelayLineLength(sampleRate));
    this.rng = createSeededRng(currentFrame || 1);

    this.port.onmessage = (event: MessageEvent<KarplusStrongWorkletMessage>) => {
      this.handleMessage(event.data);
    };
  }

  private handleMessage(message: KarplusStrongWorkletMessage): void {
    switch (message.type) {
      case 'pluck':
        this.pluck();
        break;
      case 'setMode':
        this.mode = message.mode;
        break;
      case 'setTone':
        this.tone = clampTone(message.value);
        break;
    }
  }

  /**
   * Re-seeds the entire active delay line with tone-filtered noise, and resets
   * feedback state. This is the ONLY place noise is injected — process()'s
   * steady-state loop only reads/filters/writes existing delay-line content.
   * Called again on rapid re-trigger; safely overwrites in-flight decay state.
   */
  private pluck(): void {
    const frequencyParamDefault = KARPLUS_STRONG.DEFAULT_FREQUENCY;
    const activeLength = Math.min(
      frequencyToDelayLineLength(frequencyParamDefault, sampleRate),
      this.delayLine.length
    );

    this.toneFilterState = 0;
    for (let i = 0; i < activeLength; i++) {
      const noiseSample = this.rng() * 2 - 1;
      this.toneFilterState = applyToneFilter(this.tone, noiseSample, this.toneFilterState);
      this.delayLine[i] = this.toneFilterState;
    }
    // Zero any remaining (unused at this frequency) tail of the buffer.
    for (let i = activeLength; i < this.delayLine.length; i++) {
      this.delayLine[i] = 0;
    }

    this.writeIndex = 0;
    this.hasBeenPlucked = true;
  }

  override process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const output = outputs[0]?.[0];
    if (!output) return true;

    if (!this.hasBeenPlucked) {
      output.fill(0);
      return true;
    }

    const frequencyValues = parameters.frequency;
    const dampingValues = parameters.damping;
    const isDampingConstant = (dampingValues?.length ?? 1) === 1;
    const constantCoefficient = isDampingConstant
      ? dampingToFeedbackCoefficient(dampingValues?.[0] ?? KARPLUS_STRONG.DEFAULT_DAMPING)
      : 0;

    const frequency = frequencyValues?.[0] ?? KARPLUS_STRONG.DEFAULT_FREQUENCY;
    const activeLength = Math.min(
      frequencyToDelayLineLength(frequency, sampleRate),
      this.delayLine.length
    );

    for (let i = 0; i < output.length; i++) {
      const coefficient = isDampingConstant
        ? constantCoefficient
        : dampingToFeedbackCoefficient(dampingValues?.[i] ?? KARPLUS_STRONG.DEFAULT_DAMPING);

      const readIndex = this.writeIndex % activeLength;
      const prevIndex1 = (readIndex - 1 + activeLength) % activeLength;
      const prevIndex2 = (readIndex - 2 + activeLength) % activeLength;

      const prev1 = this.delayLine[prevIndex1] ?? 0;
      const prev2 = this.delayLine[prevIndex2] ?? 0;

      const filtered = applyFeedbackFilter(this.mode, coefficient, prev1, prev2, this.rng);
      this.delayLine[readIndex] = filtered;
      output[i] = filtered;

      this.writeIndex = (this.writeIndex + 1) % activeLength;
    }

    return true;
  }
}

registerProcessor('karplus-strong', KarplusStrongProcessor);
