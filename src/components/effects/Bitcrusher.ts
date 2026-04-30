import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import {
  BITCRUSHER_BIT_DEPTH_MIN, BITCRUSHER_BIT_DEPTH_MAX, BITCRUSHER_BIT_DEPTH_DEFAULT,
  BITCRUSHER_SAMPLE_RATE_MIN, BITCRUSHER_SAMPLE_RATE_MAX, BITCRUSHER_SAMPLE_RATE_DEFAULT,
  MIX_DEFAULT_WET,
} from './effectConstants';
import { clamp } from './effectHelpers';

export class Bitcrusher extends SynthComponent {
  private inputGain: GainNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private outputGain: GainNode | null = null;

  // Mutable fields read inside onaudioprocess — updated via updateAudioParameter
  private currentBitDepth: number = BITCRUSHER_BIT_DEPTH_DEFAULT;
  private currentSampleRate: number = BITCRUSHER_SAMPLE_RATE_DEFAULT;

  constructor(id: string, position: Position) {
    super(id, ComponentType.BITCRUSHER, 'Bitcrusher', position);

    this.addInput('input', 'Audio In', SignalType.AUDIO);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    this.addParameter('bitDepth', 'Bit Depth', BITCRUSHER_BIT_DEPTH_DEFAULT, BITCRUSHER_BIT_DEPTH_MIN, BITCRUSHER_BIT_DEPTH_MAX, 1, 'bits');
    this.addParameter('sampleRate', 'Sample Rate', BITCRUSHER_SAMPLE_RATE_DEFAULT, BITCRUSHER_SAMPLE_RATE_MIN, BITCRUSHER_SAMPLE_RATE_MAX, 1, '%');
    this.addParameter('mix', 'Mix', MIX_DEFAULT_WET, 0, 1, 0.01, '');
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1.0;

    // ScriptProcessorNode for sample-level bit/rate reduction
    this.scriptNode = ctx.createScriptProcessor(256, 1, 1);

    this.currentBitDepth = this.getParameter('bitDepth')?.getValue() ?? BITCRUSHER_BIT_DEPTH_DEFAULT;
    this.currentSampleRate = this.getParameter('sampleRate')?.getValue() ?? BITCRUSHER_SAMPLE_RATE_DEFAULT;

    this.scriptNode.onaudioprocess = (event: AudioProcessingEvent) => {
      const input = event.inputBuffer.getChannelData(0);
      const output = event.outputBuffer.getChannelData(0);
      const step = Math.pow(2, this.currentBitDepth - 1);
      const holdInterval = Math.max(1, Math.round(100 / this.currentSampleRate));
      let held = 0;
      for (let i = 0; i < input.length; i++) {
        if (i % holdInterval === 0) {
          held = Math.round((input[i] ?? 0) * step) / step;
        }
        output[i] = held;
      }
    };

    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1.0;

    const mix = this.getParameter('mix')?.getValue() ?? MIX_DEFAULT_WET;
    this.applyMix(mix);

    // Dry path: input → dry → output
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.outputGain);

    // Wet path: input → scriptNode → wet → output
    this.inputGain.connect(this.scriptNode);
    this.scriptNode.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('scriptNode', this.scriptNode);
    this.registerAudioNode('dryGain', this.dryGain);
    this.registerAudioNode('wetGain', this.wetGain);
    this.registerAudioNode('outputGain', this.outputGain);
  }

  destroyAudioNodes(): void {
    if (this.scriptNode) {
      this.scriptNode.onaudioprocess = null;
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    if (this.wetGain) { this.wetGain.disconnect(); this.wetGain = null; }
    if (this.dryGain) { this.dryGain.disconnect(); this.dryGain = null; }
    if (this.inputGain) { this.inputGain.disconnect(); this.inputGain = null; }
    if (this.outputGain) { this.outputGain.disconnect(); this.outputGain = null; }
  }

  updateAudioParameter(parameterId: string, value: number): void {
    switch (parameterId) {
      case 'bitDepth':
        this.currentBitDepth = clamp(value, BITCRUSHER_BIT_DEPTH_MIN, BITCRUSHER_BIT_DEPTH_MAX);
        break;
      case 'sampleRate':
        this.currentSampleRate = clamp(value, BITCRUSHER_SAMPLE_RATE_MIN, BITCRUSHER_SAMPLE_RATE_MAX);
        break;
      case 'mix':
        this.applyMix(value);
        break;
    }
  }

  getInputNode(): AudioNode | null {
    return this.inputGain;
  }

  getOutputNode(): AudioNode | null {
    return this.outputGain;
  }

  protected override enableBypass(): void {
    if (!this.inputGain || !this.outputGain) return;

    this._bypassConnections = [
      { from: this.inputGain, to: this.dryGain! },
      { from: this.inputGain, to: this.scriptNode! },
      { from: this.dryGain!, to: this.outputGain },
      { from: this.scriptNode!, to: this.wetGain! },
      { from: this.wetGain!, to: this.outputGain },
    ];

    this.inputGain.disconnect();
    if (this.scriptNode) this.scriptNode.disconnect();
    if (this.dryGain) this.dryGain.disconnect();
    if (this.wetGain) this.wetGain.disconnect();

    this.inputGain.connect(this.outputGain);
  }

  protected override disableBypass(): void {
    if (!this.inputGain || !this.outputGain) return;

    this.inputGain.disconnect();

    this._bypassConnections.forEach(({ from, to }) => {
      try { from.connect(to); } catch { /* ignore */ }
    });

    this._bypassConnections = [];
  }

  private applyMix(mix: number): void {
    if (!this.dryGain || !this.wetGain) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    this.dryGain.gain.setValueAtTime(Math.cos(mix * 0.5 * Math.PI), now);
    this.wetGain.gain.setValueAtTime(Math.cos((1.0 - mix) * 0.5 * Math.PI), now);
  }
}
