/**
 * Looper - BPM-Synced Audio Looper Component (feature 015)
 *
 * Records audio input into a Float32Array buffer via ScriptProcessorNode,
 * loops it via AudioBufferSourceNode (loop=true), supports overdub by
 * in-place sample accumulation. Always passes live input to output (FR-019).
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType, EventType } from '../../core/types';
import type { TempoAware, GlobalBpmChangedPayload } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { globalBpmController } from '../../core/GlobalBpmController';
import { eventBus } from '../../core/EventBus';
import {
  LooperState,
  type BarCount,
  type LooperDisplayState,
  VALID_BAR_COUNTS,
} from './LooperConstants';
import {
  computeLoopDurationSamples,
  normalizePlayHead,
} from './LooperConstants';
import { validateBarCount } from '../../../specs/015-bpm-looper/contracts/validation';

// ---------------------------------------------------------------------------
// Looper component
// ---------------------------------------------------------------------------

export class Looper extends SynthComponent implements TempoAware {
  // State machine
  private _state: LooperState = LooperState.IDLE;
  private _barCount: BarCount = 2;
  private _currentBpm: number = 120;

  // Buffer
  private _loopBuffer: Float32Array | null = null;
  private _loopLengthSamples: number = 0;
  private _loopDurationSec: number = 0;
  private _writeHead: number = 0;
  private _filled: boolean = false;

  // Web Audio nodes
  private _inputGain: GainNode | null = null;
  private _captureNode: ScriptProcessorNode | null = null;
  private _outputMix: GainNode | null = null;
  private _playbackSource: AudioBufferSourceNode | null = null;

  // Playhead tracking — AudioBufferSourceNode doesn't expose current position,
  // so we derive it from the context clock.
  private _sourceStartTime: number = 0;

  // Subscriptions
  private _unsubscribeBpm: (() => void) | null = null;
  private _unsubscribeKeyRecord: (() => void) | null = null;
  private _unsubscribeKeyStop: (() => void) | null = null;
  private _unsubscribeKeyClear: (() => void) | null = null;
  private _unsubscribeTransportPlay: (() => void) | null = null;
  private _unsubscribeTransportStop: (() => void) | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.LOOPER, 'Looper', position);
    this.addInput('input', 'Audio In', SignalType.AUDIO);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);
  }

  // ---------------------------------------------------------------------------
  // SynthComponent abstract methods
  // ---------------------------------------------------------------------------

  createAudioNodes(): void {
    const ctx = audioEngine.getContext();
    if (!ctx) return;

    // Always-on passthrough: inputGain → outputMix (FR-019)
    this._inputGain = ctx.createGain();
    this._inputGain.gain.value = 1;

    this._outputMix = ctx.createGain();
    this._outputMix.gain.value = 1;

    // Passthrough: live input always reaches output
    this._inputGain.connect(this._outputMix);

    // Capture node for recording/overdub
    this._captureNode = ctx.createScriptProcessor(4096, 1, 1);
    this._inputGain.connect(this._captureNode);
    this._captureNode.connect(this._outputMix);

    this.registerAudioNode('inputGain', this._inputGain);
    this.registerAudioNode('outputMix', this._outputMix);
    this.registerAudioNode('captureNode', this._captureNode);

    this.subscribeToGlobalBpm();
    this.subscribeToTransport();
  }

  destroyAudioNodes(): void {
    this.unsubscribeFromGlobalBpm();
    this.unsubscribeFromTransport();
    this._unsubscribeKeyRecord?.();
    this._unsubscribeKeyStop?.();
    this._unsubscribeKeyClear?.();
    this._unsubscribeKeyRecord = null;
    this._unsubscribeKeyStop = null;
    this._unsubscribeKeyClear = null;

    this._stopPlaybackSource();

    if (this._captureNode) {
      this._captureNode.onaudioprocess = null;
      try { this._captureNode.disconnect(); } catch { /* already disconnected */ }
      this._captureNode = null;
    }
    if (this._inputGain) {
      try { this._inputGain.disconnect(); } catch { /* already disconnected */ }
      this._inputGain = null;
    }
    if (this._outputMix) {
      try { this._outputMix.disconnect(); } catch { /* already disconnected */ }
      this._outputMix = null;
    }
  }

  updateAudioParameter(_parameterId: string, _value: number): void {
    // No audio parameters on the Looper
  }

  getInputNode(): AudioNode | null {
    return this._inputGain;
  }

  getOutputNode(): AudioNode | null {
    return this._outputMix;
  }

  // ---------------------------------------------------------------------------
  // TempoAware interface
  // ---------------------------------------------------------------------------

  subscribeToGlobalBpm(): void {
    this._currentBpm = globalBpmController.getBpm();
    this._unsubscribeBpm = eventBus.on(
      EventType.GLOBAL_BPM_CHANGED,
      (data) => this.applyGlobalBpm((data as GlobalBpmChangedPayload).bpm)
    );
    // Subscribe to keyboard shortcut events (supports multiple Looper instances)
    this._unsubscribeKeyRecord = eventBus.on(EventType.LOOPER_KEY_RECORD, () => this.pressRecord());
    this._unsubscribeKeyStop = eventBus.on(EventType.LOOPER_KEY_STOP, () => this.pressStop());
    this._unsubscribeKeyClear = eventBus.on(EventType.LOOPER_KEY_CLEAR, () => this.pressClear());
  }

  unsubscribeFromGlobalBpm(): void {
    this._unsubscribeBpm?.();
    this._unsubscribeBpm = null;
  }

  /** Subscribe to global transport play/stop. Called from createAudioNodes(). */
  private subscribeToTransport(): void {
    this._unsubscribeTransportPlay = eventBus.on(EventType.TRANSPORT_PLAY, () => {
      // Only resume if a loop is already recorded; never auto-start recording (FR-008)
      if (this._filled) {
        this._resumePlayback();
      }
    });
    this._unsubscribeTransportStop = eventBus.on(EventType.TRANSPORT_STOP, () => {
      this.pressStop(); // halts playback and preserves buffer (FR-008)
    });
  }

  /** Unsubscribe from global transport events. Called from destroyAudioNodes(). */
  private unsubscribeFromTransport(): void {
    this._unsubscribeTransportPlay?.();
    this._unsubscribeTransportStop?.();
    this._unsubscribeTransportPlay = null;
    this._unsubscribeTransportStop = null;
  }

  applyGlobalBpm(bpm: number): void {
    // Only update BPM; does not alter an already-recorded loop (spec FR-014)
    this._currentBpm = bpm;
  }

  // ---------------------------------------------------------------------------
  // State machine — public press methods
  // ---------------------------------------------------------------------------

  pressRecord(): void {
    if (this._state !== LooperState.IDLE) return;
    this._startRecording();
  }

  pressStop(): void {
    if (this._state === LooperState.OVERDUBBING) {
      this._commitOverdub();
      return;
    }
    if (this._state === LooperState.PLAYING) {
      this._stopPlaybackSource();
      this._state = LooperState.IDLE;
    }
  }

  pressOverdub(): void {
    if (this._state !== LooperState.PLAYING) return;
    this._startOverdub();
  }

  pressClear(): void {
    this._stopPlaybackSource();
    if (this._captureNode) {
      this._captureNode.onaudioprocess = null;
    }
    this._loopBuffer = null;
    this._loopLengthSamples = 0;
    this._loopDurationSec = 0;
    this._writeHead = 0;
    this._sourceStartTime = 0;
    this._filled = false;
    this._state = LooperState.IDLE;
  }

  setBarCount(barCount: BarCount): void {
    const error = validateBarCount(barCount);
    if (error) return;
    // No-op if a loop is already recorded (FR-003)
    if (this._filled) return;
    this._barCount = barCount;
  }

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  private _startRecording(): void {
    const ctx = audioEngine.getContext();
    if (!ctx || !this._captureNode) return;

    const sampleRate = ctx.sampleRate;
    this._loopLengthSamples = computeLoopDurationSamples(this._barCount, this._currentBpm, sampleRate);
    this._loopDurationSec = this._loopLengthSamples / sampleRate;
    this._loopBuffer = new Float32Array(this._loopLengthSamples);
    this._writeHead = 0;
    this._state = LooperState.RECORDING;

    this._captureNode.onaudioprocess = (event: AudioProcessingEvent) => {
      if (this._state !== LooperState.RECORDING || !this._loopBuffer) return;
      const input = event.inputBuffer.getChannelData(0);
      for (let i = 0; i < input.length; i++) {
        if (this._writeHead < this._loopLengthSamples) {
          this._loopBuffer[this._writeHead++] = input[i]!;
        }
      }
      if (this._writeHead >= this._loopLengthSamples) {
        this._captureNode!.onaudioprocess = null;
        this._commitRecording();
      }
    };
  }

  private _commitRecording(): void {
    this._filled = true;
    this._startPlayback();
  }

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------

  private _startPlayback(): void {
    const ctx = audioEngine.getContext();
    if (!ctx || !this._loopBuffer || !this._outputMix) return;

    this._stopPlaybackSource();

    const audioBuffer = ctx.createBuffer(1, this._loopLengthSamples, ctx.sampleRate);
    audioBuffer.copyToChannel(new Float32Array(this._loopBuffer), 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = this._loopDurationSec;
    source.connect(this._outputMix);
    source.start();

    this._playbackSource = source;
    this._sourceStartTime = ctx.currentTime;
    this._state = LooperState.PLAYING;
  }

  /**
   * Resume playback after a transport-stop without touching _filled or the buffer.
   * Only valid when _filled is true and state is IDLE (stopped by transport).
   * Distinct from pressRecord() — does not trigger recording.
   */
  private _resumePlayback(): void {
    if (!this._filled || this._state !== LooperState.IDLE) return;
    this._startPlayback();
  }

  private _stopPlaybackSource(): void {
    if (this._playbackSource) {
      try { this._playbackSource.stop(); } catch { /* already stopped */ }
      try { this._playbackSource.disconnect(); } catch { /* already disconnected */ }
      this._playbackSource = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Overdub
  // ---------------------------------------------------------------------------

  private _startOverdub(): void {
    if (!this._captureNode || !this._loopBuffer) return;

    this._writeHead = 0;
    this._state = LooperState.OVERDUBBING;

    this._captureNode.onaudioprocess = (event: AudioProcessingEvent) => {
      if (this._state !== LooperState.OVERDUBBING || !this._loopBuffer) return;
      const input = event.inputBuffer.getChannelData(0);
      for (let i = 0; i < input.length; i++) {
        const pos = this._writeHead % this._loopLengthSamples;
        this._loopBuffer[pos] = (this._loopBuffer[pos] ?? 0) + (input[i] ?? 0);
        this._writeHead++;
      }
    };
  }

  private _commitOverdub(): void {
    if (this._captureNode) {
      this._captureNode.onaudioprocess = null;
    }
    this._startPlayback();
  }

  // ---------------------------------------------------------------------------
  // Display state
  // ---------------------------------------------------------------------------

  getDisplayState(): LooperDisplayState {
    let playHeadNormalized = 0;

    if (this._state === LooperState.RECORDING && this._loopLengthSamples > 0) {
      playHeadNormalized = normalizePlayHead(this._writeHead, this._loopLengthSamples);
    } else if (this._state === LooperState.PLAYING || this._state === LooperState.OVERDUBBING) {
      const ctx = audioEngine.getContext();
      if (ctx && this._loopDurationSec > 0) {
        const elapsed = (ctx.currentTime - this._sourceStartTime) % this._loopDurationSec;
        const playHeadSamples = elapsed * ctx.sampleRate;
        playHeadNormalized = normalizePlayHead(playHeadSamples, this._loopLengthSamples);
      }
    }

    return {
      state: this._state,
      playHeadNormalized,
      barCount: this._barCount,
      filled: this._filled,
    };
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  override serialize() {
    const base = super.serialize();
    const stateIndexMap: Record<LooperState, number> = {
      [LooperState.IDLE]:        0,
      [LooperState.RECORDING]:   2,
      [LooperState.PLAYING]:     2,
      [LooperState.OVERDUBBING]: 2,
    };
    base.parameters = {
      barCount: this._barCount,
      stateIndex: stateIndexMap[this._state],
    };
    if (this._loopBuffer && this._filled) {
      base.audioBlob = this._float32ToBase64(this._loopBuffer);
    }
    return base;
  }

  override deserialize(data: import('../../core/types').ComponentData): void {
    super.deserialize(data);
    const params = data.parameters;
    if (VALID_BAR_COUNTS.includes(params['barCount'] as BarCount)) {
      this._barCount = params['barCount'] as BarCount;
    }
    // Restore state: only IDLE or PLAYING on load (never RECORDING/OVERDUBBING mid-session)
    const stateIndex = params['stateIndex'] ?? 0;
    this._state = stateIndex === 0 ? LooperState.IDLE : LooperState.PLAYING;

    if (data.audioBlob) {
      try {
        this._loopBuffer = this._base64ToFloat32(data.audioBlob);
        this._loopLengthSamples = this._loopBuffer.length;
        const sampleRate = audioEngine.getContext()?.sampleRate ?? 44100;
        this._loopDurationSec = this._loopLengthSamples / sampleRate;
        this._filled = true;
        if (this._state === LooperState.PLAYING) {
          this._startPlayback();
        }
      } catch {
        this._loopBuffer = null;
        this._filled = false;
        this._state = LooperState.IDLE;
      }
    }
  }

  private _float32ToBase64(buffer: Float32Array): string {
    const bytes = new Uint8Array(buffer.buffer as ArrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  }

  private _base64ToFloat32(base64: string): Float32Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Float32Array(bytes.buffer);
  }

  // ---------------------------------------------------------------------------
  // Destroy (memory cleanup on canvas removal)
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.unsubscribeFromGlobalBpm();
    if (this.isActive) {
      this.destroyAudioNodes();
    }
    this._loopBuffer = null;
  }

  // ---------------------------------------------------------------------------
  // Accessors for tests
  // ---------------------------------------------------------------------------

  get state(): LooperState { return this._state; }
  get barCount(): BarCount { return this._barCount; }
  get filled(): boolean { return this._filled; }
  get loopLengthSamples(): number { return this._loopLengthSamples; }
  get loopBuffer(): Float32Array | null { return this._loopBuffer; }
  get sourceStartTime(): number { return this._sourceStartTime; }
  get playbackSource(): AudioBufferSourceNode | null { return this._playbackSource; }
}
