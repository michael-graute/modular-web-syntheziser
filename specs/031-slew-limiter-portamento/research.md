# Research: Slew Limiter / Portamento

**Feature**: 031-slew-limiter-portamento
**Date**: 2026-06-03

---

## Decision 1: CV Signal Architecture — ConstantSourceNode Pattern

**Decision**: Use a `ConstantSourceNode` whose `offset` AudioParam carries the smoothed CV value, identical to the pattern used by `EnvelopeFollower` and `Quantizer`.

**Rationale**: Every CV-producing component in this project exposes its output via a `ConstantSourceNode.offset`. Patch connections call `sourceNode.connect(targetNode.getAudioParamForInput(...))`. Adopting the same pattern means the Slew Limiter integrates into the existing patch system with zero changes to `PatchManager` or `ConnectionManager`.

**Alternatives considered**:
- `ScriptProcessorNode` / `AudioWorkletNode` for sample-accurate slew: rejected — over-engineered for a CV utility that updates at frame rate (~60 fps), which is more than sufficient for glide time constants in the ms–seconds range.
- `WaveShaperNode` for slew shaping: rejected — cannot read and write CV state; requires imperative frame-driven update.

---

## Decision 2: Smoothing Algorithm — IIR First-Order Lowpass (Frame-Driven)

**Decision**: Implement the slew as a frame-driven IIR first-order lowpass, identical to `EnvelopeFollower.tick()`. Use the same `computeSmoothingCoeff(timeMs, dtSec)` helper (already exported from `EnvelopeFollowerValidation.ts`).

**Rationale**: The coefficient formula `coeff = 1 − exp(−dt / τ)` gives exact exponential approach behaviour regardless of frame rate variance. It maps directly to the Rise/Fall time constants specified in the spec. The helper is already tested and proven in production via the Envelope Follower.

**Slew direction detection**: Compare incoming CV value to current output value each frame:
- If `target > current` → apply Rise coefficient
- If `target < current` → apply Fall coefficient
- If equal → no update needed

**Alternatives considered**:
- Linear ramp (`setValueAtTime` + `linearRampToValueAtTime`): poor for rapid incoming CV changes (a new target cancels the ramp and creates artefacts); also cannot update at audio-scheduler precision from a frame loop.
- `exponentialRampToValueAtTime`: same cancellation problem as linear ramp; also undefined for zero-crossing.

---

## Decision 3: Exponential Knob Scale

**Decision**: Knob parameters use the existing `Parameter` range system (min/max/step). To achieve exponential feel, use a small step (0.1 ms) and let the UI Knob control map rotation linearly in log space. The actual stored value is the raw ms value; the exponential taper is a UI concern handled in the Knob control by computing `value = min * (max/min)^(t)` where `t` is normalised knob position `[0,1]`.

**Clarification confirmed (Q1)**: Exponential taper, 0–5000 ms range (Q2).

**Rationale**: The `Knob` control in `CanvasComponent` already supports a `logarithmic` flag on `Parameter` objects (confirmed by inspecting `src/canvas/controls/Knob.ts`). If this flag does not exist, the parameter `step` can be set small (1 ms) so the knob renders densely — acceptable fallback.

**Alternatives considered**:
- Two-zone knob (0–200 ms fine, 200–5000 ms coarse): rejected per clarification — exponential is simpler and more musical.

---

## Decision 4: CV Input Architecture — GainNode Pass-Through

**Decision**: The module's audio input node is a `GainNode` (gain = 1.0, i.e., unity). Incoming CV is connected to this gain node's input. Each frame the display driver reads the current input value by maintaining a `ConstantSourceNode` that the Slew Limiter drives directly (no separate AnalyserNode needed — the target value is just the incoming CV, which for `ConstantSourceNode`-based CV sources is a known scalar).

**Key insight**: CV sources in this project are `ConstantSourceNode` instances. When patched, `sourceConstantNode.connect(slewInputGain)` routes the DC offset through the gain node. To read the current input value for slew comparison, we maintain a second `AnalyserNode` (FFT size 256, smoothing 0) on the input, sampling once per frame to get the current CV scalar — the same pattern used by `EnvelopeFollower` for audio amplitude detection.

**Alternatives considered**:
- Storing the CV target value in JavaScript state by having the patch system notify the component: rejected — breaks the unidirectional Web Audio graph model.

---

## Decision 5: Component Category — Utilities

**Decision**: `SlewLimiter` is placed in `src/components/utilities/` (not `processors/` or `analyzers/`).

**Rationale**: The Slew Limiter is a CV routing utility — it does not process audio content and does not analyse/display a signal for the user's benefit. It belongs alongside `Quantizer` (also a CV utility). The `analyzers/` category is reserved for components whose primary purpose is visualisation (Oscilloscope, VuMeter, EnvelopeFollower).

---

## Decision 6: Display Driver — SlewLimiterDisplay (new file)

**Decision**: Create `src/canvas/displays/SlewLimiterDisplay.ts` following the `EnvelopeFollowerDisplay` pattern exactly. The display:
- Is created and owned by `CanvasComponent.createControls()`
- Calls `slewLimiter.tick(dtSec)` once per `render()` call
- Draws a vertical bar proportional to `slewLimiter.getOutputValue()` in the normalised `[0, 1]` range (confirmed Q3)
- Uses the same green bar, dark background, and border styling as `EnvelopeFollowerDisplay`

---

## Decision 7: Patch Persistence — Standard ComponentData.parameters

**Decision**: Serialize `rise` and `fall` values into `ComponentData.parameters` using the existing `PatchSerializer` / `PatchStorage` pipeline. No new top-level `PatchData` fields needed.

**Validation**: A dedicated `SlewLimiterValidation.ts` file (mirrors `EnvelopeFollowerValidation.ts`) will clamp `rise` and `fall` to `[0, 5000]` ms on deserialize, preventing corrupt values from legacy or manually edited patches.

---

## Summary of Files to Create / Modify

| File | Action |
|------|--------|
| `src/components/utilities/SlewLimiter.ts` | **Create** — main component |
| `src/components/utilities/SlewLimiterValidation.ts` | **Create** — validation helpers + types |
| `src/canvas/displays/SlewLimiterDisplay.ts` | **Create** — frame-driven bar display |
| `src/core/types.ts` | **Modify** — add `SLEW_LIMITER = 'slew-limiter'` to `ComponentType` |
| `src/components/registerComponents.ts` | **Modify** — register `SlewLimiter` under Utilities |
| `src/utils/componentLayout.ts` | **Modify** — add layout case for `SLEW_LIMITER` |
| `src/canvas/CanvasComponent.ts` | **Modify** — add `createControls()` case + display field |
| `CLAUDE.md` | **Modify** — update plan reference |
| `tests/components/utilities/SlewLimiter.test.ts` | **Create** — unit tests |
| `tests/components/utilities/SlewLimiterValidation.test.ts` | **Create** — validation tests |
