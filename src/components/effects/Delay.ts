/**
 * Delay - Echo/delay effect with feedback
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

/**
 * Delay effect component
 */
export class Delay extends SynthComponent {
  private inputGain: GainNode | null;
  private dryGain: GainNode | null;
  private wetGain: GainNode | null;
  private delayNode: DelayNode | null;
  private feedbackGain: GainNode | null;
  private outputGain: GainNode | null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.DELAY, 'Delay', position);

    // Add ports
    this.addInput('input', 'Audio In', SignalType.AUDIO);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    // Add parameters
    this.addParameter('time', 'Time', 0.25, 0.001, 2.0, 0.001, 's');
    this.addParameter('feedback', 'Feedback', 0.3, 0, 0.95, 0.01, '');
    this.addParameter('mix', 'Mix', 0.5, 0, 1, 0.01, ''); // 0=dry, 1=wet

    this.inputGain = null;
    this.dryGain = null;
    this.wetGain = null;
    this.delayNode = null;
    this.feedbackGain = null;
    this.outputGain = null;
  }

  /**
   * Create audio nodes
   */
  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    // Create input gain
    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1.0;

    // Create dry/wet mix gains
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    // Create delay node
    this.delayNode = ctx.createDelay(2.0); // Max 2 seconds
    const delayTime = this.getParameter('time')?.getValue() || 0.25;
    this.delayNode.delayTime.value = delayTime;

    // Create feedback gain
    this.feedbackGain = ctx.createGain();
    const feedback = this.getParameter('feedback')?.getValue() || 0.3;
    // Clamp feedback to prevent runaway amplification
    this.feedbackGain.gain.value = Math.min(feedback, 0.95);

    // Create output gain
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1.0;

    // Set initial dry/wet mix
    const mix = this.getParameter('mix')?.getValue() || 0.5;
    this.updateMix(mix);

    // Connect routing:
    // Dry path: input -> dryGain -> output
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.outputGain);

    // Wet path with feedback: input -> delay -> feedbackGain -> delay (loop)
    //                                      ↓
    //                                   wetGain -> output
    this.inputGain.connect(this.delayNode);
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode); // Feedback loop
    this.delayNode.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Register with audio engine
    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('dryGain', this.dryGain);
    this.registerAudioNode('wetGain', this.wetGain);
    this.registerAudioNode('delayNode', this.delayNode);
    this.registerAudioNode('feedbackGain', this.feedbackGain);
    this.registerAudioNode('outputGain', this.outputGain);

    console.log(`Delay ${this.id} created with time: ${delayTime}s, feedback: ${feedback}`);
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    // Disconnect feedback loop first to prevent issues
    if (this.feedbackGain) {
      this.feedbackGain.disconnect();
      this.feedbackGain = null;
    }

    if (this.delayNode) {
      this.delayNode.disconnect();
      this.delayNode = null;
    }

    if (this.wetGain) {
      this.wetGain.disconnect();
      this.wetGain = null;
    }

    if (this.dryGain) {
      this.dryGain.disconnect();
      this.dryGain = null;
    }

    if (this.inputGain) {
      this.inputGain.disconnect();
      this.inputGain = null;
    }

    if (this.outputGain) {
      this.outputGain.disconnect();
      this.outputGain = null;
    }

    console.log(`Delay ${this.id} destroyed`);
  }

  /**
   * Update audio parameter
   */
  updateAudioParameter(parameterId: string, value: number): void {
    if (!this.delayNode || !this.feedbackGain) {
      return;
    }

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    switch (parameterId) {
      case 'time':
        // Smooth delay time changes to prevent artifacts
        this.delayNode.delayTime.setTargetAtTime(value, now, 0.01);
        break;
      case 'feedback':
        // Clamp feedback to safe range (0 - 0.95) to prevent runaway amplification
        const safeFeedback = Math.min(value, 0.95);
        this.feedbackGain.gain.setValueAtTime(safeFeedback, now);
        break;
      case 'mix':
        this.updateMix(value);
        break;
    }
  }

  /**
   * Update dry/wet mix
   */
  private updateMix(mix: number): void {
    if (!this.dryGain || !this.wetGain) {
      return;
    }

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    // Equal power crossfade
    const dryLevel = Math.cos(mix * 0.5 * Math.PI);
    const wetLevel = Math.cos((1.0 - mix) * 0.5 * Math.PI);

    this.dryGain.gain.setValueAtTime(dryLevel, now);
    this.wetGain.gain.setValueAtTime(wetLevel, now);
  }

  /**
   * Get input node for connections
   */
  getInputNode(): AudioNode | null {
    return this.inputGain;
  }

  /**
   * Get output node for connections
   */
  getOutputNode(): AudioNode | null {
    return this.outputGain;
  }

  /**
   * Get delay time AudioParam for modulation
   */
  getDelayTimeParam(): AudioParam | null {
    return this.delayNode ? this.delayNode.delayTime : null;
  }
}
