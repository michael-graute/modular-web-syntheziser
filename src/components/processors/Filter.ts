/**
 * Filter - Biquad filter component
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { AUDIO } from '../../utils/constants';

/**
 * Filter types mapped to numeric indices
 */
const FILTER_TYPE_LIST: BiquadFilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch'];

/**
 * Filter component for audio processing
 */
export class Filter extends SynthComponent {
  private inputGain: GainNode | null;
  private filterNode: BiquadFilterNode | null;
  private outputGain: GainNode | null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.FILTER, 'Filter', position);

    // Add ports
    this.addInput('input', 'Audio In', SignalType.AUDIO);
    this.addInput('cutoff_cv', 'Cutoff CV', SignalType.CV);
    this.addInput('resonance_cv', 'Resonance CV', SignalType.CV);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    // Add parameters
    // Filter type: 0=lowpass, 1=highpass, 2=bandpass, 3=notch
    this.addParameter('type', 'Type', 0, 0, 3, 1, '');
    this.addParameter('cutoff', 'Cutoff', 1000, AUDIO.MIN_FREQUENCY, AUDIO.MAX_FREQUENCY, 1, 'Hz');
    this.addParameter('resonance', 'Resonance', 1, AUDIO.MIN_Q, AUDIO.MAX_Q, 0.01, '');

    this.inputGain = null;
    this.filterNode = null;
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

    // Create filter node
    this.filterNode = ctx.createBiquadFilter();

    // Set filter type from parameter
    const typeIndex = Math.round(this.getParameter('type')?.getValue() || 0);
    this.filterNode.type = FILTER_TYPE_LIST[typeIndex] || 'lowpass';

    this.filterNode.frequency.value = this.getParameter('cutoff')?.getValue() || 1000;
    this.filterNode.Q.value = this.getParameter('resonance')?.getValue() || 1;

    // Connect: input -> filter -> output
    this.inputGain.connect(this.filterNode);
    this.filterNode.connect(this.outputGain);

    // Register with audio engine
    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('filter', this.filterNode);
    this.registerAudioNode('outputGain', this.outputGain);

    console.log(`Filter ${this.id} created with type: ${this.filterNode.type}`);
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    if (this.filterNode) {
      this.filterNode.disconnect();
      this.filterNode = null;
    }

    if (this.inputGain) {
      this.inputGain.disconnect();
      this.inputGain = null;
    }

    if (this.outputGain) {
      this.outputGain.disconnect();
      this.outputGain = null;
    }

    console.log(`Filter ${this.id} destroyed`);
  }

  /**
   * Update audio parameter
   */
  updateAudioParameter(parameterId: string, value: number): void {
    if (!this.filterNode) {
      return;
    }

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    switch (parameterId) {
      case 'type':
        // Change filter type
        const typeIndex = Math.round(value);
        this.filterNode.type = FILTER_TYPE_LIST[typeIndex] || 'lowpass';
        break;
      case 'cutoff':
        this.filterNode.frequency.setValueAtTime(value, now);
        break;
      case 'resonance':
        this.filterNode.Q.setValueAtTime(value, now);
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
   * Get cutoff frequency AudioParam for CV modulation
   */
  getCutoffParam(): AudioParam | null {
    return this.filterNode ? this.filterNode.frequency : null;
  }

  /**
   * Get resonance (Q) AudioParam for CV modulation
   */
  getResonanceParam(): AudioParam | null {
    return this.filterNode ? this.filterNode.Q : null;
  }

  /**
   * Get filter type name for display
   */
  getFilterTypeName(): string {
    const typeIndex = Math.round(this.getParameter('type')?.getValue() || 0);
    return FILTER_TYPE_LIST[typeIndex] || 'lowpass';
  }

  /**
   * Get AudioParam for CV input (override from base class)
   */
  protected override getAudioParamForInput(inputId: string): AudioParam | null {
    switch (inputId) {
      case 'cutoff_cv':
        return this.getCutoffParam();
      case 'resonance_cv':
        return this.getResonanceParam();
      default:
        return null;
    }
  }

  /**
   * Enable bypass - connect input directly to output
   */
  protected override enableBypass(): void {
    if (!this.inputGain || !this.outputGain || !this.filterNode) {
      return;
    }

    // Store original connections for restoration
    this._bypassConnections = [
      { from: this.inputGain, to: this.filterNode },
      { from: this.filterNode, to: this.outputGain },
    ];

    // Disconnect filter
    this.inputGain.disconnect();
    this.filterNode.disconnect();

    // Connect input directly to output
    this.inputGain.connect(this.outputGain);

    console.log(`Filter ${this.id} bypassed`);
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

    console.log(`Filter ${this.id} restored`);
  }
}
