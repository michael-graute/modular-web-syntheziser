/**
 * ChordFinder - Chord exploration and CV/Gate output component
 *
 * Displays diatonic chords for a selected key, generates progressions,
 * and emits 1V/octave CV and gate signals on chord press.
 * Feature: 010-chord-finder
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { getDiatonicChords, generateProgression } from '../../music/ChordTheory';
import type {
  ChordFinderConfig,
  ChordFinderState,
  DiatonicChord,
  Note,
} from '../../../specs/010-chord-finder/contracts/types';
import { ChordScaleType } from '../../../specs/010-chord-finder/contracts/types';
import {
  serializeChordFinderConfig,
  deserializeChordFinderConfig,
  encodeProgressionBitmask,
} from '../../../specs/010-chord-finder/contracts/validation';
import type { ComponentData } from '../../core/types';
import type { ChordFinderDisplay } from '../../canvas/displays/ChordFinderDisplay';

/** Maps numeric rootNote parameter (0–11) to Note enum values */
const INDEX_TO_NOTE: readonly Note[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

/** Maps numeric scaleType parameter to ChordScaleType */
const INDEX_TO_SCALE_TYPE: Record<number, ChordScaleType> = {
  0: ChordScaleType.MAJOR,
  1: ChordScaleType.NATURAL_MINOR,
};

/**
 * ChordFinder component
 *
 * Parameters (all stored as numbers for serialization compatibility):
 * - rootNote: 0–11 (C=0 … B=11)
 * - scaleType: 0=MAJOR, 1=NATURAL_MINOR
 * - octave: 2–6 (default 4)
 * - progression: 7-bit bitmask (0 = no active progression)
 */
export class ChordFinder extends SynthComponent {
  // Runtime state
  private config: ChordFinderConfig;
  private diatonicChords: DiatonicChord[] = [];
  private pressedDegree: number | null = null;

  // Audio nodes
  private note1Output: ConstantSourceNode | null = null;
  private note2Output: ConstantSourceNode | null = null;
  private note3Output: ConstantSourceNode | null = null;
  private gateOutput: ConstantSourceNode | null = null;

  // Gate targets (ADSR envelopes registered for triggering)
  private gateTargets: Set<SynthComponent> = new Set();

  // Visual update subscription

  // Canvas display reference (set by CanvasComponent in T020)
  chordFinderDisplay: ChordFinderDisplay | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.CHORD_FINDER, 'Chord Finder', position);

    // Default config: C Major, octave 4, no progression
    this.config = {
      rootNote: 'C',
      scaleType: ChordScaleType.MAJOR,
      octave: 4,
      progression: [],
    };

    // Register parameters (numeric, for patch serialization)
    this.addParameter('rootNote', 'Root', 0, 0, 11, 1, '');
    this.addParameter('scaleType', 'Scale', 0, 0, 1, 1, '');
    this.addParameter('octave', 'Oct', 4, 2, 6, 1, '');
    this.addParameter('progression', 'Prog', 0, 0, 127, 1, '');

    // Register output ports (T029)
    this.addOutput('note1', 'Note 1', SignalType.CV);
    this.addOutput('note2', 'Note 2', SignalType.CV);
    this.addOutput('note3', 'Note 3', SignalType.CV);
    this.addOutput('gate', 'Gate', SignalType.GATE);

    // Initialise diatonic chords for default key
    this.diatonicChords = getDiatonicChords(this.config.rootNote, this.config.scaleType);
  }

  // ---------------------------------------------------------------------------
  // SynthComponent abstract method implementations
  // ---------------------------------------------------------------------------

  createAudioNodes(): void {
    const ctx = audioEngine.getContext();
    if (!ctx) return;

    this.note1Output = ctx.createConstantSource();
    this.note2Output = ctx.createConstantSource();
    this.note3Output = ctx.createConstantSource();
    this.gateOutput = ctx.createConstantSource();

    this.note1Output.offset.value = 0;
    this.note2Output.offset.value = 0;
    this.note3Output.offset.value = 0;
    this.gateOutput.offset.value = 0;

    this.note1Output.start();
    this.note2Output.start();
    this.note3Output.start();
    this.gateOutput.start();

    this.audioNodes.set('note1', this.note1Output);
    this.audioNodes.set('note2', this.note2Output);
    this.audioNodes.set('note3', this.note3Output);
    this.audioNodes.set('gate', this.gateOutput);

    // Register with audio engine for routing
    audioEngine.addNode(`${this.id}:note1`, this.note1Output, this.type);
    audioEngine.addNode(`${this.id}:note2`, this.note2Output, this.type);
    audioEngine.addNode(`${this.id}:note3`, this.note3Output, this.type);
    audioEngine.addNode(`${this.id}:gate`, this.gateOutput, this.type);

    // No per-frame subscription needed — the chord circle is drawn by
    // CanvasComponent.render() in the main canvas render loop.
  }

  destroyAudioNodes(): void {
    // Unsubscribe from visual updates (T021, T045)
    // Stop and disconnect audio nodes
    const stop = (node: ConstantSourceNode | null) => {
      if (node) {
        try { node.stop(); } catch (_) { /* already stopped */ }
        try { node.disconnect(); } catch (_) { /* already disconnected */ }
      }
    };

    stop(this.note1Output);
    stop(this.note2Output);
    stop(this.note3Output);
    stop(this.gateOutput);

    this.note1Output = null;
    this.note2Output = null;
    this.note3Output = null;
    this.gateOutput = null;

    this.gateTargets.clear();
    this.audioNodes.clear();
  }

  updateAudioParameter(parameterId: string, value: number): void {
    switch (parameterId) {
      case 'rootNote':
      case 'scaleType': {
        const rootNote = INDEX_TO_NOTE[this.getParameterValue('rootNote')] ?? 'C';
        const scaleType = INDEX_TO_SCALE_TYPE[this.getParameterValue('scaleType')] ?? ChordScaleType.MAJOR;
        this.selectKey(rootNote, scaleType);
        break;
      }
      case 'octave':
        this.setOctave(value);
        break;
      case 'progression':
        // Progression is updated via generateProgression(), not directly
        break;
    }
  }

  getInputNode(_portId?: string): AudioNode | null {
    return null;
  }

  getOutputNode(): AudioNode | null {
    return this.note1Output;
  }

  protected override getOutputNodeByPort(portId: string): AudioNode | null {
    switch (portId) {
      case 'note1': return this.note1Output;
      case 'note2': return this.note2Output;
      case 'note3': return this.note3Output;
      case 'gate': return this.gateOutput;
      default: return this.note1Output;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Select a new key. Clears the active progression (FR-011).
   */
  selectKey(rootNote: Note, scaleType: ChordScaleType): void {
    this.config.rootNote = rootNote;
    this.config.scaleType = scaleType;
    this.config.progression = [];
    this.diatonicChords = getDiatonicChords(rootNote, scaleType);

    // Sync parameters
    const noteIndex = INDEX_TO_NOTE.indexOf(rootNote);
    const scaleIndex = scaleType === ChordScaleType.MAJOR ? 0 : 1;
    this.parameters.get('rootNote')?.setValue(noteIndex >= 0 ? noteIndex : 0);
    this.parameters.get('scaleType')?.setValue(scaleIndex);
    this.parameters.get('progression')?.setValue(0);
  }

  /**
   * Set the CV output octave (2–6).
   */
  setOctave(octave: number): void {
    const clamped = Math.max(2, Math.min(6, Math.round(octave)));
    this.config.octave = clamped;
    this.parameters.get('octave')?.setValue(clamped);

    // If a chord is currently pressed, update CV immediately
    if (this.pressedDegree !== null) {
      this.pressChord(this.pressedDegree);
    }
  }

  /**
   * Generate a new chord progression for the current key.
   */
  generateProgression(): void {
    if (this.diatonicChords.length === 0) {
      console.warn('[ChordFinder] generateProgression called with no key selected');
      return;
    }

    const degrees = generateProgression(this.diatonicChords);
    this.config.progression = degrees;

    const bitmask = encodeProgressionBitmask(degrees);
    this.parameters.get('progression')?.setValue(bitmask);
  }

  /**
   * Press a chord: emit CV for triad notes and open gate.
   */
  pressChord(scaleDegree: number): void {
    if (this.diatonicChords.length === 0) return;

    const chord = this.diatonicChords[scaleDegree];
    if (!chord) return;

    const octaveOffset = this.config.octave - 4;
    const ctx = audioEngine.getContext();
    const t = ctx?.currentTime ?? 0;

    if (this.note1Output) this.note1Output.offset.setValueAtTime(chord.cvVoltages[0] + octaveOffset, t);
    if (this.note2Output) this.note2Output.offset.setValueAtTime(chord.cvVoltages[1] + octaveOffset, t);
    if (this.note3Output) this.note3Output.offset.setValueAtTime(chord.cvVoltages[2] + octaveOffset, t);
    if (this.gateOutput) this.gateOutput.offset.setValueAtTime(1.0, t);

    this.pressedDegree = scaleDegree;

    // Trigger all registered gate targets
    this.gateTargets.forEach((target) => {
      const method = (target as unknown as Record<string, unknown>)['triggerGateOn'];
      if (typeof method === 'function') {
        (method as () => void).call(target);
      }
    });
  }

  /**
   * Release the currently pressed chord.
   */
  releaseChord(): void {
    const ctx = audioEngine.getContext();
    const t = ctx?.currentTime ?? 0;

    if (this.gateOutput) this.gateOutput.offset.setValueAtTime(0.0, t);
    this.pressedDegree = null;

    this.gateTargets.forEach((target) => {
      const method = (target as unknown as Record<string, unknown>)['triggerGateOff'];
      if (typeof method === 'function') {
        (method as () => void).call(target);
      }
    });
  }

  /**
   * Register a gate target (ADSR envelope).
   */
  registerGateTarget(target: SynthComponent): void {
    this.gateTargets.add(target);
  }

  /**
   * Unregister a gate target.
   */
  unregisterGateTarget(target: SynthComponent): void {
    this.gateTargets.delete(target);
  }

  /**
   * Get a snapshot of current runtime state.
   */
  getState(): ChordFinderState {
    return {
      config: { ...this.config, progression: [...this.config.progression] },
      diatonicChords: [...this.diatonicChords],
      pressedDegree: this.pressedDegree,
    };
  }

  /**
   * Return all 7 diatonic chords for the current key (empty if no key selected).
   */
  getDiatonicChords(): DiatonicChord[] {
    return [...this.diatonicChords];
  }

  // ---------------------------------------------------------------------------
  // Serialization (T037, T038)
  // ---------------------------------------------------------------------------

  override serialize(): ComponentData {
    const params = serializeChordFinderConfig(this.config);
    return {
      id: this.id,
      type: this.type,
      position: { ...this.position },
      parameters: {
        rootNote: params.rootNote,
        scaleType: params.scaleType,
        octave: params.octave,
        progression: params.progression,
      },
    };
  }

  override deserialize(data: ComponentData): void {
    this.position = { ...data.position };

    const p = data.parameters;
    const restoredConfig = deserializeChordFinderConfig({
      rootNote: p['rootNote'] ?? 0,
      scaleType: p['scaleType'] ?? 0,
      octave: p['octave'] ?? 4,
      progression: p['progression'] ?? 0,
    });

    this.config = restoredConfig;
    this.diatonicChords = getDiatonicChords(restoredConfig.rootNote, restoredConfig.scaleType);

    // Sync numeric parameters
    this.parameters.get('rootNote')?.setValue(p['rootNote'] ?? 0);
    this.parameters.get('scaleType')?.setValue(p['scaleType'] ?? 0);
    this.parameters.get('octave')?.setValue(p['octave'] ?? 4);
    this.parameters.get('progression')?.setValue(p['progression'] ?? 0);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private getParameterValue(id: string): number {
    return this.parameters.get(id)?.getValue() ?? 0;
  }
}
