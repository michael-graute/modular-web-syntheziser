/**
 * GlobalTransportController — singleton play/stop state machine with lookahead beat scheduler.
 *
 * Beat scheduling uses the setTimeout lookahead pattern anchored to AudioContext.currentTime:
 * a timer fires TRANSPORT_LOOKAHEAD_MS before each beat so the tick is scheduled precisely.
 * BPM changes re-anchor _nextBeatTime from the current AudioContext time without restarting.
 *
 * Late subscribers must call getState() / getPosition() on subscribe to self-initialise —
 * no automatic state replay is emitted on subscription.
 */

import { EventType, TransportBeatPayload } from './types';
import { eventBus } from './EventBus';
import { audioEngine } from './AudioEngine';
import { globalBpmController } from './GlobalBpmController';

export enum TransportState {
  STOPPED = 'stopped',
  PLAYING = 'playing',
}

export interface TransportPosition {
  bar: number;
  beat: number;
}

const TRANSPORT_LOOKAHEAD_MS = 25;
const BEATS_PER_BAR = 4;

export class GlobalTransportController {
  private _state: TransportState = TransportState.STOPPED;
  private _position: TransportPosition = { bar: 1, beat: 1 };
  private _nextBeatTime: number = 0;
  private _timeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly _bpmUnsubscribe: () => void;

  constructor() {
    this._bpmUnsubscribe = eventBus.on(EventType.GLOBAL_BPM_CHANGED, () => {
      this._onBpmChange();
    });
  }

  /** Tears down EventBus subscriptions. Call when the controller is no longer needed. */
  destroy(): void {
    this.stop();
    this._bpmUnsubscribe();
  }

  getState(): TransportState {
    return this._state;
  }

  getPosition(): TransportPosition {
    return { ...this._position };
  }

  /**
   * Starts transport. No-op if already PLAYING.
   * Reads current BPM to initialise _nextBeatTime before starting the scheduler.
   */
  play(): void {
    if (this._state === TransportState.PLAYING) return;
    this._state = TransportState.PLAYING;
    this._position = { bar: 1, beat: 1 };
    const ctx = audioEngine.getContext();
    this._nextBeatTime = ctx.currentTime;
    eventBus.emit(EventType.TRANSPORT_PLAY, undefined);
    this._scheduleTick();
  }

  /**
   * Stops transport. No-op if already STOPPED.
   * Clears the scheduler and resets position to bar 1, beat 1.
   */
  stop(): void {
    if (this._state === TransportState.STOPPED) return;
    if (this._timeoutId !== null) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
    this._state = TransportState.STOPPED;
    this._position = { bar: 1, beat: 1 };
    eventBus.emit(EventType.TRANSPORT_STOP, undefined);
  }

  /**
   * Lookahead scheduler: fires TRANSPORT_LOOKAHEAD_MS before each beat,
   * emits TRANSPORT_BEAT with the current position, advances position,
   * and schedules the next tick.
   */
  private _scheduleTick(): void {
    if (this._state !== TransportState.PLAYING) return;

    const ctx = audioEngine.getContext();
    const bpm = globalBpmController.getBpm();
    const beatIntervalSec = 60 / bpm;

    const now = ctx.currentTime;
    const delayMs = Math.max(0, (this._nextBeatTime - now) * 1000 - TRANSPORT_LOOKAHEAD_MS);

    this._timeoutId = setTimeout(() => {
      if (this._state !== TransportState.PLAYING) return;

      const payload: TransportBeatPayload = { bar: this._position.bar, beat: this._position.beat };
      eventBus.emit(EventType.TRANSPORT_BEAT, payload);

      // Advance position
      if (this._position.beat < BEATS_PER_BAR) {
        this._position = { bar: this._position.bar, beat: this._position.beat + 1 };
      } else {
        this._position = { bar: this._position.bar + 1, beat: 1 };
      }

      this._nextBeatTime += beatIntervalSec;
      this._scheduleTick();
    }, delayMs);
  }

  /**
   * Called on BPM_CHANGED: re-anchors _nextBeatTime so the new tempo takes
   * effect within one beat period without restarting transport.
   */
  private _onBpmChange(): void {
    if (this._state !== TransportState.PLAYING) return;
    const ctx = audioEngine.getContext();
    this._nextBeatTime = ctx.currentTime;
  }
}

/** Singleton instance shared across the application */
export const globalTransportController = new GlobalTransportController();
