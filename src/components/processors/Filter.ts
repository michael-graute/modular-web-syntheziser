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

const CUTOFF_RANGE = { min: AUDIO.MIN_FREQUENCY, max: AUDIO.MAX_FREQUENCY };

/**
 * Compute the gain for the Filter's cvAmountGainNode.
 * Scales a unipolar 0..1 CV signal (e.g. ADSR) into Hz.
 * At cvAmountPercent=100%, a full 0..1 signal maps to 0..(paramMax − paramMin).
 * Uses full paramRange (not ÷2) because ADSR is unipolar, unlike the bipolar LFO.
 */
function computeCvAmountGain(cvAmountPercent: number, range: { min: number; max: number }): number {
  const clamped = Math.max(0, Math.min(100, cvAmountPercent));
  return (clamped / 100) * (range.max - range.min);
}

// Exported for unit tests only — not part of the public API
export { computeCvAmountGain as _computeCvAmountGain };

/**
 * Filter component for audio processing
 */
export class Filter extends SynthComponent {
  private inputGain: GainNode | null;
  private filterNode: BiquadFilterNode | null;
  private outputGain: GainNode | null;
  private cvAmountGainNode: GainNode | null;

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
    // CV Amount: scales unipolar CV sources (ADSR 0..1) into Hz; default 50% gives audible sweep
    this.addParameter('cvAmount', 'CV Amount', 50, 0, 100, 1, '%');

    this.inputGain = null;
    this.filterNode = null;
    this.outputGain = null;
    this.cvAmountGainNode = null;
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

    // Link AudioParams to Parameters for CV visualization
    const cutoffParam = this.getParameter('cutoff');
    const resonanceParam = this.getParameter('resonance');
    if (cutoffParam) {
      cutoffParam.linkAudioParam(this.filterNode.frequency);
    }
    if (resonanceParam) {
      resonanceParam.linkAudioParam(this.filterNode.Q);
    }

    // CV Amount GainNode: unipolar CV sources (ADSR 0..1) connect here.
    // The gain scales 0..1 signals into Hz — at 50% CV Amount, full ADSR adds 0..10000 Hz.
    // LFO connections bypass this node and connect directly to filterNode.frequency
    // via their own per-connection scaler (see LFO.connectTo override).
    const cvAmount = this.getParameter('cvAmount')?.getValue() ?? 50;
    this.cvAmountGainNode = ctx.createGain();
    this.cvAmountGainNode.gain.value = computeCvAmountGain(cvAmount, CUTOFF_RANGE);
    this.cvAmountGainNode.connect(this.filterNode.frequency);

    // Connect: input -> filter -> output
    this.inputGain.connect(this.filterNode);
    this.filterNode.connect(this.outputGain);

    // Register with audio engine
    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('filter', this.filterNode);
    this.registerAudioNode('outputGain', this.outputGain);
    this.registerAudioNode('cvAmountGain', this.cvAmountGainNode);

    console.log(`Filter ${this.id} created with type: ${this.filterNode.type}`);
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    if (this.cvAmountGainNode) {
      this.cvAmountGainNode.disconnect();
      this.cvAmountGainNode = null;
    }

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
        const typeIndex = Math.round(value);
        this.filterNode.type = FILTER_TYPE_LIST[typeIndex] || 'lowpass';
        break;
      case 'cutoff':
        this.filterNode.frequency.setValueAtTime(value, now);
        break;
      case 'resonance':
        this.filterNode.Q.setValueAtTime(value, now);
        break;
      case 'cvAmount':
        if (this.cvAmountGainNode) {
          this.cvAmountGainNode.gain.setValueAtTime(
            computeCvAmountGain(value, CUTOFF_RANGE),
            now
          );
        }
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
   * Get AudioParam for CV input (override from base class).
   *
   * cutoff_cv intentionally returns null so the base-class connectTo() falls
   * through to getInputNodeByPort() → cvAmountGainNode for unipolar sources
   * (ADSR, etc.).  The LFO's connectTo() override calls getDirectCutoffParam()
   * instead to bypass cvAmountGainNode with its own per-connection scaler.
   *
   * resonance_cv still returns an AudioParam directly — no scaling node needed.
   */
  override getAudioParamForInput(inputId: string): AudioParam | null {
    switch (inputId) {
      case 'cutoff_cv':
        return null; // force routing through cvAmountGainNode for unipolar sources
      case 'resonance_cv':
        return this.getResonanceParam();
      default:
        return null;
    }
  }

  /**
   * Direct access to filterNode.frequency for CV sources that bring their own
   * scaling (e.g. LFO per-connection scaler).  Only call this when you are
   * certain the signal is already scaled to Hz.
   */
  getDirectCutoffParam(): AudioParam | null {
    return this.getCutoffParam();
  }

  /**
   * Get AudioNode for CV input (override from base class).
   * Unipolar CV sources (ADSR 0..1) use this path — they connect to
   * cvAmountGainNode which scales into Hz before reaching filterNode.frequency.
   */
  protected override getInputNodeByPort(portId: string): AudioNode | null {
    if (portId === 'cutoff_cv') {
      return this.cvAmountGainNode;
    }
    return super.getInputNodeByPort(portId);
  }

  /**
   * Return a monitoring tap node for a given input port.
   * The ModulationVisualizer can connect an AnalyserNode here to read the
   * already-scaled signal (in Hz) rather than the raw 0..1 CV source.
   * For cutoff_cv the tap point is cvAmountGainNode — its output carries
   * the ADSR signal scaled to Hz by the CV Amount setting.
   */
  getCvMonitorNodeForInput(portId: string): AudioNode | null {
    if (portId === 'cutoff_cv') {
      return this.cvAmountGainNode;
    }
    return null;
  }

  override getParameterRangeForInput(portId: string): { min: number; max: number } | null {
    switch (portId) {
      case 'cutoff_cv':
        return CUTOFF_RANGE;
      case 'resonance_cv':
        return { min: AUDIO.MIN_Q, max: AUDIO.MAX_Q };
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
