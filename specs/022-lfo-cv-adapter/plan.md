# Implementation Plan: LFO CV Adapter

**Branch**: `022-lfo-cv-adapter` | **Date**: 2026-05-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/022-lfo-cv-adapter/spec.md`

## Summary

The LFO currently outputs a single ±(depth/100) signal through one shared `GainNode`. When connected to multiple destinations (e.g. filter cutoff in Hz range and VCA gain in 0..1 range), it cannot scale differently for each — leading to clipping, gating, or silence. The fix introduces a **per-connection GainNode** inside the LFO, computed at connect time from the target parameter's `min`/`max` range. A new **Filter CV Amount** parameter (0–100%) replaces the hard-coded `cutoffCvScaler` workaround, giving users explicit control over ADSR→filter modulation depth. The `SynthComponent` base class fallback path (`getInputNodeByPort`) is retained as a general escape hatch but is removed from the Filter's primary CV path.

---

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**: Web Audio API, DOM — zero runtime dependencies
**Storage**: `localStorage` via existing `PatchSerializer` / `PatchStorage` pattern
**Testing**: Vitest (run via `vitest run`)
**Target Platform**: Browser (Vite dev server / static build)
**Project Type**: Single-page modular synthesizer app (`src/` flat structure with `core/`, `components/`, `ui/`, `patch/`, `canvas/`, `timing/` directories)
**Performance Goals**: 60 FPS canvas rendering; audio parameter changes take effect within one Web Audio scheduler tick (~128 samples); depth changes ramp over ~5 ms to avoid click artefacts
**Constraints**:
- Zero new runtime dependencies — Web Audio API + DOM only
- TypeScript strict mode enforced
- Follows existing singleton export pattern (`audioEngine`, `patchManager`, `eventBus`)
- Patch format changes must be backward-compatible (legacy patches must load without error)
- All 19 guided lesson patches must continue to load and play without modification (SC-004)

---

## Constitution Check

**Constitution Version**: 1.0

- [x] **Readability & Maintainability**: Per-connection map keyed by `"targetId:portId"` string is self-documenting. Helper `computeScaleGain()` stays well under 50 lines. No nesting beyond 3 levels.
- [x] **Code Organization**: LFO adapter logic lives in `LFO.ts`; Filter CV Amount in `Filter.ts`; connection plumbing in `SynthComponent.ts`. No cross-layer leakage.
- [x] **Code Standards**: Magic scale factor (4000) replaced by computed formula; named constant `CV_RAMP_SECONDS = 0.005` for the 5 ms ramp. Strict mode satisfied.
- [x] **Test Coverage**: `computeScaleGain()` utility reaches 100%; per-connection create/destroy/update logic reaches ≥ 80%.
- [x] **Test Quality**: Tests mock AudioContext (no real audio context needed). AAA pattern. Named descriptively.
- [x] **UI Consistency**: Filter CV Amount rendered as a third knob in the existing Filter knob row — matches existing cutoff/resonance pattern.
- [x] **User Feedback**: Depth knob change propagates to all active connections within the same audio render quantum (imperceptible lag via 5 ms ramp).
- [x] **Performance**: Per-connection GainNodes are lightweight; no polling or animation-frame work introduced.

No constitution violations requiring justification.

---

## Project Structure

### Documentation (this feature)

```text
specs/022-lfo-cv-adapter/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/
│   ├── types.ts         # TypeScript type contracts
│   └── validation.ts    # Validation helpers
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code Changes

```text
src/
├── components/
│   ├── generators/
│   │   └── LFO.ts                   # MODIFY: add per-connection GainNode map
│   └── processors/
│       └── Filter.ts                # MODIFY: add cvAmount param, remove cutoffCvScaler
├── canvas/
│   └── CanvasComponent.ts           # MODIFY: add CV Amount knob for Filter
└── utils/
    └── constants.ts                 # MODIFY: add CV_RAMP_SECONDS constant

tests/
├── components/generators/
│   └── LFO.test.ts                  # MODIFY: extend existing tests
└── components/processors/
    └── Filter.test.ts               # MODIFY: extend existing tests
```

---

## Phase 0: Research

### Resolved Decisions

#### Decision 1: Per-connection GainNode strategy
**Decision**: LFO maintains a `Map<string, GainNode>` keyed by `"${targetId}:${portId}"`. The normalised oscillator output (`gainNode`, gain = depth/100, ±1 at 100%) fans out through one GainNode per active connection, each with `gain = (depth/100) × (paramMax − paramMin) / 2`.

