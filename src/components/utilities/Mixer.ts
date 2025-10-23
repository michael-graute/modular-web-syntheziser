/**
 * Mixer - Audio mixer component with multiple input channels
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

/**
 * Mixer component for combining multiple audio sources
 */
export class Mixer extends SynthComponent {
  private channelGains: GainNode[];
  private outputGain: GainNode | null;
  private readonly numChannels: number = 4;

  constructor(id: string, position: Position) {
    super(id, ComponentType.MIXER, 'Mixer', position);

    this.channelGains = [];
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

    // Create gain node for each channel
    this.channelGains = [];
    for (let i = 0; i < this.numChannels; i++) {
      const channelGain = ctx.createGain();
      const gainValue = this.getParameter(`gain${i + 1}`)?.getValue() || 0.75;
      channelGain.gain.value = gainValue;

      // Connect channel to output
      channelGain.connect(this.outputGain);

      this.channelGains.push(channelGain);

      // Register with audio engine
      this.registerAudioNode(`channelGain${i + 1}`, channelGain);
    }

    // Register output gain
    this.registerAudioNode('outputGain', this.outputGain);

    console.log(`Mixer ${this.id} created with ${this.numChannels} channels`);
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    // Disconnect all channel gains
    this.channelGains.forEach((gain) => {
      gain.disconnect();
    });
    this.channelGains = [];

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
      // Extract channel number from parameterId (e.g., "gain1" -> 0)
      const channelIndex = parseInt(parameterId.replace('gain', '')) - 1;
      if (channelIndex >= 0 && channelIndex < this.channelGains.length) {
        this.channelGains[channelIndex]!.gain.setValueAtTime(value, now);
      }
    }
  }

  /**
   * Get input node for a specific channel
   */
  getInputNode(portId?: string): AudioNode | null {
    if (!portId) {
      // Default to first channel if no port specified
      return this.channelGains[0] || null;
    }

    // Extract channel number from portId (e.g., "input1" -> 0)
    if (portId.startsWith('input')) {
      const channelIndex = parseInt(portId.replace('input', '')) - 1;
      if (channelIndex >= 0 && channelIndex < this.channelGains.length) {
        return this.channelGains[channelIndex] || null;
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
}
