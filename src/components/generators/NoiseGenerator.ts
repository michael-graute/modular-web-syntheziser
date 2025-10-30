/**
 * NoiseGenerator - White and Pink noise generator
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

/**
 * Noise types
 */
const NOISE_TYPES = ['white', 'pink'];

/**
 * NoiseGenerator component for generating white and pink noise
 */
export class NoiseGenerator extends SynthComponent {
  private bufferSource: AudioBufferSourceNode | null;
  private gainNode: GainNode | null;
  private cvScalerNode: GainNode | null; // Scales CV input (e.g., LFO 0-100) down to gain range (0-1)
  private pinkFilter: BiquadFilterNode | null;
  private noiseBuffer: AudioBuffer | null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.NOISE, 'Noise', position);

    // Add output
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    // Add CV input for amplitude modulation
    this.addInput('amplitude', 'Amp CV', SignalType.CV);

    // Add parameters
    // Noise type: 0=white, 1=pink
    this.addParameter('type', 'Type', 0, 0, 1, 1, '');
    // Amplitude: 0 - 100%
    this.addParameter('amplitude', 'Amplitude', 50, 0, 100, 1, '%');

    this.bufferSource = null;
    this.gainNode = null;
    this.cvScalerNode = null;
    this.pinkFilter = null;
    this.noiseBuffer = null;
  }

  /**
   * Generate white noise buffer
   */
  private generateWhiteNoiseBuffer(duration: number = 2): AudioBuffer {
    const ctx = audioEngine.getContext();
    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * duration;

    // Create buffer (mono)
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // Fill with random values [-1, 1]
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  /**
   * Create audio nodes
   */
  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    // Generate white noise buffer (2 seconds, looping)
    this.noiseBuffer = this.generateWhiteNoiseBuffer(2);

    // Create buffer source
    this.bufferSource = ctx.createBufferSource();
    this.bufferSource.buffer = this.noiseBuffer;
    this.bufferSource.loop = true;

    // Create gain node for amplitude control
    this.gainNode = ctx.createGain();
    const amplitude = this.getParameter('amplitude')?.getValue() || 50;
    this.gainNode.gain.value = amplitude / 100;

    // CV Scaling Setup:
    // Problem: LFO outputs large values (0-100), but gain needs 0-1
    // Solution: Two-stage scaling chain
    //
    // Stage 1: cvScalerNode with constant input
    //   - ConstantSource(1.0) → GainNode (gain parameter is where LFO connects)
    //   - Output = 1.0 * LFO_value (e.g., 1.0 * 50 = 50)
    //
    // Stage 2: Apply 0.01 scale factor
    //   - Take Stage 1 output → multiply by 0.01 using another GainNode
    //   - This second gain node connects its OUTPUT to main gain's AudioParam
    //   - Final result: LFO_value * 0.01 added to base gain

    // Create constant source (value = 1.0)
    const constantSource = ctx.createConstantSource();
    constantSource.offset.value = 1.0;

    // Create first gain node (LFO connects to its .gain parameter)
    this.cvScalerNode = ctx.createGain();
    this.cvScalerNode.gain.value = 0; // LFO will modulate this via AudioParam connection

    // Connect: constant → cvScalerNode
    // Output of cvScalerNode = 1.0 * cvScalerNode.gain (which is modulated by LFO)
    constantSource.connect(this.cvScalerNode);
    constantSource.start();

    // Create second gain node to apply 0.01 scale factor
    const cvScaleOutput = ctx.createGain();
    cvScaleOutput.gain.value = 0.01; // This scales the LFO signal down

    // Connect: cvScalerNode → cvScaleOutput → main gain.gain AudioParam
    this.cvScalerNode.connect(cvScaleOutput);
    cvScaleOutput.connect(this.gainNode.gain);

    // Register constant source
    this.registerAudioNode('constantSource', constantSource);
    this.registerAudioNode('cvScaleOutput', cvScaleOutput);

    // Link AudioParam to Parameter for CV visualization
    const amplitudeParam = this.getParameter('amplitude');
    if (amplitudeParam) {
      // Link to the main gain's AudioParam (this is what gets modulated)
      amplitudeParam.linkAudioParam(this.gainNode.gain);
    }

    // Create filter for pink noise
    this.pinkFilter = ctx.createBiquadFilter();
    this.pinkFilter.type = 'lowpass';
    this.pinkFilter.frequency.value = 3000; // Pink noise filter cutoff
    this.pinkFilter.Q.value = 0.5;

    // Connect audio signal path based on noise type
    const noiseType = Math.round(this.getParameter('type')?.getValue() || 0);
    if (noiseType === 1) {
      // Pink noise: source → pink filter → gain
      this.bufferSource.connect(this.pinkFilter);
      this.pinkFilter.connect(this.gainNode);
    } else {
      // White noise: source → gain
      this.bufferSource.connect(this.gainNode);
    }

    // Start the noise
    this.bufferSource.start();

    // Register with audio engine
    this.registerAudioNode('bufferSource', this.bufferSource);
    this.registerAudioNode('gain', this.gainNode);
    this.registerAudioNode('cvScaler', this.cvScalerNode);
    this.registerAudioNode('pinkFilter', this.pinkFilter);

    console.log(`NoiseGenerator ${this.id} created with type: ${NOISE_TYPES[noiseType]}`);
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    if (this.bufferSource) {
      try {
        this.bufferSource.stop();
        this.bufferSource.disconnect();
      } catch (error) {
        // Buffer source might already be stopped
      }
      this.bufferSource = null;
    }

    if (this.pinkFilter) {
      this.pinkFilter.disconnect();
      this.pinkFilter = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.cvScalerNode) {
      this.cvScalerNode.disconnect();
      this.cvScalerNode = null;
    }

    this.noiseBuffer = null;

    console.log(`NoiseGenerator ${this.id} destroyed`);
  }

  /**
   * Update audio parameter
   */
  updateAudioParameter(parameterId: string, value: number): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    switch (parameterId) {
      case 'type':
        // Switch between white and pink noise by reconnecting the audio path
        // Don't destroy nodes - just change the routing
        if (this.bufferSource && this.gainNode && this.pinkFilter) {
          const noiseType = Math.round(value);

          // Disconnect buffer source from everything
          this.bufferSource.disconnect();

          if (noiseType === 1) {
            // Pink noise: source → pink filter → gain
            this.bufferSource.connect(this.pinkFilter);
            // Make sure pink filter is connected to gain
            // (it might already be connected, so disconnect first to avoid duplicates)
            try {
              this.pinkFilter.disconnect();
            } catch (e) {
              // Already disconnected, that's fine
            }
            this.pinkFilter.connect(this.gainNode);
          } else {
            // White noise: source → gain directly
            this.bufferSource.connect(this.gainNode);
          }

          console.log(`NoiseGenerator ${this.id} type changed to: ${NOISE_TYPES[noiseType]}`);
        }
        break;
      case 'amplitude':
        if (this.gainNode) {
          this.gainNode.gain.setValueAtTime(value / 100, now);
          console.log(`NoiseGenerator ${this.id} amplitude changed to: ${value}%`);
        }
        break;
    }
  }

  /**
   * Get input node for connections
   */
  getInputNode(): AudioNode | null {
    // Noise generators don't have audio input
    return null;
  }

  /**
   * Get output node for connections
   */
  getOutputNode(): AudioNode | null {
    return this.gainNode; // Output is the main gain node
  }

  /**
   * Get noise type name for display
   */
  getNoiseTypeName(): string {
    const typeIndex = Math.round(this.getParameter('type')?.getValue() || 0);
    return NOISE_TYPES[typeIndex] || 'white';
  }

  /**
   * Get current amplitude value
   */
  getAmplitude(): number {
    return this.getParameter('amplitude')?.getValue() || 50;
  }

  /**
   * Get AudioParam for CV input (override from base class)
   */
  protected override getAudioParamForInput(inputId: string): AudioParam | null {
    switch (inputId) {
      case 'amplitude':
        // Return the CV scaler's gain AudioParam
        // LFO connects here, output is scaled by 0.01 and added to main gain
        return this.cvScalerNode ? this.cvScalerNode.gain : null;
      default:
        return null;
    }
  }
}
