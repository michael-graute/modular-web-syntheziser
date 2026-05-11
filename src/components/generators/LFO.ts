/**
 * LFO (Low Frequency Oscillator) - Modulation source
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { CV } from '../../utils/constants';

/**
 * LFO waveform types mapped to numeric indices
 */
const LFO_WAVEFORM_TYPES: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];

/**
 * Compute the gain for a per-connection LFO scaler.
 * The LFO depth GainNode outputs ±(depth/100); multiplying by this gain yields
 * a peak swing of depth% × (paramMax − paramMin) / 2 centred on zero.
 */
function computeScaleGain(depthPercent: number, range: { min: number; max: number }): number {
  const clamped = Math.max(0, Math.min(100, depthPercent));
  return (clamped / 100) * ((range.max - range.min) / 2);
}

// Exported for unit tests only — not part of the public API
export { computeScaleGain as _computeScaleGain };

/** Entry in the per-connection scaler map. */
interface ConnectionScaler {
  node: GainNode;
  /** (paramMax − paramMin) / 2 — the range-based part of the gain, independent of depth. */
  fullDepthGain: number;
}

/**
 * LFO component for low-frequency modulation.
 * Rate range: 0.01Hz - 20Hz (unlike oscillator which is 20Hz-20kHz)
 *
 * CV adapter pattern: for each outgoing CV connection whose target exposes both
 * an AudioParam (via getAudioParamForInput) and a parameter range (via
 * getParameterRangeForInput), the LFO creates a dedicated per-connection GainNode
 * that scales the normalised ±(depth/100) signal to the target's parameter range.
 * This allows one LFO to drive multiple destinations simultaneously with independent
 * scaling. Future CV sources can adopt the same pattern by overriding connectTo/
 * disconnectFrom in their own class.
 */
export class LFO extends SynthComponent {
  private oscillator: OscillatorNode | null;
  private gainNode: GainNode | null;
  private connectionScalers: Map<string, ConnectionScaler>;

  constructor(id: string, position: Position) {
    super(id, ComponentType.LFO, 'LFO', position);

    // Add outputs
    this.addOutput('output', 'Mod Out', SignalType.CV);

    // Add parameters
    // Waveform: 0=sine, 1=square, 2=sawtooth, 3=triangle
    this.addParameter('waveform', 'Waveform', 0, 0, 3, 1, '');
    // Rate: 0.01Hz - 20Hz for LFO (much slower than audio oscillator)
    this.addParameter('rate', 'Rate', 1, 0.01, 20, 0.01, 'Hz');
    // Depth/Amplitude: 0 - 100% (controls output amplitude)
    this.addParameter('depth', 'Depth', 50, 0, 100, 1, '%');

    this.oscillator = null;
    this.gainNode = null;
    this.connectionScalers = new Map();
  }

  /**
   * Create audio nodes
   */
  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    // Create oscillator for LFO
    this.oscillator = ctx.createOscillator();

    // Set waveform from parameter
    const waveformIndex = Math.round(this.getParameter('waveform')?.getValue() || 0);
    this.oscillator.type = LFO_WAVEFORM_TYPES[waveformIndex] || 'sine';

    // Set rate (frequency)
    this.oscillator.frequency.value = this.getParameter('rate')?.getValue() || 1;

    // Create gain node for depth control
    // Outputs ±(depth/100); per-connection scalers scale this to the target's range.
    this.gainNode = ctx.createGain();
    const depthPercent = this.getParameter('depth')?.getValue() || 50;
    this.gainNode.gain.value = depthPercent / 100;

    // Connect oscillator → gain
    this.oscillator.connect(this.gainNode);

    // Start oscillator
    this.oscillator.start();

    // Register with audio engine
    this.registerAudioNode('oscillator', this.oscillator);
    this.registerAudioNode('gain', this.gainNode);

