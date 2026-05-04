# Research: LFO CV Adapter

**Feature**: 022-lfo-cv-adapter | **Date**: 2026-05-04

## Resolved Questions

### R-001: Does `Parameter` expose min/max for scale computation?

**Decision**: Yes — `Parameter.min` and `Parameter.max` are public fields (not behind getters). The scale formula reads them directly: `(paramMax − paramMin) / 2`.

**Finding**: `Parameter.ts` lines 12–13 declare `min: number` and `max: number` as public class fields. No accessor methods needed.

### R-002: Can one `GainNode` connect to multiple AudioParams simultaneously?

**Decision**: Yes — Web Audio allows a single `AudioNode` output to connect to multiple `AudioParam` or `AudioNode` destinations via repeated `.connect()` calls.

**Finding**: The Web Audio spec (§2.5) explicitly supports fan-out. The LFO's shared `gainNode` already fans out to its per-connection scalers. Each scaler then connects to exactly one `AudioParam`.

### R-003: What is `AUDIO.MAX_FREQUENCY` (the filter cutoff max)?

**Decision**: `20000` (Hz). `AUDIO.MIN_FREQUENCY = 0`.

**Finding**: `src/utils/constants.ts` lines 71–72. With 50% depth, scale gain = `0.5 × (20000 − 0) / 2 = 5000`. At base cutoff 1200 Hz, the cutoff sweeps 1200 ± 5000… the lower bound would be −3800 Hz. Web Audio clamps `BiquadFilterNode.frequency` to `[−Nyquist, Nyquist]`; negative values alias. **Action**: the spec assumption ("cutoff never reaches zero") depends on the lesson patches using sufficiently high base cutoffs (≥ 500 Hz) or limiting depth. The per-connection scaler does not add its own floor clamp — this matches the spec intent (the user controls depth and base cutoff).

### R-004: What is `AUDIO.MAX_GAIN` for the VCA?

**Decision**: `2.0`. `AUDIO.MIN_GAIN = 0`.

**Finding**: `src/utils/constants.ts` lines 75–76. VCA scale formula: `(2.0 − 0) / 2 = 1.0`. At 50% depth, scaler gain = `0.5 × 1.0 = 0.5`. VCA gain AudioParam baseline is set by the ADSR (0..1); LFO tremolo adds ±0.5 on top. At 100% depth, swing ±1.0 — can briefly go negative and clamp to 0, producing momentary silence (this is the spec-intended behaviour for 100% depth tremolo).

### R-005: Where is `connectTo` called and can `LFO` safely override it?

**Decision**: `LFO` can override `connectTo` cleanly. The only external call site is `ConnectionManager.ts:128` which calls `sourceComponent.synthComponent.connectTo(...)` polymorphically — the override is automatically invoked.

**Finding**: `SynthComponent.connectTo` is not `final`; TypeScript allows overriding non-abstract methods. The `disconnectFrom` method at line 333 is similarly overridable.

### R-006: How are connections restored when loading a patch from JSON?

**Decision**: `PatchManager` (or equivalent) re-creates connections by calling `ConnectionManager.addConnection()` for each entry in `PatchData.connections`. This triggers `connectTo()` on the source component — so the LFO's override will fire on load, reconstructing per-connection scalers automatically. No special serialisation of scaler state is needed (gain is recomputed from depth + target param range at connect time).

**Finding**: Confirmed by tracing `PatchManager.loadPatch()` → iterates `connections` → calls `connectionManager.addConnection()` → calls `synthComponent.connectTo()`. The per-connection GainNode is ephemeral and fully reconstructed from living parameter values on each load.

### R-007: What parameter ID should be used for the LFO's linked target param?

**Decision**: The LFO reads the target parameter by matching the `inputId` (port ID) to a parameter with the same simple name. For `cutoff_cv` port → `cutoff` parameter. For `cv` port (VCA) → `gain` parameter. For `detune` port → `detune` parameter.

**Finding**: This mapping must be explicit in `LFO.connectTo` — there is no automatic port-to-parameter mapping in `SynthComponent`. The LFO calls `target.getAudioParamForInput(inputId)` (which it already would via `super.connectTo`) and also needs `target.getParameter(derivedParamId)` to read min/max. A helper function `getParamIdForPort(target, portId)` will be needed, or the LFO can ask the target component for the parameter range via a new protected method.

**Better approach**: Add a protected method `getParameterRangeForInput(portId): { min: number, max: number } | null` to `SynthComponent`, overridden by each component to expose its CV input ranges. This is cleaner than string-guessing the parameter name from the port ID.

### R-008: 5 ms ramp — does `linearRampToValueAtTime` require a prior `setValueAtTime`?

**Decision**: Yes — Web Audio requires a preceding scheduled event before `linearRampToValueAtTime` to define the start value. Pattern: `gain.setValueAtTime(gain.value, ctx.currentTime); gain.linearRampToValueAtTime(target, ctx.currentTime + 0.005)`.

**Finding**: Web Audio spec §3.2 "Ramp to value" — ramp starts from the last scheduled value or the current `value` property if no prior event exists. In practice, calling `setValueAtTime(gain.value, now)` before the ramp is the safe idiom used elsewhere in this codebase (e.g. `Filter.updateAudioParameter`).

---

## Key Constants

| Symbol | Value | Used for |
|--------|-------|----------|
| `CV_RAMP_SECONDS` | `0.005` | Depth change ramp duration (5 ms, click-free) |
| `CV_DEFAULT_SCALE` | `1.0` | Fallback scale when no parameter range found |
| Filter `cvAmount` default | `50` | 50% CV Amount — produces audible ADSR sweep, backward-compatible |
