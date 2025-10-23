/**
 * VCA - Voltage Controlled Amplifier
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { AUDIO } from '../../utils/constants';

/**
 * VCA component for amplitude control
 */
export class VCA extends SynthComponent {
  private gainNode: GainNode | null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.VCA, 'VCA', position);

    // Add ports
    this.addInput('input', 'Audio In', SignalType.AUDIO);
    this.addInput('cv', 'CV In', SignalType.CV);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    // Add parameters (default to 0 so oscillator is silent until keyboard triggers)
    this.addParameter('gain', 'Gain', 0, AUDIO.MIN_GAIN, AUDIO.MAX_GAIN, 0.01, '');

    this.gainNode = null;
  }

  /**
   * Create audio nodes
   */
  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    // Create gain node
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = this.getParameter('gain')?.getValue() || 0;

    // Register with audio engine
    this.registerAudioNode('gain', this.gainNode);

    console.log(`VCA ${this.id} created`);
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    console.log(`VCA ${this.id} destroyed`);
  }

  /**
   * Update audio parameter
   */
  updateAudioParameter(parameterId: string, value: number): void {
    if (!this.gainNode) {
      return;
    }

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    switch (parameterId) {
      case 'gain':
        this.gainNode.gain.setValueAtTime(value, now);
        break;
    }
  }

  /**
   * Get input node for connections
   */
  getInputNode(): AudioNode | null {
    return this.gainNode;
  }

  /**
   * Get output node for connections
   */
  getOutputNode(): AudioNode | null {
    return this.gainNode;
  }

  /**
   * Get gain AudioParam for CV/envelope modulation
   */
  getGainParam(): AudioParam | null {
    return this.gainNode ? this.gainNode.gain : null;
  }

  /**
   * Get AudioParam for CV input (override from base class)
   */
  protected override getAudioParamForInput(inputId: string): AudioParam | null {
    if (inputId === 'cv') {
      return this.getGainParam();
    }
    return null;
  }
}
