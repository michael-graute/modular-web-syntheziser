/**
 * Reverb - Algorithmic reverb effect using ConvolverNode
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

/**
 * Reverb effect component
 */
export class Reverb extends SynthComponent {
  private inputGain: GainNode | null;
  private dryGain: GainNode | null;
  private wetGain: GainNode | null;
  private convolver: ConvolverNode | null;
  private outputGain: GainNode | null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.REVERB, 'Reverb', position);

    // Add ports
    this.addInput('input', 'Audio In', SignalType.AUDIO);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    // Add parameters
    this.addParameter('roomSize', 'Room Size', 0.5, 0.1, 1.0, 0.01, '');
    this.addParameter('decay', 'Decay', 2.0, 0.5, 5.0, 0.1, 's');
    this.addParameter('mix', 'Mix', 0.3, 0, 1, 0.01, ''); // 0=dry, 1=wet

    this.inputGain = null;
    this.dryGain = null;
    this.wetGain = null;
    this.convolver = null;
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

    // Create convolver for reverb
    this.convolver = ctx.createConvolver();

    // Create output gain
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1.0;

    // Generate initial impulse response
    const roomSize = this.getParameter('roomSize')?.getValue() || 0.5;
    const decay = this.getParameter('decay')?.getValue() || 2.0;
    this.convolver.buffer = this.createImpulseResponse(roomSize, decay);

    // Set initial dry/wet mix
    const mix = this.getParameter('mix')?.getValue() || 0.3;
    this.updateMix(mix);

    // Connect routing: input -> (dry + wet) -> output
    // Dry path: input -> dryGain -> output
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.outputGain);

    // Wet path: input -> convolver -> wetGain -> output
    this.inputGain.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Register with audio engine
    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('dryGain', this.dryGain);
    this.registerAudioNode('wetGain', this.wetGain);
    this.registerAudioNode('convolver', this.convolver);
    this.registerAudioNode('outputGain', this.outputGain);

    console.log(`Reverb ${this.id} created`);
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    if (this.convolver) {
      this.convolver.disconnect();
      this.convolver = null;
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

    console.log(`Reverb ${this.id} destroyed`);
  }

  /**
   * Update audio parameter
   */
  updateAudioParameter(parameterId: string, value: number): void {
    switch (parameterId) {
      case 'roomSize':
      case 'decay':
        // Regenerate impulse response when room parameters change
        this.regenerateImpulseResponse();
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
   * Regenerate impulse response based on current parameters
   */
  private regenerateImpulseResponse(): void {
    if (!this.convolver) {
      return;
    }

    const roomSize = this.getParameter('roomSize')?.getValue() || 0.5;
    const decay = this.getParameter('decay')?.getValue() || 2.0;

    this.convolver.buffer = this.createImpulseResponse(roomSize, decay);
  }

  /**
   * Create an algorithmic impulse response
   * This simulates room reflections without needing external files
   */
  private createImpulseResponse(roomSize: number, decay: number): AudioBuffer {
    const ctx = audioEngine.getContext();
    const sampleRate = ctx.sampleRate;

    // Duration based on room size and decay
    const duration = roomSize * decay;
    const length = Math.floor(sampleRate * duration);

    // Create stereo buffer
    const impulseBuffer = ctx.createBuffer(2, length, sampleRate);
    const leftChannel = impulseBuffer.getChannelData(0);
    const rightChannel = impulseBuffer.getChannelData(1);

    // Generate impulse response using exponential decay with noise
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;

      // Exponential decay envelope
      const envelope = Math.exp(-t * (3.0 / decay));

      // Add some random reflections (noise)
      const noise = (Math.random() * 2 - 1) * envelope;

      // Add early reflections (delayed impulses)
      let reflections = 0;
      const numReflections = Math.floor(5 + roomSize * 10);
      for (let j = 0; j < numReflections; j++) {
        const reflectionDelay = (j + 1) * 0.01 * roomSize;
        const reflectionTime = reflectionDelay * sampleRate;
        const reflectionDecay = Math.exp(-j * 0.3);

        if (i === Math.floor(reflectionTime)) {
          reflections += reflectionDecay * envelope;
        }
      }

      // Combine noise and reflections
      leftChannel[i] = noise * 0.5 + reflections * 0.5;

      // Slightly different for right channel (stereo effect)
      const noiseR = (Math.random() * 2 - 1) * envelope;
      rightChannel[i] = noiseR * 0.5 + reflections * 0.5;
    }

    // Normalize to prevent clipping
    this.normalizeBuffer(impulseBuffer);

    return impulseBuffer;
  }

  /**
   * Normalize buffer to prevent clipping
   */
  private normalizeBuffer(buffer: AudioBuffer): void {
    let maxVal = 0;

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        const sample = data[i];
        if (sample === undefined) continue;
        const absVal = Math.abs(sample);
        if (absVal > maxVal) {
          maxVal = absVal;
        }
      }
    }

    if (maxVal > 0) {
      const scale = 0.95 / maxVal; // Leave some headroom
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < data.length; i++) {
          const sample = data[i];
          if (sample === undefined) continue;
          data[i] = sample * scale;
        }
      }
    }
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
    this._bypassConnections = [
      { from: this.inputGain, to: this.dryGain! },
      { from: this.inputGain, to: this.convolver! },
      { from: this.dryGain!, to: this.outputGain },
      { from: this.convolver!, to: this.wetGain! },
      { from: this.wetGain!, to: this.outputGain },
    ];

    // Disconnect all processing nodes
    this.inputGain.disconnect();
    this.convolver?.disconnect();
    this.dryGain?.disconnect();
    this.wetGain?.disconnect();

    // Connect input directly to output
    this.inputGain.connect(this.outputGain);

    console.log(`Reverb ${this.id} bypassed`);
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

    // Clear stored connections
    this._bypassConnections = [];

    console.log(`Reverb ${this.id} restored`);
  }
}
