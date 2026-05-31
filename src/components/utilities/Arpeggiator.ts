import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType, EventType } from '../../core/types';
import type { GlobalBpmChangedPayload } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { globalBpmController } from '../../core/GlobalBpmController';
import { eventBus } from '../../core/EventBus';
import { timingCalculator } from '../../timing/TimingCalculator';
import {
  ArpParameterId,
  ArpPortId,
  ArpDirection,
  SUBDIVISION_FRACTIONS,
  GATE_LENGTH_FRACTIONS,
  ARP_MAX_NOTES,
  CV_OCTAVE,
} from '../../../specs/029-arpeggiator/contracts/types';

export class Arpeggiator extends SynthComponent {
  // Components connected to gate-out that require JS-level triggering (e.g. ADSR)
  private connectedGateTargets: Set<SynthComponent> = new Set();

  // Audio nodes
  private cvOutputNode: ConstantSourceNode | null = null;
  private gateOutputNode: ConstantSourceNode | null = null;
  private cvInputNode: GainNode | null = null;
  private gateInputNode: GainNode | null = null;

  // Step state
  private noteSequence: number[] = [];
  private _stepCycle: number[] = [];
  private stepIndex: number = 0;
  private _prevGateHigh: boolean = false;
  private _lastLatchedCv: number | null = null; // CV value latched at last gate-high

  // Scheduling
  private _stepTimer: number | null = null;
  private currentBpm: number = 120;

  // JS-level getters registered by ConnectionManager
  private _cvGetter: (() => number) | null = null;
  private _gateGetter: (() => number) | null = null;

