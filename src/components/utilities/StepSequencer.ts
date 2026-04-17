/**
 * StepSequencer - 16-step sequencer with CV/Gate outputs
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType, EventType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { globalBpmController } from '../../core/GlobalBpmController';
import { eventBus } from '../../core/EventBus';
import type { GlobalBpmChangedPayload } from '../../core/types';
import type {
  StepSequencerDisplayState,
  SequencerMode,
} from '../../../specs/012-step-sequencer-refactor/contracts/types';

/**
 * Sequencer step data structure
 */
export interface SequencerStep {
  active: boolean;       // Step enabled/disabled
  note: number;          // MIDI note number (0-127)
  velocity: number;      // Velocity (0.0 - 1.0)
  gateLength: number;    // Gate length: 0=Tied, 1=1/1, 2=1/2, 3=1/4, 4=1/8, 5=1/16
}

/**
 * Step Sequencer component
 */
export class StepSequencer extends SynthComponent {
  private frequencyNode: ConstantSourceNode | null;
  private gateNode: ConstantSourceNode | null;
  private velocityNode: ConstantSourceNode | null;

  // Arpeggiator input nodes
  private arpGateInputNode: GainNode | null; // Receives gate from keyboard
  private arpFreqInputNode: GainNode | null; // Receives frequency CV from keyboard
  private arpVelInputNode: GainNode | null; // Receives velocity CV from keyboard

  // Sequencer state
  private steps: SequencerStep[];
  private currentStep: number; // Current step for scheduling (lookahead)
  private visualCurrentStep: number; // Current step for visual indicator (actual playback)
  private isPlaying: boolean;
  private nextStepTime: number;
  private lookaheadTime: number = 0.1; // 100ms lookahead
  private scheduleInterval: number | null;
  private lastGateOnTime: number = -1; // Track when gate was last triggered on

  // Arpeggiator state
  private arpBaseNote: number = 60; // Base note from keyboard (C4 default)
  private arpIsKeyHeld: boolean = false; // Is keyboard key currently held
  private lastArpGateState: number = 0; // Track keyboard gate state
  private arpCheckInterval: number | null = null; // Interval for polling arp gate input

  // JS-level getter functions for arp gate and frequency, supplied by ConnectionManager
  // when a keyboard output is wired to an arp input port.
  // We cannot use ConstantSourceNode.offset.value because setValueAtTime() schedules
  // changes on the audio thread only and does not update the JS-readable .value property.
  private arpGateGetter: (() => number) | null = null;
  private arpFreqGetter: (() => number) | null = null;

  // Connected components
  private connectedGateTargets: Set<SynthComponent>;

