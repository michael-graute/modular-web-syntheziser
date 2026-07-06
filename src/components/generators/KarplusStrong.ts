/**
 * KarplusStrong — algorithmic plucked-string / percussive synthesizer.
 *
 * Implements the classic Karplus-Strong delay-line-with-feedback-filter
 * algorithm via a custom AudioWorkletNode (this codebase's first use of
 * AudioWorklet). Triggered by a gate/trigger input (re-excites the string),
 * tracks pitch via 1V/octave-style CV, and exposes Damping, Tone, and Mode
 * controls.
 *
 * Feature: 034-karplus-strong-oscillator
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType, KarplusStrongMode } from '../../core/types';
import type { ComponentData } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { KARPLUS_STRONG } from '../../utils/constants';
import { normalizeMode, clampDamping, clampTone } from '../../worklets/karplus-strong-dsp';

export class KarplusStrong extends SynthComponent {
  private workletNode: AudioWorkletNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private outputGain: GainNode | null = null;
  private isModuleReady = false;
  private pendingPluck = false;

  constructor(id: string, position: Position) {
    super(id, ComponentType.KARPLUS_STRONG, 'Karplus-Strong', position);

    this.addInput('trigger', 'Trigger', SignalType.GATE);
    this.addInput('pitch', 'Pitch CV', SignalType.CV);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    // Knob range starts at 0 (not KARPLUS_STRONG.MIN_FREQUENCY) so it can
    // reach true "no offset" when Pitch CV is connected — matching
    // Oscillator's frequency knob, which also ranges down to 0 for this
    // exact reason (CV becomes the sole driver; the knob is an offset/
    // transpose on top of it). The 40Hz musical floor is still enforced
    // separately at the DSP level (frequencyToDelayLineLength -> clampFrequency).
    this.addParameter(
      'frequency',
      'Frequency',
      KARPLUS_STRONG.DEFAULT_FREQUENCY,
      0,
      KARPLUS_STRONG.MAX_FREQUENCY,
      1,
      'Hz'
    );
    this.addParameter('damping', 'Damping', KARPLUS_STRONG.DEFAULT_DAMPING, 0, 1, 0.01, '');
    this.addParameter('tone', 'Tone', KARPLUS_STRONG.DEFAULT_TONE, 0, 1, 0.01, '');
    // Mode: 0 = String, 1 = Stretched, 2 = Muted, 3 = Metallic
    this.addParameter('mode', 'Mode', KarplusStrongMode.STRING, 0, 3, 1, '');
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    // Output gain exists immediately so getOutputNode()/connections work even
    // before the async worklet module resolves; it stays silent until then.
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1.0;
    this.registerAudioNode('outputGain', this.outputGain);

    void this.loadWorkletModule(ctx);
  }

  private async loadWorkletModule(ctx: AudioContext): Promise<void> {
    try {
      // In dev, Vite's dev server transpiles any .ts file on request, so the
      // raw source URL works directly. In a production build, AudioWorklet
      // files must be their own genuine Rollup build entry (see
      // vite.config.ts) — a plain new URL(..., import.meta.url) to the raw
      // .ts source only gets Vite's generic static-asset-copy treatment
      // (untranspiled, imports unresolved), since Vite's special bundling
      // for new URL() only applies to new Worker()/SharedWorker(), not
      // AudioWorklet. The built file's stable filename (no content hash) is
      // configured in vite.config.ts's rollupOptions.output.entryFileNames.
      const workletUrl = import.meta.env.DEV
        ? new URL('../../worklets/karplus-strong.worklet.ts', import.meta.url)
        : /* @vite-ignore */ new URL('../../../assets/karplus-strong.worklet.js', import.meta.url);
      await ctx.audioWorklet.addModule(workletUrl);

      this.workletNode = new AudioWorkletNode(ctx, 'karplus-strong');
      this.analyserNode = ctx.createAnalyser();
      this.analyserNode.fftSize = 1024;

      this.workletNode.connect(this.analyserNode);
      if (this.outputGain) {
        this.workletNode.connect(this.outputGain);
      }

      const frequencyParam = this.getParameter('frequency');
      const dampingParam = this.getParameter('damping');
      const workletFrequency = this.workletNode.parameters.get('frequency');
      const workletDamping = this.workletNode.parameters.get('damping');

      if (workletFrequency) {
        workletFrequency.value = frequencyParam?.getValue() ?? KARPLUS_STRONG.DEFAULT_FREQUENCY;
        frequencyParam?.linkAudioParam(workletFrequency);
      }
      if (workletDamping) {
        workletDamping.value = dampingParam?.getValue() ?? KARPLUS_STRONG.DEFAULT_DAMPING;
        dampingParam?.linkAudioParam(workletDamping);
      }

      this.sendTone(this.getParameter('tone')?.getValue() ?? KARPLUS_STRONG.DEFAULT_TONE);
      this.sendMode(normalizeMode(this.getParameter('mode')?.getValue()));

      this.registerAudioNode('worklet', this.workletNode);
      this.registerAudioNode('analyser', this.analyserNode);

      this.isModuleReady = true;

      if (this.pendingPluck) {
        this.pendingPluck = false;
        this.firePluck();
      }
    } catch (error) {
      console.error(`KarplusStrong ${this.id} failed to load AudioWorklet module:`, error);
    }
  }

  destroyAudioNodes(): void {
    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch (_) {
        /* already disconnected */
      }
      this.workletNode = null;
    }
    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch (_) {
        /* already disconnected */
      }
      this.analyserNode = null;
    }
    if (this.outputGain) {
      try {
        this.outputGain.disconnect();
      } catch (_) {
        /* already disconnected */
      }
      this.outputGain = null;
    }
    this.isModuleReady = false;
    this.pendingPluck = false;
  }

  updateAudioParameter(parameterId: string, value: number): void {
    if (!this.workletNode) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    switch (parameterId) {
      case 'frequency':
        this.workletNode.parameters.get('frequency')?.setValueAtTime(value, now);
        break;
      case 'damping':
        this.workletNode.parameters.get('damping')?.setValueAtTime(value, now);
        break;
      case 'tone':
        this.sendTone(value);
        break;
      case 'mode':
        this.sendMode(normalizeMode(value));
        break;
    }
  }

  private sendTone(value: number): void {
    this.workletNode?.port.postMessage({ type: 'setTone', value: clampTone(value) });
  }

  private sendMode(mode: KarplusStrongMode): void {
    this.workletNode?.port.postMessage({ type: 'setMode', mode });
  }

  /**
   * Re-excites the string. Named to match the codebase's established
   * gate-trigger convention (ADSREnvelope.triggerGateOn) so existing gate
   * sources (Collider, Arpeggiator, ChordFinder) that duck-type-dispatch to
   * any registered target exposing this method work without modification.
   */
  triggerGateOn(): void {
    if (this.isModuleReady) {
      this.firePluck();
    } else {
      this.pendingPluck = true;
    }
  }

  /**
   * No-op: a pluck is a one-shot excitation with no separate release phase.
   * Present so gate sources that call both triggerGateOn/triggerGateOff
   * unconditionally (duck-typed dispatch) don't need special-casing.
   */
  triggerGateOff(): void {
    // Intentionally empty.
  }

  private firePluck(): void {
    this.workletNode?.port.postMessage({ type: 'pluck' });
  }

  getInputNode(): AudioNode | null {
    // No audio input — trigger and pitch are CV/Gate only.
    return null;
  }

  getOutputNode(): AudioNode | null {
    return this.outputGain;
  }

  /** Live waveform data for KarplusStrongDisplay. */
  getWaveformData(dataArray: Float32Array): void {
    // @ts-ignore - Web Audio API type mismatch in some TS lib versions
    this.analyserNode?.getFloatTimeDomainData(dataArray);
  }

  getAnalyserFftSize(): number {
    return this.analyserNode?.fftSize ?? 1024;
  }

  override getAudioParamForInput(inputId: string): AudioParam | null {
    if (inputId === 'pitch') {
      return this.workletNode?.parameters.get('frequency') ?? null;
    }
    return null;
  }

  override getParameterRangeForInput(portId: string): { min: number; max: number } | null {
    if (portId === 'pitch') {
      return { min: KARPLUS_STRONG.MIN_FREQUENCY, max: KARPLUS_STRONG.MAX_FREQUENCY };
    }
    return null;
  }

  /**
   * When a CV source connects to the pitch input, zero the base frequency so
   * the CV signal is the sole driver (matches Oscillator's frequency-CV
   * behavior at the AudioParam level). Unlike Oscillator, the Frequency
   * KNOB itself is also visually snapped to 0, so the UI honestly reflects
   * that the knob is contributing no offset — avoiding the confusing "note
   * pitch jumps around depending on knob position" experience of a knob
   * that silently keeps its old displayed value while actually acting as a
   * hidden transpose offset. Turning the knob afterward (while CV is still
   * connected) intentionally dials in a deliberate transpose offset on top
   * of the CV note, and that value is kept as-is on disconnect (see
   * onInputDisconnected) rather than reverted to whatever it was before CV
   * connected.
   */
  override onInputConnected(portId: string): void {
    if (portId === 'pitch' && this.workletNode) {
      const ctx = audioEngine.getContext();
      this.workletNode.parameters.get('frequency')?.setValueAtTime(0, ctx.currentTime);
      this.getParameter('frequency')?.setValue(0);
    }
  }

  /**
   * When the pitch CV connection is removed, sync the AudioParam to
   * whatever the Frequency knob currently shows — the knob's value is
   * authoritative at all times; disconnecting just means the AudioParam
   * needs to stop being additively driven by an external CV signal on top
   * of it.
   */
  override onInputDisconnected(portId: string): void {
    if (portId === 'pitch' && this.workletNode) {
      const ctx = audioEngine.getContext();
      const base = this.getParameter('frequency')?.getValue() ?? KARPLUS_STRONG.DEFAULT_FREQUENCY;
      this.workletNode.parameters.get('frequency')?.setValueAtTime(base, ctx.currentTime);
    }
  }

  override serialize(): ComponentData {
    return {
      id: this.id,
      type: this.type,
      position: { ...this.position },
      parameters: {
        frequency: this.getParameter('frequency')?.getValue() ?? KARPLUS_STRONG.DEFAULT_FREQUENCY,
        damping: this.getParameter('damping')?.getValue() ?? KARPLUS_STRONG.DEFAULT_DAMPING,
        tone: this.getParameter('tone')?.getValue() ?? KARPLUS_STRONG.DEFAULT_TONE,
        mode: this.getParameter('mode')?.getValue() ?? KarplusStrongMode.STRING,
      },
    };
  }

  override deserialize(data: ComponentData): void {
    this.position = { ...data.position };
    // Frequency is clamped to the KNOB's own range (0-MAX_FREQUENCY) here, via
    // setParameterValue -> Parameter.setValue, NOT via the stricter DSP-level
    // clampFrequency (40-MAX_FREQUENCY) — a persisted value of 0 is legitimate
    // (pure-CV-offset mode when Pitch CV is connected); the 40Hz musical floor
    // is enforced separately, only at the point of actual synthesis.
    const rawFrequency = data.parameters['frequency'] ?? KARPLUS_STRONG.DEFAULT_FREQUENCY;
    const frequency = Number.isNaN(rawFrequency) ? KARPLUS_STRONG.DEFAULT_FREQUENCY : rawFrequency;
    const damping = clampDamping(data.parameters['damping'] ?? KARPLUS_STRONG.DEFAULT_DAMPING);
    const tone = clampTone(data.parameters['tone'] ?? KARPLUS_STRONG.DEFAULT_TONE);
    const mode = normalizeMode(data.parameters['mode']);

    this.setParameterValue('frequency', frequency);
    this.setParameterValue('damping', damping);
    this.setParameterValue('tone', tone);
    this.setParameterValue('mode', mode);
  }
}