  // BPM subscription cleanup
  private _globalBpmUnsubscribe: (() => void) | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.ARPEGGIATOR, 'Arpeggiator', position);

    this.addInput(ArpPortId.CV_IN, 'CV In', SignalType.CV);
    this.addInput(ArpPortId.GATE_IN, 'Gate In', SignalType.GATE);
    this.addOutput(ArpPortId.CV_OUT, 'CV Out', SignalType.CV);
    this.addOutput(ArpPortId.GATE_OUT, 'Gate Out', SignalType.GATE);

    this.addParameter(ArpParameterId.DIRECTION, 'Direction', ArpDirection.Up, 0, 3, 1, '');
    this.addParameter(ArpParameterId.OCTAVES, 'Octaves', 1, 1, 4, 1, '');
    this.addParameter(ArpParameterId.SUBDIVISION, 'Rate', 2, 0, 3, 1, ''); // default 1/16
    this.addParameter(ArpParameterId.GATE_LENGTH, 'Gate', 1, 0, 2, 1, ''); // default medium
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    this.cvInputNode = ctx.createGain();
    this.cvInputNode.gain.value = 1.0;

    this.gateInputNode = ctx.createGain();
    this.gateInputNode.gain.value = 1.0;

    this.cvOutputNode = ctx.createConstantSource();
    this.cvOutputNode.offset.value = 0.0;
    this.cvOutputNode.start();

    this.gateOutputNode = ctx.createConstantSource();
    this.gateOutputNode.offset.value = 0.0;
    this.gateOutputNode.start();

    this.registerAudioNode('cvInputNode', this.cvInputNode);
    this.registerAudioNode('gateInputNode', this.gateInputNode);
    this.registerAudioNode('cvOutputNode', this.cvOutputNode);
    this.registerAudioNode('gateOutputNode', this.gateOutputNode);

    this.currentBpm = globalBpmController.getBpm();

    this._globalBpmUnsubscribe = eventBus.on(
      EventType.GLOBAL_BPM_CHANGED,
      (payload: unknown) => {
        this.currentBpm = (payload as GlobalBpmChangedPayload).bpm;
        this.startClock();
      }
    );

    this.startClock();
  }

  destroyAudioNodes(): void {
    this.stopClock();

    this._globalBpmUnsubscribe?.();
    this._globalBpmUnsubscribe = null;

    if (this.gateOutputNode) { this.gateOutputNode.stop(); this.gateOutputNode.disconnect(); this.gateOutputNode = null; }
    if (this.cvOutputNode) { this.cvOutputNode.stop(); this.cvOutputNode.disconnect(); this.cvOutputNode = null; }
    if (this.gateInputNode) { this.gateInputNode.disconnect(); this.gateInputNode = null; }
    if (this.cvInputNode) { this.cvInputNode.disconnect(); this.cvInputNode = null; }

    this.noteSequence = [];
    this._stepCycle = [];
    this.stepIndex = 0;
    this._prevGateHigh = false;
    this.connectedGateTargets.clear();
  }

  updateAudioParameter(parameterId: string, _value: number): void {
    if (
      parameterId === ArpParameterId.DIRECTION ||
      parameterId === ArpParameterId.OCTAVES
    ) {
      this.rebuildStepCycle();
    } else if (parameterId === ArpParameterId.SUBDIVISION) {
      this.rebuildStepCycle();
      this.startClock(); // restart timer with new interval
    }
    // gateLength applied on next tick — no rebuild needed
  }

  // ── Input / output routing ──────────────────────────────────────────────────

  getInputNode(portId?: string): AudioNode | null {
    if (portId === ArpPortId.GATE_IN) return this.gateInputNode;
    return this.cvInputNode;
  }

  protected override getInputNodeByPort(portId: string): AudioNode | null {
    return this.getInputNode(portId);
  }

  getOutputNode(): AudioNode | null {
    return this.cvOutputNode;
  }

  protected override getOutputNodeByPort(portId: string): AudioNode | null {
    if (portId === ArpPortId.GATE_OUT) return this.gateOutputNode;
    return this.cvOutputNode;
  }

  // ── ADSR gate target registration ───────────────────────────────────────────

  registerGateTarget(target: SynthComponent): void {
    this.connectedGateTargets.add(target);
  }

  unregisterGateTarget(target: SynthComponent): void {
    this.connectedGateTargets.delete(target);
  }

  override disconnectFrom(target: SynthComponent, outputId?: string, inputId?: string): void {
    super.disconnectFrom(target, outputId, inputId);
    if (outputId === ArpPortId.GATE_OUT) {
      this.connectedGateTargets.delete(target);
    }
  }

  // ── JS-level getter registration (called by ConnectionManager) ──────────────

  setCvGetter(fn: () => number): void {
    this._cvGetter = fn;
  }

  setGateGetter(fn: () => number): void {
    this._gateGetter = fn;
    this._prevGateHigh = false;
    this._lastLatchedCv = null;
  }

  clearCvGetter(_portId?: string): void {
    this._cvGetter = null;
  }

  clearGateGetter(_portId?: string): void {
    this._gateGetter = null;
    this._prevGateHigh = false;
    this._lastLatchedCv = null;
  }

  // ── Port lifecycle ──────────────────────────────────────────────────────────

  override onInputConnected(_portId: string): void {
    // getters registered by ConnectionManager after this call — no-op
  }

  override onInputDisconnected(portId: string): void {
    if (portId === ArpPortId.CV_IN) {
      this.clearCvGetter();
    } else if (portId === ArpPortId.GATE_IN) {
      this.clearGateGetter();
      // Silence output immediately
      if (this.gateOutputNode && audioEngine.isReady()) {
        const ctx = audioEngine.getContext();
        this.gateOutputNode.offset.setValueAtTime(0, ctx.currentTime);
      }
      this.noteSequence = [];
      this.rebuildStepCycle();
    }
  }

  // ── Step cycle ──────────────────────────────────────────────────────────────

  private buildStepCycle(): number[] {
    if (this.noteSequence.length === 0) return [];

    const octaves = this.getParameter(ArpParameterId.OCTAVES)?.getValue() ?? 1;
    const direction = this.getParameter(ArpParameterId.DIRECTION)?.getValue() ?? ArpDirection.Up;

    const baseNotes = [...this.noteSequence].sort((a, b) => a - b);

    const expanded: number[] = [];
    for (let oct = 0; oct < octaves; oct++) {
      for (const note of baseNotes) {
        expanded.push(note + oct * CV_OCTAVE);
      }
    }

    switch (direction) {
      case ArpDirection.Up:
        return expanded;
      case ArpDirection.Down:
        return [...expanded].reverse();
      case ArpDirection.UpDown:
        if (expanded.length <= 1) return expanded;
        return [...expanded, ...expanded.slice(1, -1).reverse()];
      case ArpDirection.Random:
        return [...expanded].sort(() => Math.random() - 0.5);
      default:
        return expanded;
    }
  }

  private rebuildStepCycle(): void {
    this._stepCycle = this.buildStepCycle();
    if (this._stepCycle.length > 0) {
      this.stepIndex = Math.min(this.stepIndex, this._stepCycle.length - 1);
    } else {
      this.stepIndex = 0;
    }
  }

  // ── Clock ───────────────────────────────────────────────────────────────────

  private stepIntervalMs(): number {
    const subdivisionParam = this.getParameter(ArpParameterId.SUBDIVISION)?.getValue() ?? 2;
    const subdivision = Math.round(subdivisionParam) as keyof typeof SUBDIVISION_FRACTIONS;
    const fraction = SUBDIVISION_FRACTIONS[subdivision] ?? 0.25;
    return timingCalculator.calculateGateDuration(this.currentBpm, fraction);
  }

  private startClock(): void {
    this.stopClock();
    const intervalMs = this.stepIntervalMs();
    this._stepTimer = window.setInterval(() => this.tick(), intervalMs);
  }

  private stopClock(): void {
    if (this._stepTimer !== null) {
      clearInterval(this._stepTimer);
      this._stepTimer = null;
    }
  }

  // ── Tick ────────────────────────────────────────────────────────────────────

  private tick(): void {
    // Process gate edge from input
    if (this._gateGetter !== null) {
      const gateValue = this._gateGetter();
      const gateHigh = gateValue >= 0.5;

      const cv = this._cvGetter?.() ?? 0;

      if (gateHigh && !this._prevGateHigh) {
        // Gate-high edge: latch current CV pitch
        this._lastLatchedCv = cv;
        if (this.noteSequence.length >= ARP_MAX_NOTES) {
          this.noteSequence.shift(); // evict oldest
        }
        this.noteSequence.push(cv);
        this.rebuildStepCycle();
      } else if (gateHigh && this._prevGateHigh && cv !== this._lastLatchedCv) {
        // CV changed while gate is held (legato key change): latch new pitch
        this._lastLatchedCv = cv;
        if (!this.noteSequence.includes(cv)) {
          if (this.noteSequence.length >= ARP_MAX_NOTES) {
            this.noteSequence.shift();
          }
          this.noteSequence.push(cv);
          this.rebuildStepCycle();
        }
      } else if (!gateHigh && this._prevGateHigh) {
        // Gate-low edge: clear the whole sequence (all keys released)
        this.noteSequence = [];
        this._lastLatchedCv = null;
        this.rebuildStepCycle();
      }

      this._prevGateHigh = gateHigh;
    }

    // Emit step
    if (this._stepCycle.length === 0 || !this.cvOutputNode || !this.gateOutputNode || !audioEngine.isReady()) {
      if (this.gateOutputNode && audioEngine.isReady()) {
        const ctx = audioEngine.getContext();
        this.gateOutputNode.offset.setValueAtTime(0, ctx.currentTime);
      }
      return;
    }

    this.stepIndex = (this.stepIndex + 1) % this._stepCycle.length;

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    const gateLengthParam = this.getParameter(ArpParameterId.GATE_LENGTH)?.getValue() ?? 1;
    const gateLengthKey = Math.round(gateLengthParam) as keyof typeof GATE_LENGTH_FRACTIONS;
    const gateFraction = GATE_LENGTH_FRACTIONS[gateLengthKey] ?? 0.5;
    const gateDurationS = (this.stepIntervalMs() * gateFraction) / 1000;

    this.cvOutputNode.offset.setValueAtTime(this._stepCycle[this.stepIndex] ?? 0, now);
    this.gateOutputNode.offset.setValueAtTime(1, now);
    this.gateOutputNode.offset.setValueAtTime(0, now + gateDurationS);

    // Trigger JS-level gate targets (e.g. ADSR envelopes)
    this.connectedGateTargets.forEach((target) => {
      const t = target as any;
      if (t.triggerGateOn) t.triggerGateOn();
      if (t.triggerGateOff) {
        setTimeout(() => t.triggerGateOff(), gateDurationS * 1000);
      }
    });
  }
}
