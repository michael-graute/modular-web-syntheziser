/**
 * ADSR Envelope - Attack Decay Sustain Release envelope generator
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { ENVELOPE } from '../../utils/constants';

/**
 * ADSR Envelope component for amplitude and modulation control
 */
export class ADSREnvelope extends SynthComponent {
  private constantSource: ConstantSourceNode | null;
  private gainNode: GainNode | null;
  private isGateOn: boolean = false;

  constructor(id: string, position: Position) {
    super(id, ComponentType.ADSR_ENVELOPE, 'ADSR', position);

    // Add ports
    this.addInput('gate', 'Gate In', SignalType.GATE);
    this.addOutput('output', 'CV Out', SignalType.CV);

    // Add ADSR parameters
    this.addParameter('attack', 'Attack', ENVELOPE.DEFAULT_ATTACK, ENVELOPE.MIN_TIME, ENVELOPE.MAX_TIME, 0.01, 's');
    this.addParameter('decay', 'Decay', ENVELOPE.DEFAULT_DECAY, ENVELOPE.MIN_TIME, ENVELOPE.MAX_TIME, 0.01, 's');
    this.addParameter('sustain', 'Sustain', ENVELOPE.DEFAULT_SUSTAIN, ENVELOPE.MIN_LEVEL, ENVELOPE.MAX_LEVEL, 0.01, '');
    this.addParameter('release', 'Release', ENVELOPE.DEFAULT_RELEASE, ENVELOPE.MIN_TIME, ENVELOPE.MAX_TIME, 0.01, 's');

    this.constantSource = null;
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

    // Create constant source (outputs constant 1.0 signal)
    this.constantSource = ctx.createConstantSource();
    this.constantSource.offset.value = 1.0;
    this.constantSource.start();

    // Create gain node for envelope shaping
    // The envelope controls this gain, output = 1.0 * envelope_gain
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 0; // Start at 0

    // Connect constant source through gain node
    this.constantSource.connect(this.gainNode);

    // Register with audio engine
    this.registerAudioNode('constantSource', this.constantSource);
    this.registerAudioNode('envelope', this.gainNode);

    console.log(`ADSR Envelope ${this.id} created`);
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    if (this.constantSource) {
      this.constantSource.stop();
      this.constantSource.disconnect();
      this.constantSource = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    this.isGateOn = false;
    console.log(`ADSR Envelope ${this.id} destroyed`);
  }

  /**
   * Update audio parameter
   */
  updateAudioParameter(parameterId: string, value: number): void {
    // ADSR parameters don't update the audio node directly
    // They are used when the gate is triggered
    console.log(`ADSR ${this.id} parameter ${parameterId} updated to ${value}`);
  }

  /**
   * Get input node for connections
   */
  getInputNode(): AudioNode | null {
    // Envelopes don't have audio input, only gate trigger
    return null;
  }

  /**
   * Get output node for connections
   */
  getOutputNode(): AudioNode | null {
    return this.gainNode;
  }

  /**
   * Get envelope gain AudioParam for CV modulation
   */
  getEnvelopeParam(): AudioParam | null {
    return this.gainNode ? this.gainNode.gain : null;
  }

  /**
   * Trigger gate on (note on)
   * Starts the Attack-Decay-Sustain phase
   */
  triggerGateOn(): void {
    if (!this.gainNode) return;

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const gainParam = this.gainNode.gain;

    // Get ADSR parameter values
    const attack = this.getParameter('attack')?.getValue() || ENVELOPE.DEFAULT_ATTACK;
    const decay = this.getParameter('decay')?.getValue() || ENVELOPE.DEFAULT_DECAY;
    const sustain = this.getParameter('sustain')?.getValue() || ENVELOPE.DEFAULT_SUSTAIN;

    // Cancel any scheduled values
    gainParam.cancelScheduledValues(now);

    // Get current value for smooth transition
    const currentValue = gainParam.value;

    // ADSR envelope
    // Start from current value
    gainParam.setValueAtTime(currentValue, now);

    // Attack phase: ramp to peak (1.0)
    gainParam.linearRampToValueAtTime(1.0, now + attack);

    // Decay phase: ramp down to sustain level
    gainParam.linearRampToValueAtTime(sustain, now + attack + decay);

    // Sustain phase is maintained until gate off
    this.isGateOn = true;

    console.log(`ADSR ${this.id} gate ON: A=${attack}s, D=${decay}s, S=${sustain}`);
  }

  /**
   * Trigger gate off (note off)
   * Starts the Release phase
   */
  triggerGateOff(): void {
    if (!this.gainNode || !this.isGateOn) return;

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const gainParam = this.gainNode.gain;

    // Get release parameter
    const release = this.getParameter('release')?.getValue() || ENVELOPE.DEFAULT_RELEASE;

    // Cancel any scheduled values
    gainParam.cancelScheduledValues(now);

    // Start from current value
    const currentValue = gainParam.value;
    gainParam.setValueAtTime(currentValue, now);

    // Release phase: ramp down to 0
    gainParam.linearRampToValueAtTime(0.0, now + release);

    this.isGateOn = false;

    console.log(`ADSR ${this.id} gate OFF: R=${release}s`);
  }

  /**
   * Check if gate is currently on
   */
  isGateActive(): boolean {
    return this.isGateOn;
  }

  /**
   * Get AudioParam for gate input (override from base class)
   * ADSR doesn't use AudioParam for gate, it uses trigger methods
   * But we need to implement this for the connection system
   */
  protected override getAudioParamForInput(_inputId: string): AudioParam | null {
    // ADSR uses trigger methods (triggerGateOn/Off) instead of AudioParam
    // Return null to indicate no direct AudioParam connection
    return null;
  }

  /**
   * Get output node for a specific port (override from base class)
   * ADSR outputs CV signal from the envelope gainNode
   */
  protected override getOutputNodeByPort(_portId: string): AudioNode | null {
    return this.gainNode;
  }
}
