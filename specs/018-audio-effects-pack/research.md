# Research: Audio Effects Pack

**Feature**: 018-audio-effects-pack  
**Date**: 2026-04-29

---

## Decision 1: Bitcrusher DSP approach

**Decision**: Implement as a `ScriptProcessorNode` (or `AudioWorkletNode`) with a JavaScript processing loop that quantizes sample values and applies sample-rate reduction via a sample-hold counter.

**Rationale**: The Web Audio API has no built-in bitcrusher. A `ScriptProcessorNode` is the simplest approach that works in all browsers without a separate worklet file. For this project's zero-new-dependencies constraint and audio context mock pattern in tests, `ScriptProcessorNode` is preferable. `AudioWorkletNode` would require a separate processor file loaded via `addModule()`, complicating the test setup significantly.

**Alternatives considered**:
- `AudioWorkletNode`: Better performance and lower latency, but requires a separate worklet script loaded via URL, incompatible with the project's Vitest mock setup.
- `WaveShaperNode` with lookup table: Cannot model sample-rate reduction (only quantization); insufficient.

---

## Decision 2: Flanger DSP approach

**Decision**: Implement with `DelayNode` + internal `OscillatorNode` (LFO) modulating `delayTime`. Delay range: 1–10ms base; LFO modulates ±1–5ms. Uses same equal-power dry/wet crossfade as Chorus.

**Rationale**: Identical in structure to the existing `Chorus` class. Flanging uses shorter delays (1–10ms vs. Chorus's 20ms) and often uses feedback. Feedback is implemented via a `GainNode` connecting the delay output back to the delay input, with gain clamped to 0–0.95 to prevent runaway.

**Alternatives considered**:
- Chorus with tighter delays: Reusing Chorus with different parameter defaults was considered but rejected — the feedback path changes the signal graph and warrants a distinct class.

---

## Decision 3: Phaser DSP approach

**Decision**: Implement using a chain of `BiquadFilterNode`s set to `allpass` type. Stage count (2, 4, 6, 8) determines chain length. An internal LFO modulates the `frequency` AudioParam of each allpass filter in unison. Feedback from output back to input via a clamped `GainNode`.

**Rationale**: `BiquadFilterNode` in `allpass` mode is the standard Web Audio approach for phasing. Each allpass stage shifts phase by 180° at its center frequency; chaining stages creates the characteristic notch pattern. No `ScriptProcessorNode` needed — all native nodes.

**Implementation note**: Stage count changes require recreating the audio node graph (disconnect old chain, create new chain, reconnect). This is acceptable since stage count is a setup parameter, not a real-time knob — users select it like a mode switch.

**Alternatives considered**:
- Single `BiquadFilterNode` with higher-order type: Web Audio's `BiquadFilterNode` is always 2nd-order; multi-stage must be chained manually.

---

## Decision 4: Tremolo DSP approach

**Decision**: Implement with `GainNode` + internal `OscillatorNode` (LFO) modulating `gain.value`. LFO output is offset to the range [0, 1] using a DC offset `GainNode` and constant source. Depth (0–100%) scales the modulation amplitude; at 0% depth the gain stays at 1.0 (no modulation).

**Rationale**: Tremolo is pure amplitude modulation — the simplest of the four effects. Uses only native `GainNode` and `OscillatorNode`, no scripted nodes. The [0,1] LFO scaling (rather than [-1,1]) ensures volume never goes negative.

**LFO offset technique**: `ConstantSourceNode` providing DC offset of 0.5 + LFO signal scaled by `depth/2` → gain oscillates between `(0.5 - depth/2)` and `(0.5 + depth/2)`. At depth=1: [0, 1]. At depth=0: [0.5, 0.5] (constant).

**Alternatives considered**:
- `ScriptProcessorNode`: Unnecessary complexity when native nodes suffice.
- Ring modulation (bipolar LFO into GainNode): Produces tremolo but also ring-mod artifacts at high depth; the offset technique is cleaner.

---

## Decision 5: Phaser stage count change strategy

**Decision**: When the `stages` parameter changes, call `destroyAudioNodes()` then `createAudioNodes()` on the Phaser instance, preserving all other parameter values before reinitialisation.

**Rationale**: The allpass filter chain length is structural — it cannot be changed incrementally without disconnecting and reconnecting nodes. Since stage count is a coarse setting (2/4/6/8), the brief audio dropout during graph recreation is acceptable and consistent with how other "mode switch" parameters work in this codebase (e.g., filter type changes).

---

## Decision 6: Bypass implementation

**Decision**: All four effects use the same `enableBypass` / `disableBypass` pattern as `Chorus.ts`: store `_bypassConnections`, disconnect processing nodes, wire `inputGain → outputGain` directly, then restore on un-bypass.

**Rationale**: Consistent with existing bypass interface. No new patterns needed.

---

## Decision 7: Test approach for ScriptProcessorNode (Bitcrusher)

**Decision**: Mock `ScriptProcessorNode` in the existing Vitest audio mock (`tests/mocks/` or `tests/setup.ts`), adding `onaudioprocess` callback invocation support. Test quantization logic by extracting it into a pure function `quantizeSample(value, bitDepth)` testable without Web Audio.

**Rationale**: The project already mocks the Web Audio API for unit tests. Pure function extraction follows the existing pattern (e.g., `TimingCalculator`) and achieves 100% coverage of the DSP math without requiring a real audio context.
