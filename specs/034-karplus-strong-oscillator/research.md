# Research: Karplus-Strong String Synthesizer

**Feature**: `034-karplus-strong-oscillator` | **Date**: 2026-07-04

## Overview

This feature introduces the codebase's **first AudioWorkletNode**. Every other component uses native Web Audio nodes (`OscillatorNode`, `BiquadFilterNode`, `GainNode`, `DelayNode`, `ConstantSourceNode`) composed into a graph. Karplus-Strong's tight per-sample feedback loop (`output[n] = damping * (output[n-1] + output[n-2]) / 2`) cannot be expressed with block-level native nodes (128-sample render quantum granularity), so custom sample-accurate DSP is required. This document resolves the technical unknowns needed before design.

## Decision 1: DSP execution mechanism

**Decision**: Implement the algorithm inside a custom `AudioWorkletProcessor`, loaded via `audioContext.audioWorklet.addModule(...)` and wrapped by an `AudioWorkletNode` in the component.

**Rationale**: Confirmed via codebase search (`grep -rniE "audioworklet|registerProcessor|\.worklet\."`) that no AudioWorklet exists today. `src/visualization/ParameterValueSampler.ts:10,44,81` explicitly documents that AudioWorklet was evaluated and rejected for a *different* purpose (reading modulated `AudioParam` values, which AudioWorklet doesn't expose either) — that decision does not apply here, since Karplus-Strong needs to *generate* samples, not read parameter values. Notably, `vite.config.ts` at the repo root already carries anticipatory setup for this: COOP/COEP response headers ("Enable SharedArrayBuffer support for AudioWorklet") and `assetsInclude: ['**/*.worklet.js']`. This confirms AudioWorklet was a planned direction that never shipped — this feature is the first to use it.

**Alternatives considered**:
- *ScriptProcessorNode*: Deprecated, runs on the main thread, causes audio glitches under UI load. Rejected — worse than AudioWorklet in every respect and explicitly superseded by it.
- *Chained native `DelayNode` + `GainNode` feedback loop*: Native `DelayNode` feedback loops operate at block granularity (128 samples) and cannot implement the required per-sample averaging filter or the noise-burst excitation/re-trigger logic cleanly. Rejected — cannot express the algorithm.
- *Pre-rendering plucks as static buffers via `OfflineAudioContext` and playing back through `AudioBufferSourceNode`*: Would avoid AudioWorklet entirely, but loses continuous parameter control (Damping/Tone can't be swept per-instance without re-rendering), breaks the "re-trigger while still decaying" requirement (US1 AC3) cleanly, and doesn't match how every other pitched/triggered module in the system behaves (live parameter response). Rejected — degrades UX below acceptance criteria.

## Decision 2: Worklet module loading strategy (build tooling)

**Decision**: Load the processor module using Vite's `new URL('./karplus-strong.worklet.ts', import.meta.url)` pattern passed to `audioContext.audioWorklet.addModule(...)`, letting Vite handle bundling/transpilation of the worklet file as a separate asset in both dev and production builds.

**Rationale**: No existing precedent for `?url` or `new URL(..., import.meta.url)` imports exists in this codebase (confirmed via search), so this pattern is introduced fresh. It is Vite's documented, standard approach for worklet/worker modules and requires no additional Vite plugins. The existing `assetsInclude: ['**/*.worklet.js']` in `vite.config.ts` suggests a `.worklet.js` output naming convention was anticipated; using a `.worklet.ts` source file (compiled by Vite) that emits a `.worklet.js`-pattern asset keeps consistency with that pre-existing config, though the config will need a small update to `assetsInclude: ['**/*.worklet.js', '**/*.worklet.ts']` or reliance on Vite's default worker/module handling — to be finalized during implementation (see plan.md Complexity/Risk notes).

**Alternatives considered**:
- *Inline processor code as a `Blob` URL string built at runtime*: Avoids build-tool coupling entirely but sacrifices TypeScript type-checking and syntax highlighting for the processor source, and diverges from how every other source file in the project is authored. Rejected — inconsistent with project code standards (Constitution: "Code Standards" requires static typing where available).
- *Separate non-Vite-processed static `.js` file in `public/`*: Simple and guaranteed to load with correct MIME type, but forfeits TypeScript authoring and the existing build pipeline's linting. Acceptable fallback if the `new URL()` approach proves incompatible with the current Vite version, but not the first choice.

## Decision 3: Algorithm parameterization (Damping, Tone, Mode)

**Decision**:
- **Damping**: A single 0–1 (or equivalent knob-normalized) parameter mapped internally to a feedback-loop decay coefficient in the classic Karplus-Strong averaging filter: `y[n] = damping * 0.5 * (y[n-1] + y[n-2])`. Higher Damping → coefficient closer to 1.0 (slow decay); lower → coefficient further below 1.0 (fast decay). Coefficient range is clamped strictly below 1.0 to guarantee eventual decay to silence (addresses spec Edge Case: "Damping at absolute maximum").
- **Tone/Pick-Position**: Implemented as a one-pole lowpass filter applied to the initial noise-burst excitation *before* it enters the delay line/feedback loop (not applied continuously to the output). Sweeping this parameter changes the brightness of the pluck's attack without altering the sustain's decay-rate character, matching the "pick position" physical-modeling convention (plucking near the bridge = brighter excitation spectrum; near the middle = duller).
- **Mode**: A discrete boolean/enum applied as a variant of the feedback filter — "String" uses the standard averaging filter (as above); "Stretched" uses the probabilistic sign-inversion variant (Jaffe & Smith's "stretched Karplus-Strong": each feedback sample is passed through unchanged with high probability, or negated, based on a fixed blend probability tied to Damping), which extends sustain and adds a percussive/noisy character suited to drum-like sounds.

**Rationale**: This is the standard, well-documented formulation of Karplus-Strong and its "stretched" extension (Jaffe & Smith, 1983; Karplus & Smith, 1983), directly satisfying FR-004/005/006 and the User Story 3/4 acceptance scenarios without inventing a novel algorithm.

**Alternatives considered**:
- *Two-pole/higher-order damping filter*: More faithful physical modeling (frequency-dependent damping beyond a single-pole average) but adds complexity without a corresponding functional requirement calling for it. Rejected for v1 — the spec's Damping requirement (FR-004) only calls for controllable overall decay time, not per-harmonic damping curves; can be a future refinement.
- *Continuous Mode blend (crossfade string/stretched) instead of discrete switch*: Not requested by the spec (FR-006 says "a Mode selector offering at least two options"); a discrete switch is simpler and sufficient. Rejected — unnecessary scope expansion.

## Decision 4: Trigger/gate signal handling

**Decision**: The Trigger input is a `GATE`-typed port (reusing the existing `SignalType.GATE` — confirmed via `src/core/types.ts` that there is no dedicated "trigger" signal type; `GATE` is the established convention for trigger-like signals in this codebase, e.g., ADSR's gate input). Unlike `ADSREnvelope`, which exposes public `triggerGateOn()`/`triggerGateOff()` methods invoked externally by the connection/gate-routing system on signal transition (no internal edge detection), the Karplus-Strong component will expose a single `pluck()` method invoked on the rising edge of the incoming gate signal, matching the established pattern of externally-driven trigger dispatch rather than reimplementing edge detection inside the component.

**Rationale**: Consistency with `ADSREnvelope.ts` (`triggerGateOn`/`triggerGateOff`, lines 132–193) — the gate-routing/connection system already owns edge detection and calls the appropriate component method; Karplus-Strong should plug into that exact mechanism with its own single `pluck()` entry point (since, unlike ADSR, there is no separate "release" phase — a pluck is a one-shot excitation, not a sustained level).

**Alternatives considered**:
- *Continuous gate-level sampling inside the AudioWorklet's `process()`, detecting rising edges at audio-rate*: Technically most sample-accurate for trigger timing, but duplicates edge-detection logic that the existing connection system already provides at the component layer, and would require routing the raw gate signal into the worklet as an audio-rate input (adding complexity to the node graph). Rejected in favor of reusing the established external-trigger-method convention; the worklet still needs a message-based "pluck now" entry point (see Decision 5), which achieves comparable timing accuracy without duplicating logic.

## Decision 5: Main-thread ↔ worklet-thread communication

**Decision**: Use `AudioWorkletNode.port.postMessage(...)` for discrete/infrequent events (pluck trigger, mode change, tone/pick-position change), and standard `AudioParam`s (exposed via `AudioWorkletNode.parameters`) for continuously-variable, automatable values (frequency, damping) so they integrate with the existing `parameter.linkAudioParam(...)` pattern used by `Oscillator.ts` for CV visualization and connection (per Oscillator lines 64-72).

**Rationale**: This is the standard, idiomatic division of responsibility for `AudioWorkletNode`: `AudioParam`s support the Web Audio automation timeline (`setValueAtTime`, `linearRampToValueAtTime`, and direct connection from CV-source output nodes) exactly like native nodes' parameters, letting Frequency/Pitch-CV and Damping reuse the exact same `getAudioParamForInput()` / CV-connection mechanism already used by `Oscillator.ts`. Discrete one-shot events (pluck, mode switch) have no meaningful automation timeline and are naturally expressed as messages.

**Alternatives considered**:
- *Route Trigger/Mode through additional custom `AudioParam`s instead of message-passing*: Possible (e.g., a "trigger" AudioParam that the worklet watches for a rising edge), but this reintroduces audio-rate edge detection duplicated from Decision 4, and Mode is inherently discrete/non-automatable per spec (FR-006 describes a selector, not a sweepable control). Rejected — messages are the correct fit for discrete state changes.

## Decision 6: Visual feedback mechanism

**Decision**: Follow the `Oscilloscope`-style live waveform pattern: tap the worklet's output via a lightweight `AnalyserNode` inserted in the signal chain (`workletNode → analyserNode → outputGain`), and render its `getFloatTimeDomainData()` samples in a dedicated `KarplusStrongDisplay` class under `src/canvas/displays/`, driven by the existing per-frame canvas render pass (same mechanism `SlewLimiterDisplay.render()` uses to call `tick()` — confirmed no dedicated "audio worklet visualization" precedent exists, but the `AnalyserNode` + canvas-render-driven-pull pattern is already established by `Oscilloscope` and `VuMeter`).

**Rationale**: Reuses a pattern already proven twice in this codebase (`Oscilloscope`, `VuMeter`) rather than inventing a new one; requires zero new infrastructure beyond the display class itself, and needs no message-passing from the worklet thread for visualization (the `AnalyserNode` reads directly from the audio graph).

**Alternatives considered**:
- *Push waveform/level data from the worklet thread via `port.postMessage()` on every render quantum*: Technically viable but adds unnecessary main-thread message traffic (every ~2.9ms at 44.1kHz/128 samples) for data an `AnalyserNode` already provides passively. Rejected — needless complexity and potential performance cost.

## Decision 7: Registration & UI wiring checklist

**Decision**: Confirmed (via codebase research) that adding a new component requires touching all of the following, none of which can be skipped without silently breaking functionality:
1. `ComponentType` enum — add `KARPLUS_STRONG` (or similar) entry.
2. `src/components/generators/KarplusStrong.ts` — the component class itself (extends the same base as `Oscillator`).
3. `src/components/registerComponents.ts` — register type/name/description/category/factory/dimensions.
4. `src/utils/componentLayout.ts` — add a case in `getControlLayout()` and `getPortCounts()` for sizing math (sizing only, per prior project memory — does NOT create controls).
5. `src/canvas/CanvasComponent.ts` — explicit case in the private `createControls()` method to instantiate `Knob`/`Dropdown` controls for Frequency, Damping, Tone, Mode (per prior project memory: `componentLayout.ts` alone will not create interactive controls), plus display wiring (instantiating `KarplusStrongDisplay`) and a display-name map entry (~line 2431 pattern).
5. `src/canvas/displays/KarplusStrongDisplay.ts` — new display class per Decision 6.

**Rationale**: This mirrors the exact checklist already followed for `SlewLimiter` (registration at `registerComponents.ts` lines 312-319, layout case at `componentLayout.ts` line 180, `CanvasComponent` display wiring at lines 1696-1739/2431) and matches project memory: "every new component needs an explicit case in `CanvasComponent.createControls()`; `componentLayout.ts` only sizes the box, it does NOT create controls."

## Open Questions Resolved

All `NEEDS CLARIFICATION` items from Technical Context are resolved above. No remaining unknowns block Phase 1 design.
