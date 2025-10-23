/**
 * KeyboardInput - Component that receives QWERTY keyboard input and outputs CV/Gate signals
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

/**
 * KeyboardInput component for converting keyboard input to CV/Gate signals
 */
export class KeyboardInput extends SynthComponent {
  private frequencyNode: ConstantSourceNode | null;
  private gateNode: ConstantSourceNode | null;
  private velocityNode: ConstantSourceNode | null;
  private activeNotes: Map<number, number>; // note -> frequency
  private connectedGateTargets: Set<SynthComponent>; // Track ADSR components connected to gate

  constructor(id: string, position: Position) {
    super(id, ComponentType.KEYBOARD_INPUT, 'Keyboard', position);

    // Add output ports
    this.addOutput('frequency', 'Frequency', SignalType.CV);
    this.addOutput('gate', 'Gate', SignalType.GATE);
    this.addOutput('velocity', 'Velocity', SignalType.CV);

    this.frequencyNode = null;
    this.gateNode = null;
    this.velocityNode = null;
    this.activeNotes = new Map();
    this.connectedGateTargets = new Set();
  }

  /**
   * Create audio nodes
   */
  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    // Create ConstantSourceNodes for CV outputs
    this.frequencyNode = ctx.createConstantSource();
    this.frequencyNode.offset.value = 440; // A4 default
    this.frequencyNode.start();

    this.gateNode = ctx.createConstantSource();
    this.gateNode.offset.value = 0; // Gate off by default
    this.gateNode.start();

    this.velocityNode = ctx.createConstantSource();
    this.velocityNode.offset.value = 0; // No velocity by default
    this.velocityNode.start();

    // Register with audio engine
    this.registerAudioNode('frequency', this.frequencyNode);
    this.registerAudioNode('gate', this.gateNode);
    this.registerAudioNode('velocity', this.velocityNode);

    console.log(`Keyboard ${this.id} created`);
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    if (this.frequencyNode) {
      this.frequencyNode.stop();
      this.frequencyNode.disconnect();
      this.frequencyNode = null;
    }

    if (this.gateNode) {
      this.gateNode.stop();
      this.gateNode.disconnect();
      this.gateNode = null;
    }

    if (this.velocityNode) {
      this.velocityNode.stop();
      this.velocityNode.disconnect();
      this.velocityNode = null;
    }

    this.activeNotes.clear();
    console.log(`Keyboard ${this.id} destroyed`);
  }

  /**
   * Update audio parameter
   */
  updateAudioParameter(_parameterId: string, _value: number): void {
    // Keyboard has no parameters
  }

  /**
   * Get input node for connections
   */
  getInputNode(): AudioNode | null {
    // Keyboard has no audio input
    return null;
  }

  /**
   * Get output node for connections
   */
  getOutputNode(): AudioNode | null {
    // Return frequency node as default output
    return this.frequencyNode;
  }

  /**
   * Get specific output node by port ID (override)
   */
  protected override getOutputNodeByPort(portId: string): AudioNode | null {
    switch (portId) {
      case 'frequency':
        return this.frequencyNode;
      case 'gate':
        return this.gateNode;
      case 'velocity':
        return this.velocityNode;
      default:
        return this.frequencyNode; // Default to frequency
    }
  }

  /**
   * Get frequency AudioParam for connections
   */
  getFrequencyParam(): AudioParam | null {
    return this.frequencyNode ? this.frequencyNode.offset : null;
  }

  /**
   * Get gate AudioParam for connections
   */
  getGateParam(): AudioParam | null {
    return this.gateNode ? this.gateNode.offset : null;
  }

  /**
   * Get velocity AudioParam for connections
   */
  getVelocityParam(): AudioParam | null {
    return this.velocityNode ? this.velocityNode.offset : null;
  }

  /**
   * Register a component connected to the gate output
   */
  registerGateTarget(target: SynthComponent): void {
    this.connectedGateTargets.add(target);
    console.log(`Keyboard ${this.id} registered gate target: ${target.name} (${target.id})`);
  }

  /**
   * Unregister a component from gate output
   */
  unregisterGateTarget(target: SynthComponent): void {
    this.connectedGateTargets.delete(target);
    console.log(`Keyboard ${this.id} unregistered gate target: ${target.name} (${target.id})`);
  }

  /**
   * Trigger note on
   */
  triggerNoteOn(note: number, frequency: number, velocity: number): void {
    if (!this.frequencyNode || !this.gateNode || !this.velocityNode) return;

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    // Store active note
    this.activeNotes.set(note, frequency);

    // Update frequency (use last note if multiple notes pressed)
    this.frequencyNode.offset.setValueAtTime(frequency, now);

    // Update velocity
    this.velocityNode.offset.setValueAtTime(velocity, now);

    // Gate on
    this.gateNode.offset.setValueAtTime(1, now);

    // Trigger connected ADSR envelopes
    this.connectedGateTargets.forEach((target) => {
      if (target.type === ComponentType.ADSR_ENVELOPE) {
        const adsrComponent = target as any;
        if (adsrComponent.triggerGateOn) {
          adsrComponent.triggerGateOn();
        }
      }
    });

    console.log(`Keyboard ${this.id} note ON: ${note} (${frequency.toFixed(2)} Hz, vel=${velocity.toFixed(2)})`);
  }

  /**
   * Trigger note off
   */
  triggerNoteOff(note: number): void {
    if (!this.gateNode) return;

    // Remove from active notes
    this.activeNotes.delete(note);

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    // If no more notes active, gate off
    if (this.activeNotes.size === 0) {
      this.gateNode.offset.setValueAtTime(0, now);

      // Trigger gate off on connected ADSR envelopes
      this.connectedGateTargets.forEach((target) => {
        if (target.type === ComponentType.ADSR_ENVELOPE) {
          const adsrComponent = target as any;
          if (adsrComponent.triggerGateOff) {
            adsrComponent.triggerGateOff();
          }
        }
      });

      console.log(`Keyboard ${this.id} note OFF: ${note} (gate off)`);
    } else {
      // Update to most recent note frequency
      const lastNote = Array.from(this.activeNotes.values()).pop();
      if (lastNote && this.frequencyNode) {
        this.frequencyNode.offset.setValueAtTime(lastNote, now);
      }
      console.log(`Keyboard ${this.id} note OFF: ${note} (${this.activeNotes.size} notes still active)`);
    }
  }

  /**
   * Get number of active notes
   */
  getActiveNoteCount(): number {
    return this.activeNotes.size;
  }

  /**
   * Release all notes
   */
  releaseAll(): void {
    if (!this.gateNode) return;

    this.activeNotes.clear();

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    this.gateNode.offset.setValueAtTime(0, now);

    console.log(`Keyboard ${this.id} released all notes`);
  }
}
