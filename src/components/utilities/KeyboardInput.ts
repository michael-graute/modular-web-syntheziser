/**
 * KeyboardInput - Component that receives QWERTY keyboard input and outputs CV/Gate signals
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { VoiceAllocator, VoiceSlot } from './VoiceAllocator';

/**
 * KeyboardInput component for converting keyboard input to CV/Gate signals.
 * Supports mono (legacy) and poly (4-voice) modes toggled via the polyMode parameter.
 */
export class KeyboardInput extends SynthComponent {
  private frequencyNode: ConstantSourceNode | null;
  private gateNode: ConstantSourceNode | null;
  private velocityNode: ConstantSourceNode | null;
  private activeNotes: Map<number, number>; // note -> frequency (mono mode)
  private connectedGateTargets: Set<SynthComponent>; // mono ADSR targets
  private voiceAllocator: VoiceAllocator;

  constructor(id: string, position: Position) {
    super(id, ComponentType.KEYBOARD_INPUT, 'Keyboard', position);

    // Mono output ports (unchanged from pre-feature behaviour)
    this.addOutput('frequency', 'Frequency', SignalType.CV);
    this.addOutput('gate', 'Gate', SignalType.GATE);
    this.addOutput('velocity', 'Velocity', SignalType.CV);
    // Poly output port — carries 4-voice slot data via JS getter (FR-001)
    this.addOutput('poly-cv', 'Poly CV', SignalType.POLY_CV);

    // polyMode: 0 = mono (default, backward-compatible), 1 = poly (FR-003, FR-014)
    this.addParameter('polyMode', 'Poly Mode', 0, 0, 1, 1, '');

    this.frequencyNode = null;
    this.gateNode = null;
    this.velocityNode = null;
    this.activeNotes = new Map();
    this.connectedGateTargets = new Set();
    this.voiceAllocator = new VoiceAllocator();
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    this.frequencyNode = ctx.createConstantSource();
    this.frequencyNode.offset.value = 220;
    this.frequencyNode.start();

    this.gateNode = ctx.createConstantSource();
    this.gateNode.offset.value = 0;
    this.gateNode.start();

    this.velocityNode = ctx.createConstantSource();
    this.velocityNode.offset.value = 0;
    this.velocityNode.start();

    this.registerAudioNode('frequency', this.frequencyNode);
    this.registerAudioNode('gate', this.gateNode);
    this.registerAudioNode('velocity', this.velocityNode);

    // If restored from a patch with polyMode=1, freeze mono outputs immediately
    if (this.isPolyMode()) {
      this._freezeMonoOutputs();
    }

    console.log(`Keyboard ${this.id} created`);
  }

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
    this.voiceAllocator.releaseAll();
    console.log(`Keyboard ${this.id} destroyed`);
  }

  updateAudioParameter(_parameterId: string, _value: number): void {
    // polyMode is handled by setPolyMode(); other params are no-ops
  }

  getInputNode(): AudioNode | null {
    return null;
  }

  getOutputNode(): AudioNode | null {
    return this.frequencyNode;
  }

  protected override getOutputNodeByPort(portId: string): AudioNode | null {
    switch (portId) {
      case 'frequency': return this.frequencyNode;
      case 'gate':      return this.gateNode;
      case 'velocity':  return this.velocityNode;
      // poly-cv has no AudioNode — data flows via getVoiceSlots() getter
      case 'poly-cv':   return null;
      default:          return this.frequencyNode;
    }
  }

  // -------------------------------------------------------------------------
  // Poly mode API
  // -------------------------------------------------------------------------

  isPolyMode(): boolean {
    return this.getParameter('polyMode')?.getValue() === 1;
  }

  setPolyMode(mode: 0 | 1): void {
    this.getParameter('polyMode')?.setValue(mode);
    this.voiceAllocator.releaseAll();

    if (mode === 1) {
      // Entering poly — freeze all mono outputs so connected mono ADSR/osc stay silent
      this._freezeMonoOutputs();
    } else {
      // Leaving poly — restore mono outputs to neutral ready state
      this._restoreMonoOutputs();
    }
  }

  getVoiceSlots(): Readonly<VoiceSlot[]> {
    return this.voiceAllocator.getSlots();
  }

  // -------------------------------------------------------------------------
  // Note events — branch on current mode
  // -------------------------------------------------------------------------

  triggerNoteOn(note: number, frequency: number, velocity: number): void {
    if (this.isPolyMode()) {
      this.voiceAllocator.noteOn(note, frequency);
      return;
    }
    this._monoNoteOn(note, frequency, velocity);
  }

  triggerNoteOff(note: number): void {
    if (this.isPolyMode()) {
      this.voiceAllocator.noteOff(note);
      return;
    }
    this._monoNoteOff(note);
  }

  // -------------------------------------------------------------------------
  // Mono gate target registration (unchanged from pre-feature API)
  // -------------------------------------------------------------------------

  registerGateTarget(target: SynthComponent): void {
    this.connectedGateTargets.add(target);
  }

  unregisterGateTarget(target: SynthComponent): void {
    this.connectedGateTargets.delete(target);
  }

  // -------------------------------------------------------------------------
  // Read-back helpers (used by ConnectionManager getter pattern)
  // -------------------------------------------------------------------------

  getGateValue(): number {
    if (this.isPolyMode()) return 0; // mono gate is frozen in poly mode
    return this.activeNotes.size > 0 ? 1 : 0;
  }

  getCurrentFrequency(): number {
    if (this.activeNotes.size === 0) return 220;
    return Array.from(this.activeNotes.values()).pop()!;
  }

  getActiveNoteCount(): number {
    return this.activeNotes.size;
  }

  getFrequencyParam(): AudioParam | null {
    return this.frequencyNode ? this.frequencyNode.offset : null;
  }

  getGateParam(): AudioParam | null {
    return this.gateNode ? this.gateNode.offset : null;
  }

  getVelocityParam(): AudioParam | null {
    return this.velocityNode ? this.velocityNode.offset : null;
  }

  releaseAll(): void {
    if (!this.gateNode) return;
    this.activeNotes.clear();
    const ctx = audioEngine.getContext();
    this.gateNode.offset.setValueAtTime(0, ctx.currentTime);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _freezeMonoOutputs(): void {
    if (!this.gateNode || !this.frequencyNode || !this.velocityNode) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    // SC-003: takes effect within one audio buffer
    this.gateNode.offset.cancelScheduledValues(now);
    this.gateNode.offset.setValueAtTime(0, now);
    this.frequencyNode.offset.cancelScheduledValues(now);
    this.frequencyNode.offset.setValueAtTime(this.frequencyNode.offset.value, now);
    this.velocityNode.offset.cancelScheduledValues(now);
    this.velocityNode.offset.setValueAtTime(0, now);
    this.activeNotes.clear();
  }

  private _restoreMonoOutputs(): void {
    if (!this.gateNode || !this.frequencyNode || !this.velocityNode) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    this.gateNode.offset.cancelScheduledValues(now);
    this.gateNode.offset.setValueAtTime(0, now);
    this.frequencyNode.offset.cancelScheduledValues(now);
    this.frequencyNode.offset.setValueAtTime(220, now);
    this.velocityNode.offset.cancelScheduledValues(now);
    this.velocityNode.offset.setValueAtTime(0, now);
  }

  private _monoNoteOn(note: number, frequency: number, velocity: number): void {
    if (!this.frequencyNode || !this.gateNode || !this.velocityNode) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    this.activeNotes.set(note, frequency);
    this.frequencyNode.offset.setValueAtTime(frequency, now);
    this.velocityNode.offset.setValueAtTime(velocity, now);
    this.gateNode.offset.setValueAtTime(1, now);

    this.connectedGateTargets.forEach((target) => {
      if (target.type === ComponentType.ADSR_ENVELOPE) {
        const adsr = target as any;
        if (adsr.triggerGateOn) adsr.triggerGateOn();
      }
    });

    console.log(`Keyboard ${this.id} note ON: ${note} (${frequency.toFixed(2)} Hz, vel=${velocity.toFixed(2)})`);
  }

  private _monoNoteOff(note: number): void {
    if (!this.gateNode) return;
    this.activeNotes.delete(note);
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    if (this.activeNotes.size === 0) {
      this.gateNode.offset.setValueAtTime(0, now);
      this.connectedGateTargets.forEach((target) => {
        if (target.type === ComponentType.ADSR_ENVELOPE) {
          const adsr = target as any;
          if (adsr.triggerGateOff) adsr.triggerGateOff();
        }
      });
      console.log(`Keyboard ${this.id} note OFF: ${note} (gate off)`);
    } else {
      const lastFreq = Array.from(this.activeNotes.values()).pop();
      if (lastFreq && this.frequencyNode) {
        this.frequencyNode.offset.setValueAtTime(lastFreq, now);
      }
      console.log(`Keyboard ${this.id} note OFF: ${note} (${this.activeNotes.size} notes still active)`);
    }
  }
}