  // Global BPM subscription
  private _globalBpmUnsubscribe: (() => void) | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.STEP_SEQUENCER, 'Sequencer', position);

    // Initialize nodes
    this.frequencyNode = null;
    this.gateNode = null;
    this.velocityNode = null;
    this.arpGateInputNode = null;
    this.arpFreqInputNode = null;
    this.arpVelInputNode = null;

    // Initialize state
    this.currentStep = 0;
    this.visualCurrentStep = 0;
    this.isPlaying = false;
    this.nextStepTime = 0;
    this.scheduleInterval = null;
    this.connectedGateTargets = new Set();

    // Initialize 16 steps with default values
    this.steps = Array.from({ length: 16 }, () => ({
      active: true,
      note: 60, // C4
      velocity: 0.8,
      gateLength: 3, // 1/4 note
    }));

    // Add output ports
    this.addOutput('frequency', 'Frequency', SignalType.CV);
    this.addOutput('gate', 'Gate', SignalType.GATE);
    this.addOutput('velocity', 'Velocity', SignalType.CV);

    // Add input ports for arpeggiator mode
    this.addInput('arpeggiate', 'Arp Gate', SignalType.GATE);
    this.addInput('arpFrequency', 'Arp Freq', SignalType.CV);
    this.addInput('arpVelocity', 'Arp Vel', SignalType.CV);

    // Add global parameters
    this.addParameter('bpm', 'BPM', 120, 30, 300, 1, '');
    this.addParameter('bpmMode', 'BPM Mode', 0, 0, 1, 1, ''); // 0=global, 1=local
    this.addParameter('noteValue', 'Division', 2, 0, 5, 1, '');
    // Note values: 0=whole, 1=1/2, 2=1/4, 3=1/8, 4=1/16, 5=1/32
    this.addParameter('sequenceLength', 'Length', 16, 2, 16, 1, '');
    this.addParameter('mode', 'Mode', 0, 0, 1, 1, '');
    // Mode: 0=Sequencer, 1=Arpeggiator

    // Add per-step parameters (16 steps × 4 fields = 64 parameters)
    for (let i = 0; i < 16; i++) {
      this.addParameter(`step_${i}_active`, `S${i + 1} Active`, 1, 0, 1, 1, '');
      this.addParameter(`step_${i}_note`, `S${i + 1} Note`, 60, 0, 127, 1, '');
      this.addParameter(`step_${i}_velocity`, `S${i + 1} Vel`, 0.8, 0, 1, 0.01, '');
      this.addParameter(`step_${i}_gateLength`, `S${i + 1} Gate`, 3, 0, 5, 1, '');
    }

    // Sync runtime steps array from parameters (establishes consistent initial state)
    this.syncStepsFromParameters();
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

    // Create GainNodes for arpeggiator CV inputs
    this.arpGateInputNode = ctx.createGain();
    this.arpGateInputNode.gain.value = 1;

    this.arpFreqInputNode = ctx.createGain();
    this.arpFreqInputNode.gain.value = 1;

    this.arpVelInputNode = ctx.createGain();
    this.arpVelInputNode.gain.value = 1;

    // Register with audio engine
    this.registerAudioNode('frequency', this.frequencyNode);
    this.registerAudioNode('gate', this.gateNode);
    this.registerAudioNode('velocity', this.velocityNode);
    this.registerAudioNode('arpeggiate', this.arpGateInputNode);
    this.registerAudioNode('arpFrequency', this.arpFreqInputNode);
    this.registerAudioNode('arpVelocity', this.arpVelInputNode);

    // Start polling for arp gate input (guards on mode + connection internally)
    this.startArpeggiatorMonitoring();

    // Subscribe to global BPM (takes effect at next step boundary via existing scheduling)
    this.subscribeToGlobalBpm();
  }

  /**
   * Destroy audio nodes
   */
  destroyAudioNodes(): void {
    // Stop playback
    this.stop();

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

    if (this.arpGateInputNode) {
      this.arpGateInputNode.disconnect();
      this.arpGateInputNode = null;
    }

    if (this.arpFreqInputNode) {
      this.arpFreqInputNode.disconnect();
      this.arpFreqInputNode = null;
    }

    if (this.arpVelInputNode) {
      this.arpVelInputNode.disconnect();
      this.arpVelInputNode = null;
    }

    this.stopArpeggiatorMonitoring();
    this.connectedGateTargets.clear();
    this.unsubscribeFromGlobalBpm();
  }

  /**
   * Update audio parameter
   */
  updateAudioParameter(parameterId: string, value: number): void {
    switch (parameterId) {
      case 'bpm':
      case 'noteValue':
      case 'sequenceLength':
      case 'mode':
        // Handled live in scheduling / display
        break;
      case 'bpmMode':
        // 0 = follow global BPM; adopt current global value immediately.
        // Guard: only when active (not during construction or deserialize).
        if (value === 0 && this.isActive) {
          this.setParameterValue('bpm', globalBpmController.getBpm());
        }
        break;
      default:
        // Per-step parameter: sync the matching step field
        if (parameterId.startsWith('step_')) {
          const parts = parameterId.split('_');
          const stepIndex = parseInt(parts[1] ?? '0', 10);
          const field = parts[2] as keyof SequencerStep;
          if (!isNaN(stepIndex) && stepIndex >= 0 && stepIndex < 16 && this.steps[stepIndex]) {
            if (field === 'active') {
              this.steps[stepIndex]!.active = value !== 0;
            } else if (field === 'note' || field === 'velocity') {
              this.steps[stepIndex]![field] = value;
            } else if (field === 'gateLength') {
              this.steps[stepIndex]!.gateLength = value;
            }
          }
        }
        break;
    }
  }

  /**
   * Get input node for connections
   */
  getInputNode(portId?: string): AudioNode | null {
    // Handle arpeggiator inputs by port ID
    if (portId) {
      switch (portId) {
        case 'arpeggiate':
          return this.arpGateInputNode;
        case 'arpFrequency':
          return this.arpFreqInputNode;
        case 'arpVelocity':
          return this.arpVelInputNode;
      }
    }

    // Sequencer doesn't have audio input
    return null;
  }

  /**
   * Get AudioParam for CV input (override)
   */
  protected override getAudioParamForInput(inputId: string): AudioParam | null {
    switch (inputId) {
      case 'arpeggiate':
        return this.arpGateInputNode?.gain || null;
      case 'arpFrequency':
        return this.arpFreqInputNode?.gain || null;
      case 'arpVelocity':
        return this.arpVelInputNode?.gain || null;
      default:
        return null;
    }
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
        return this.frequencyNode;
    }
  }

  /**
   * Register JS-level getter functions for arp gate and frequency.
   * Called by ConnectionManager when a keyboard output is wired to an arp input port.
   * Getters read JS-state rather than Web Audio API scheduled values.
   */
  setArpGateGetter(fn: () => number): void {
    this.arpGateGetter = fn;
  }

  setArpFreqGetter(fn: () => number): void {
    this.arpFreqGetter = fn;
  }

  clearArpSources(inputId?: string): void {
    if (!inputId || inputId === 'arpeggiate') this.arpGateGetter = null;
    if (!inputId || inputId === 'arpFrequency') this.arpFreqGetter = null;
  }

  /**
   * Register a component connected to the gate output
   */
  registerGateTarget(target: SynthComponent): void {
    this.connectedGateTargets.add(target);
  }

  /**
   * Unregister a component from gate output
   */
  unregisterGateTarget(target: SynthComponent): void {
    this.connectedGateTargets.delete(target);
  }

  // ---------------------------------------------------------------------------
  // Global BPM integration (TempoAware)
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to global BPM changes. Called from createAudioNodes() so it runs
   * whenever the component is activated — including mid-playback canvas adds.
   * The new BPM is applied via setParameterValue('bpm') which feeds into the
   * existing scheduling loop and takes effect at the next step boundary.
   */
  subscribeToGlobalBpm(): void {
    // Apply current global BPM immediately if in global mode
    if ((this.getParameter('bpmMode')?.getValue() ?? 0) === 0) {
      this.setParameterValue('bpm', globalBpmController.getBpm());
    }

    // Subscribe for future changes
    this._globalBpmUnsubscribe = eventBus.on(
      EventType.GLOBAL_BPM_CHANGED,
      (data) => this.applyGlobalBpm((data as GlobalBpmChangedPayload).bpm)
    );
  }

  /**
   * Unsubscribe from global BPM changes. Called from destroyAudioNodes().
   */
  unsubscribeFromGlobalBpm(): void {
    if (this._globalBpmUnsubscribe) {
      this._globalBpmUnsubscribe();
      this._globalBpmUnsubscribe = null;
    }
  }

  /**
   * Apply a new global BPM value. Only acts when in global mode (bpmMode=0).
   * Takes effect at the next step boundary via the existing scheduling loop.
   */
  applyGlobalBpm(bpm: number): void {
    if ((this.getParameter('bpmMode')?.getValue() ?? 0) === 0) {
      this.setParameterValue('bpm', bpm);
    }
  }

  /**
   * Convert MIDI note number to frequency
   */
  private midiToFrequency(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  /**
   * Get step interval in seconds based on BPM and note value
   */
  private getStepInterval(): number {
    const bpm = this.getParameter('bpm')?.getValue() || 120;
    const noteValue = this.getParameter('noteValue')?.getValue() || 2;

    const secondsPerBeat = 60 / bpm;
    const divisor = Math.pow(2, noteValue); // 1, 2, 4, 8, 16, 32
    return (secondsPerBeat * 4) / divisor;
  }

  /**
   * Get gate duration for a step in seconds.
   * Returns null for tied gate (no gate-off event should be emitted — the gate
   * stays high until the next active step fires a new gate-on).
   */
  private getGateDuration(step: SequencerStep, stepInterval: number): number | null {
    if (step.gateLength === 0) {
      return null; // Tied: suppress gate-off
    }
    const divisor = Math.pow(2, step.gateLength - 1);
    return stepInterval / divisor;
  }

  /**
   * Start playback
   */
  start(): void {
    if (this.isPlaying) return;

    const ctx = audioEngine.getContext();
    this.isPlaying = true;
    this.currentStep = 0;
    this.visualCurrentStep = 0;
    this.nextStepTime = ctx.currentTime;

    // Start scheduling interval
    this.scheduleInterval = window.setInterval(() => {
      this.scheduleNextSteps();
    }, 25); // Check every 25ms
  }

  /**
   * Stop playback
   */
  stop(): void {
    if (!this.isPlaying) return;

    this.isPlaying = false;

    // Clear scheduling interval
    if (this.scheduleInterval !== null) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
    }

    // Gate off
    if (this.gateNode) {
      const ctx = audioEngine.getContext();
      this.gateNode.offset.setValueAtTime(0, ctx.currentTime);
    }

    // Trigger gate off for all connected ADSR envelopes
    this.triggerGateOffForTargets();
    this.lastGateOnTime = -1;
  }

  /**
   * Reset to step 1
   */
  reset(): void {
    this.currentStep = 0;
    this.visualCurrentStep = 0;
  }

  /**
   * Schedule steps within lookahead window.
   * Uses getSequenceLength() so the loop respects the active length parameter.
   */
  private scheduleNextSteps(): void {
    if (!this.isPlaying) return;

    const ctx = audioEngine.getContext();
    const currentTime = ctx.currentTime;
    const stepInterval = this.getStepInterval();
    const seqLength = this.getSequenceLength();

    // Schedule all steps within lookahead window
    while (this.nextStepTime < currentTime + this.lookaheadTime) {
      const stepToSchedule = this.currentStep;
      const timeToSchedule = this.nextStepTime;

      this.scheduleStep(stepToSchedule, timeToSchedule);

      // Schedule the visual indicator update to happen at the actual step time.
      // Clamp to seqLength so the cursor does not advance past the active length.
      const delay = (timeToSchedule - currentTime) * 1000;
      if (delay > 0) {
        setTimeout(() => {
          if (this.isPlaying && stepToSchedule < seqLength) {
            this.visualCurrentStep = stepToSchedule;
          }
        }, delay);
      } else {
        if (stepToSchedule < seqLength) {
          this.visualCurrentStep = stepToSchedule;
        }
      }

      // Advance to next step, wrapping at sequence length
      this.currentStep = (this.currentStep + 1) % seqLength;
      this.nextStepTime += stepInterval;
    }
  }

  /**
   * Schedule a single step
   */
  private scheduleStep(stepIndex: number, time: number): void {
    const step = this.steps[stepIndex];

    if (!this.frequencyNode || !this.gateNode || !this.velocityNode) return;

    // If this is an inactive step, turn gate off if it was on
    if (!step || !step.active) {
      if (this.lastGateOnTime >= 0) {
        // Schedule gate off at the start of this inactive step
        this.gateNode.offset.setValueAtTime(0, time);

        // Trigger gate off for ADSR envelopes
        const delay = (time - audioEngine.getContext().currentTime) * 1000;
        if (delay > 0) {
          setTimeout(() => {
            this.triggerGateOffForTargets();
          }, delay);
        } else {
          this.triggerGateOffForTargets();
        }

        this.lastGateOnTime = -1;
      }
      return;
    }

    // Calculate final note
    let finalNote = step.note;

    // In arpeggiator mode, treat step note as transpose offset from keyboard base note
    if (this.isArpeggiatorMode() && this.arpIsKeyHeld) {
      // Decode semitone offset: stored as offset + 64 (encodeArpOffset convention)
      const transposeOffset = step.note - 64;
      finalNote = this.arpBaseNote + transposeOffset;

      // Use step velocity (keyboard velocity CV not reliably readable via GainNode)
      this.velocityNode.offset.setValueAtTime(step.velocity, time);
    } else {
      // Standalone mode: use step velocity
      this.velocityNode.offset.setValueAtTime(step.velocity, time);
    }

    // Clamp to valid MIDI range
    finalNote = Math.max(0, Math.min(127, finalNote));

    // Schedule frequency change
    const frequency = this.midiToFrequency(finalNote);
    this.frequencyNode.offset.setValueAtTime(frequency, time);

    // Schedule gate on
    this.gateNode.offset.setValueAtTime(1, time);
    this.lastGateOnTime = time;

    // Trigger connected ADSR envelopes
    this.connectedGateTargets.forEach((target) => {
      if (target.type === ComponentType.ADSR_ENVELOPE) {
        const adsrComponent = target as any;
        if (adsrComponent.triggerGateOn) {
          // Schedule trigger at the step time
          setTimeout(() => {
            adsrComponent.triggerGateOn();
          }, (time - audioEngine.getContext().currentTime) * 1000);
        }
      }
    });

    // Schedule gate off (suppressed for tied gate — gate stays high until next active step)
    const gateDuration = this.getGateDuration(step, this.getStepInterval());
    if (gateDuration !== null) {
      const gateOffTime = time + gateDuration;
      this.gateNode.offset.setValueAtTime(0, gateOffTime);

      const gateOffDelay = (gateOffTime - audioEngine.getContext().currentTime) * 1000;
      if (gateOffDelay > 0) {
        setTimeout(() => {
          this.triggerGateOffForTargets();
          this.lastGateOnTime = -1;
        }, gateOffDelay);
      }
    }
    // Tied gate: lastGateOnTime remains set; gate-off fires when the next active step triggers
  }

  /**
   * Trigger gate off for all connected ADSR targets
   */
  private triggerGateOffForTargets(): void {
    this.connectedGateTargets.forEach((target) => {
      if (target.type === ComponentType.ADSR_ENVELOPE) {
        const adsrComponent = target as any;
        if (adsrComponent.triggerGateOff) {
          adsrComponent.triggerGateOff();
        }
      }
    });
  }

  /**
   * Returns true when mode Parameter is set to Arpeggiator (1).
   * Mode is set explicitly via the UI toggle, not inferred from connections.
   */
  isArpeggiatorMode(): boolean {
    return (this.getParameter('mode')?.getValue() ?? 0) === 1;
  }

  /**
   * Returns true when a gate source is connected to the arpeggiate input.
   * The gate connection is the minimum requirement for arp triggering.
   */
  isArpeggiatorConnected(): boolean {
    return this.arpGateGetter !== null;
  }

  /**
   * Start the arpeggiator gate-polling interval.
   * Runs whenever audio nodes exist; checkArpeggiatorInputs() guards on mode and connection.
   */
  private startArpeggiatorMonitoring(): void {
    if (this.arpCheckInterval !== null) return;
    this.arpCheckInterval = window.setInterval(() => {
      this.checkArpeggiatorInputs();
    }, 10);
  }

  /**
   * Stop the arpeggiator gate-polling interval.
   */
  private stopArpeggiatorMonitoring(): void {
    if (this.arpCheckInterval !== null) {
      clearInterval(this.arpCheckInterval);
      this.arpCheckInterval = null;
    }
  }

  /**
   * Check arpeggiator CV inputs and update base note.
   * Reads .offset.value directly from the connected ConstantSourceNode because
   * GainNode.gain.value does not reflect values driven by audio-graph connections.
   */
  private checkArpeggiatorInputs(): void {
    if (!this.isArpeggiatorMode() || !this.arpGateGetter) return;

    // Read gate and frequency via JS-level getters (not Web Audio API scheduled values)
    const gateValue = this.arpGateGetter();
    const freqValue = this.arpFreqGetter?.() ?? 440;

    // Convert frequency to MIDI note
    const midiNote = this.frequencyToMidi(freqValue);

    // Detect gate rising edge (0 -> 1)
    if (gateValue > 0.5 && this.lastArpGateState <= 0.5) {
      // Gate turned on - start sequencer with this base note
      this.arpBaseNote = midiNote;
      this.arpIsKeyHeld = true;

      if (!this.isPlaying) {
        this.start();
      }
    }
    // Detect gate falling edge (1 -> 0)
    else if (gateValue <= 0.5 && this.lastArpGateState > 0.5) {
      // Gate turned off - stop and reset sequencer
      this.arpIsKeyHeld = false;

      if (this.isPlaying) {
        this.stop();
        this.reset();
      }
    }
    // While gate is held, update base note if it changes
    else if (gateValue > 0.5 && this.arpIsKeyHeld) {
      this.arpBaseNote = midiNote;
    }

    this.lastArpGateState = gateValue;
  }

  /**
   * Convert frequency to MIDI note number
   */
  private frequencyToMidi(frequency: number): number {
    if (frequency <= 0) return 60; // Default to C4
    return Math.round(69 + 12 * Math.log2(frequency / 440));
  }

  /**
   * Override deserialize to sync runtime steps after all parameter values are restored.
   * PatchSerializer restores parameters one-by-one; syncStepsFromParameters() consolidates
   * them into this.steps[] in a single pass after the loop completes.
   */
  override deserialize(data: import('../../core/types').ComponentData): void {
    super.deserialize(data);
    this.syncStepsFromParameters();
  }

  /**
   * Sync the runtime steps array from Parameter values.
   * Must be called after patch load (once all setParameterValue calls complete)
   * and is called automatically at the end of the constructor.
   */
  syncStepsFromParameters(): void {
    for (let i = 0; i < 16; i++) {
      this.steps[i] = {
        active: (this.getParameter(`step_${i}_active`)?.getValue() ?? 1) !== 0,
        note: this.getParameter(`step_${i}_note`)?.getValue() ?? 60,
        velocity: this.getParameter(`step_${i}_velocity`)?.getValue() ?? 0.8,
        gateLength: this.getParameter(`step_${i}_gateLength`)?.getValue() ?? 3,
      };
    }
  }

  /**
   * Get sequencer steps (for UI)
   */
  getSteps(): SequencerStep[] {
    return this.steps;
  }

  /**
   * Update a step and write through to the corresponding Parameters
   * so that PatchSerializer captures the live edit on next save.
   */
  updateStep(stepIndex: number, step: Partial<SequencerStep>): void {
    if (stepIndex < 0 || stepIndex >= 16) return;

    this.steps[stepIndex] = {
      ...this.steps[stepIndex]!,
      ...step,
    };

    // Write through to Parameters for serialization
    if (step.active !== undefined) {
      this.getParameter(`step_${stepIndex}_active`)?.setValue(step.active ? 1 : 0);
    }
    if (step.note !== undefined) {
      this.getParameter(`step_${stepIndex}_note`)?.setValue(step.note);
    }
    if (step.velocity !== undefined) {
      this.getParameter(`step_${stepIndex}_velocity`)?.setValue(step.velocity);
    }
    if (step.gateLength !== undefined) {
      this.getParameter(`step_${stepIndex}_gateLength`)?.setValue(step.gateLength);
    }
  }

  /**
   * Get current step (for UI)
   */
  getCurrentStep(): number {
    return this.visualCurrentStep;
  }

  /**
   * Check if playing (for UI)
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Returns the active sequence length (2–16).
   */
  getSequenceLength(): number {
    return this.getParameter('sequenceLength')?.getValue() ?? 16;
  }

  /**
   * Returns the current mode (0=Sequencer, 1=Arpeggiator).
   */
  getMode(): SequencerMode {
    return (this.getParameter('mode')?.getValue() ?? 0) as SequencerMode;
  }

  /**
   * Returns a display-state snapshot consumed by StepSequencerDisplay each frame.
   */
  getDisplayState(): StepSequencerDisplayState {
    return {
      pattern: {
        steps: this.steps as unknown as import('../../../specs/012-step-sequencer-refactor/contracts/types').SequencerStep[],
        bpm: this.getParameter('bpm')?.getValue() ?? 120,
        noteValue: (this.getParameter('noteValue')?.getValue() ?? 2) as import('../../../specs/012-step-sequencer-refactor/contracts/types').NoteDivision,
        sequenceLength: this.getSequenceLength(),
        mode: this.getMode(),
      },
      transport: {
        isPlaying: this.isPlaying,
        visualCurrentStep: this.visualCurrentStep,
      },
    };
  }
}
