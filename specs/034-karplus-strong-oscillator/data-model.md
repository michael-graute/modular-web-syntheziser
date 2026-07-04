# Data Model: Karplus-Strong String Synthesizer

**Feature**: `034-karplus-strong-oscillator` | **Date**: 2026-07-04

## Entities

### KarplusStrongComponent (main-thread)

Extends `SynthComponent` (same base as `Oscillator`). Represents the component instance in the patch graph.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Inherited — unique component instance ID |
| `type` | `ComponentType.KARPLUS_STRONG` | New enum member added to `src/core/types.ts` |
| `frequency` | `number` (Hz) | Manual Frequency/Tune control value. Range: 40–4000 Hz (per spec clarification). Default: 440 Hz. Backed by an `AudioParam` on the worklet node. |
| `damping` | `number` (0–1 normalized) | Damping/decay control. 0 = fastest decay, 1 = longest sustain (internally clamped below the self-oscillation threshold). Default: 0.5 (moderate sustain, ~1–2s). Backed by an `AudioParam`. |
| `tone` | `number` (0–1 normalized) | Tone/Pick-Position control — brightness of excitation noise burst. 0 = dull/warm, 1 = bright/metallic. Default: 0.5. Sent via `port.postMessage({type:'setTone', value})`, **not** an `AudioParam` — Tone only affects the noise burst at the moment of excitation (pluck time), not a continuously-automatable per-sample signal, so it does not need the automation timeline an `AudioParam` provides (see research.md Decision 5). |
| `mode` | `KarplusStrongMode` (enum: `STRING` \| `STRETCHED`) | Discrete mode selector. Default: `STRING`. Sent via `port.postMessage`, not an `AudioParam` (discrete, non-automatable per spec FR-006). |
| `workletNode` | `AudioWorkletNode \| null` | Null until `audioContext.audioWorklet.addModule(...)` resolves (async — see Risk in plan.md). |
| `analyserNode` | `AnalyserNode \| null` | Feeds `KarplusStrongDisplay`; created alongside `workletNode`. |
| `isModuleReady` | `boolean` | Tracks whether the worklet module has finished loading; gates `pluck()` calls that arrive before readiness (queued, not dropped — see Behavior below). |
| `pendingPluck` | `boolean` | Set `true` if `pluck()` is called before `isModuleReady`; consumed (fires one pluck) once the module becomes ready. |

**Validation rules** (mirrors FR-012, Edge Cases):
- `frequency` clamped to [40, 4000] Hz at both the manual-control and Pitch-CV-input levels.
- `damping` clamped to [0, 1]; internally mapped to a feedback coefficient strictly < 1.0 so a pluck always eventually decays (never sustains indefinitely).
- `tone` clamped to [0, 1].
- `mode` restricted to the two enum values; unknown/invalid persisted values fall back to `STRING` on deserialize (backward-compatible default).

**State transitions**:
- **Uninitialized → Loading**: on construction, `createAudioNodes()` kicks off `audioWorklet.addModule(...)` (async).
- **Loading → Ready**: module resolves; `workletNode` is instantiated and connected into the graph (`workletNode → analyserNode → outputGain`); if `pendingPluck` is `true`, immediately fire one pluck message and clear the flag.
- **Ready → Idle**: default state after readiness, before any trigger; `Audio output MUST be silent` (FR-008).
- **Idle → Plucking**: `pluck()` invoked (either from external gate-rising-edge dispatch, per the `ADSREnvelope.triggerGateOn()` convention, or from a queued `pendingPluck`); worklet re-seeds its internal noise burst and begins decay.
- **Plucking → Plucking (re-trigger)**: a new `pluck()` while still decaying immediately re-seeds the excitation (FR-013, US1 AC3) — no separate "release" phase exists (unlike ADSR).
- **Plucking → Idle**: amplitude decays below an inaudible floor; no explicit state flag needed since this is a continuous decay, not a discrete transition the component needs to track.

### KarplusStrongProcessor (audio-thread, `AudioWorkletProcessor`)

Runs inside the worklet global scope. Not directly serialized/persisted — its runtime state is derived entirely from the `AudioParam`s and messages sent by `KarplusStrongComponent`.

| Field | Type | Notes |
|---|---|---|
| `delayLine` | `Float32Array` | Pre-allocated at construction, sized for the *lowest* supported frequency (40 Hz) at the current sample rate, to avoid any allocation inside `process()` (Constitution: Performance). Shorter effective delay lengths (higher frequencies) simply use a smaller active slice. |
| `writeIndex` | `number` | Current write position in the circular delay line. |
| `mode` | `KarplusStrongMode` | Updated via `port.onmessage`. |
| `rngState` | `number` | Seed/state for the noise-burst excitation generator (simple LCG or similar — no external RNG dependency, per zero-runtime-deps constraint). |

**Parameters exposed as custom `AudioParam`s** (per research.md Decision 5): `frequency` (a-rate, 40–4000 Hz), `damping` (k-rate, 0–1).

**Messages accepted via `port.onmessage`** (per research.md Decision 5):
- `{ type: 'pluck' }` — re-seed the delay line with a fresh noise burst (filtered by current `tone`), reset feedback state.
- `{ type: 'setMode', mode: KarplusStrongMode }` — update the feedback-filter variant used on subsequent plucks (does not retroactively alter an in-flight decay, per spec Assumption).
- `{ type: 'setTone', value: number }` — update the excitation-filtering coefficient applied to future plucks' noise bursts (tone is not a continuously-automatable per-sample parameter in the same sense as frequency/damping, since it only affects the moment of excitation — implemented as a message rather than an `AudioParam` for this reason, refining research.md Decision 3/5).

### Persisted shape (`ComponentData.parameters`)

Following the `SlewLimiter.ts` precedent (component owns its own `serialize()`/`deserialize()`, packing into the generic `Record<string, number>`):

```ts
{
  frequency: number;   // Hz, 40-4000
  damping: number;     // 0-1
  tone: number;        // 0-1
  mode: number;        // 0 = STRING, 1 = STRETCHED (numeric enum index, consistent with other dropdown params)
}
```

No new top-level `ComponentData` fields needed (unlike `Looper`'s `audioBlob` addition) — this fits entirely within the existing generic `parameters` record, keeping the change backward-compatible with legacy patches (which simply won't contain a Karplus-Strong component at all).

## Relationships

- `KarplusStrongComponent` is patched into the graph like any other Generator: its Trigger (GATE) input receives edge-dispatch calls from the existing gate-routing/connection system (same mechanism as `ADSREnvelope`); its Pitch CV (existing 1V/octave convention, same as `Oscillator`) input connects to the `frequency` `AudioParam` via `getAudioParamForInput()`; its Audio output connects downstream to any Audio-accepting input (Filter, VCA, Effects, Mixer, Master Out).
- `KarplusStrongDisplay` reads from `analyserNode`, which taps the `workletNode`'s output — no direct coupling between the display and the worklet thread itself.
