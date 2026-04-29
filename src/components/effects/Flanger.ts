import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import {
  RATE_MIN, RATE_MAX, RATE_DEFAULT_MODULATION,
  DEPTH_DEFAULT,
  FEEDBACK_DEFAULT,
  MIX_DEFAULT_HALF,
  FLANGER_DELAY_BASE_S, FLANGER_DELAY_MAX_S, FLANGER_LFO_GAIN_SCALE,
} from './effectConstants';
import { safeFeedback, depthToFlangerLfoGain, clamp } from './effectHelpers';

export class Flanger extends SynthComponent {
  private inputGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private feedbackGain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private outputGain: GainNode | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.FLANGER, 'Flanger', position);

    this.addInput('input', 'Audio In', SignalType.AUDIO);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    this.addParameter('rate', 'Rate', RATE_DEFAULT_MODULATION, RATE_MIN, RATE_MAX, 0.1, 'Hz');
    this.addParameter('depth', 'Depth', DEPTH_DEFAULT, 0, 100, 1, '%');
    this.addParameter('feedback', 'Feedback', FEEDBACK_DEFAULT, 0, 95, 1, '%');
    this.addParameter('mix', 'Mix', MIX_DEFAULT_HALF, 0, 1, 0.01, '');
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1.0;

    this.delayNode = ctx.createDelay(FLANGER_DELAY_MAX_S);
    this.delayNode.delayTime.value = FLANGER_DELAY_BASE_S;

    this.feedbackGain = ctx.createGain();
    const feedback = this.getParameter('feedback')?.getValue() ?? FEEDBACK_DEFAULT;
    this.feedbackGain.gain.value = safeFeedback(feedback);

    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    const rate = this.getParameter('rate')?.getValue() ?? RATE_DEFAULT_MODULATION;
    this.lfo.frequency.value = rate;

    this.lfoGain = ctx.createGain();
    const depth = this.getParameter('depth')?.getValue() ?? DEPTH_DEFAULT;
    this.lfoGain.gain.value = depthToFlangerLfoGain(depth, FLANGER_LFO_GAIN_SCALE);

    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1.0;

    const mix = this.getParameter('mix')?.getValue() ?? MIX_DEFAULT_HALF;
    this.applyMix(mix);

    // Dry path: input → dry → output
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.outputGain);

    // Wet path: input → delay → wet → output
    this.inputGain.connect(this.delayNode);
    this.delayNode.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Feedback: wet → feedbackGain → delay input
    this.wetGain.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);

    // LFO modulates delay time
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.delayNode.delayTime);

    this.lfo.start();

    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('delayNode', this.delayNode);
    this.registerAudioNode('feedbackGain', this.feedbackGain);
    this.registerAudioNode('lfo', this.lfo);
    this.registerAudioNode('lfoGain', this.lfoGain);
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
    if (this.lfoGain) { this.lfoGain.disconnect(); this.lfoGain = null; }
    if (this.feedbackGain) { this.feedbackGain.disconnect(); this.feedbackGain = null; }
    if (this.delayNode) { this.delayNode.disconnect(); this.delayNode = null; }
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
      case 'depth':
        if (this.lfoGain) {
          this.lfoGain.gain.setValueAtTime(depthToFlangerLfoGain(value, FLANGER_LFO_GAIN_SCALE), now);
        }
        break;
      case 'feedback':
        if (this.feedbackGain) {
          this.feedbackGain.gain.setValueAtTime(safeFeedback(value), now);
        }
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
      { from: this.inputGain, to: this.delayNode! },
      { from: this.dryGain!, to: this.outputGain },
      { from: this.delayNode!, to: this.wetGain! },
      { from: this.wetGain!, to: this.outputGain },
      { from: this.wetGain!, to: this.feedbackGain! },
      { from: this.feedbackGain!, to: this.delayNode! },
      { from: this.lfo!, to: this.lfoGain! },
    ];

    this.inputGain.disconnect();
    if (this.delayNode) this.delayNode.disconnect();
    if (this.lfo) this.lfo.disconnect();
    if (this.lfoGain) this.lfoGain.disconnect();
    if (this.dryGain) this.dryGain.disconnect();
    if (this.wetGain) this.wetGain.disconnect();
    if (this.feedbackGain) this.feedbackGain.disconnect();

    this.inputGain.connect(this.outputGain);
  }

  protected override disableBypass(): void {
    if (!this.inputGain || !this.outputGain) return;

    this.inputGain.disconnect();

    this._bypassConnections.forEach(({ from, to }) => {
      try { from.connect(to); } catch { /* ignore */ }
    });

    // Restore AudioParam connection not stored in _bypassConnections
    if (this.lfoGain && this.delayNode) {
      this.lfoGain.connect(this.delayNode.delayTime);
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
