import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { VoiceSlot } from '../utilities/VoiceAllocator';

type VoiceSlotsGetter = () => Readonly<VoiceSlot[]>;

const WAVEFORM_TYPES: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
const VOICE_COUNT = 4;

export class PolyOscillator extends SynthComponent {
  private oscillators: OscillatorNode[] = [];
  // One output GainNode per voice — PolyVCA connects to each individually (FR-007)
  private voiceOutputs: GainNode[] = [];
  private voiceSlotsGetter: VoiceSlotsGetter | null = null;
  private rafHandle: number | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.POLY_OSCILLATOR, 'Poly Osc', position);

    this.addInput('poly-cv', 'Poly CV', SignalType.POLY_CV);
    // Four individual audio outputs — one per voice (connect each to PolyVCA audio-N)
    for (let i = 0; i < VOICE_COUNT; i++) {
      this.addOutput(`voice-${i}`, `Voice ${i}`, SignalType.AUDIO);
    }

    // waveform: 0=sine, 1=square, 2=sawtooth, 3=triangle (FR-008: shared across all voices)
    this.addParameter('waveform', 'Waveform', 0, 0, 3, 1, '');
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) throw new Error('AudioEngine not initialized');
    const ctx = audioEngine.getContext();

    const waveformIndex = Math.round(this.getParameter('waveform')?.getValue() ?? 0);
    const waveform = WAVEFORM_TYPES[waveformIndex] ?? 'sine';

    for (let i = 0; i < VOICE_COUNT; i++) {
      const osc = ctx.createOscillator();
      osc.type = waveform;
      osc.frequency.value = 0;
      osc.start();

      // Each voice has its own output GainNode — starts silent (gate=0)
      const out = ctx.createGain();
      out.gain.value = 0;

      osc.connect(out);

      this.oscillators.push(osc);
      this.voiceOutputs.push(out);

      this.registerAudioNode(`voice-${i}`, out);
    }

    this._startPolling();
  }

  destroyAudioNodes(): void {
    this._stopPolling();

    for (const osc of this.oscillators) {
      try { osc.stop(); } catch (_) { /* already stopped */ }
      osc.disconnect();
    }
    for (const out of this.voiceOutputs) {
      out.disconnect();
    }

    this.oscillators = [];
    this.voiceOutputs = [];
  }

  updateAudioParameter(parameterId: string, value: number): void {
    if (parameterId === 'waveform') {
      const waveform = WAVEFORM_TYPES[Math.round(value)] ?? 'sine';
      for (const osc of this.oscillators) {
        osc.type = waveform;
      }
    }
  }

  getInputNode(): AudioNode | null { return null; }

  // Default output: voice 0 (fallback; proper connections use getOutputNodeByPort)
  getOutputNode(): AudioNode | null { return this.voiceOutputs[0] ?? null; }

  protected override getOutputNodeByPort(portId: string): AudioNode | null {
    const match = portId.match(/^voice-(\d)$/);
    if (match) {
      return this.voiceOutputs[parseInt(match[1]!, 10)] ?? null;
    }
    return this.voiceOutputs[0] ?? null;
  }

  // PolyConsumer interface
  setVoiceSlotsGetter(getter: VoiceSlotsGetter): void {
    this.voiceSlotsGetter = getter;
  }

  clearVoiceSlotsGetter(): void {
    this.voiceSlotsGetter = null;
    // Zero all voice outputs immediately when cable is removed
    const ctx = audioEngine.isReady() ? audioEngine.getContext() : null;
    const now = ctx?.currentTime ?? 0;
    for (const out of this.voiceOutputs) {
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(0, now);
    }
  }

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
    // FR-001a: reads only slot.frequency (gate switching via per-voice output gain)
    if (!this.voiceSlotsGetter) return;

    const slots = this.voiceSlotsGetter();
    for (let i = 0; i < VOICE_COUNT; i++) {
      const slot = slots[i];
      if (!slot) continue;

      const osc = this.oscillators[i];
      const out = this.voiceOutputs[i];
      if (!osc || !out) continue;

      if (osc.frequency.value !== slot.frequency) {
        osc.frequency.value = slot.frequency;
      }
      // Gate the voice output directly — PolyVCA CV envelope shapes the amplitude
      if (out.gain.value !== slot.gate) {
        out.gain.value = slot.gate;
      }
    }
  }
}
