import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

/**
 * Ring Modulator — multiplies two audio-rate signals to produce sum and
 * difference frequencies (classic AM synthesis / bell / metallic timbres).
 *
 * Audio graph (active):
 *   Audio In  → carrierBypassGain (1.0) → multiplierGain [signal]
 *   Modulator → modulatorEntry    (1.0) → multiplierGain.gain (base 0.0)
 *                                          → outputGain → Audio Out
 *
 * Audio graph (bypassed):
 *   Audio In  → carrierBypassGain → outputGain → Audio Out
 */
export class RingModulator extends SynthComponent {
  private carrierBypassGain: GainNode | null = null;
  private modulatorEntry: GainNode | null = null;
  private multiplierGain: GainNode | null = null;
  private outputGain: GainNode | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.RING_MODULATOR, 'Ring Modulator', position);

    this.addInput('audio-in', 'Audio In', SignalType.AUDIO);
    this.addInput('modulator', 'Modulator In', SignalType.AUDIO);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    this.carrierBypassGain = ctx.createGain();
    this.carrierBypassGain.gain.value = 1.0;

    this.modulatorEntry = ctx.createGain();
    this.modulatorEntry.gain.value = 1.0;

    this.multiplierGain = ctx.createGain();
    // Base gain of 0.0: absent modulator produces silence (FR-004)
    this.multiplierGain.gain.value = 0.0;

    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1.0;

    this.carrierBypassGain.connect(this.multiplierGain);
    this.modulatorEntry.connect(this.multiplierGain.gain);
    this.multiplierGain.connect(this.outputGain);

    this.registerAudioNode('carrierBypassGain', this.carrierBypassGain);
    this.registerAudioNode('inputGain', this.carrierBypassGain);
    this.registerAudioNode('modulatorEntry', this.modulatorEntry);
    this.registerAudioNode('multiplierGain', this.multiplierGain);
    this.registerAudioNode('outputGain', this.outputGain);
  }

  destroyAudioNodes(): void {
    if (this.outputGain) { this.outputGain.disconnect(); this.outputGain = null; }
    if (this.multiplierGain) { this.multiplierGain.disconnect(); this.multiplierGain = null; }
    if (this.modulatorEntry) { this.modulatorEntry.disconnect(); this.modulatorEntry = null; }
    if (this.carrierBypassGain) { this.carrierBypassGain.disconnect(); this.carrierBypassGain = null; }
  }

  // No parameters — required abstract method is a deliberate no-op
  updateAudioParameter(_parameterId: string, _value: number): void {}

  getInputNode(portId?: string): AudioNode | null {
    if (portId === 'modulator') return this.modulatorEntry;
    return this.carrierBypassGain;
  }

  protected override getInputNodeByPort(portId: string): AudioNode | null {
    return this.getInputNode(portId);
  }

  getOutputNode(): AudioNode | null {
    return this.outputGain;
  }

  protected override enableBypass(): void {
    if (!this.carrierBypassGain || !this.multiplierGain || !this.outputGain) return;

    this._bypassConnections = [
      { from: this.carrierBypassGain, to: this.multiplierGain },
    ];

    this.carrierBypassGain.disconnect();
    this.multiplierGain.disconnect();

    this.carrierBypassGain.connect(this.outputGain);
  }

  protected override disableBypass(): void {
    if (!this.carrierBypassGain || !this.multiplierGain || !this.outputGain) return;

    this.carrierBypassGain.disconnect();

    this._bypassConnections.forEach(({ from, to }) => {
      try { from.connect(to); } catch { /* ignore */ }
    });

    this.multiplierGain.connect(this.outputGain);
    this._bypassConnections = [];
  }
}
