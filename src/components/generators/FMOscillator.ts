/**
 * FMOscillator - Frequency modulation oscillator component
 *
 * Extends the base Oscillator with an FM audio input and an fmDepth parameter.
 * A carrier GainNode sits between the FM input and the carrier OscillatorNode's
 * frequency AudioParam, scaling the modulator signal by fmDepth (Hz).
 */

import { Oscillator } from './Oscillator';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import {
  FM_DEPTH_DEFAULT,
  FM_DEPTH_MIN,
  FM_DEPTH_MAX,
} from '../../../specs/020-fm-oscillator/contracts/validation';

/**
 * FM Oscillator — carrier oscillator with audio-rate frequency modulation input.
 */
export class FMOscillator extends Oscillator {
  /** GainNode that scales the incoming FM signal by fmDepth before routing to the carrier frequency */
  private fmGain: GainNode | null = null;

  constructor(id: string, position: Position) {
    super(id, position);

    // Override the name and type set by the Oscillator base class
    this.name = 'FM Oscillator';
    this.type = ComponentType.FM_OSCILLATOR;

    // Add the FM audio input port
    this.addInput('fm', 'FM Input', SignalType.AUDIO);

    // Add CV input for external modulation of FM depth (e.g. from an LFO)
    this.addInput('fmDepth_cv', 'FM Depth CV', SignalType.CV);

    // Add the fmDepth parameter (units: Hz — scales the modulator amplitude)
    this.addParameter('fmDepth', 'FM Depth', FM_DEPTH_DEFAULT, FM_DEPTH_MIN, FM_DEPTH_MAX, 1, 'Hz');
  }

  /**
   * Create audio nodes — extends the base oscillator setup with an fmGain node.
   */
  override createAudioNodes(): void {
    // Initialise the carrier oscillator (registers 'oscillator' key)
    super.createAudioNodes();

    const ctx = audioEngine.getContext();

    // Create a gain node that scales the FM input before it reaches carrier.frequency
    this.fmGain = ctx.createGain();

    // Initialise gain from the fmDepth parameter value
    const fmDepthValue = this.getParameter('fmDepth')?.getValue() ?? FM_DEPTH_DEFAULT;
    this.fmGain.gain.value = fmDepthValue;

    // Route fmGain output into the carrier oscillator's frequency AudioParam
    // getOutputNode() returns the OscillatorNode created by super.createAudioNodes()
    const carrierOscillator = this.getOutputNode() as OscillatorNode;
    this.fmGain.connect(carrierOscillator.frequency);

    // Register the gain node so tests and serialisation can access it
    this.registerAudioNode('fmInput', this.fmGain);

    // Link fmDepth parameter to fmGain.gain for CV visualisation sampling
    const fmDepthParam = this.getParameter('fmDepth');
    if (fmDepthParam) {
      fmDepthParam.linkAudioParam(this.fmGain.gain);
    }
  }

  /**
   * Destroy audio nodes — tears down fmGain before calling super.
   */
  override destroyAudioNodes(): void {
    if (this.fmGain) {
      this.fmGain.disconnect();
      this.fmGain = null;
    }
    super.destroyAudioNodes();
  }

  /**
   * Get input node — returns fmGain for the 'fm' port so that audio connections
   * from a modulator oscillator flow through the gain scaler into carrier.frequency.
   * All other port IDs delegate to the base class (which returns null for oscillators).
   */
  override getInputNode(portId?: string): AudioNode | null {
    if (portId === 'fm') {
      return this.fmGain;
    }
    return super.getInputNode(portId);
  }

  /**
   * Get AudioParam for a CV input port.
   * 'fmDepth_cv' routes CV signals directly into fmGain.gain, enabling LFO modulation
   * of FM depth at audio rate. All other CV ports delegate to the base class.
   */
  override getAudioParamForInput(inputId: string): AudioParam | null {
    if (inputId === 'fmDepth_cv') {
      return this.fmGain?.gain ?? null;
    }
    return super.getAudioParamForInput(inputId);
  }

  /**
   * Update audio parameter in real time.
   * Intercepts 'fmDepth' to update fmGain.gain; delegates everything else to super.
   */
  override updateAudioParameter(parameterId: string, value: number): void {
    if (parameterId === 'fmDepth' && this.fmGain) {
      this.fmGain.gain.setValueAtTime(value, audioEngine.getContext().currentTime);
      return;
    }
    super.updateAudioParameter(parameterId, value);
  }
}
