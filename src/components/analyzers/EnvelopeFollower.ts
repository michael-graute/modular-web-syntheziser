/**
 * EnvelopeFollower - Converts incoming audio amplitude to a 0-1 CV signal.
 *
 * Analyses the input audio via periodic RMS (AnalyserNode) each animation frame.
 * Attack and Release parameters shape the IIR smoothing applied to the RMS value.
 * Gain scales the input sensitivity before detection.
 * The CV output is a ConstantSourceNode whose offset is updated every frame,
 * making it patchable to any CV-accepting input in the synthesizer.
 *
 * Feature: 030-envelope-follower
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import type { ComponentData } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import {
  validateEnvelopeFollowerParams,
  clampEnvelope,
  computeSmoothingCoeff,
} from './EnvelopeFollowerValidation';

const FFT_SIZE = 256;
const MAX_DT_SEC = 0.1; // clamp frame delta to prevent envelope jump after tab-switch

export class EnvelopeFollower extends SynthComponent {
  private inputGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private cvNode: ConstantSourceNode | null = null;
  private dataArray: Float32Array | null = null;

  private envelopeValue: number = 0;

  constructor(id: string, position: Position) {
    super(id, ComponentType.ENVELOPE_FOLLOWER, 'Env Follower', position);

    this.addInput('input', 'Audio In', SignalType.AUDIO);
    this.addOutput('cv', 'CV Out', SignalType.CV);

    this.addParameter('attack', 'Attack', 10, 1, 500, 1, 'ms');
    this.addParameter('release', 'Release', 100, 5, 2000, 5, 'ms');
    this.addParameter('gain', 'Gain', 1.0, 0.1, 4.0, 0.05, '×');
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

    // dataArray must be Float32Array(fftSize) — getFloatTimeDomainData fills fftSize samples
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
    this.envelopeValue = 0;
    this.audioNodes.clear();
  }

  getInputNode(): AudioNode | null {
    return this.inputGain;
  }

  getOutputNode(): AudioNode | null {
    return this.cvNode;
  }

  updateAudioParameter(_parameterId: string, _value: number): void {
    // Attack, release, and gain are read live each frame in tick() — no immediate action needed.
  }

  /** Returns the current smoothed envelope value in [0, 1]. */
  getEnvelopeValue(): number {
    return this.envelopeValue;
  }

  /**
   * Advances the envelope by one animation frame.
   * Called once per frame from EnvelopeFollowerDisplay.render().
   * @param dt Frame delta time in seconds.
   */
  tick(dt: number): void {
    if (!this.analyser || !this.dataArray || !this.cvNode) return;

    const safeDt = Math.min(dt, MAX_DT_SEC);

    // @ts-ignore - Web Audio API type mismatch in some TS lib versions
    this.analyser.getFloatTimeDomainData(this.dataArray);

    // RMS over the analysis window
    let sumSq = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const s = this.dataArray[i]!;
      sumSq += s * s;
    }
    const rmsRaw = Math.sqrt(sumSq / this.dataArray.length);

    // Apply gain and clamp
    const gain = this.getParameter('gain')?.getValue() ?? 1.0;
    const rmsNow = clampEnvelope(rmsRaw * gain);

    // IIR smoothing with separate attack/release coefficients
    const attackMs = this.getParameter('attack')?.getValue() ?? 10;
    const releaseMs = this.getParameter('release')?.getValue() ?? 100;
    const coeff = rmsNow >= this.envelopeValue
      ? computeSmoothingCoeff(attackMs, safeDt)
      : computeSmoothingCoeff(releaseMs, safeDt);

    this.envelopeValue = clampEnvelope(this.envelopeValue + coeff * (rmsNow - this.envelopeValue));
    this.cvNode.offset.value = this.envelopeValue;
  }

  override serialize(): ComponentData {
    return {
      id: this.id,
      type: this.type,
      position: { ...this.position },
      parameters: {
        attack: this.getParameter('attack')?.getValue() ?? 10,
        release: this.getParameter('release')?.getValue() ?? 100,
        gain: this.getParameter('gain')?.getValue() ?? 1.0,
      },
    };
  }

  override deserialize(data: ComponentData): void {
    this.position = { ...data.position };
    const p = validateEnvelopeFollowerParams(data.parameters);
    this.parameters.get('attack')?.setValue(p.attack);
    this.parameters.get('release')?.setValue(p.release);
    this.parameters.get('gain')?.setValue(p.gain);
  }
}