**Rationale**: Keeps the existing oscillator→gainNode chain intact (bypass, depth, waveform logic unchanged). Per-connection nodes are created/destroyed on connect/disconnect. Web Audio supports multiple `.connect()` calls from one source to many destinations.

**Alternative considered**: A single shared scaler with dynamic gain — rejected because it cannot simultaneously serve destinations with different parameter ranges.

#### Decision 2: Where to intercept connect/disconnect
**Decision**: Override `getOutputNodeByPort` in `LFO` to intercept calls during `connectTo()`. For disconnect, override a new `onBeforeDisconnectFrom()` hook in `SynthComponent` — **but** the simpler approach is: override `connectTo` and `disconnectFrom` in `LFO` directly, since `LFO` is the only CV source that needs per-connection scaling for now.

**Rationale**: Overriding in `LFO` is localised and requires no base class surgery beyond what already exists. FR-009 (encapsulation for future sources) is satisfied by the pattern being self-contained in the source component class.

**Alternative considered**: Modifying `SynthComponent.connectTo()` to automatically detect LFO sources — rejected because it couples the base class to a specific component type.

#### Decision 3: Scale formula for bipolar LFO
**Decision**: `scalerGain = (depth / 100) × (paramMax − paramMin) / 2`

The LFO oscillator outputs ±1. The depth `GainNode` (gain = depth/100) yields ±(depth/100). The per-connection scaler multiplies this by `(paramMax − paramMin) / 2`, producing a peak-to-peak swing of `depth% × (paramMax − paramMin)` centred on zero. The base parameter value set on the AudioParam acts as the centre offset (existing Web Audio additive model).

**Example — Filter cutoff** (min=0, max=20000): at 50% depth, scaler gain = `0.5 × 10000 = 5000`. Swing is ±5000 Hz around the base cutoff. With base cutoff 1200 Hz the actual frequency oscillates 200–6200 Hz — always positive.

**Example — VCA gain** (min=0, max=2): at 50% depth, scaler gain = `0.5 × 1.0 = 0.5`. Swing is ±0.5 around the base gain.

**Example — Oscillator detune** (min=−100, max=100): at 50% depth, scaler gain = `0.5 × 100 = 50`. Swing is ±50 cents.

#### Decision 4: Filter CV Amount implementation
**Decision**: Add parameter `cvAmount` (range 0–100, default 50, unit `%`) to `Filter`. In `createAudioNodes()`, create a `cvAmountGainNode` whose `gain` maps 0–100% → 0.0–1.0. Connect incoming CV sources to this node, and this node to `filterNode.frequency`. The `cutoffCvScaler` is removed entirely.

**Rationale**: The LFO's per-connection scaler already scales to Hz range; the `cvAmountGainNode` then applies user-controlled attenuation (0–1). For ADSR (0..1 unipolar): at CV Amount 100%, gain=1.0, so full ADSR swing adds 0..`(paramMax−paramMin)/2` Hz... 

**Wait** — this requires a separate treatment. The ADSR (0..1) connected to the Filter's `cutoff_cv` port should go through a dedicated GainNode whose `gain = cvAmount/100 × paramRange`. The LFO (±1 after depth) goes through its own per-connection scaler before reaching the AudioParam directly (bypassing `cvAmountGainNode`). 

**Revised decision**: 
- **LFO→filter cutoff**: LFO per-connection scaler output connects directly to `filterNode.frequency` (AudioParam). `getAudioParamForInput('cutoff_cv')` returns `filterNode.frequency`.
- **ADSR→filter cutoff**: ADSR (0..1) connects to `cvAmountGainNode` (gain = cvAmount/100 × paramRange). `cvAmountGainNode` connects to `filterNode.frequency`. `getInputNodeByPort('cutoff_cv')` returns `cvAmountGainNode` as the AudioNode fallback for non-LFO CV sources.
- The LFO bypasses `cvAmountGainNode` because it already has per-connection scaling. Other CV sources (ADSR, Step Sequencer) use the `cvAmountGainNode` path.

**This requires the LFO's `connectTo` override to call `getAudioParamForInput` directly (bypassing the AudioNode fallback path) and connect its per-connection scaler to the AudioParam.** The ADSR uses the existing `getInputNodeByPort` fallback path as intended.

#### Decision 5: Depth change propagation
**Decision**: When `updateAudioParameter('depth', value)` is called, iterate the `connectionScalers` map and call `linearRampToValueAtTime(newGain, ctx.currentTime + CV_RAMP_SECONDS)` on each scaler's `gain`. `CV_RAMP_SECONDS = 0.005` (5 ms).

