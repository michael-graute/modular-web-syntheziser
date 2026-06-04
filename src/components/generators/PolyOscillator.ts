import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { VoiceSlot } from '../utilities/VoiceAllocator';

type VoiceSlotsGetter = () => Readonly<VoiceSlot[]>;

const WAVEFORM_TYPES: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
const VOICE_COUNT = 4;

export class PolyOscillator extends SynthComponent {
  private oscillators: OscillatorNode[] = [];
  private voiceOutputs: GainNode[] = [];   // one per voice; gate open/close here
  private polyAudioOut: GainNode | null = null; // single summing node exposed as poly-audio port
  private voiceSlotsGetter: VoiceSlotsGetter | null = null;
  private rafHandle: number | null = null;

  // PolyVCA registers itself here when connected; ConnectionManager calls it
  // to wire the internal audio nodes directly (bypassing the Web Audio port)
  private polyAudioDisconnector: (() => void) | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.POLY_OSCILLATOR, 'Poly Osc', position);

    this.addInput('poly-cv', 'Poly CV', SignalType.POLY_CV);
    // Single bundled audio output — connects to Poly VCA poly-audio input
    this.addOutput('poly-audio', 'Poly Audio', SignalType.POLY_AUDIO);

    this.addParameter('waveform', 'Waveform', 0, 0, 3, 1, '');
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) throw new Error('AudioEngine not initialized');
    const ctx = audioEngine.getContext();

    const waveformIndex = Math.round(this.getParameter('waveform')?.getValue() ?? 0);
    const waveform = WAVEFORM_TYPES[waveformIndex] ?? 'sine';

    // Dummy summing node — exposed as the port's AudioNode so the connection
    // system has something to hold on to; actual audio flows via voiceOutputs
    this.polyAudioOut = ctx.createGain();
    this.polyAudioOut.gain.value = 1.0;

    for (let i = 0; i < VOICE_COUNT; i++) {
      const osc = ctx.createOscillator();
      osc.type = waveform;
      osc.frequency.value = 0;
      osc.start();

      const out = ctx.createGain();
      out.gain.value = 0; // silent until gate opens

      osc.connect(out);
      // Also feed the dummy summing node (so something is reachable via the port)
      out.connect(this.polyAudioOut);

      this.oscillators.push(osc);
      this.voiceOutputs.push(out);
    }

    this.registerAudioNode('poly-audio', this.polyAudioOut);
    this._startPolling();
  }

  destroyAudioNodes(): void {
    this._stopPolling();

    for (const osc of this.oscillators) {
      try { osc.stop(); } catch (_) { /* already stopped */ }
      osc.disconnect();
    }
    for (const out of this.voiceOutputs) { out.disconnect(); }
    if (this.polyAudioOut) { this.polyAudioOut.disconnect(); this.polyAudioOut = null; }

    this.oscillators = [];
    this.voiceOutputs = [];
    this.polyAudioDisconnector = null;
  }

  updateAudioParameter(parameterId: string, value: number): void {
    if (parameterId === 'waveform') {
      const waveform = WAVEFORM_TYPES[Math.round(value)] ?? 'sine';
      for (const osc of this.oscillators) osc.type = waveform;
    }
  }

  getInputNode(): AudioNode | null { return null; }
  getOutputNode(): AudioNode | null { return this.polyAudioOut; }

  protected override getOutputNodeByPort(_portId: string): AudioNode | null {
    return this.polyAudioOut;
  }

  // PolyConsumer interface
  setVoiceSlotsGetter(getter: VoiceSlotsGetter): void {
    this.voiceSlotsGetter = getter;
  }

  clearVoiceSlotsGetter(): void {
    this.voiceSlotsGetter = null;
    const ctx = audioEngine.isReady() ? audioEngine.getContext() : null;
    const now = ctx?.currentTime ?? 0;
    for (const out of this.voiceOutputs) {
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(0, now);
    }
  }

  // Called by ConnectionManager when poly-audio cable is connected to a PolyVCA.
  // The consumer immediately wires all 4 voiceOutput GainNodes into its own graph.
  registerPolyAudioConsumer(
    connect: (voiceOutputs: GainNode[]) => void,
    disconnect: () => void
  ): void {
    this.polyAudioDisconnector = disconnect;
    if (this.voiceOutputs.length === VOICE_COUNT) {
      connect(this.voiceOutputs);
    }
  }

  clearPolyAudioConsumer(): void {
    if (this.polyAudioDisconnector) this.polyAudioDisconnector();
    this.polyAudioDisconnector = null;
  }

  getVoiceOutputs(): GainNode[] { return this.voiceOutputs; }

  private _startPolling(): void {
    const poll = () => {
      if (!this.isActive) return;
      this._applySlots();
      this.rafHandle = requestAnimationFrame(poll);
    };
    this.rafHandle = requestAnimationFrame(poll);
  }

  private _stopPolling(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private _applySlots(): void {
    if (!this.voiceSlotsGetter) return;
    const slots = this.voiceSlotsGetter();
    for (let i = 0; i < VOICE_COUNT; i++) {
      const slot = slots[i];
      const osc = this.oscillators[i];
      const out = this.voiceOutputs[i];
      if (!slot || !osc || !out) continue;
      if (osc.frequency.value !== slot.frequency) osc.frequency.value = slot.frequency;
      if (out.gain.value !== slot.gate) out.gain.value = slot.gate;
    }
  }
}
