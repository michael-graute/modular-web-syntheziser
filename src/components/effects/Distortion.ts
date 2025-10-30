/**
 * Distortion - Waveshaping distortion effect
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

/**
 * Distortion effect component using WaveShaperNode
 */
export class Distortion extends SynthComponent {
  private inputGain: GainNode | null;
  private dryGain: GainNode | null;
  private wetGain: GainNode | null;
  private waveshaper: WaveShaperNode | null;
  private toneFilter: BiquadFilterNode | null;
  private outputGain: GainNode | null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.DISTORTION, 'Distortion', position);

    // Add ports
    this.addInput('input', 'Audio In', SignalType.AUDIO);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    // Add parameters
    this.addParameter('drive', 'Drive', 50, 0, 100, 1, '%');
    this.addParameter('tone', 'Tone', 8000, 200, 20000, 100, 'Hz');
    this.addParameter('mix', 'Mix', 0.5, 0, 1, 0.01, ''); // 0=dry, 1=wet

    this.inputGain = null;
    this.dryGain = null;
    this.wetGain = null;
    this.waveshaper = null;
    this.toneFilter = null;
    this.outputGain = null;
  }

  /**
   * Generate distortion curve based on drive amount
   */
  private makeDistortionCurve(amount: number): Float32Array {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    // Convert 0-100 range to 0-400 for curve generation
    const k = amount * 4;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Waveshaping function: tanh-based soft clipping
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }

    return curve;
  }

  /**
   * Create audio nodes
   */
  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    // Create input gain
    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1.0;

    // Create dry/wet mix gains
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    // Create waveshaper
    this.waveshaper = ctx.createWaveShaper();
    const drive = this.getParameter('drive')?.getValue() || 50;
    this.waveshaper.curve = this.makeDistortionCurve(drive) as any;
    this.waveshaper.oversample = '4x'; // High quality oversampling

    // Create tone control (lowpass filter)
    this.toneFilter = ctx.createBiquadFilter();
    this.toneFilter.type = 'lowpass';
    const tone = this.getParameter('tone')?.getValue() || 8000;
    this.toneFilter.frequency.value = tone;
    this.toneFilter.Q.value = 1.0;

    // Create output gain
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1.0;

    // Set initial dry/wet mix
    const mix = this.getParameter('mix')?.getValue() || 0.5;
    this.updateMix(mix);

    // Connect routing:
    // Dry path: input -> dryGain -> output
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.outputGain);

    // Wet path: input -> waveshaper -> tone filter -> wetGain -> output
    this.inputGain.connect(this.waveshaper);
    this.waveshaper.connect(this.toneFilter);
    this.toneFilter.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Register with audio engine
    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('dryGain', this.dryGain);
    this.registerAudioNode('wetGain', this.wetGain);
    this.registerAudioNode('waveshaper', this.waveshaper);
    this.registerAudioNode('toneFilter', this.toneFilter);
    this.registerAudioNode('outputGain', this.outputGain);

    console.log(`Distortion ${this.id} created with drive: ${drive}%, tone: ${tone}Hz`);
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    if (this.toneFilter) {
      this.toneFilter.disconnect();
      this.toneFilter = null;
    }

    if (this.waveshaper) {
      this.waveshaper.disconnect();
      this.waveshaper = null;
    }

    if (this.wetGain) {
      this.wetGain.disconnect();
      this.wetGain = null;
    }

    if (this.dryGain) {
      this.dryGain.disconnect();
      this.dryGain = null;
    }

    if (this.inputGain) {
      this.inputGain.disconnect();
      this.inputGain = null;
    }

    if (this.outputGain) {
      this.outputGain.disconnect();
      this.outputGain = null;
    }

    console.log(`Distortion ${this.id} destroyed`);
  }

  /**
   * Update audio parameter
   */
  updateAudioParameter(parameterId: string, value: number): void {
    if (!this.waveshaper || !this.toneFilter) {
      return;
    }

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    switch (parameterId) {
      case 'drive':
        // Update distortion curve
        this.waveshaper.curve = this.makeDistortionCurve(value) as any;
        console.log(`Distortion ${this.id} drive changed to: ${value}%`);
        break;
      case 'tone':
        // Update tone filter cutoff
        this.toneFilter.frequency.setValueAtTime(value, now);
        console.log(`Distortion ${this.id} tone changed to: ${value}Hz`);
        break;
      case 'mix':
        this.updateMix(value);
        break;
    }
  }

  /**
   * Update dry/wet mix
   */
  private updateMix(mix: number): void {
    if (!this.dryGain || !this.wetGain) {
      return;
    }

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    // Equal power crossfade
    const dryLevel = Math.cos(mix * 0.5 * Math.PI);
    const wetLevel = Math.cos((1.0 - mix) * 0.5 * Math.PI);

    this.dryGain.gain.setValueAtTime(dryLevel, now);
    this.wetGain.gain.setValueAtTime(wetLevel, now);
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
   * Enable bypass - connect input directly to output
   */
  protected override enableBypass(): void {
    if (!this.inputGain || !this.outputGain) {
      return;
    }

    // Store original connections for restoration
    this._bypassConnections = [
      { from: this.inputGain, to: this.dryGain! },
      { from: this.inputGain, to: this.waveshaper! },
      { from: this.dryGain!, to: this.outputGain },
      { from: this.waveshaper!, to: this.toneFilter! },
      { from: this.toneFilter!, to: this.wetGain! },
      { from: this.wetGain!, to: this.outputGain },
    ];

    // Disconnect all processing nodes
    this.inputGain.disconnect();
    if (this.waveshaper) this.waveshaper.disconnect();
    if (this.toneFilter) this.toneFilter.disconnect();
    if (this.dryGain) this.dryGain.disconnect();
    if (this.wetGain) this.wetGain.disconnect();

    // Connect input directly to output
    this.inputGain.connect(this.outputGain);

    console.log(`Distortion ${this.id} bypassed`);
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

    console.log(`Distortion ${this.id} restored`);
  }
}
