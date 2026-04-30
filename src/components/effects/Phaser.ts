import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import {
  RATE_MIN, RATE_MAX, RATE_DEFAULT_MODULATION,
  DEPTH_DEFAULT,
  FEEDBACK_DEFAULT,
  MIX_DEFAULT_HALF,
  PHASER_STAGES_DEFAULT, PhaserStages,
  PHASER_ALLPASS_FREQ_MIN, PHASER_ALLPASS_FREQ_MAX, PHASER_LFO_GAIN_SCALE,
} from './effectConstants';
import { safeFeedback, depthToPhaserLfoGain, clamp, isValidPhaserStages } from './effectHelpers';

export class Phaser extends SynthComponent {
  private inputGain: GainNode | null = null;
  private allpassFilters: BiquadFilterNode[] = [];
  private feedbackGain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private outputGain: GainNode | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.PHASER, 'Phaser', position);

    this.addInput('input', 'Audio In', SignalType.AUDIO);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    this.addParameter('rate', 'Rate', RATE_DEFAULT_MODULATION, RATE_MIN, RATE_MAX, 0.1, 'Hz');
    this.addParameter('depth', 'Depth', DEPTH_DEFAULT, 0, 100, 1, '%');
    this.addParameter('feedback', 'Feedback', FEEDBACK_DEFAULT, 0, 95, 1, '%');
    this.addParameter('stages', 'Stages', PHASER_STAGES_DEFAULT, 2, 8, 2, '');
    this.addParameter('mix', 'Mix', MIX_DEFAULT_HALF, 0, 1, 0.01, '');
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();
    const stages = this.getParameter('stages')?.getValue() ?? PHASER_STAGES_DEFAULT;

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1.0;

    // Build allpass filter chain
    const centerFreq = (PHASER_ALLPASS_FREQ_MIN + PHASER_ALLPASS_FREQ_MAX) / 2;
    this.allpassFilters = [];
    for (let i = 0; i < stages; i++) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'allpass';
      filter.frequency.value = centerFreq;
      filter.Q.value = 0.5;
      this.allpassFilters.push(filter);
    }

    this.feedbackGain = ctx.createGain();
    const feedback = this.getParameter('feedback')?.getValue() ?? FEEDBACK_DEFAULT;
    this.feedbackGain.gain.value = safeFeedback(feedback);

    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    const rate = this.getParameter('rate')?.getValue() ?? RATE_DEFAULT_MODULATION;
    this.lfo.frequency.value = rate;

    this.lfoGain = ctx.createGain();
    const depth = this.getParameter('depth')?.getValue() ?? DEPTH_DEFAULT;
    this.lfoGain.gain.value = depthToPhaserLfoGain(depth, PHASER_LFO_GAIN_SCALE);

    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1.0;

    const mix = this.getParameter('mix')?.getValue() ?? MIX_DEFAULT_HALF;
    this.applyMix(mix);

    // Wire allpass chain sequentially
    const chainStart = this.allpassFilters[0]!;
    const chainEnd = this.allpassFilters[this.allpassFilters.length - 1]!;

    this.inputGain.connect(chainStart);
    for (let i = 0; i < this.allpassFilters.length - 1; i++) {
      this.allpassFilters[i]!.connect(this.allpassFilters[i + 1]!);
    }

    // Wet path: chain end → wet → output
    chainEnd.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Feedback: chain end → feedbackGain → chain start
    chainEnd.connect(this.feedbackGain);
    this.feedbackGain.connect(chainStart);

    // Dry path: input → dry → output
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.outputGain);

    // LFO modulates all allpass frequencies
    this.lfo.connect(this.lfoGain);
    for (const filter of this.allpassFilters) {
      this.lfoGain.connect(filter.frequency);
    }

    this.lfo.start();

    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('feedbackGain', this.feedbackGain);
    this.registerAudioNode('lfo', this.lfo);
    this.registerAudioNode('lfoGain', this.lfoGain);
    this.registerAudioNode('dryGain', this.dryGain);
    this.registerAudioNode('wetGain', this.wetGain);
    this.registerAudioNode('outputGain', this.outputGain);
    this.allpassFilters.forEach((f, i) => this.registerAudioNode(`allpass${i}`, f));
  }

  destroyAudioNodes(): void {
    if (this.lfo) {
      try { this.lfo.stop(); } catch { /* already stopped */ }
      this.lfo.disconnect();
      this.lfo = null;
    }
    if (this.lfoGain) { this.lfoGain.disconnect(); this.lfoGain = null; }
    this.allpassFilters.forEach((filter, i) => {
      filter.disconnect();
      this.audioNodes.delete(`allpass${i}`);
    });
    this.allpassFilters = [];
    if (this.feedbackGain) { this.feedbackGain.disconnect(); this.feedbackGain = null; }
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
          this.lfoGain.gain.setValueAtTime(depthToPhaserLfoGain(value, PHASER_LFO_GAIN_SCALE), now);
        }
        break;
      case 'feedback':
        if (this.feedbackGain) {
          this.feedbackGain.gain.setValueAtTime(safeFeedback(value), now);
        }
        break;
      case 'stages': {
        const newStages = isValidPhaserStages(value) ? value : PHASER_STAGES_DEFAULT;
        // Snapshot current parameter values before graph teardown
        const rate = this.getParameter('rate')?.getValue() ?? RATE_DEFAULT_MODULATION;
        const depth = this.getParameter('depth')?.getValue() ?? DEPTH_DEFAULT;
        const feedback = this.getParameter('feedback')?.getValue() ?? FEEDBACK_DEFAULT;
        const mix = this.getParameter('mix')?.getValue() ?? MIX_DEFAULT_HALF;

        // Rebuild graph with new stage count
        this.getParameter('stages')?.setValue(newStages as PhaserStages);
        this.destroyAudioNodes();
        this.createAudioNodes();

        // Restore parameter values into the new graph
        this.updateAudioParameter('rate', rate);
        this.updateAudioParameter('depth', depth);
        this.updateAudioParameter('feedback', feedback);
        this.applyMix(mix);
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
      { from: this.inputGain, to: this.allpassFilters[0]! },
      { from: this.inputGain, to: this.dryGain! },
      { from: this.dryGain!, to: this.outputGain },
      ...this.allpassFilters.slice(0, -1).map((f, i) => ({
        from: f as AudioNode,
        to: this.allpassFilters[i + 1] as AudioNode,
      })),
      { from: this.allpassFilters[this.allpassFilters.length - 1]!, to: this.wetGain! },
      { from: this.allpassFilters[this.allpassFilters.length - 1]!, to: this.feedbackGain! },
      { from: this.feedbackGain!, to: this.allpassFilters[0]! },
      { from: this.wetGain!, to: this.outputGain },
      { from: this.lfo!, to: this.lfoGain! },
    ];

    this.inputGain.disconnect();
    if (this.lfo) this.lfo.disconnect();
    if (this.lfoGain) this.lfoGain.disconnect();
    if (this.dryGain) this.dryGain.disconnect();
    if (this.wetGain) this.wetGain.disconnect();
    if (this.feedbackGain) this.feedbackGain.disconnect();
    for (const filter of this.allpassFilters) {
      filter.disconnect();
    }

    this.inputGain.connect(this.outputGain);
  }

  protected override disableBypass(): void {
    if (!this.inputGain || !this.outputGain) return;

    this.inputGain.disconnect();

    this._bypassConnections.forEach(({ from, to }) => {
      try { from.connect(to); } catch { /* ignore */ }
    });

    // Restore AudioParam connections (LFO → allpass frequencies) not in _bypassConnections
    if (this.lfoGain) {
      for (const filter of this.allpassFilters) {
        try { this.lfoGain.connect(filter.frequency); } catch { /* ignore */ }
      }
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
