/**
 * VuMeter - Passive peak-level monitoring component
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

export class VuMeter extends SynthComponent {
  private inputGain: GainNode | null;
  private analyser: AnalyserNode | null;
  private dataArray: Float32Array | null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.VU_METER, 'VU Meter', position);

    this.addInput('input', 'Audio In', SignalType.AUDIO);

    this.inputGain = null;
    this.analyser = null;
    this.dataArray = null;
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1.0;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0;

    this.inputGain.connect(this.analyser);

    this.dataArray = new Float32Array(256);

    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('analyser', this.analyser);
  }

  destroyAudioNodes(): void {
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.inputGain) {
      this.inputGain.disconnect();
      this.inputGain = null;
    }

    this.dataArray = null;
  }

  getInputNode(): AudioNode | null {
    return this.inputGain;
  }

  getOutputNode(): AudioNode | null {
    return null;
  }

  updateAudioParameter(_parameterId: string, _value: number): void {
    // No parameters to update
  }

  getPeakLevel(): number {
    if (!this.analyser || !this.dataArray) {
      return 0;
    }

    // @ts-ignore - Web Audio API type mismatch in some TS lib versions
    this.analyser.getFloatTimeDomainData(this.dataArray);

    let peak = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const abs = Math.abs(this.dataArray[i]!);
      if (abs > peak) {
        peak = abs;
      }
    }

    return Math.min(peak, 1);
  }
}
