/**
 * ClockDivider - Derives synchronized division/multiplication gate pulses
 * from the shared global tempo (feature 038)
 *
 * The first component with six simultaneous, independently-rated gate
 * outputs. No audio nodes, no input ports — timing is driven entirely by
 * the global BPM via a shared lookahead scheduler generalized from
 * StepSequencer's nextStepTime pattern (research.md decision 1), so
 * related rates (e.g. /2 and /4) always coincide on shared beats.
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType, EventType } from '../../core/types';
import type { GlobalBpmChangedPayload } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { globalBpmController } from '../../core/GlobalBpmController';
import { eventBus } from '../../core/EventBus';
import {
  ClockDividerRate,
  CLOCK_DIVIDER_OUTPUT_COUNT,
  DEFAULT_RATES,
} from '../../../specs/038-clock-divider/contracts/types';
import { clampRateIndex, pulseWidthMs, collectDueTicks } from '../../../specs/038-clock-divider/contracts/validation';

const SCHEDULER_POLL_MS = 25;
const LOOKAHEAD_SEC = 0.1;

type OutputIndex = 1 | 2 | 3 | 4 | 5 | 6;

export class ClockDivider extends SynthComponent {
  private _rates: ClockDividerRate[] = [...DEFAULT_RATES];
  private _currentBpm: number = globalBpmController.getBpm();

  private _gateNodes: (ConstantSourceNode | null)[] = new Array(CLOCK_DIVIDER_OUTPUT_COUNT).fill(null);
  private _nextTickTime: number[] = new Array(CLOCK_DIVIDER_OUTPUT_COUNT).fill(0);
  private _schedulerIntervalId: number | null = null;

  private _unsubscribeBpm: (() => void) | null = null;
  private _unsubscribeTransportPlay: (() => void) | null = null;
  private _unsubscribeTransportStop: (() => void) | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.CLOCK_DIVIDER, 'Clock Divider', position);
    for (let i = 0; i < CLOCK_DIVIDER_OUTPUT_COUNT; i++) {
      this.addOutput(`out${i + 1}`, `Out ${i + 1}`, SignalType.GATE);
      const defaultRate = DEFAULT_RATES[i] ?? ClockDividerRate.Div2;
      this.addParameter(`rate${i + 1}`, `Output ${i + 1} Rate`, defaultRate, 0, 5, 1, '');
    }
  }

  // ---------------------------------------------------------------------------
  // SynthComponent abstract method implementations
  // ---------------------------------------------------------------------------

  createAudioNodes(): void {
    const ctx = audioEngine.getContext();
    if (!ctx) return;

    for (let i = 0; i < CLOCK_DIVIDER_OUTPUT_COUNT; i++) {
      const node = ctx.createConstantSource();
      node.offset.value = 0;
      node.start();
      this._gateNodes[i] = node;
      this.registerAudioNode(`out${i + 1}`, node);
      this._nextTickTime[i] = ctx.currentTime;
    }

    this.subscribeToGlobalBpm();
    this.subscribeToTransport();
    this.startScheduler();
  }

  destroyAudioNodes(): void {
    this.stopScheduler();
    this.unsubscribeFromGlobalBpm();
    this.unsubscribeFromTransport();

    for (let i = 0; i < CLOCK_DIVIDER_OUTPUT_COUNT; i++) {
      const node = this._gateNodes[i];
      if (node) {
        try { node.stop(); } catch (_) { /* already stopped */ }
        try { node.disconnect(); } catch (_) { /* already disconnected */ }
      }
      this._gateNodes[i] = null;
    }
    this.audioNodes.clear();
  }

  updateAudioParameter(parameterId: string, value: number): void {
    const match = /^rate([1-6])$/.exec(parameterId);
    if (!match) return;
    const index = Number(match[1]) - 1;
    this._rates[index] = clampRateIndex(value);
  }

  getInputNode(): AudioNode | null {
    return null;
  }

  getOutputNode(): AudioNode | null {
    return this._gateNodes[0] ?? null;
  }

  protected override getOutputNodeByPort(portId: string): AudioNode | null {
    const match = /^out([1-6])$/.exec(portId);
    if (!match) return null;
    return this._gateNodes[Number(match[1]) - 1] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  setRate(outputIndex: OutputIndex, rate: ClockDividerRate): void {
    this.setParameterValue(`rate${outputIndex}`, rate);
  }

  getRate(outputIndex: OutputIndex): ClockDividerRate {
    return this._rates[outputIndex - 1] ?? ClockDividerRate.Div2;
  }

  // ---------------------------------------------------------------------------
  // Global BPM subscription (research.md decision 5 — always-global, no bpmMode)
  // ---------------------------------------------------------------------------

  private subscribeToGlobalBpm(): void {
    this._currentBpm = globalBpmController.getBpm();
    this._unsubscribeBpm = eventBus.on(
      EventType.GLOBAL_BPM_CHANGED,
      (data) => {
        this._currentBpm = (data as GlobalBpmChangedPayload).bpm;
      }
    );
  }

  private unsubscribeFromGlobalBpm(): void {
    if (this._unsubscribeBpm) {
      this._unsubscribeBpm();
      this._unsubscribeBpm = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Global transport subscription
  // ---------------------------------------------------------------------------

  private subscribeToTransport(): void {
    this._unsubscribeTransportPlay = eventBus.on(EventType.TRANSPORT_PLAY, () => {
      this.startScheduler();
    });
    this._unsubscribeTransportStop = eventBus.on(EventType.TRANSPORT_STOP, () => {
      this.stopScheduler();
      const ctx = audioEngine.getContext();
      if (!ctx) return;
      for (const node of this._gateNodes) {
        node?.offset.setValueAtTime(0, ctx.currentTime);
      }
    });
  }

  private unsubscribeFromTransport(): void {
    if (this._unsubscribeTransportPlay) {
      this._unsubscribeTransportPlay();
      this._unsubscribeTransportPlay = null;
    }
    if (this._unsubscribeTransportStop) {
      this._unsubscribeTransportStop();
      this._unsubscribeTransportStop = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Shared lookahead scheduler (research.md decision 1)
  // ---------------------------------------------------------------------------

  private startScheduler(): void {
    if (this._schedulerIntervalId !== null) return; // idempotent
    this._schedulerIntervalId = window.setInterval(() => this.scheduleLoop(), SCHEDULER_POLL_MS);
  }

  private stopScheduler(): void {
    if (this._schedulerIntervalId !== null) {
      window.clearInterval(this._schedulerIntervalId);
      this._schedulerIntervalId = null;
    }
  }

  private scheduleLoop(): void {
    const ctx = audioEngine.getContext();
    if (!ctx) return;

    const horizon = ctx.currentTime + LOOKAHEAD_SEC;
    for (let i = 0; i < CLOCK_DIVIDER_OUTPUT_COUNT; i++) {
      const rate = this._rates[i] ?? ClockDividerRate.Div2;
      const cursor = this._nextTickTime[i] ?? ctx.currentTime;
      const { dueTimes, nextTickTime } = collectDueTicks(cursor, horizon, this._currentBpm, rate);

      const node = this._gateNodes[i];
      if (node) {
        for (const t of dueTimes) {
          node.offset.setValueAtTime(1, t);
          node.offset.setValueAtTime(0, t + pulseWidthMs(this._currentBpm, rate) / 1000);
        }
      }

      this._nextTickTime[i] = nextTickTime;
    }
  }
}
