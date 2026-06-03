/**
 * SlewLimiter — smooths abrupt CV jumps with independent Rise and Fall time constants.
 *
 * Reads incoming CV each animation frame via an AnalyserNode (same pattern as
 * EnvelopeFollower), applies an IIR first-order lowpass with separate coefficients
 * for upward (Rise) and downward (Fall) transitions, and exposes the smoothed value
 * via a ConstantSourceNode whose offset is patchable to any CV-accepting input.
 *
 * Feature: 031-slew-limiter-portamento
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import type { ComponentData } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import {
  validateSlewLimiterParams,
  clampCv,
  computeSlewCoeff,
} from './SlewLimiterValidation';

const FFT_SIZE = 256;
const MAX_DT_SEC = 0.1;

export class SlewLimiter extends SynthComponent {
  private inputGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private cvNode: ConstantSourceNode | null = null;
  private dataArray: Float32Array | null = null;

  private outputValue: number = 0;

  constructor(id: string, position: Position) {
    super(id, ComponentType.SLEW_LIMITER, 'Slew Limiter', position);

    this.addInput('input', 'CV In', SignalType.CV);
    this.addOutput('cv', 'CV Out', SignalType.CV);

    this.addParameter('rise', 'Rise', 50, 0, 5000, 1, 'ms');
    this.addParameter('fall', 'Fall', 50, 0, 5000, 1, 'ms');
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1.0;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    this.analyser.smoothingTimeConstant = 0;

    this.inputGain.connect(this.analyser);

    this.dataArray = new Float32Array(FFT_SIZE);

    this.cvNode = ctx.createConstantSource();
    this.cvNode.offset.value = 0;
    this.cvNode.start();

    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('analyser', this.analyser);
    this.registerAudioNode('cvNode', this.cvNode);
  }

  destroyAudioNodes(): void {
    if (this.cvNode) {
      try { this.cvNode.stop(); } catch (_) { /* already stopped */ }
      try { this.cvNode.disconnect(); } catch (_) { /* already disconnected */ }
      this.cvNode = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch (_) { /* already disconnected */ }
      this.analyser = null;
    }
    if (this.inputGain) {
      try { this.inputGain.disconnect(); } catch (_) { /* already disconnected */ }
      this.inputGain = null;
    }
    this.dataArray = null;
    this.outputValue = 0;
    this.audioNodes.clear();
  }

  getInputNode(): AudioNode | null {
    return this.inputGain;
  }

  getOutputNode(): AudioNode | null {
    return this.cvNode;
  }

  updateAudioParameter(_parameterId: string, _value: number): void {
    // Rise and Fall are read live each frame in tick() — no immediate action needed.
  }

  /** Returns the current smoothed output value in [0, 1]. */
  getOutputValue(): number {
    return this.outputValue;
  }

  /**
   * Advances the slew by one animation frame.
   * Called once per frame from SlewLimiterDisplay.render().
   * @param dtSec Frame delta time in seconds.
   */
  tick(dtSec: number): void {
    if (!this.analyser || !this.dataArray || !this.cvNode) return;

    const safeDt = Math.min(dtSec, MAX_DT_SEC);

    // @ts-ignore - Web Audio API type mismatch in some TS lib versions
    this.analyser.getFloatTimeDomainData(this.dataArray);

    // Mean of the analysis window gives the current DC CV value
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i]!;
    }
    const target = clampCv(sum / this.dataArray.length);

    const riseMs = this._isBypassed ? 0 : (this.getParameter('rise')?.getValue() ?? 50);
    const fallMs = this._isBypassed ? 0 : (this.getParameter('fall')?.getValue() ?? 50);
    const coeff = target >= this.outputValue
      ? computeSlewCoeff(riseMs, safeDt)
      : computeSlewCoeff(fallMs, safeDt);

    this.outputValue = clampCv(this.outputValue + coeff * (target - this.outputValue));
    this.cvNode.offset.value = this.outputValue;
  }

  protected override enableBypass(): void {
    // No audio graph rewiring needed — tick() uses coeff=1 when _isBypassed is true,
    // making the output instantly track the input (true CV pass-through).
  }

  protected override disableBypass(): void {
    // No audio graph rewiring needed — tick() resumes normal slew on next frame.
  }

  override serialize(): ComponentData {
    return {
      id: this.id,
      type: this.type,
      position: { ...this.position },
      parameters: {
        rise: this.getParameter('rise')?.getValue() ?? 50,
        fall: this.getParameter('fall')?.getValue() ?? 50,
      },
      isBypassed: this.isBypassed,
    };
  }

  override deserialize(data: ComponentData): void {
    this.position = { ...data.position };
    const p = validateSlewLimiterParams(data.parameters);
    this.parameters.get('rise')?.setValue(p.rise);
    this.parameters.get('fall')?.setValue(p.fall);
    if (data.isBypassed) {
      this.setBypass(true);
    }
  }
}
