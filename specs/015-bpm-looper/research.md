# Research: BPM-Synced Looper (015)

**Date**: 2026-04-18
**Branch**: `015-bpm-looper`

---

## Decision 1: Audio Recording & Playback — AudioWorklet vs Web Audio API nodes

**Decision**: Use `MediaRecorder` / `AudioBuffer` + Web Audio API nodes only. No AudioWorklet.

**Rationale**: The codebase has zero AudioWorklet usage — no worklet files, no `addModule()` calls, no build-time worklet bundling. Introducing AudioWorklet would require a separate worker file, HTTPS or localhost context, and new build configuration. The Web Audio API's `AudioBuffer` + `ScriptProcessorNode`/`MediaRecorder` approach integrates with the existing `audioEngine.getContext()` pattern and meets the zero-new-dependencies constraint. For a looper that operates at human tempo (bar-length buffers, not sample-by-sample DSP), `AudioBuffer` recording via an `AnalyserNode` + timed sampling — or via a `MediaStreamAudioDestinationNode` feeding `MediaRecorder` — provides sufficient accuracy.

**Implementation approach**: Use a `ScriptProcessorNode` (deprecated but universally available in the browser target and consistent with the rest of the codebase) for sample capture into a `Float32Array` buffer during recording. Playback via an `AudioBufferSourceNode` looping with `loop = true` and precise `loopStart`/`loopEnd`. Passthrough via a direct `GainNode` routing input → output at gain 1.0 in all states.

**Alternatives considered**:
- AudioWorklet: Correct modern approach but adds build complexity not present in the project — rejected.
- MediaRecorder: High-level API, easy recording, but limited control over timing precision and not suited to sample-accurate loop boundaries — rejected.
- Web Audio API-native loop (AudioBufferSourceNode only): Could work for playback but capturing to a buffer still requires a tap node — ScriptProcessorNode is the most straightforward tap in this codebase.

---

## Decision 2: Loop Buffer Serialisation — Base64 PCM in ComponentData

**Decision**: Extend `ComponentData` with an optional `audioBlob?: string` field (Base64-encoded raw IEEE 754 Float32 PCM, mono).

**Rationale**: `ComponentData.parameters` is `Record<string, number>` — numeric only and cannot hold binary data. Adding a top-level optional `audioBlob` field to `ComponentData` is backward-compatible: existing components do not set it, and the PatchSerializer ignores it for non-Looper components. On load, `audioBlob` is decoded back to a `Float32Array` and placed into an `AudioBuffer`.

**Size estimate**: 8 bars at 120 BPM = 16 s × 44100 samples/s × 4 bytes = ~2.8 MB raw → ~3.7 MB Base64. Patches with a Looper will be larger than typical patches — this is accepted per the spec.

**Alternatives considered**:
- IndexedDB: Would keep patches small but requires async deserialization and a new storage layer — rejected for MVP.
- Separate audio file export: Future enhancement; not needed for the initial feature.

---

## Decision 3: Canvas Display Pattern — Separate Embedded Canvas (Collider pattern)

**Decision**: Follow the `ColliderDisplay` pattern — a dedicated `LooperDisplay` class with its own `HTMLCanvasElement` appended to the DOM alongside the main synth canvas.

**Rationale**: The doughnut ring requires continuous animation (rotating playhead) independent of other canvas redraws. The Collider component uses exactly this pattern for its physics visualization. ChordFinderDisplay renders statically into the main canvas — not suitable here because the playhead needs per-frame updates driven by the audio clock.

**Key wiring points** (from codebase research):
- `CanvasComponent.createControls()` instantiates `LooperDisplay` and appends its canvas to the DOM.
- `LooperDisplay.updatePosition(x, y)` called whenever the CanvasComponent moves.
- `LooperDisplay.destroy()` removes canvas from DOM on component removal.
- `Looper` SynthComponent holds a reference to `LooperDisplay` for state updates.

---

## Decision 4: Global BPM Integration — EventBus subscription + TempoAware interface

**Decision**: Implement the `TempoAware` interface from `src/core/types.ts` — subscribe to `EventType.GLOBAL_BPM_CHANGED` in `activate()` and unsubscribe in `deactivate()`.

**Rationale**: All tempo-aware components in the codebase (Collider, StepSequencer) use this pattern. The loop duration in seconds is computed at the moment recording begins using the current BPM from `globalBpmController.getBpm()`. Subsequent BPM changes do not affect a loop already in the buffer (per spec FR-004).

---

## Decision 5: Keyboard Reserved-Key Mechanism

**Decision**: Add a static `RESERVED_KEYS: ReadonlySet<string>` to `KeyboardController` (keys: `'1'`, `'2'`, `'0'`). In `handleKeyDown()`, return early before note mapping if `RESERVED_KEYS.has(key)`.

**Rationale**: The existing `KeyboardController.handleKeyDown()` already has an input-field guard and repeat suppression — adding a reserved-key check is a minimal, targeted change. No global event listener interception is needed. The Looper's shortcut handler listens on `window` independently; the two handlers are siblings, not nested.

---

## Decision 6: Input Passthrough — Always-on GainNode

**Decision**: Route the Looper's input port through a `GainNode` (gain = 1.0) directly to the output port at all times. This node is created in `createAudioNodes()` and is never disconnected. The loop playback `AudioBufferSourceNode` merges into the same output destination.

**Rationale**: FR-019 requires passthrough in all states including idle. A permanent passthrough GainNode requires zero state management — it just exists. During overdub, both the passthrough GainNode output and the loop playback output feed the same destination node, satisfying FR-020.

---

## Decision 7: Overdub Mixing — In-place Float32Array accumulation

**Decision**: During overdub, each `ScriptProcessorNode` `onaudioprocess` block mixes incoming samples directly into the existing `Float32Array` buffer at the current write position: `buffer[i] += inputSample`. No feedback coefficient — straight mix at unity gain (FR-009, clarification B).

**Rationale**: Full accumulation with no decay is the standard Boss RC / Loopy Pro behaviour and is what the user selected. The buffer grows in volume with each overdub pass — mix management is the musician's responsibility.

---

## File Structure

```text
src/components/utilities/Looper.ts         # SynthComponent + TempoAware
src/canvas/displays/LooperDisplay.ts       # Doughnut ring canvas (ColliderDisplay pattern)
src/core/types.ts                          # Extend ComponentData.audioBlob?, add EventTypes
src/keyboard/KeyboardController.ts         # Add RESERVED_KEYS set (1, 2, 0)
tests/components/Looper.test.ts            # State machine, serialization, BPM sync
tests/components/Looper.buffer.test.ts     # Buffer record/overdub/clear
tests/canvas/LooperDisplay.test.ts         # Display state → colour mapping
tests/keyboard/KeyboardController.reserved.test.ts  # Reserved-key guard
```
