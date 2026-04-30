/**
 * Mixer - Audio mixer component with multiple input channels
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

/**
 * Mixer component for combining multiple audio sources
 */
const PAN_MIN = -1.0;
const PAN_MAX = 1.0;
const PAN_DEFAULT = 0.0;
const PAN_STEP = 0.01;

export class Mixer extends SynthComponent {
  private inputGains: GainNode[];
  private channelGains: GainNode[];
  private stereoPanners: StereoPannerNode[];
  private outputGain: GainNode | null;
  private readonly numChannels: number = 4;

  constructor(id: string, position: Position) {
    super(id, ComponentType.MIXER, 'Mixer', position);

    this.inputGains = [];
    this.channelGains = [];
    this.stereoPanners = [];
    this.outputGain = null;

    // Add input ports for each channel
    for (let i = 0; i < this.numChannels; i++) {
      this.addInput(`input${i + 1}`, `In ${i + 1}`, SignalType.AUDIO);
    }

    // Add single output port
    this.addOutput('output', 'Mix Out', SignalType.AUDIO);

    // Add gain parameters for each channel
    for (let i = 0; i < this.numChannels; i++) {
      this.addParameter(`gain${i + 1}`, `Ch${i + 1}`, 0.75, 0, 1, 0.01, '');
    }

    // Add master output gain
    this.addParameter('master', 'Master', 0.75, 0, 1, 0.01, '');

    // Add pan parameters for each channel
    for (let i = 0; i < this.numChannels; i++) {
      this.addParameter(`pan${i + 1}`, `Pan${i + 1}`, PAN_DEFAULT, PAN_MIN, PAN_MAX, PAN_STEP, '');
    }
  }

  /**
   * Create audio nodes
   */
  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    // Create output gain node
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = this.getParameter('master')?.getValue() || 0.75;

    // Create input, channel gain, and stereo panner nodes for each channel
    this.inputGains = [];
    this.channelGains = [];
    this.stereoPanners = [];
    for (let i = 0; i < this.numChannels; i++) {
      const inputGain = ctx.createGain();
      inputGain.gain.value = 1.0;

      const channelGain = ctx.createGain();
      channelGain.gain.value = this.getParameter(`gain${i + 1}`)?.getValue() ?? 0.75;

      const stereoPanner = ctx.createStereoPanner();
      stereoPanner.pan.value = this.getParameter(`pan${i + 1}`)?.getValue() ?? PAN_DEFAULT;

      // Signal chain: inputGain → channelGain → stereoPanner → outputGain
      inputGain.connect(channelGain);
      channelGain.connect(stereoPanner);
      stereoPanner.connect(this.outputGain);

      this.inputGains.push(inputGain);
      this.channelGains.push(channelGain);
      this.stereoPanners.push(stereoPanner);

      this.registerAudioNode(`inputGain${i + 1}`, inputGain);
      this.registerAudioNode(`channelGain${i + 1}`, channelGain);
      this.registerAudioNode(`stereoPanner${i + 1}`, stereoPanner);
    }

    // Register output gain
    this.registerAudioNode('outputGain', this.outputGain);

    console.log(`Mixer ${this.id} created with ${this.numChannels} channels`);
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    // Disconnect all input gains
    this.inputGains.forEach((gain) => {
      gain.disconnect();
    });
    this.inputGains = [];

    // Disconnect all channel gains
    this.channelGains.forEach((gain) => {
      gain.disconnect();
    });
    this.channelGains = [];

    // Disconnect all stereo panners
    this.stereoPanners.forEach((panner) => {
      panner.disconnect();
    });
    this.stereoPanners = [];

    // Disconnect output gain
    if (this.outputGain) {
      this.outputGain.disconnect();
      this.outputGain = null;
    }

    console.log(`Mixer ${this.id} destroyed`);
  }

  /**
   * Update audio parameter
   */
  updateAudioParameter(parameterId: string, value: number): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    if (parameterId === 'master') {
      if (this.outputGain) {
        this.outputGain.gain.setValueAtTime(value, now);
      }
    } else if (parameterId.startsWith('gain')) {
      const channelIndex = parseInt(parameterId.replace('gain', '')) - 1;
      if (channelIndex >= 0 && channelIndex < this.channelGains.length) {
        this.channelGains[channelIndex]!.gain.setValueAtTime(value, now);
      }
    } else if (parameterId.startsWith('pan')) {
      const channelIndex = parseInt(parameterId.replace('pan', '')) - 1;
      if (channelIndex >= 0 && channelIndex < this.stereoPanners.length) {
        this.stereoPanners[channelIndex]!.pan.setValueAtTime(value, now);
      }
    }
  }

  /**
   * Get input node for a specific channel
   */
  getInputNode(portId?: string): AudioNode | null {
    if (!portId) {
      // Default to first channel if no port specified
      return this.inputGains[0] || null;
    }

    // Extract channel number from portId (e.g., "input1" -> 0)
    if (portId.startsWith('input')) {
      const channelIndex = parseInt(portId.replace('input', '')) - 1;
      if (channelIndex >= 0 && channelIndex < this.inputGains.length) {
        return this.inputGains[channelIndex] || null;
      }
    }

    return null;
  }

  /**
   * Get output node for connections
   */
  getOutputNode(): AudioNode | null {
    return this.outputGain;
  }

  /**
   * Get the number of channels
   */
  getNumChannels(): number {
    return this.numChannels;
  }

  /**
   * Enable bypass - connect all inputs directly to output
   */
  protected override enableBypass(): void {
    if (!this.outputGain || this.inputGains.length === 0 || this.channelGains.length === 0) {
      return;
    }

    // Store original connections for restoration
    this._bypassConnections = [];
    for (let i = 0; i < this.numChannels; i++) {
      this._bypassConnections.push({ from: this.inputGains[i]!, to: this.channelGains[i]! });
      this._bypassConnections.push({ from: this.channelGains[i]!, to: this.stereoPanners[i]! });
      this._bypassConnections.push({ from: this.stereoPanners[i]!, to: this.outputGain });
    }

    // Disconnect all processing
    this.inputGains.forEach(inputGain => inputGain.disconnect());
    this.channelGains.forEach(channelGain => channelGain.disconnect());
    this.stereoPanners.forEach(panner => panner.disconnect());

    // Connect all inputs directly to output (bypass path skips fader and panner)
    this.inputGains.forEach(inputGain => inputGain.connect(this.outputGain!));

    console.log(`Mixer ${this.id} bypassed`);
  }

  /**
   * Disable bypass - restore original audio graph
   */
  protected override disableBypass(): void {
    if (!this.outputGain || this.inputGains.length === 0) {
      return;
    }

    // Disconnect bypass paths
    this.inputGains.forEach(inputGain => inputGain.disconnect());

    // Restore original connections
    this._bypassConnections.forEach(({ from, to }) => {
      try {
        from.connect(to);
      } catch (error) {
        console.error(`Error restoring connection:`, error);
      }
    });

    // Clear stored connections
    this._bypassConnections = [];

    console.log(`Mixer ${this.id} restored`);
  }
}
