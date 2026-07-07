# Phase 0 Research: X-Y Pad Controller

No `[NEEDS CLARIFICATION]` markers remained in the spec after `/speckit-clarify` (see spec.md Clarifications). This document records the technical decisions needed to move from spec to design, each grounded in existing codebase patterns rather than introducing new ones.

## Decision: CV output scaling — per-connection GainNode adapter (LFO pattern)

**Decision**: Reuse the LFO's `connectTo` override pattern: each X/Y output gets its own `GainNode`-based scaler per target connection, sized from the target's `getParameterRangeForInput(portId)` and the axis's depth parameter (0-100%), keyed in a `Map<string, ConnectionScaler>` by `${target.id}:${inputId}`.

**Rationale**: `SynthComponent.connectTo` (base) only does a raw `outputNode.connect(targetParam)` with no scaling. `LFO.ts:181-233` already solves exactly this problem — normalized signal × depth% × target range — and is called out in its own code as the reusable template for future CV sources. The X-Y Pad's requirement (FR-004a: per-axis depth scaling against the target's declared range) is structurally identical, just with two independent axes instead of one signal.

**Alternatives considered**:
- *Fixed voltage convention (e.g. always -5V to +5V) with target doing its own scaling*: Rejected — no such convention exists anywhere in this codebase; every existing CV source scales itself against the target's range.
- *A single shared GainNode per axis (not per-connection)*: Rejected — would prevent two different targets from having independently useful depth on the same axis's output, and diverges from the LFO precedent without a clear benefit.

## Decision: Movement capture mechanism — requestAnimationFrame sampling, not audio-thread

**Decision**: Sample `(performance.now(), x, y)` at ~60/sec via `requestAnimationFrame` while in the Recording state, writing into a pre-allocated fixed-length buffer sized for the 60-second maximum (≈3600 samples), matching the Looper's fixed-buffer bound-up-front approach but using a UI-thread timer instead of an audio-thread callback.

**Rationale**: The Looper's capture uses a `ScriptProcessorNode`'s `onaudioprocess` because it is capturing an actual audio signal at the audio sample rate. The X-Y Pad captures pointer/UI state, not an audio signal — there is no audio-thread reason to sample it there, and doing so would add unnecessary AudioWorklet/ScriptProcessor complexity for a value that only changes on user interaction. `requestAnimationFrame` is the standard, already-used-elsewhere (canvas render loops, e.g. Looper's own display polling at `CanvasComponent.ts:1487-1495`) mechanism for UI-rate sampling in this codebase.

**Alternatives considered**:
- *ScriptProcessorNode/AudioWorklet capture, matching Looper exactly*: Rejected — over-engineered for a non-audio-rate signal; would also tie the sample rate to the audio context's block size rather than the requested ~60/sec.
- *Growing array (push each sample) instead of a fixed pre-sized buffer*: Rejected — the Looper's precedent and FR-017 (bounded max duration) both favor a fixed-size buffer allocated once, avoiding reallocation churn and making the max-duration cap trivial to enforce (stop when write index reaches capacity).

## Decision: Recorded data persistence — reuse `ComponentData.audioBlob`

**Decision**: Pack the captured `(t, x, y)` samples into a single `Float32Array` (interleaved: `[t0,x0,y0,t1,x1,y1,...]`), Base64-encode it with the same `_float32ToBase64`/`_base64ToFloat32` approach the Looper uses, and store it in the existing generic `ComponentData.audioBlob?: string` field.

**Rationale**: `audioBlob` is already documented in `core/types.ts` as a generic Base64 slot "used by Looper; ignored by all other components" — it is a general-purpose bytes-in-JSON field, not audio-specific in its actual mechanics (it's just a Float32Array-to-string codec). Reusing it means zero changes to `ComponentData`, `PatchSerializer`, or patch-format versioning, satisfying the plan's backward-compatibility constraint automatically.

**Alternatives considered**:
- *New `ComponentData.movementBlob` field*: Rejected — adds a schema field for what is mechanically identical serialization to an already-existing generic slot; increases surface area for backward-compatibility concerns for no benefit.
- *Storing samples as a plain number[][] in `parameters` or a new JSON field*: Rejected — `parameters` is typed `Record<string, number>` (single values only); a raw JSON array of ~3600 triples would bloat the patch JSON considerably more than Base64-packed binary floats.

## Decision: Interactive pad UI — dedicated overlay canvas (Looper pattern), not `controls[]`

**Decision**: Implement `XYPadDisplay` as a sibling `HTMLCanvasElement` overlay (pointer-events enabled), following `LooperDisplay`'s structure exactly: its own pointer-down/move/up handlers translated from client to local/zoom-corrected coordinates, a `requestAnimationFrame` render loop polling display state, and Record/Stop/Play buttons implemented as hit-testable regions within that same overlay canvas.

**Rationale**: The existing `controls[]` array (`Knob`, `Slider`, `Dropdown`, `Button` in `src/canvas/controls/`) is built for single-axis or discrete controls — `Knob.onMouseDown/onMouseMove` is explicitly vertical-drag-only (uses `deltaY`, a parameter literally named `_x` is unused for dragging). Retrofitting true 2D drag into that model would require changing the shared control interface for one component's benefit. The Looper already establishes the precedent for a component needing a large, custom-interaction 2D surface with its own buttons: a dedicated overlay canvas with its own event handling, wired into `CanvasComponent.createControls()` via a per-type `if` block exactly like the Looper's.

**Alternatives considered**:
- *New reusable `XYPadControl` implementing the standard control interface (`containsPoint`, `onMouseDown`, `onMouseMove`, `onMouseUp`) added to `src/canvas/controls/`*: Considered viable, but rejected for this feature since nothing else currently needs 2D drag, and the Looper precedent (dedicated overlay display) is the more directly analogous, already-proven pattern for "one component owns a large custom interactive area with multiple buttons." Revisit if a second 2D-drag component is later needed.

## Decision: Recording state on patch load — never resume RECORDING

**Decision**: On `deserialize()`, restore only `IDLE` or `PLAYING` state (if a recording exists), never `RECORDING`, matching the Looper's own deserialize guard.

**Rationale**: Directly reuses an existing, already-reviewed safety rule (`Looper.ts` deserialize, lines ~393-395) rather than inventing a new one — a reloaded page has no pointer actively dragging, so resuming a recording state would be meaningless and immediately stuck.

**Alternatives considered**: None — this is a direct precedent reuse, not an open design question.
