import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

const VOICE_COUNT = 4;
// Summing gain prevents clipping: 4 voices × 0.25 = 1.0 max (FR-012)
const SUM_GAIN = 0.25;

export class PolyVCA extends SynthComponent {
  private voiceInputs: GainNode[] = [];  // receive audio from PolyOscillator per-voice output
  private voiceGains: GainNode[] = [];   // CV-controlled per voice (from PolyADSR env-N)
  private sumGain: GainNode | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.POLY_VCA, 'Poly VCA', position);

    // FR-011: 4 independent gain stages; FR-012: mono mix output
    for (let i = 0; i < VOICE_COUNT; i++) {
      this.addInput(`audio-${i}`, `Audio ${i} In`, SignalType.AUDIO);
      this.addInput(`cv-${i}`, `CV ${i} In`, SignalType.CV);
    }
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) throw new Error('AudioEngine not initialized');
    const ctx = audioEngine.getContext();

    this.sumGain = ctx.createGain();
    this.sumGain.gain.value = SUM_GAIN;

    for (let i = 0; i < VOICE_COUNT; i++) {
      // voiceInput receives audio from PolyOscillator voice output
      const input = ctx.createGain();
      input.gain.value = 1.0;

      // voiceGain controlled by PolyADSR env-N CV
      const gain = ctx.createGain();
      gain.gain.value = 0; // start silent — CV drives it

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
    for (const n of this.voiceInputs) { n.disconnect(); }
    for (const n of this.voiceGains) { n.disconnect(); }
    if (this.sumGain) { this.sumGain.disconnect(); this.sumGain = null; }
    this.voiceInputs = [];
    this.voiceGains = [];
  }

  updateAudioParameter(_parameterId: string, _value: number): void {
    // No user-adjustable parameters; gain is entirely CV-driven
  }

  getInputNode(portId?: string): AudioNode | null {
    if (!portId) return this.voiceInputs[0] ?? null;
    const audioMatch = portId.match(/^audio-(\d)$/);
    if (audioMatch) {
      return this.voiceInputs[parseInt(audioMatch[1]!, 10)] ?? null;
    }
    // cv-N ports use AudioParam — return null here; getAudioParamForInput handles them
    return null;
  }

  protected override getInputNodeByPort(portId: string): AudioNode | null {
    return this.getInputNode(portId);
  }

  getOutputNode(): AudioNode | null { return this.sumGain; }

  override getAudioParamForInput(inputId: string): AudioParam | null {
    const cvMatch = inputId.match(/^cv-(\d)$/);
    if (cvMatch) {
      const gain = this.voiceGains[parseInt(cvMatch[1]!, 10)];
      return gain?.gain ?? null;
    }
    return null;
  }
}
