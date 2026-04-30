import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import {
  RATE_MIN, RATE_MAX, RATE_DEFAULT_TREMOLO,
  DEPTH_DEFAULT,
  MIX_DEFAULT_WET,
} from './effectConstants';
import { tremoloLfoParams, clamp } from './effectHelpers';

export class Tremolo extends SynthComponent {
  private inputGain: GainNode | null = null;
  private tremoloGain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private constantSource: ConstantSourceNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private outputGain: GainNode | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.TREMOLO, 'Tremolo', position);

    this.addInput('input', 'Audio In', SignalType.AUDIO);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    this.addParameter('rate', 'Rate', RATE_DEFAULT_TREMOLO, RATE_MIN, RATE_MAX, 0.1, 'Hz');
    this.addParameter('depth', 'Depth', DEPTH_DEFAULT, 0, 100, 1, '%');
    this.addParameter('mix', 'Mix', MIX_DEFAULT_WET, 0, 1, 0.01, '');
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1.0;

    this.tremoloGain = ctx.createGain();
    this.tremoloGain.gain.value = 0;

    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    const rate = this.getParameter('rate')?.getValue() ?? RATE_DEFAULT_TREMOLO;
    this.lfo.frequency.value = rate;

    this.lfoGain = ctx.createGain();

    this.constantSource = ctx.createConstantSource();

    const depth = this.getParameter('depth')?.getValue() ?? DEPTH_DEFAULT;
    const { lfoAmplitude, dcOffset } = tremoloLfoParams(depth);
    this.lfoGain.gain.value = lfoAmplitude;
    this.constantSource.offset.value = dcOffset;

    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1.0;

    const mix = this.getParameter('mix')?.getValue() ?? MIX_DEFAULT_WET;
    this.applyMix(mix);

    // Wet path: input → tremoloGain → wet → output
    this.inputGain.connect(this.tremoloGain);
    this.tremoloGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Dry path: input → dry → output
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.outputGain);

    // Amplitude modulation: constantSource and LFO both drive tremoloGain.gain
    this.constantSource.connect(this.tremoloGain.gain);
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.tremoloGain.gain);

    this.lfo.start();
    this.constantSource.start();

    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('tremoloGain', this.tremoloGain);
    this.registerAudioNode('lfo', this.lfo);
    this.registerAudioNode('lfoGain', this.lfoGain);
    this.registerAudioNode('constantSource', this.constantSource);
    this.registerAudioNode('dryGain', this.dryGain);
    this.registerAudioNode('wetGain', this.wetGain);
    this.registerAudioNode('outputGain', this.outputGain);
  }

  destroyAudioNodes(): void {
    if (this.lfo) {
      try { this.lfo.stop(); } catch { /* already stopped */ }
      this.lfo.disconnect();
      this.lfo = null;
    }
    if (this.constantSource) {
      try { this.constantSource.stop(); } catch { /* already stopped */ }
      this.constantSource.disconnect();
      this.constantSource = null;
    }
    if (this.lfoGain) { this.lfoGain.disconnect(); this.lfoGain = null; }
    if (this.tremoloGain) { this.tremoloGain.disconnect(); this.tremoloGain = null; }
    if (this.dryGain) { this.dryGain.disconnect(); this.dryGain = null; }
    if (this.wetGain) { this.wetGain.disconnect(); this.wetGain = null; }
    if (this.inputGain) { this.inputGain.disconnect(); this.inputGain = null; }
    if (this.outputGain) { this.outputGain.disconnect(); this.outputGain = null; }
  }

  updateAudioParameter(parameterId: string, value: number): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    switch (parameterId) {
      case 'rate':
        if (this.lfo) {
          this.lfo.frequency.setValueAtTime(clamp(value, RATE_MIN, RATE_MAX), now);
        }
        break;
      case 'depth': {
        const { lfoAmplitude, dcOffset } = tremoloLfoParams(value);
        if (this.lfoGain) {
          this.lfoGain.gain.setValueAtTime(lfoAmplitude, now);
        }
        if (this.constantSource) {
          this.constantSource.offset.setValueAtTime(dcOffset, now);
        }
        break;
      }
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
      { from: this.inputGain, to: this.tremoloGain! },
      { from: this.inputGain, to: this.dryGain! },
      { from: this.tremoloGain!, to: this.wetGain! },
      { from: this.wetGain!, to: this.outputGain },
      { from: this.dryGain!, to: this.outputGain },
      { from: this.lfo!, to: this.lfoGain! },
    ];

    this.inputGain.disconnect();
    if (this.tremoloGain) this.tremoloGain.disconnect();
    if (this.lfo) this.lfo.disconnect();
    if (this.lfoGain) this.lfoGain.disconnect();
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

    // Restore AudioParam connections not stored in _bypassConnections
    if (this.constantSource && this.tremoloGain) {
      this.constantSource.connect(this.tremoloGain.gain);
    }
    if (this.lfoGain && this.tremoloGain) {
      this.lfoGain.connect(this.tremoloGain.gain);
    }

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
