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
  private inputGain: GainNode | null;
  private gainNode: GainNode | null;
  private outputGain: GainNode | null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.VCA, 'VCA', position);

    // Add ports
    this.addInput('input', 'Audio In', SignalType.AUDIO);
    this.addInput('cv', 'CV In', SignalType.CV);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    // Add parameters (default to 0 so oscillator is silent until keyboard triggers)
    this.addParameter('gain', 'Gain', 0, AUDIO.MIN_GAIN, AUDIO.MAX_GAIN, 0.01, '');

    this.inputGain = null;
    this.gainNode = null;
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

    // Create input and output gain nodes for bypass routing
    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1.0;

    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1.0;

    // Create main gain node (VCA control)
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = this.getParameter('gain')?.getValue() || 0;

    // Connect: input -> gainNode (VCA) -> output
    this.inputGain.connect(this.gainNode);
    this.gainNode.connect(this.outputGain);

    // Register with audio engine
    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('gain', this.gainNode);
    this.registerAudioNode('outputGain', this.outputGain);

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

    if (this.inputGain) {
      this.inputGain.disconnect();
      this.inputGain = null;
    }

    if (this.outputGain) {
      this.outputGain.disconnect();
      this.outputGain = null;
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
    return this.inputGain;
  }

  /**
   * Get output node for connections
   */
  getOutputNode(): AudioNode | null {
    return this.outputGain;
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

  /**
   * Enable bypass - connect input directly to output
   */
  protected override enableBypass(): void {
    if (!this.inputGain || !this.outputGain || !this.gainNode) {
      return;
    }

    // Store original connections for restoration
    this._bypassConnections = [
      { from: this.inputGain, to: this.gainNode },
      { from: this.gainNode, to: this.outputGain },
    ];

    // Disconnect VCA gain node
    this.inputGain.disconnect();
    this.gainNode.disconnect();

    // Connect input directly to output
    this.inputGain.connect(this.outputGain);

    console.log(`VCA ${this.id} bypassed`);
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

    console.log(`VCA ${this.id} restored`);
  }
}
