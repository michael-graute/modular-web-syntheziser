/**
 * X-Y Pad - Two-axis controller with independent depth-scaled CV outputs
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { CV } from '../../utils/constants';
import { XYPadState, XY_PAD, type XYPadDisplayState } from './XYPadConstants';
import {
  clampPosition,
  isPlayableRecording,
  hasReachedRecordingLimit,
  wrapPlaybackTime,
} from '../../../specs/035-xy-pad-controller/contracts/validation';
import type { XYPosition, MovementRecording } from '../../../specs/035-xy-pad-controller/contracts/types';

/**
 * Entry in the per-connection scaler map. Extends the LFO's ConnectionScaler
 * shape with an offsetNode and a combined node, since (unlike LFO's bipolar
 * ±depth modulation signal) the X-Y Pad's unipolar [0,1] position must map
 * onto the target's absolute range — position 0 must reach range.min, not 0.
 * scaler and offsetNode both feed into `combined` (an identity GainNode), so
 * `combined`'s output is the true post-scale/offset value reaching the
 * target — this is also the tap point ModulationVisualizer needs to show
 * accurate live values (see getScaledOutputForConnection).
 */
interface XYConnectionScaler {
  node: GainNode;
  offsetNode: ConstantSourceNode;
  combined: GainNode;
  fullDepthGain: number;
}

/**
 * Compute the gain for a per-connection X-Y Pad scaler.
 * Position is normalised [0, 1] and arrives via a ConstantSourceNode; the
 * scaler's gain maps that to depth% × (paramMax − paramMin), and a second
 * ConstantSourceNode (offsetNode) adds range.min so 0 maps to range.min and
 * 1 maps to range.min + depth% × (paramMax − paramMin).
 */
function computeScaleGain(depthPercent: number, range: { min: number; max: number }): number {
  const clamped = Math.max(0, Math.min(100, depthPercent));
  return (clamped / 100) * (range.max - range.min);
}

/**
 * X-Y Pad component: a 2D draggable controller exposing two independent CV
 * outputs (X, Y), each with its own 0-100% depth control.
 *
 * CV adapter pattern: for each outgoing connection whose target exposes both
 * an AudioParam (via getAudioParamForInput) and a parameter range (via
 * getParameterRangeForInput), a dedicated per-connection GainNode scales the
 * normalised [0,1] axis position to the target's parameter range — the same
 * pattern LFO uses, doubled (one scaler map per axis since X and Y depth are
 * independent).
 *
 * Record/Play functionality (movement capture and looped playback) is added
 * in a later increment; this class currently supports only live position
 * tracking and depth-scaled CV output (User Story 1).
 */
export class XYPad extends SynthComponent {
  private xSourceNode: ConstantSourceNode | null = null;
  private ySourceNode: ConstantSourceNode | null = null;
  private xConnectionScalers: Map<string, XYConnectionScaler>;
  private yConnectionScalers: Map<string, XYConnectionScaler>;

  private _x: number = 0.5;
  private _y: number = 0.5;
  private _state: XYPadState = XYPadState.IDLE;

  private _recording: MovementRecording | null = null;
  private _captureSamples: Float32Array | null = null;
  private _captureSampleCount: number = 0;
  private _captureStartTime: number = 0;
  private _captureRafId: number | null = null;