**Rationale**: Eliminates click artefacts from abrupt gain steps mid-LFO cycle (clarification Q2 answer). The ramp is imperceptible as lag.

#### Decision 6: Patch backward compatibility
**Decision**: The lesson patches (L11 ADSR→filter) currently work via the `cutoffCvScaler` workaround. After the refactor:
- The Filter gains a `cvAmount` parameter with **default value 50** (50%).
- At 50% CV Amount, `cvAmountGainNode.gain = 0.5`. For ADSR (0..1), this multiplied by `paramRange` (20000) = max addition of 10000 Hz — equivalent to the old fixed gain of 5000 (actually 4000 in the workaround). A default of 50% produces a similar audible sweep to the existing workaround.
- Existing patch JSON files that don't include `cvAmount` will deserialise with the default value (50%) — backward compatible, no patch file changes required.
- LFO-connected lesson patches (L12, L13, L19) benefit from the correct per-connection scaling automatically.

---

## Phase 1: Design & Contracts

See [data-model.md](data-model.md) and [contracts/](contracts/) for detailed type definitions.

### Architecture Overview

```
LFO
├── oscillator (OscillatorNode)  ←─ unchanged
├── gainNode (depth scaler, ±depth/100)  ←─ unchanged
└── connectionScalers: Map<string, GainNode>  ←─ NEW
    ├── "filter1:cutoff_cv" → GainNode (gain = depth/100 × 10000)  ←─ connects to filterNode.frequency
    ├── "osc1:detune"       → GainNode (gain = depth/100 × 100)    ←─ connects to oscillator.detune
    └── "vca1:cv"           → GainNode (gain = depth/100 × 1.0)    ←─ connects to vca.gainNode.gain

Filter
├── inputGain (GainNode)        ←─ unchanged
├── filterNode (BiquadFilterNode)  ←─ unchanged
├── outputGain (GainNode)       ←─ unchanged
├── cvAmountGainNode (GainNode) ←─ NEW (replaces cutoffCvScaler)
│   gain = cvAmount/100 × (paramMax − paramMin)   (e.g. 0.5 × 20000 = 10000)
│   connects to filterNode.frequency
└── parameters:
    ├── type, cutoff, resonance   ←─ unchanged
    └── cvAmount (0–100%, default 50)  ←─ NEW
```

### LFO.connectTo override logic

```
override connectTo(target, outputId, inputId):
  if outputId === 'output' and target param range exists for inputId:
    param = target.getAudioParamForInput(inputId)
    if param exists:
      key = "${target.id}:${inputId}"
      scalerGain = computeScaleGain(depth, target.getParameter(inputId linked param))
      scaler = ctx.createGain()
      scaler.gain.value = scalerGain
      gainNode.connect(scaler)      ← depth-scaled LFO output feeds scaler
      scaler.connect(param)         ← scaler feeds AudioParam directly
      connectionScalers.set(key, scaler)
      return                        ← do NOT call super.connectTo()
  super.connectTo(...)              ← fallback for non-CV or no-range connections
```

### Filter.getAudioParamForInput override

```
getAudioParamForInput(inputId):
  if inputId === 'cutoff_cv':
    return filterNode.frequency   ← LFO uses this path (per-connection scaler → AudioParam)
  if inputId === 'resonance_cv':
    return filterNode.Q
  return null

getInputNodeByPort(portId):
  if portId === 'cutoff_cv':
    return cvAmountGainNode       ← ADSR / other CV sources use this path
  return super.getInputNodeByPort(portId)
```

### Serialisation

`cvAmount` is a standard `Parameter` — it serialises via the existing `SynthComponent.serialize()` path (collects all `parameters` values into `ComponentData.parameters`). No changes to `PatchSerializer` required.

---

## Complexity Tracking

No constitution violations requiring justification.

| Decision | Tradeoff | Justification |
|----------|----------|---------------|
| LFO overrides `connectTo`/`disconnectFrom` | Duplicates some base-class routing logic | Localised to one component; avoids coupling base class to LFO-specific logic (FR-009) |
| Two CV paths on Filter (`getAudioParamForInput` for LFO, `getInputNodeByPort` for ADSR) | Slightly asymmetric | Required to let LFO bypass cvAmountGainNode (which would double-scale it) while ADSR still gets user-controlled depth via cvAmount knob |
