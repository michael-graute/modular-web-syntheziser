/**
 * ParametricEQ - 3-Band Parametric Equalizer component
 *
 * Three BiquadFilterNodes in series: lowshelf → peaking → highshelf.
 * CV gain modulation exposed via getAudioParamForInput() — uses the same
 * per-connection LFO scaler pattern as Filter.ts.
 *
 * Feature: 026-parametric-eq
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import {
  DEFAULT_EQ_CONFIG,
  EQ_GAIN_MIN,
  EQ_GAIN_MAX,
  LOW_FREQ_MIN,
  LOW_FREQ_MAX,
  MID_FREQ_MIN,
  MID_FREQ_MAX,
  MID_Q_MIN,
  MID_Q_MAX,
  HIGH_FREQ_MIN,
  HIGH_FREQ_MAX,
  GAIN_CV_RANGE,
} from '../../../specs/026-parametric-eq/contracts/types';
import {
  serializeEQConfig,
  deserializeEQConfig,
} from '../../../specs/026-parametric-eq/contracts/validation';

export class ParametricEQ extends SynthComponent {
  private inputGain: GainNode | null = null;
  private lowShelf: BiquadFilterNode | null = null;
  private midPeak: BiquadFilterNode | null = null;
  private highShelf: BiquadFilterNode | null = null;
  private outputGain: GainNode | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.PARAMETRIC_EQ, 'Parametric EQ', position);

    this.addInput('audio-in', 'Audio In', SignalType.AUDIO);
    this.addInput('low-gain-cv', 'Low Gain CV', SignalType.CV);
    this.addInput('mid-gain-cv', 'Mid Gain CV', SignalType.CV);
    this.addInput('high-gain-cv', 'High Gain CV', SignalType.CV);
    this.addOutput('audio-out', 'Audio Out', SignalType.AUDIO);

    const d = DEFAULT_EQ_CONFIG;
    this.addParameter('lowGain',  'Low Gain',  d.lowGain,  EQ_GAIN_MIN,   EQ_GAIN_MAX,   0.1,  'dB');
    this.addParameter('lowFreq',  'Low Freq',  d.lowFreq,  LOW_FREQ_MIN,  LOW_FREQ_MAX,  1,    'Hz');
    this.addParameter('midGain',  'Mid Gain',  d.midGain,  EQ_GAIN_MIN,   EQ_GAIN_MAX,   0.1,  'dB');
    this.addParameter('midFreq',  'Mid Freq',  d.midFreq,  MID_FREQ_MIN,  MID_FREQ_MAX,  1,    'Hz');
    this.addParameter('midQ',     'Mid Q',     d.midQ,     MID_Q_MIN,     MID_Q_MAX,     0.01, '');
    this.addParameter('highGain', 'High Gain', d.highGain, EQ_GAIN_MIN,   EQ_GAIN_MAX,   0.1,  'dB');
    this.addParameter('highFreq', 'High Freq', d.highFreq, HIGH_FREQ_MIN, HIGH_FREQ_MAX, 1,    'Hz');
  }

  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1.0;

    this.lowShelf = ctx.createBiquadFilter();
    this.lowShelf.type = 'lowshelf';
    this.lowShelf.frequency.value = this.getParameter('lowFreq')?.getValue() ?? DEFAULT_EQ_CONFIG.lowFreq;
    this.lowShelf.gain.value = this.getParameter('lowGain')?.getValue() ?? DEFAULT_EQ_CONFIG.lowGain;

    this.midPeak = ctx.createBiquadFilter();
    this.midPeak.type = 'peaking';
    this.midPeak.frequency.value = this.getParameter('midFreq')?.getValue() ?? DEFAULT_EQ_CONFIG.midFreq;
    this.midPeak.gain.value = this.getParameter('midGain')?.getValue() ?? DEFAULT_EQ_CONFIG.midGain;
    this.midPeak.Q.value = this.getParameter('midQ')?.getValue() ?? DEFAULT_EQ_CONFIG.midQ;

    this.highShelf = ctx.createBiquadFilter();
    this.highShelf.type = 'highshelf';
    this.highShelf.frequency.value = this.getParameter('highFreq')?.getValue() ?? DEFAULT_EQ_CONFIG.highFreq;
    this.highShelf.gain.value = this.getParameter('highGain')?.getValue() ?? DEFAULT_EQ_CONFIG.highGain;

    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1.0;

    this.inputGain.connect(this.lowShelf);
    this.lowShelf.connect(this.midPeak);
    this.midPeak.connect(this.highShelf);
    this.highShelf.connect(this.outputGain);

    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('lowShelf', this.lowShelf);
    this.registerAudioNode('midPeak', this.midPeak);
    this.registerAudioNode('highShelf', this.highShelf);
    this.registerAudioNode('outputGain', this.outputGain);
  }

  destroyAudioNodes(): void {
    this.outputGain?.disconnect();
    this.outputGain = null;

    this.highShelf?.disconnect();
    this.highShelf = null;

    this.midPeak?.disconnect();
    this.midPeak = null;

    this.lowShelf?.disconnect();
    this.lowShelf = null;

    this.inputGain?.disconnect();
    this.inputGain = null;
  }

  getInputNode(_portId?: string): AudioNode | null {
    return this.inputGain;
  }

  getOutputNode(): AudioNode | null {
    return this.outputGain;
  }

  updateAudioParameter(parameterId: string, value: number): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    switch (parameterId) {
      case 'lowGain':
        this.lowShelf?.gain.setValueAtTime(value, now);
        break;
      case 'lowFreq':
        this.lowShelf?.frequency.setValueAtTime(value, now);
        break;
      case 'midGain':
        this.midPeak?.gain.setValueAtTime(value, now);
        break;
      case 'midFreq':
        this.midPeak?.frequency.setValueAtTime(value, now);
        break;
      case 'midQ':
        this.midPeak?.Q.setValueAtTime(value, now);
        break;
      case 'highGain':
        this.highShelf?.gain.setValueAtTime(value, now);
        break;
      case 'highFreq':
        this.highShelf?.frequency.setValueAtTime(value, now);
        break;
    }
  }

  protected override enableBypass(): void {
    if (!this.inputGain || !this.lowShelf || !this.midPeak || !this.highShelf || !this.outputGain) {
      return;
    }

    this._bypassConnections = [
      { from: this.inputGain, to: this.lowShelf },
      { from: this.lowShelf, to: this.midPeak },
      { from: this.midPeak, to: this.highShelf },
      { from: this.highShelf, to: this.outputGain },
    ];

    this.inputGain.disconnect();
    this.lowShelf.disconnect();
    this.midPeak.disconnect();
    this.highShelf.disconnect();

    this.inputGain.connect(this.outputGain);
  }

  protected override disableBypass(): void {
    if (!this.inputGain || !this.outputGain) {
      return;
    }

    this.inputGain.disconnect();

    this._bypassConnections.forEach(({ from, to }) => {
      try {
        from.connect(to);
      } catch (error) {
        console.error('Error restoring ParametricEQ connection:', error);
      }
    });

    this._bypassConnections = [];
  }

  override getAudioParamForInput(inputId: string): AudioParam | null {
    switch (inputId) {
      case 'low-gain-cv':  return this.lowShelf?.gain ?? null;
      case 'mid-gain-cv':  return this.midPeak?.gain ?? null;
      case 'high-gain-cv': return this.highShelf?.gain ?? null;
      default:             return null;
    }
  }

  override getParameterRangeForInput(portId: string): { min: number; max: number } | null {
    switch (portId) {
      case 'low-gain-cv':
      case 'mid-gain-cv':
      case 'high-gain-cv':
        return { ...GAIN_CV_RANGE };
      default:
        return null;
    }
  }

  override serialize() {
    const base = super.serialize();
    const config = {
      lowGain:  this.getParameter('lowGain')?.getValue()  ?? DEFAULT_EQ_CONFIG.lowGain,
      lowFreq:  this.getParameter('lowFreq')?.getValue()  ?? DEFAULT_EQ_CONFIG.lowFreq,
      midGain:  this.getParameter('midGain')?.getValue()  ?? DEFAULT_EQ_CONFIG.midGain,
      midFreq:  this.getParameter('midFreq')?.getValue()  ?? DEFAULT_EQ_CONFIG.midFreq,
      midQ:     this.getParameter('midQ')?.getValue()     ?? DEFAULT_EQ_CONFIG.midQ,
      highGain: this.getParameter('highGain')?.getValue() ?? DEFAULT_EQ_CONFIG.highGain,
      highFreq: this.getParameter('highFreq')?.getValue() ?? DEFAULT_EQ_CONFIG.highFreq,
    };
    base.parameters = serializeEQConfig(config);
    return base;
  }

  override deserialize(data: import('../../core/types').ComponentData): void {
    this.position = { ...data.position };

    const config = deserializeEQConfig(data.parameters as Record<string, number>);
    this.setParameterValue('lowGain',  config.lowGain);
    this.setParameterValue('lowFreq',  config.lowFreq);
    this.setParameterValue('midGain',  config.midGain);
    this.setParameterValue('midFreq',  config.midFreq);
    this.setParameterValue('midQ',     config.midQ);
    this.setParameterValue('highGain', config.highGain);
    this.setParameterValue('highFreq', config.highFreq);

    if (data.isBypassed) {
      (this as any)._isBypassed = true;
    }
  }
}
