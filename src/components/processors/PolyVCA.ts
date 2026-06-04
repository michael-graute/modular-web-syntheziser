import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

const VOICE_COUNT = 4;
const SUM_GAIN = 0.25; // 4 voices × 0.25 = 1.0 max (prevents clipping)

export class PolyVCA extends SynthComponent {
  private voiceInputs: GainNode[] = [];   // receive audio per voice from PolyOscillator
  private voiceGains: GainNode[] = [];    // CV-controlled per voice from PolyADSR
  private sumGain: GainNode | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.POLY_VCA, 'Poly VCA', position);

    // Single bundled inputs — wired internally by ConnectionManager
    this.addInput('poly-audio', 'Poly Audio', SignalType.POLY_AUDIO);
    this.addInput('poly-env',   'Poly Env',   SignalType.POLY_ENV);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) throw new Error('AudioEngine not initialized');
    const ctx = audioEngine.getContext();

    this.sumGain = ctx.createGain();
    this.sumGain.gain.value = SUM_GAIN;

    for (let i = 0; i < VOICE_COUNT; i++) {
      const input = ctx.createGain();
      input.gain.value = 1.0;

      const gain = ctx.createGain();
      gain.gain.value = 0; // CV-driven

      input.connect(gain);
      gain.connect(this.sumGain);

      this.voiceInputs.push(input);
      this.voiceGains.push(gain);

      this.registerAudioNode(`voiceInput-${i}`, input);
      this.registerAudioNode(`voiceGain-${i}`, gain);
    }

    this.registerAudioNode('sumGain', this.sumGain);
  }

  destroyAudioNodes(): void {
    for (const n of this.voiceInputs) n.disconnect();
    for (const n of this.voiceGains) n.disconnect();
    if (this.sumGain) { this.sumGain.disconnect(); this.sumGain = null; }
    this.voiceInputs = [];
    this.voiceGains = [];
  }

  updateAudioParameter(_parameterId: string, _value: number): void { /* no user params */ }

  getInputNode(_portId?: string): AudioNode | null {
    // poly-audio and poly-env are wired by ConnectionManager directly; return null here
    return null;
  }

  getOutputNode(): AudioNode | null { return this.sumGain; }

  // Called by ConnectionManager when a poly-audio cable arrives from PolyOscillator
  connectPolyAudio(voiceOutputs: GainNode[]): void {
    for (let i = 0; i < VOICE_COUNT; i++) {
      const src = voiceOutputs[i];
      const dst = this.voiceInputs[i];
      if (src && dst) src.connect(dst);
    }
  }

  disconnectPolyAudio(voiceOutputs: GainNode[]): void {
    for (let i = 0; i < VOICE_COUNT; i++) {
      const src = voiceOutputs[i];
      const dst = this.voiceInputs[i];
      if (src && dst) {
        try { src.disconnect(dst); } catch (_) { /* already disconnected */ }
      }
    }
  }

  // Called by ConnectionManager when a poly-env cable arrives from PolyADSR
  connectPolyEnv(outputGains: GainNode[]): void {
    for (let i = 0; i < VOICE_COUNT; i++) {
      const src = outputGains[i];
      const dst = this.voiceGains[i];
      if (src && dst) src.connect(dst.gain);
    }
  }

  disconnectPolyEnv(outputGains: GainNode[]): void {
    for (let i = 0; i < VOICE_COUNT; i++) {
      const src = outputGains[i];
      const dst = this.voiceGains[i];
      if (src && dst) {
        try { src.disconnect(dst.gain); } catch (_) { /* already disconnected */ }
      }
    }
  }

  // Expose internal arrays for ConnectionManager to inspect on disconnect
  getVoiceInputs(): GainNode[]  { return this.voiceInputs; }
  getVoiceGains(): GainNode[]   { return this.voiceGains; }
}