    console.log(`LFO ${this.id} created with waveform: ${this.oscillator.type}, rate: ${this.oscillator.frequency.value}Hz`);
  }

  /**
   * Destroy audio nodes — disconnect and release all per-connection scalers first.
   */
  destroyAudioNodes(): void {
    // Disconnect all per-connection scalers before releasing the gain node they feed from
    this.connectionScalers.forEach(({ node }) => {
      try { node.disconnect(); } catch (_) { /* already disconnected */ }
    });
    this.connectionScalers.clear();

    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch (_) {
        // Oscillator might already be stopped
      }
      this.oscillator = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    console.log(`LFO ${this.id} destroyed`);
  }

  /**
   * Update audio parameter
   */
  updateAudioParameter(parameterId: string, value: number): void {
    if (!this.oscillator || !this.gainNode) {
      return;
    }

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    switch (parameterId) {
      case 'waveform':
        const waveformIndex = Math.round(value);
        this.oscillator.type = LFO_WAVEFORM_TYPES[waveformIndex] || 'sine';
        console.log(`LFO ${this.id} waveform changed to: ${this.oscillator.type}`);
        break;
      case 'rate':
        this.oscillator.frequency.setValueAtTime(value, now);
        console.log(`LFO ${this.id} rate changed to: ${value.toFixed(2)}Hz`);
        break;
      case 'depth':
        // Update the shared depth GainNode (normalised ±1 scale)
        this.gainNode.gain.setValueAtTime(value / 100, now);
        // Ramp all per-connection scalers to the new depth-scaled gain (click-free)
        this.connectionScalers.forEach(({ node, fullDepthGain }) => {
          node.gain.setValueAtTime(node.gain.value, now);
          node.gain.linearRampToValueAtTime(
            (value / 100) * fullDepthGain,
            now + CV.RAMP_SECONDS
          );
        });
        console.log(`LFO ${this.id} depth changed to: ${value}%`);
        break;
    }
  }

  /**
   * Connect this LFO's output to a target component.
   * For CV connections where the target exposes both an AudioParam and a parameter
   * range, a dedicated per-connection scaler GainNode is created so the LFO can drive
   * multiple destinations simultaneously with independent scaling.
   */
  override connectTo(target: SynthComponent, outputId: string = 'output', inputId: string = 'input'): void {
    if (!this.gainNode || outputId !== 'output') {
      super.connectTo(target, outputId, inputId);
      return;
    }

    const outputPort = this.outputs.get(outputId);
    if (!outputPort || outputPort.type !== SignalType.CV) {
      super.connectTo(target, outputId, inputId);
      return;
    }

    // Some targets (e.g. Filter cutoff_cv) return null from getAudioParamForInput so that
    // unipolar sources (ADSR) route through a scaling node instead.  The LFO brings its
    // own per-connection scaler, so it uses getDirectCutoffParam (or equivalent) as a
    // secondary lookup to get the raw AudioParam it needs.
    let targetParam = target.getAudioParamForInput(inputId);
    if (!targetParam && typeof (target as any).getDirectCutoffParam === 'function' && inputId === 'cutoff_cv') {
      targetParam = (target as any).getDirectCutoffParam();
    }
    const targetRange = target.getParameterRangeForInput(inputId);

    if (!targetParam || !targetRange) {
      // No AudioParam or no range info — fall back to base class routing
      super.connectTo(target, outputId, inputId);
      return;
    }

    const ctx = audioEngine.getContext();
    const depth = this.getParameter('depth')?.getValue() ?? 50;
    const fullDepthGain = (targetRange.max - targetRange.min) / 2;
    const scalerGain = computeScaleGain(depth, targetRange);

    const scaler = ctx.createGain();
    scaler.gain.value = scalerGain;
    this.gainNode.connect(scaler);
    scaler.connect(targetParam);

    const key = `${target.id}:${inputId}`;
    this.connectionScalers.set(key, { node: scaler, fullDepthGain });

    // Update port connection state (mirrors what super.connectTo does)
    const inputPort = target.inputs.get(inputId);
    if (outputPort && inputPort) {
      outputPort.connect(inputPort.id);
      inputPort.connect(outputPort.id);
    }

    // Notify target (mirrors the onInputConnected call in super.connectTo)
    target.onInputConnected(inputId);

    console.log(`✓ LFO ${this.id} → ${target.id}:${inputId} (CV scaler gain=${scalerGain.toFixed(2)})`);
  }

  /**
   * Disconnect this LFO's output from a target component.
   * Cleans up the per-connection scaler if one exists.
   */
  override disconnectFrom(target: SynthComponent, outputId?: string, inputId?: string): void {
    if (!outputId || !inputId) {
      super.disconnectFrom(target, outputId, inputId);
      return;
    }

    const key = `${target.id}:${inputId}`;
    const scaler = this.connectionScalers.get(key);

    if (scaler) {
      try { scaler.node.disconnect(); } catch (_) { /* already disconnected */ }
      this.connectionScalers.delete(key);

      // Update port state
      const outputPort = this.outputs.get(outputId);
      const inputPort = target.inputs.get(inputId);
      if (outputPort) outputPort.disconnect();
      if (inputPort) inputPort.disconnect();

      // Notify target (mirrors onInputDisconnected call in super.disconnectFrom)
      target.onInputDisconnected(inputId);

      console.log(`✓ LFO ${this.id} disconnected from ${target.id}:${inputId} (scaler removed)`);
      return;
    }

    // No scaler for this connection — use base class path
    super.disconnectFrom(target, outputId, inputId);
  }

  /**
   * Get input node for connections
   */
  getInputNode(): AudioNode | null {
    // LFOs don't have audio input
    return null;
  }

  /**
   * Get output node for connections
   */
  getOutputNode(): AudioNode | null {
    return this.gainNode;
  }

  /**
   * Return the per-connection scaler GainNode for a specific target connection.
   * The scaler output is already scaled to the target parameter's Hz/unit range,
   * so the ModulationVisualizer can tap it to show accurate visual feedback.
   * Returns null if no scaler exists (fallback to raw gainNode).
   */
  getScaledOutputForConnection(targetId: string, inputId: string): GainNode | null {
    const key = `${targetId}:${inputId}`;
    const scaler = this.connectionScalers.get(key);
    return scaler ? scaler.node : null;
  }

  /**
   * Get waveform name for display
   */
  getWaveformName(): string {
    const waveformIndex = Math.round(this.getParameter('waveform')?.getValue() || 0);
    return LFO_WAVEFORM_TYPES[waveformIndex] || 'sine';
  }

  /**
   * Get current rate value
   */
  getRate(): number {
    return this.getParameter('rate')?.getValue() || 1;
  }

  /**
   * Get current depth value
   */
  getDepth(): number {
    return this.getParameter('depth')?.getValue() || 50;
  }

  /**
   * Check if this component supports bypass
   */
  override isBypassable(): boolean {
    return true;
  }

  /**
   * Enable bypass - disconnect oscillator output to stop modulation.
   * Oscillator continues running internally to maintain phase continuity.
   */
  protected override enableBypass(): void {
    if (!this.oscillator || !this.gainNode) {
      throw new Error('Cannot bypass LFO: audio nodes not initialized');
    }
    this.oscillator.disconnect();
    console.log(`LFO ${this.id} bypassed (modulation disabled)`);
  }

  /**
   * Disable bypass - reconnect oscillator output to resume modulation.
   * Modulation resumes from current phase position.
   */
  protected override disableBypass(): void {
    if (!this.oscillator || !this.gainNode) {
      throw new Error('Cannot enable LFO: audio nodes not initialized');
    }
    this.oscillator.connect(this.gainNode);
    console.log(`LFO ${this.id} restored (modulation enabled)`);
  }
}
