/**
 * Quantizer - CV pitch quantizer component
 *
 * Accepts a continuously varying CV input and snaps it to the nearest
 * pitch in a user-selected musical scale and root key, outputting a
 * quantized CV signal at control rate.
 *
 * An optional Gate/Trigger input enables rhythmically locked pitch updates:
 * with a trigger connected, output pitch only changes on rising edges.
 *
 * CV input is sampled via an AnalyserNode so the actual audio-rate signal
 * from upstream sources (LFO, Collider, etc.) is read correctly each frame.
 * Gate input is received via a ConstantSourceNode whose offset is set by
 * the upstream gate source.
 *
 * Feature: 025-quantizer
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import type { ComponentData } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { visualUpdateScheduler } from '../../visualization/scheduler';
import type { SubscriptionHandle } from '../../visualization/types';
import {
  buildPitchTable,
  quantizeCv,
  midiToNoteLabel,
  midiToCv,
  serializeQuantizerConfig,
  deserializeQuantizerConfig,
} from '../../../specs/025-quantizer/contracts/validation';
import { MusicalScale } from '../../music/MusicalScale';
import {
  QuantizerConfig,
  DEFAULT_QUANTIZER_CONFIG,
  NOTE_ORDER,
  SCALE_TYPE_ORDER,
} from '../../../specs/025-quantizer/contracts/types';

const GATE_THRESHOLD = 0.5;
const ANALYSER_FFT_SIZE = 256; // Smallest valid FFT — we only need one sample

export class Quantizer extends SynthComponent {
  private config: QuantizerConfig;
  private pitchTable: readonly number[];

  // Runtime state (not persisted)
  private heldCv: number = 0;        // 1V/octave (used internally for pitch table lookups)
  private heldHz: number = 261.63;   // Hz (written to cvOutputNode — what oscillators expect)
  private lastGateValue: number = 0;
  private currentNoteLabel: string = 'C4';

  // Web Audio nodes
  private cvOutputNode: ConstantSourceNode | null = null;
  // AnalyserNode reads the actual audio signal from upstream CV source
  private cvAnalyserNode: AnalyserNode | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cvSampleBuffer: any = null;
  // AnalyserNode reads the actual gate signal — .offset.value on a ConstantSourceNode
  // reflects only the base value, not audio-rate signal driven in by upstream connections
  private gateAnalyserNode: AnalyserNode | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private gateSampleBuffer: any = null;

  // Visual scheduler subscription
  private subscription: SubscriptionHandle | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.QUANTIZER, 'Quantizer', position);

    this.config = { ...DEFAULT_QUANTIZER_CONFIG };
    this.pitchTable = buildPitchTable(this.config.rootNote, this.config.scaleType);

    // Parameters (numeric indices for serialization)
    this.addParameter('rootNote', 'Root', 0, 0, 11, 1, '');
    this.addParameter('scaleType', 'Scale', 0, 0, 7, 1, '');

    // Ports
    this.addInput('cv-in', 'CV In', SignalType.CV);
    this.addInput('gate-in', 'Trig', SignalType.GATE);
    this.addOutput('cv-out', 'CV Out', SignalType.CV);
  }

  // ---------------------------------------------------------------------------
  // SynthComponent abstract implementations
  // ---------------------------------------------------------------------------

  createAudioNodes(): void {
    const ctx = audioEngine.getContext();
    if (!ctx) return;

    // CV output — downstream oscillators connect to this node's offset AudioParam.
    // Value is in Hz so it drives OscillatorNode.frequency directly.
    this.cvOutputNode = ctx.createConstantSource();
    this.cvOutputNode.offset.value = this.heldHz;
    this.cvOutputNode.start();
    this.audioNodes.set('cv-out', this.cvOutputNode);
    audioEngine.addNode(`${this.id}:cv-out`, this.cvOutputNode, this.type);

    // AnalyserNode for CV input — upstream CV source connects here.
    // getFloatTimeDomainData() samples the actual audio signal each frame.
    this.cvAnalyserNode = ctx.createAnalyser();
    this.cvAnalyserNode.fftSize = ANALYSER_FFT_SIZE;
    this.cvAnalyserNode.smoothingTimeConstant = 0; // No smoothing — we want raw values
    this.cvSampleBuffer = new Float32Array(this.cvAnalyserNode.fftSize) as Float32Array;
    this.audioNodes.set('cv-in', this.cvAnalyserNode);
    audioEngine.addNode(`${this.id}:cv-in`, this.cvAnalyserNode, this.type);

    // Gate input — upstream gate source connects its output node here.
    // We use an AnalyserNode so getFloatTimeDomainData() reads the live audio-rate signal.
    this.gateAnalyserNode = ctx.createAnalyser();
    this.gateAnalyserNode.fftSize = ANALYSER_FFT_SIZE;
    this.gateAnalyserNode.smoothingTimeConstant = 0;
    this.gateSampleBuffer = new Float32Array(this.gateAnalyserNode.fftSize);
    this.audioNodes.set('gate-in', this.gateAnalyserNode);
    audioEngine.addNode(`${this.id}:gate-in`, this.gateAnalyserNode, this.type);

    // Subscribe to control-rate update loop
    this.subscription = visualUpdateScheduler.onFrame(() => {
      this.update();
    }, 'Quantizer');
  }

  destroyAudioNodes(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;

    if (this.cvOutputNode) {
      try { this.cvOutputNode.stop(); } catch (_) { /* already stopped */ }
      try { this.cvOutputNode.disconnect(); } catch (_) { /* already disconnected */ }
      this.cvOutputNode = null;
    }
    if (this.cvAnalyserNode) {
      try { this.cvAnalyserNode.disconnect(); } catch (_) { /* already disconnected */ }
      this.cvAnalyserNode = null;
    }
    if (this.gateAnalyserNode) {
      try { this.gateAnalyserNode.disconnect(); } catch (_) { /* already disconnected */ }
      this.gateAnalyserNode = null;
    }

    this.cvSampleBuffer = null;
    this.gateSampleBuffer = null;
    this.lastGateValue = 0;
    this.audioNodes.clear();
  }

  updateAudioParameter(parameterId: string, value: number): void {
    switch (parameterId) {
      case 'rootNote': {
        const note = NOTE_ORDER[value] ?? DEFAULT_QUANTIZER_CONFIG.rootNote;
        this.config = { ...this.config, rootNote: note };
        this.rebuildPitchTable();
        break;
      }
      case 'scaleType': {
        const scale = SCALE_TYPE_ORDER[value] ?? DEFAULT_QUANTIZER_CONFIG.scaleType;
        this.config = { ...this.config, scaleType: scale };
        this.rebuildPitchTable();
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Node routing
  // ---------------------------------------------------------------------------

  override getAudioParamForInput(_inputId: string): AudioParam | null {
    // Both CV and gate inputs use AnalyserNodes — no AudioParam routing
    return null;
  }

  override getInputNode(portId?: string): AudioNode | null {
    switch (portId) {
      case 'gate-in': return this.gateAnalyserNode;
      case 'cv-in':
      default: return this.cvAnalyserNode;
    }
  }

  protected override getInputNodeByPort(portId: string): AudioNode | null {
    return this.getInputNode(portId);
  }

  override getOutputNode(): AudioNode | null {
    return this.cvOutputNode;
  }

  protected override getOutputNodeByPort(_portId: string): AudioNode | null {
    return this.cvOutputNode;
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  override serialize(): ComponentData {
    const params = serializeQuantizerConfig(this.config);
    return {
      id: this.id,
      type: this.type,
      position: { ...this.position },
      parameters: {
        rootNote: params['rootNote'] ?? 0,
        scaleType: params['scaleType'] ?? 0,
      },
    };
  }

  override deserialize(data: ComponentData): void {
    this.position = { ...data.position };

    const p = data.parameters;
    const restored = deserializeQuantizerConfig({
      rootNote: p['rootNote'] ?? 0,
      scaleType: p['scaleType'] ?? 0,
    });

    this.config = restored;
    this.pitchTable = buildPitchTable(restored.rootNote, restored.scaleType);

    this.parameters.get('rootNote')?.setValue(p['rootNote'] ?? 0);
    this.parameters.get('scaleType')?.setValue(p['scaleType'] ?? 0);
  }

  // ---------------------------------------------------------------------------
  // Public accessor for note label (used by CanvasComponent for rendering)
  // ---------------------------------------------------------------------------

  getNoteLabel(): string {
    return this.currentNoteLabel;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private rebuildPitchTable(): void {
    this.pitchTable = buildPitchTable(this.config.rootNote, this.config.scaleType);
    const liveCv = this.readCvInput();
    const inputCv = liveCv !== 0 ? liveCv : this.heldCv;
    const quantizedMidi = quantizeCv(inputCv, this.pitchTable);
    this.heldCv = midiToCv(quantizedMidi);
    this.heldHz = MusicalScale.midiToHz(quantizedMidi);
    this.currentNoteLabel = midiToNoteLabel(quantizedMidi);
    if (this.cvOutputNode) {
      const ctx = audioEngine.getContext();
      if (ctx) {
        // Short ramp on user-triggered config changes to avoid a click
        const now = ctx.currentTime;
        this.cvOutputNode.offset.cancelScheduledValues(now);
        this.cvOutputNode.offset.setValueAtTime(this.cvOutputNode.offset.value, now);
        this.cvOutputNode.offset.linearRampToValueAtTime(this.heldHz, now + 0.01);
      } else {
        this.cvOutputNode.offset.value = this.heldHz;
      }
    }
  }

  private readCvInput(): number {
    if (!this.cvAnalyserNode || !this.cvSampleBuffer) return 0;
    this.cvAnalyserNode.getFloatTimeDomainData(this.cvSampleBuffer);
    return this.cvSampleBuffer[this.cvSampleBuffer.length - 1] ?? 0;
  }

  private readGateInput(): number {
    if (!this.gateAnalyserNode || !this.gateSampleBuffer) return 0;
    this.gateAnalyserNode.getFloatTimeDomainData(this.gateSampleBuffer);
    return this.gateSampleBuffer[this.gateSampleBuffer.length - 1] ?? 0;
  }

  private update(): void {
    if (!this.cvOutputNode) return;

    const inputCv = this.readCvInput();
    const gateValue = this.readGateInput();
    const risingEdge = this.lastGateValue < GATE_THRESHOLD && gateValue >= GATE_THRESHOLD;
    const triggerConnected = this.inputs.get('gate-in')?.isConnected() ?? false;

    if (!triggerConnected || risingEdge) {
      const quantizedMidi = quantizeCv(inputCv, this.pitchTable);
      const newHz = MusicalScale.midiToHz(quantizedMidi);
      if (newHz !== this.heldHz) {
        this.heldCv = midiToCv(quantizedMidi);
        this.heldHz = newHz;
        this.currentNoteLabel = midiToNoteLabel(quantizedMidi);
        this.cvOutputNode.offset.value = this.heldHz;
      }
    }

    this.lastGateValue = gateValue;
  }
}
