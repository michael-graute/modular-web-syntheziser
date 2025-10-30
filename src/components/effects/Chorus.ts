/**
 * Chorus - Modulated delay effect
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

/**
 * Chorus effect component using DelayNode + internal LFO
 */
export class Chorus extends SynthComponent {
  private inputGain: GainNode | null;
  private dryGain: GainNode | null;
  private wetGain: GainNode | null;
  private delayNode: DelayNode | null;
  private lfo: OscillatorNode | null;
  private lfoGain: GainNode | null;
  private outputGain: GainNode | null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.CHORUS, 'Chorus', position);

    // Add ports
    this.addInput('input', 'Audio In', SignalType.AUDIO);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    // Add parameters
    this.addParameter('rate', 'Rate', 1.0, 0.1, 10, 0.1, 'Hz');
    this.addParameter('depth', 'Depth', 50, 0, 100, 1, '%');
    this.addParameter('mix', 'Mix', 0.5, 0, 1, 0.01, ''); // 0=dry, 1=wet

    this.inputGain = null;
    this.dryGain = null;
    this.wetGain = null;
    this.delayNode = null;
    this.lfo = null;
    this.lfoGain = null;
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

    // Create delay node for chorus effect
    // Typical chorus uses short delays (10-30ms range)
    this.delayNode = ctx.createDelay(0.1); // Max 100ms
    this.delayNode.delayTime.value = 0.020; // Base delay of 20ms

    // Create internal LFO for modulation
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    const rate = this.getParameter('rate')?.getValue() || 1.0;
    this.lfo.frequency.value = rate;

    // Create LFO gain to control modulation depth
    this.lfoGain = ctx.createGain();
    const depth = this.getParameter('depth')?.getValue() || 50;
    // Depth controls the delay time modulation range (±depth * 0.005ms)
    this.lfoGain.gain.value = (depth / 100) * 0.005;

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

    // Wet path: input -> delay -> wetGain -> output
    // LFO modulation: lfo -> lfoGain -> delay.delayTime (AudioParam)
    this.inputGain.connect(this.delayNode);
    this.delayNode.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Connect LFO to modulate delay time
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.delayNode.delayTime);

    // Start LFO
    this.lfo.start();

    // Register with audio engine
    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('dryGain', this.dryGain);
    this.registerAudioNode('wetGain', this.wetGain);
    this.registerAudioNode('delayNode', this.delayNode);
    this.registerAudioNode('lfo', this.lfo);
    this.registerAudioNode('lfoGain', this.lfoGain);
    this.registerAudioNode('outputGain', this.outputGain);

    console.log(`Chorus ${this.id} created with rate: ${rate}Hz, depth: ${depth}%`);
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    // Stop LFO first
    if (this.lfo) {
      try {
        this.lfo.stop();
        this.lfo.disconnect();
      } catch (error) {
        // LFO might already be stopped
      }
      this.lfo = null;
    }

    if (this.lfoGain) {
      this.lfoGain.disconnect();
      this.lfoGain = null;
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

    console.log(`Chorus ${this.id} destroyed`);
  }

  /**
   * Update audio parameter
   */
  updateAudioParameter(parameterId: string, value: number): void {
    if (!this.lfo || !this.lfoGain) {
      return;
    }

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    switch (parameterId) {
      case 'rate':
        // Update LFO frequency
        this.lfo.frequency.setValueAtTime(value, now);
        console.log(`Chorus ${this.id} rate changed to: ${value}Hz`);
        break;
      case 'depth':
        // Update LFO gain (modulation depth)
        // Convert percentage to delay time modulation range
        const depthGain = (value / 100) * 0.005;
        this.lfoGain.gain.setValueAtTime(depthGain, now);
        console.log(`Chorus ${this.id} depth changed to: ${value}%`);
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
   * Enable bypass - connect input directly to output
   */
  protected override enableBypass(): void {
    if (!this.inputGain || !this.outputGain) {
      return;
    }

    // Store original connections for restoration
    // Note: AudioParam connections are not stored, they will be manually reconnected
    this._bypassConnections = [
      { from: this.inputGain, to: this.dryGain! },
      { from: this.inputGain, to: this.delayNode! },
      { from: this.dryGain!, to: this.outputGain },
      { from: this.delayNode!, to: this.wetGain! },
      { from: this.wetGain!, to: this.outputGain },
      { from: this.lfo!, to: this.lfoGain! },
    ];

    // Disconnect all processing nodes
    this.inputGain.disconnect();
    if (this.delayNode) this.delayNode.disconnect();
    if (this.lfo) this.lfo.disconnect();
    if (this.lfoGain) this.lfoGain.disconnect();
    if (this.dryGain) this.dryGain.disconnect();
    if (this.wetGain) this.wetGain.disconnect();

    // Connect input directly to output
    this.inputGain.connect(this.outputGain);

    console.log(`Chorus ${this.id} bypassed`);
  }

  /**
   * Disable bypass - restore original audio graph
   */
  protected override disableBypass(): void {
    if (!this.inputGain || !this.outputGain) {
      return;
    }

    // Disconnect bypass path
    this.inputGain.disconnect();

    // Restore original connections
    this._bypassConnections.forEach(({ from, to }) => {
      try {
        from.connect(to);
      } catch (error) {
        console.error(`Error restoring connection:`, error);
      }
    });

    // Manually reconnect AudioParam connections (not stored in _bypassConnections)
    if (this.lfoGain && this.delayNode) {
      this.lfoGain.connect(this.delayNode.delayTime);
    }

    // Clear stored connections
    this._bypassConnections = [];

    console.log(`Chorus ${this.id} restored`);
  }
}
