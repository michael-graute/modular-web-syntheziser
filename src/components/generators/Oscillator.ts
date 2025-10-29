/**
 * Oscillator - Basic oscillator component
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { AUDIO } from '../../utils/constants';

/**
 * Waveform types mapped to numeric indices
 */
const WAVEFORM_TYPES: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];

/**
 * Oscillator component with basic waveform generation
 */
export class Oscillator extends SynthComponent {
  private oscillator: OscillatorNode | null;
  private frequencyMonitorInterval: number | null;
  private lastLoggedFrequency: number;

  constructor(id: string, position: Position) {
    super(id, ComponentType.OSCILLATOR, 'Oscillator', position);

    // Add outputs
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    // Add inputs for CV control
    this.addInput('frequency', 'Frequency CV', SignalType.CV);
    this.addInput('detune', 'Detune CV', SignalType.CV);

    // Add parameters
    // Waveform: 0=sine, 1=square, 2=sawtooth, 3=triangle
    this.addParameter('waveform', 'Waveform', 0, 0, 3, 1, '');
    this.addParameter('frequency', 'Frequency', 0, AUDIO.MIN_FREQUENCY, AUDIO.MAX_FREQUENCY, 1, 'Hz');
    this.addParameter('detune', 'Detune', 0, AUDIO.MIN_DETUNE, AUDIO.MAX_DETUNE, 1, 'cents');

    this.oscillator = null;
    this.frequencyMonitorInterval = null;
    this.lastLoggedFrequency = 0;
  }

  /**
   * Create audio nodes
   */
  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    // Create oscillator
    this.oscillator = ctx.createOscillator();

    // Set waveform from parameter
    const waveformIndex = Math.round(this.getParameter('waveform')?.getValue() || 0);
    this.oscillator.type = WAVEFORM_TYPES[waveformIndex] || 'sine';

    this.oscillator.frequency.value = this.getParameter('frequency')?.getValue() || 0;
    this.oscillator.detune.value = this.getParameter('detune')?.getValue() || 0;

    // Start oscillator
    this.oscillator.start();

    // Register with audio engine
    this.registerAudioNode('oscillator', this.oscillator);

    console.log(`Oscillator ${this.id} created and started with waveform: ${this.oscillator.type}`);

    // Start frequency monitoring
    this.startFrequencyMonitoring();
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    // Stop frequency monitoring
    this.stopFrequencyMonitoring();

    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch (error) {
        // Oscillator might already be stopped
      }
      this.oscillator = null;
    }

    console.log(`Oscillator ${this.id} destroyed`);
  }

  /**
   * Update audio parameter
   */
  updateAudioParameter(parameterId: string, value: number): void {
    if (!this.oscillator) {
      return;
    }

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    switch (parameterId) {
      case 'waveform':
        // Change waveform type
        const waveformIndex = Math.round(value);
        this.oscillator.type = WAVEFORM_TYPES[waveformIndex] || 'sine';
        break;
      case 'frequency':
        this.oscillator.frequency.setValueAtTime(value, now);
        break;
      case 'detune':
        this.oscillator.detune.setValueAtTime(value, now);
        break;
    }
  }

  /**
   * Get input node for connections
   */
  getInputNode(): AudioNode | null {
    // Oscillators don't have audio input, only CV inputs
    return null;
  }

  /**
   * Get output node for connections
   */
  getOutputNode(): AudioNode | null {
    return this.oscillator;
  }

  /**
   * Get frequency AudioParam for CV modulation
   */
  getFrequencyParam(): AudioParam | null {
    return this.oscillator ? this.oscillator.frequency : null;
  }

  /**
   * Get detune AudioParam for CV modulation
   */
  getDetuneParam(): AudioParam | null {
    return this.oscillator ? this.oscillator.detune : null;
  }

  /**
   * Get waveform name for display
   */
  getWaveformName(): string {
    const waveformIndex = Math.round(this.getParameter('waveform')?.getValue() || 0);
    return WAVEFORM_TYPES[waveformIndex] || 'sine';
  }

  /**
   * Get AudioParam for CV input (override from base class)
   */
  protected override getAudioParamForInput(inputId: string): AudioParam | null {
    switch (inputId) {
      case 'frequency':
        return this.getFrequencyParam();
      case 'detune':
        return this.getDetuneParam();
      default:
        return null;
    }
  }

  /**
   * Start monitoring frequency changes and log them
   */
  private startFrequencyMonitoring(): void {
    if (this.frequencyMonitorInterval !== null) {
      return; // Already monitoring
    }

    // Monitor frequency every 100ms
    this.frequencyMonitorInterval = window.setInterval(() => {
      if (!this.oscillator) {
        this.stopFrequencyMonitoring();
        return;
      }

      const currentFreq = this.oscillator.frequency.value;

      // Only log if frequency changed by more than 0.1 Hz
      if (Math.abs(currentFreq - this.lastLoggedFrequency) > 0.1) {
        const baseFreq = this.getParameter('frequency')?.getValue() || 0;
        const cvInput = currentFreq - baseFreq;

        console.log(`🎵 Oscillator ${this.id.slice(0, 8)}... frequency changed:`);
        console.log(`   Base frequency: ${baseFreq.toFixed(2)} Hz`);
        console.log(`   CV input: ${cvInput.toFixed(2)} Hz`);
        console.log(`   Total frequency: ${currentFreq.toFixed(2)} Hz`);

        this.lastLoggedFrequency = currentFreq;
      }
    }, 100);
  }

  /**
   * Stop monitoring frequency changes
   */
  private stopFrequencyMonitoring(): void {
    if (this.frequencyMonitorInterval !== null) {
      window.clearInterval(this.frequencyMonitorInterval);
      this.frequencyMonitorInterval = null;
    }
  }
}
