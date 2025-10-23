/**
 * Oscilloscope - Real-time waveform and spectrum analyzer
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

/**
 * Oscilloscope component for audio visualization
 */
export class Oscilloscope extends SynthComponent {
  private inputGain: GainNode | null;
  private analyser: AnalyserNode | null;
  private dataArray: Float32Array | null;
  private frequencyArray: Uint8Array | null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.OSCILLOSCOPE, 'Scope', position);

    // Add ports
    this.addInput('input', 'Audio In', SignalType.AUDIO);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    // Add parameters
    this.addParameter('timeScale', 'Time Scale', 50, 10, 1000, 10, 'ms');
    this.addParameter('fftSize', 'FFT Size', 2048, 512, 8192, 512, '');
    this.addParameter('displayMode', 'Display', 0, 0, 2, 1, ''); // 0=Waveform, 1=Spectrum, 2=Both
    this.addParameter('gain', 'Gain', 1.0, 0.1, 10.0, 0.1, 'x');

    this.inputGain = null;
    this.analyser = null;
    this.dataArray = null;
    this.frequencyArray = null;
  }

  /**
   * Create audio nodes
   */
  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    // Create input gain for pass-through
    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1.0;

    // Create analyser node
    this.analyser = ctx.createAnalyser();
    const fftSize = this.getParameter('fftSize')?.getValue() || 2048;
    this.analyser.fftSize = Math.max(512, Math.min(8192, fftSize)); // Clamp to valid range
    this.analyser.smoothingTimeConstant = 0.8;

    // Connect: input → analyser (pass-through)
    this.inputGain.connect(this.analyser);

    // Allocate data arrays
    this.dataArray = new Float32Array(this.analyser.fftSize) as Float32Array;
    this.frequencyArray = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array;

    // Register with audio engine
    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('analyser', this.analyser);

    console.log(`Oscilloscope ${this.id} created with FFT size: ${this.analyser.fftSize}`);
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.inputGain) {
      this.inputGain.disconnect();
      this.inputGain = null;
    }

    this.dataArray = null;
    this.frequencyArray = null;

    console.log(`Oscilloscope ${this.id} destroyed`);
  }

  /**
   * Update audio parameter
   */
  updateAudioParameter(parameterId: string, value: number): void {
    if (!this.analyser) {
      return;
    }

    switch (parameterId) {
      case 'fftSize':
        // Update FFT size (must be power of 2)
        const newSize = Math.max(512, Math.min(8192, Math.round(value)));
        if (this.analyser.fftSize !== newSize) {
          this.analyser.fftSize = newSize;
          // Reallocate arrays
          this.dataArray = new Float32Array(this.analyser.fftSize) as Float32Array;
          this.frequencyArray = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array;
          console.log(`Oscilloscope ${this.id} FFT size updated to: ${newSize}`);
        }
        break;
      case 'timeScale':
      case 'displayMode':
      case 'gain':
        // These parameters only affect visualization, not audio processing
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
    return this.analyser; // Pass-through output
  }

  /**
   * Get waveform data for visualization (time-domain)
   */
  getWaveformData(): Float32Array | null {
    if (!this.analyser || !this.dataArray) {
      return null;
    }
    // @ts-ignore - Web Audio API type mismatch
    this.analyser.getFloatTimeDomainData(this.dataArray);
    return this.dataArray;
  }

  /**
   * Get spectrum data for visualization (frequency-domain)
   */
  getSpectrumData(): Uint8Array | null {
    if (!this.analyser || !this.frequencyArray) {
      return null;
    }
    // @ts-ignore - Web Audio API type mismatch
    this.analyser.getByteFrequencyData(this.frequencyArray);
    return this.frequencyArray;
  }

  /**
   * Get current FFT size
   */
  getFFTSize(): number {
    return this.analyser ? this.analyser.fftSize : 2048;
  }
}
