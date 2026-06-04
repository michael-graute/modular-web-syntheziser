import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { VoiceSlot } from '../utilities/VoiceAllocator';
import { ENVELOPE } from '../../utils/constants';

type VoiceSlotsGetter = () => Readonly<VoiceSlot[]>;

const VOICE_COUNT = 4;

export class PolyADSR extends SynthComponent {
  private constantSources: ConstantSourceNode[] = [];
  private envGains: GainNode[] = [];
  private outputGains: GainNode[] = [];        // per-voice CV outputs
  private polyEnvOut: GainNode | null = null;  // dummy node exposed as poly-env port
  private previousGates: (0 | 1)[] = [0, 0, 0, 0];
  private voiceSlotsGetter: VoiceSlotsGetter | null = null;
  private rafHandle: number | null = null;

  private polyEnvDisconnector: (() => void) | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.POLY_ADSR, 'Poly ADSR', position);

    this.addInput('poly-cv', 'Poly CV', SignalType.POLY_CV);
    // Single bundled envelope output — connects to Poly VCA poly-env input
    this.addOutput('poly-env', 'Poly Env', SignalType.POLY_ENV);

    this.addParameter('attack',  'Attack',  0.01, ENVELOPE.MIN_TIME, ENVELOPE.MAX_TIME, 0.001, 's');
    this.addParameter('decay',   'Decay',   0.1,  ENVELOPE.MIN_TIME, ENVELOPE.MAX_TIME, 0.001, 's');
    this.addParameter('sustain', 'Sustain', 0.7,  ENVELOPE.MIN_LEVEL, ENVELOPE.MAX_LEVEL, 0.01, '');
    this.addParameter('release', 'Release', 0.3,  ENVELOPE.MIN_TIME, ENVELOPE.MAX_TIME, 0.001, 's');
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) throw new Error('AudioEngine not initialized');
    const ctx = audioEngine.getContext();

    // Dummy node for the port — actual CV flows via outputGains directly to PolyVCA
    this.polyEnvOut = ctx.createGain();
    this.polyEnvOut.gain.value = 1.0;

    for (let i = 0; i < VOICE_COUNT; i++) {
      const src = ctx.createConstantSource();
      src.offset.value = 1.0;
      src.start();

      const env = ctx.createGain();
      env.gain.value = 0;

      const out = ctx.createGain();
      out.gain.value = 1.0;

      src.connect(env);
      env.connect(out);
      // Feed dummy node too
      out.connect(this.polyEnvOut);

      this.constantSources.push(src);
      this.envGains.push(env);
      this.outputGains.push(out);
    }

    this.registerAudioNode('poly-env', this.polyEnvOut);
    this.previousGates = [0, 0, 0, 0];
    this._startPolling();
  }

  destroyAudioNodes(): void {
    this._stopPolling();
    for (const src of this.constantSources) { src.stop(); src.disconnect(); }
    for (const env of this.envGains) { env.disconnect(); }
    for (const out of this.outputGains) { out.disconnect(); }
    if (this.polyEnvOut) { this.polyEnvOut.disconnect(); this.polyEnvOut = null; }

    this.constantSources = [];
    this.envGains = [];
    this.outputGains = [];
    this.previousGates = [0, 0, 0, 0];
    this.polyEnvDisconnector = null;
  }

  updateAudioParameter(_parameterId: string, _value: number): void { /* read at trigger time */ }

  getInputNode(): AudioNode | null { return null; }
  getOutputNode(): AudioNode | null { return this.polyEnvOut; }

  protected override getOutputNodeByPort(_portId: string): AudioNode | null {
    return this.polyEnvOut;
  }

  // PolyConsumer interface
  setVoiceSlotsGetter(getter: VoiceSlotsGetter): void { this.voiceSlotsGetter = getter; }

  clearVoiceSlotsGetter(): void {
    this.voiceSlotsGetter = null;
    for (let i = 0; i < VOICE_COUNT; i++) {
      if (this.previousGates[i] === 1) {
        this._triggerGateOff(i);
        this.previousGates[i] = 0;
      }
    }
  }

  // Called by ConnectionManager when poly-env cable is connected to a PolyVCA.
  registerPolyEnvConsumer(
    connect: (outputGains: GainNode[]) => void,
    disconnect: () => void
  ): void {
    this.polyEnvDisconnector = disconnect;
    if (this.outputGains.length === VOICE_COUNT) {
      connect(this.outputGains);
    }
  }

  clearPolyEnvConsumer(): void {
    if (this.polyEnvDisconnector) this.polyEnvDisconnector();
    this.polyEnvDisconnector = null;
  }

  getOutputGains(): GainNode[] { return this.outputGains; }

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
      if (!slot) continue;
      const prev = this.previousGates[i] ?? 0;
      if (prev === 0 && slot.gate === 1) { this._triggerGateOn(i);  this.previousGates[i] = 1; }
      else if (prev === 1 && slot.gate === 0) { this._triggerGateOff(i); this.previousGates[i] = 0; }
    }
  }

  private _triggerGateOn(i: number): void {
    const env = this.envGains[i];
    if (!env) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const attack  = this.getParameter('attack')?.getValue()  ?? 0.01;
    const decay   = this.getParameter('decay')?.getValue()   ?? 0.1;
    const sustain = this.getParameter('sustain')?.getValue() ?? 0.7;
    env.gain.cancelScheduledValues(now);
    env.gain.setValueAtTime(env.gain.value, now);
    env.gain.linearRampToValueAtTime(1.0, now + attack);
    env.gain.linearRampToValueAtTime(sustain, now + attack + decay);
  }

  private _triggerGateOff(i: number): void {
    const env = this.envGains[i];
    if (!env) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const release = this.getParameter('release')?.getValue() ?? 0.3;
    env.gain.cancelScheduledValues(now);
    env.gain.setValueAtTime(env.gain.value, now);
    env.gain.linearRampToValueAtTime(0.0, now + release);
  }
}
