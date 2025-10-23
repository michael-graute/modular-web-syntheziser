/**
 * MasterOutput - Master output component connecting to audio destination
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

/**
 * Master output component connecting to system audio
 */
export class MasterOutput extends SynthComponent {
  private inputGain: GainNode | null;
  private limiter: DynamicsCompressorNode | null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.MASTER_OUTPUT, 'Master Out', position);

    // Add ports
    this.addInput('input', 'Audio In', SignalType.AUDIO);

    // Add parameters
    this.addParameter('volume', 'Volume', 0.7, 0, 1, 0.01, '');
    this.addParameter('limiter', 'Limiter', 1, 0, 1, 1, ''); // 0=off, 1=on

    this.inputGain = null;
    this.limiter = null;
  }

  /**
   * Create audio nodes
   */
  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    // Create input gain for volume control
    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = this.getParameter('volume')?.getValue() || 0.7;

    // Create limiter (compressor acting as limiter)
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1.0;
    this.limiter.knee.value = 0.0;
    this.limiter.ratio.value = 20.0;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.01;

    // Connect chain: input -> gain -> limiter -> destination
    const limiterEnabled = this.getParameter('limiter')?.getValue() || 1;

    if (limiterEnabled > 0.5) {
      this.inputGain.connect(this.limiter);
      this.limiter.connect(ctx.destination);
    } else {
      this.inputGain.connect(ctx.destination);
    }

    // Register with audio engine
    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('limiter', this.limiter);

    console.log(`Master Output ${this.id} created`);
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    if (this.limiter) {
      this.limiter.disconnect();
      this.limiter = null;
    }

    if (this.inputGain) {
      this.inputGain.disconnect();
      this.inputGain = null;
    }

    console.log(`Master Output ${this.id} destroyed`);
  }

  /**
   * Update audio parameter
   */
  updateAudioParameter(parameterId: string, value: number): void {
    if (!this.inputGain) {
      return;
    }

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    switch (parameterId) {
      case 'volume':
        this.inputGain.gain.setValueAtTime(value, now);
        break;
      case 'limiter':
        // Reconnect chain when limiter is toggled
        this.reconnectChain(value > 0.5);
        break;
    }
  }

  /**
   * Reconnect the audio chain based on limiter state
   */
  private reconnectChain(limiterEnabled: boolean): void {
    if (!this.inputGain || !this.limiter) {
      return;
    }

    const ctx = audioEngine.getContext();

    // Disconnect current connections
    this.inputGain.disconnect();
    this.limiter.disconnect();

    // Reconnect based on limiter state
    if (limiterEnabled) {
      this.inputGain.connect(this.limiter);
      this.limiter.connect(ctx.destination);
    } else {
      this.inputGain.connect(ctx.destination);
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
    // Master output doesn't have an output (it goes to destination)
    return null;
  }

  /**
   * Get volume AudioParam for master volume control
   */
  getVolumeParam(): AudioParam | null {
    return this.inputGain ? this.inputGain.gain : null;
  }
}
