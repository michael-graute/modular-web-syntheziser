/**
 * LFO (Low Frequency Oscillator) - Modulation source
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

/**
 * LFO waveform types mapped to numeric indices
 */
const LFO_WAVEFORM_TYPES: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];

/**
 * LFO component for low-frequency modulation
 * Rate range: 0.01Hz - 20Hz (unlike oscillator which is 20Hz-20kHz)
 */
export class LFO extends SynthComponent {
  private oscillator: OscillatorNode | null;
  private gainNode: GainNode | null;

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
    this.gainNode = ctx.createGain();

    // Convert depth percentage to gain value
    // At 100% depth, we want full modulation range
    // Typical modulation range is +/- some value, so we scale accordingly
    const depthPercent = this.getParameter('depth')?.getValue() || 50;
    this.gainNode.gain.value = (depthPercent / 100) * 100; // Scale to useful range

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
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch (error) {
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
        // Change waveform type
        const waveformIndex = Math.round(value);
        this.oscillator.type = LFO_WAVEFORM_TYPES[waveformIndex] || 'sine';
        console.log(`LFO ${this.id} waveform changed to: ${this.oscillator.type}`);
        break;
      case 'rate':
        // Update LFO frequency (rate)
        this.oscillator.frequency.setValueAtTime(value, now);
        console.log(`LFO ${this.id} rate changed to: ${value.toFixed(2)}Hz`);
        break;
      case 'depth':
        // Update modulation depth
        const gainValue = (value / 100) * 100; // Scale to useful range
        this.gainNode.gain.setValueAtTime(gainValue, now);
        console.log(`LFO ${this.id} depth changed to: ${value}%`);
        break;
    }
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
    // Return the gain node (after depth scaling)
    return this.gainNode;
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
}