  private _playbackStartTime: number = 0;
  private _playbackRafId: number | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.XY_PAD, 'X-Y Pad', position);

    this.addOutput('x', 'X', SignalType.CV);
    this.addOutput('y', 'Y', SignalType.CV);

    this.addParameter('xDepth', 'X Depth', 50, 0, 100, 1, '%');
    this.addParameter('yDepth', 'Y Depth', 50, 0, 100, 1, '%');

    this.xConnectionScalers = new Map();
    this.yConnectionScalers = new Map();
  }

  /**
   * Create audio nodes. Each axis gets a ConstantSourceNode holding the
   * current normalised [0,1] position as its offset — a GainNode alone
   * cannot emit a value with no upstream signal to scale, so (like Collider's
   * frequency/gate outputs) a started ConstantSourceNode is the actual
   * signal source; per-connection scalers tap it the same way LFO's
   * connectionScalers tap its shared gainNode.
   */
  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    this.xSourceNode = ctx.createConstantSource();
    this.xSourceNode.offset.value = this._x;
    this.xSourceNode.start();

    this.ySourceNode = ctx.createConstantSource();
    this.ySourceNode.offset.value = this._y;
    this.ySourceNode.start();

    this.registerAudioNode('xSource', this.xSourceNode);
    this.registerAudioNode('ySource', this.ySourceNode);

    console.log(`XYPad ${this.id} created`);
  }

  /**
   * Destroy audio nodes — cancel any active capture/playback loop and
   * disconnect/release all per-connection scalers first.
   */
  destroyAudioNodes(): void {
    if (this._captureRafId !== null) {
      cancelAnimationFrame(this._captureRafId);
      this._captureRafId = null;
    }
    this._stopPlayback();

    this.xConnectionScalers.forEach(({ node, offsetNode, combined }) => {
      try { node.disconnect(); } catch (_) { /* already disconnected */ }
      try { offsetNode.stop(); offsetNode.disconnect(); } catch (_) { /* already stopped */ }
      try { combined.disconnect(); } catch (_) { /* already disconnected */ }
    });
    this.xConnectionScalers.clear();

    this.yConnectionScalers.forEach(({ node, offsetNode, combined }) => {
      try { node.disconnect(); } catch (_) { /* already disconnected */ }
      try { offsetNode.stop(); offsetNode.disconnect(); } catch (_) { /* already stopped */ }
      try { combined.disconnect(); } catch (_) { /* already disconnected */ }
    });
    this.yConnectionScalers.clear();

    if (this.xSourceNode) {
      try { this.xSourceNode.stop(); } catch (_) { /* already stopped */ }
      this.xSourceNode.disconnect();
      this.xSourceNode = null;
    }
    if (this.ySourceNode) {
      try { this.ySourceNode.stop(); } catch (_) { /* already stopped */ }
      this.ySourceNode.disconnect();
      this.ySourceNode = null;
    }

    console.log(`XYPad ${this.id} destroyed`);
  }

  /**
   * Update audio parameter — re-scales existing connection GainNodes when
   * xDepth/yDepth change, ramped click-free like LFO's depth update.
   */
  updateAudioParameter(parameterId: string, value: number): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    if (parameterId === 'xDepth') {
      this.xConnectionScalers.forEach(({ node, fullDepthGain }) => {
        node.gain.setValueAtTime(node.gain.value, now);
        node.gain.linearRampToValueAtTime((value / 100) * fullDepthGain, now + CV.RAMP_SECONDS);
      });
    } else if (parameterId === 'yDepth') {
      this.yConnectionScalers.forEach(({ node, fullDepthGain }) => {
        node.gain.setValueAtTime(node.gain.value, now);
        node.gain.linearRampToValueAtTime((value / 100) * fullDepthGain, now + CV.RAMP_SECONDS);
      });
    }
  }

  /**
   * Set the current normalised axis position (called by XYPadDisplay on
   * drag). Named distinctly from the inherited SynthComponent.setPosition
   * (which moves the component on the canvas) to avoid a signature clash.
   * Clamps to [0, 1] per axis and updates both raw output GainNodes.
   *
   * If a manual drag arrives while PLAYING, playback is immediately
   * interrupted and manual control takes over (FR-014). If RECORDING, the
   * capture loop reads position from _x/_y directly each frame, so setting
   * them here is sufficient — no separate sample-append call is needed.
   */
  setAxisPosition(x: number, y: number): void {
    if (this._state === XYPadState.PLAYING) {
      this._stopPlayback();
      this._state = XYPadState.IDLE;
    }

    const clamped = clampPosition({ x, y });
    this._x = clamped.x;
    this._y = clamped.y;

    if (this.xSourceNode) {
      this.xSourceNode.offset.value = this._x;
    }
    if (this.ySourceNode) {
      this.ySourceNode.offset.value = this._y;
    }
  }

  /**
   * Whether the Play control should be enabled (FR-012).
   */
  isPlayAvailable(): boolean {
    return isPlayableRecording(this._recording);
  }

  /**
   * Get the current state (idle/recording/playing).
   */
  getState(): XYPadState {
    return this._state;
  }

  // ---------------------------------------------------------------------------
  // State machine — public press methods (mirrors Looper's press-method style)
  // ---------------------------------------------------------------------------

  /**
   * Start recording. If PLAYING, stops playback first (starting a new
   * recording always discards any previous one, FR-013). Capture begins
   * immediately at the current resting position (FR-008, clarified: no
   * arm-and-wait — a static pointer still produces a flat lead-in).
   */
  pressRecord(): void {
    if (this._state === XYPadState.PLAYING) {
      this._stopPlayback();
    }
    this._startRecording();
  }

  /**
   * Stop the active recording or playback. No-op when already IDLE.
   */
  pressStop(): void {
    if (this._state === XYPadState.RECORDING) {
      this._finalizeRecording();
      this._state = XYPadState.IDLE;
    } else if (this._state === XYPadState.PLAYING) {
      this._stopPlayback();
      this._state = XYPadState.IDLE;
    }
  }

  /**
   * Start looped playback of the current recording. No-op if no recording
   * exists (Play control is disabled in that case per FR-012) or if not IDLE.
   */
  pressPlay(): void {
    if (this._state !== XYPadState.IDLE) return;
    if (!isPlayableRecording(this._recording)) return;
    this._startPlayback();
  }

  // ---------------------------------------------------------------------------
  // Recording capture
  // ---------------------------------------------------------------------------

  private _startRecording(): void {
    this._recording = null;
    this._captureSamples = new Float32Array(XY_PAD.MAX_SAMPLES * 3);
    this._captureSampleCount = 0;
    this._captureStartTime = performance.now();
    this._state = XYPadState.RECORDING;

    const sampleIntervalMs = 1000 / XY_PAD.SAMPLE_RATE_HZ;
    let lastSampleTime = 0;

    const captureLoop = (): void => {
      if (this._state !== XYPadState.RECORDING || !this._captureSamples) return;

      const now = performance.now();
      const elapsed = now - this._captureStartTime;

      if (elapsed - lastSampleTime >= sampleIntervalMs) {
        lastSampleTime = elapsed;
        const i = this._captureSampleCount * 3;
        this._captureSamples[i] = elapsed;
        this._captureSamples[i + 1] = this._x;
        this._captureSamples[i + 2] = this._y;
        this._captureSampleCount++;

        if (hasReachedRecordingLimit(this._captureSampleCount, XY_PAD.MAX_SAMPLES)) {
          this._finalizeRecording();
          this._state = XYPadState.IDLE;
          return;
        }
      }

      this._captureRafId = requestAnimationFrame(captureLoop);
    };

    this._captureRafId = requestAnimationFrame(captureLoop);
  }

  private _finalizeRecording(): void {
    if (this._captureRafId !== null) {
      cancelAnimationFrame(this._captureRafId);
      this._captureRafId = null;
    }

    if (this._captureSamples && this._captureSampleCount > 0) {
      const durationMs = this._captureSamples[(this._captureSampleCount - 1) * 3] ?? 0;
      this._recording = {
        samples: this._captureSamples.slice(0, this._captureSampleCount * 3),
        sampleCount: this._captureSampleCount,
        durationMs,
      };
    } else {
      this._recording = null;
    }

    this._captureSamples = null;
    this._captureSampleCount = 0;
  }

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------

  private _startPlayback(): void {
    if (!isPlayableRecording(this._recording)) return;

    this._playbackStartTime = performance.now();
    this._state = XYPadState.PLAYING;

    const playbackLoop = (): void => {
      if (this._state !== XYPadState.PLAYING || !isPlayableRecording(this._recording)) return;

      const elapsed = performance.now() - this._playbackStartTime;
      const wrapped = wrapPlaybackTime(elapsed, this._recording.durationMs);
      const { x, y } = this._sampleAt(this._recording, wrapped);

      this._x = x;
      this._y = y;
      if (this.xSourceNode) this.xSourceNode.offset.value = x;
      if (this.ySourceNode) this.ySourceNode.offset.value = y;

      this._playbackRafId = requestAnimationFrame(playbackLoop);
    };

    this._playbackRafId = requestAnimationFrame(playbackLoop);
  }

  private _stopPlayback(): void {
    if (this._playbackRafId !== null) {
      cancelAnimationFrame(this._playbackRafId);
      this._playbackRafId = null;
    }
  }

  /**
   * Find the position at a given elapsed time within a recording, linearly
   * interpolating between the two nearest captured samples.
   */
  private _sampleAt(recording: MovementRecording, elapsedMs: number): XYPosition {
    const { samples, sampleCount } = recording;

    if (sampleCount === 1) {
      return { x: samples[1] ?? 0.5, y: samples[2] ?? 0.5 };
    }

    // Find the first sample whose timestamp is >= elapsedMs.
    let hi = 0;
    while (hi < sampleCount && (samples[hi * 3] ?? 0) < elapsedMs) hi++;

    if (hi === 0) {
      return { x: samples[1] ?? 0.5, y: samples[2] ?? 0.5 };
    }
    if (hi >= sampleCount) {
      const last = sampleCount - 1;
      return { x: samples[last * 3 + 1] ?? 0.5, y: samples[last * 3 + 2] ?? 0.5 };
    }

    const lo = hi - 1;
    const tLo = samples[lo * 3] ?? 0;
    const tHi = samples[hi * 3] ?? 0;
    const span = tHi - tLo;
    const frac = span > 0 ? (elapsedMs - tLo) / span : 0;

    const xLo = samples[lo * 3 + 1] ?? 0.5;
    const xHi = samples[hi * 3 + 1] ?? 0.5;
    const yLo = samples[lo * 3 + 2] ?? 0.5;
    const yHi = samples[hi * 3 + 2] ?? 0.5;

    return {
      x: xLo + (xHi - xLo) * frac,
      y: yLo + (yHi - yLo) * frac,
    };
  }

  /**
   * Get the current normalised position.
   */
  getPosition(): XYPosition {
    return { x: this._x, y: this._y };
  }

  /**
   * Get display state for XYPadDisplay's render loop.
   */
  getDisplayState(): XYPadDisplayState {
    return {
      state: this._state,
      x: this._x,
      y: this._y,
      hasRecording: isPlayableRecording(this._recording),
    };
  }

  /**
   * Connect an output (X or Y) to a target component. For CV connections
   * where the target exposes both an AudioParam and a parameter range, a
   * dedicated per-connection scaler GainNode is created so each axis can
   * drive multiple destinations simultaneously with independent scaling.
   */
  override connectTo(target: SynthComponent, outputId: string = 'output', inputId: string = 'input'): void {
    const isX = outputId === 'x';
    const isY = outputId === 'y';
    const sourceNode = isX ? this.xSourceNode : isY ? this.ySourceNode : null;
    const depthParamId = isX ? 'xDepth' : 'yDepth';
    const scalerMap = isX ? this.xConnectionScalers : this.yConnectionScalers;

    if (!sourceNode || (!isX && !isY)) {
      super.connectTo(target, outputId, inputId);
      return;
    }

    const outputPort = this.outputs.get(outputId);
    if (!outputPort || outputPort.type !== SignalType.CV) {
      super.connectTo(target, outputId, inputId);
      return;
    }

    const targetParam = target.getAudioParamForInput(inputId);
    const targetRange = target.getParameterRangeForInput(inputId);

    if (!targetParam || !targetRange) {
      super.connectTo(target, outputId, inputId);
      return;
    }

    const ctx = audioEngine.getContext();
    const depth = this.getParameter(depthParamId)?.getValue() ?? 50;
    const fullDepthGain = targetRange.max - targetRange.min;
    const scalerGain = computeScaleGain(depth, targetRange);

    // Scales the [0,1] position into [0, depth% × span]...
    const scaler = ctx.createGain();
    scaler.gain.value = scalerGain;
    sourceNode.connect(scaler);

    // ...a constant offset holds range.min...
    const offsetNode = ctx.createConstantSource();
    offsetNode.offset.value = targetRange.min;
    offsetNode.start();

    // ...and both sum into `combined` (identity gain), so combined's output is
    // the true [range.min, range.min + depth% × span] value — this is both
    // what reaches the target AudioParam and what the visualizer taps.
    const combined = ctx.createGain();
    combined.gain.value = 1;
    scaler.connect(combined);
    offsetNode.connect(combined);
    combined.connect(targetParam);

    const key = `${target.id}:${inputId}`;
    scalerMap.set(key, { node: scaler, offsetNode, combined, fullDepthGain });

    const inputPort = target.inputs.get(inputId);
    if (outputPort && inputPort) {
      outputPort.connect(inputPort.id);
      inputPort.connect(outputPort.id);
    }

    target.onInputConnected(inputId);

    console.log(`✓ XYPad ${this.id}:${outputId} → ${target.id}:${inputId} (CV scaler gain=${scalerGain.toFixed(2)}, offset=${targetRange.min})`);
  }

  /**
   * Disconnect an output (X or Y) from a target component. Cleans up the
   * per-connection scaler if one exists.
   */
  override disconnectFrom(target: SynthComponent, outputId?: string, inputId?: string): void {
    if (!outputId || !inputId) {
      super.disconnectFrom(target, outputId, inputId);
      return;
    }

    const isX = outputId === 'x';
    const isY = outputId === 'y';
    const scalerMap = isX ? this.xConnectionScalers : isY ? this.yConnectionScalers : null;

    if (!scalerMap) {
      super.disconnectFrom(target, outputId, inputId);
      return;
    }

    const key = `${target.id}:${inputId}`;
    const scaler = scalerMap.get(key);

    if (scaler) {
      try { scaler.node.disconnect(); } catch (_) { /* already disconnected */ }
      try { scaler.offsetNode.stop(); scaler.offsetNode.disconnect(); } catch (_) { /* already stopped */ }
      try { scaler.combined.disconnect(); } catch (_) { /* already disconnected */ }
      scalerMap.delete(key);

      const outputPort = this.outputs.get(outputId);
      const inputPort = target.inputs.get(inputId);
      if (outputPort) outputPort.disconnect();
      if (inputPort) inputPort.disconnect();

      target.onInputDisconnected(inputId);

      console.log(`✓ XYPad ${this.id} disconnected from ${target.id}:${inputId} (scaler removed)`);
      return;
    }

    super.disconnectFrom(target, outputId, inputId);
  }

  /**
   * Return the per-connection combined (scaler + offset) GainNode for a
   * specific target connection, so ModulationVisualizer can tap the true
   * post-scale/offset signal (matching LFO's getScaledOutputForConnection
   * signature — ModulationVisualizer calls this with just (targetId,
   * inputId), so both axis maps are checked since a target input can only
   * be driven by one of X or Y at a time in practice).
   * Returns null if no scaler exists for that connection on either axis.
   */
  getScaledOutputForConnection(targetId: string, inputId: string): GainNode | null {
    const key = `${targetId}:${inputId}`;
    const xScaler = this.xConnectionScalers.get(key);
    if (xScaler) return xScaler.combined;
    const yScaler = this.yConnectionScalers.get(key);
    return yScaler ? yScaler.combined : null;
  }

  /**
   * Get output node for a specific port ('x' or 'y').
   */
  protected override getOutputNodeByPort(portId: string): AudioNode | null {
    switch (portId) {
      case 'x':
        return this.xSourceNode;
      case 'y':
        return this.ySourceNode;
      default:
        return this.xSourceNode;
    }
  }

  /**
   * Get the main output node for connections (defaults to X, matches the
   * Collider/KeyboardInput dual-output convention).
   */
  getOutputNode(): AudioNode | null {
    return this.xSourceNode;
  }

  /**
   * Get input node (X-Y Pad has no inputs).
   */
  getInputNode(): AudioNode | null {
    return null;
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  /**
   * Serialize including any recorded movement, reusing the generic
   * ComponentData.audioBlob slot (the same mechanism Looper uses for its
   * audio buffer). Unlike Looper's serialize(), this does NOT overwrite
   * base.parameters — xDepth/yDepth are already written there by
   * SynthComponent.serialize()'s addParameter loop and must be preserved.
   */
  override serialize(): import('../../core/types').ComponentData {
    const base = super.serialize();
    if (isPlayableRecording(this._recording)) {
      base.audioBlob = this._float32ToBase64(this._recording.samples);
    }
    return base;
  }

  /**
   * Restore xDepth/yDepth (via super.deserialize()) and any recorded
   * movement from audioBlob. State always restores to IDLE — never resumes
   * RECORDING or PLAYING, matching the Looper's conservative reload guard.
   */
  override deserialize(data: import('../../core/types').ComponentData): void {
    super.deserialize(data);
    this._state = XYPadState.IDLE;

    if (data.audioBlob) {
      try {
        const samples = this._base64ToFloat32(data.audioBlob);
        const sampleCount = samples.length / 3;
        const durationMs = samples[(sampleCount - 1) * 3] ?? 0;
        this._recording = { samples, sampleCount, durationMs };
      } catch {
        this._recording = null;
      }
    } else {
      this._recording = null;
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
}
