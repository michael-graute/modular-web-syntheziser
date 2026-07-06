# Implementation Plan: Karplus-Strong String Synthesizer

**Branch**: `034-karplus-strong-oscillator` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/034-karplus-strong-oscillator/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a new Generator-category component, **Karplus-Strong**, that produces algorithmic plucked-string / percussive synthesis. It is triggered by a gate/trigger input (re-excites the string on each pulse), tracks pitch via a standard 1V/octave CV input (with a manual Frequency knob as fallback/base), and exposes Damping (decay time) and Tone (pick-position/excitation brightness) controls plus a discrete String/Stretched Mode selector. Technical approach: implement the sample-accurate delay-line-with-feedback-filter algorithm inside a custom `AudioWorkletProcessor` (this codebase's first use of AudioWorklet), wrapped by an `AudioWorkletNode` that plugs into the existing component/graph/CV/persistence/MIDI conventions exactly like every other Generator.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**: Web Audio API (including `AudioWorkletNode`/`AudioWorkletProcessor` — first use in this codebase), DOM — zero runtime dependencies
**Storage**: `localStorage` via existing `PatchSerializer` / `PatchStorage` pattern
**Testing**: Vitest (run via `vitest run`)
**Target Platform**: Browser (Vite dev server / static build)
**Project Type**: Single-page modular synthesizer app (`src/` flat structure with `core/`, `components/`, `ui/`, `patch/`, `canvas/`, `timing/` directories)
**Performance Goals**: 60 FPS canvas rendering; audio parameter changes take effect within one Web Audio scheduler tick (~128 samples); AudioWorklet `process()` callback must never allocate or block, to avoid audio-thread underruns
**Constraints**:
- Zero new runtime dependencies — Web Audio API + DOM only (the AudioWorklet processor module is authored in-repo, not an external package)
- TypeScript strict mode enforced
- Follows existing singleton export pattern (`audioEngine`, `patchManager`, `eventBus`)
- Patch format changes must be backward-compatible (legacy patches must load without error)
- First-ever use of `audioContext.audioWorklet.addModule(...)` in this codebase — module loading is asynchronous, unlike every other component's synchronous `createAudioNodes()`; component creation must tolerate this (see research.md Decision 2 and Risks below)
- `vite.config.ts` already anticipates worklet assets (COOP/COEP headers, `assetsInclude: ['**/*.worklet.js']`) but has never been exercised — first real validation of that config

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0

Verify feature compliance with project constitution principles:

- [x] **Readability & Maintainability**: Types are self-documenting (`KarplusStrongMode`, `KarplusStrongParameters`). The AudioWorkletProcessor's `process()` loop is inherently a tight numeric loop but stays under 50 lines by delegating damping/tone/mode logic to small helper methods called once per block, not per sample where avoidable.
- [x] **Code Organization**: New code follows the existing `components/generators/` (component class), `canvas/displays/` (visualization) split. One new top-level concern — the worklet processor source — is grouped under a new `src/worklets/` directory (mirrors `src/physics/`, `src/music/` as a responsibility-grouped, non-component-layer directory), not mixed into `components/`.
- [x] **Code Standards**: TypeScript strict mode applies to both the main-thread component and the worklet processor source. All magic numbers (sample rate assumptions, default coefficients, min/max frequency) become named constants in a shared contract file. Lint must pass on both the component and worklet TypeScript files.
- [x] **Test Coverage**: Core DSP logic (coefficient calculation from Damping, frequency-to-delay-line-length mapping, Mode variant selection) is pure/testable and extracted into standalone functions callable from Vitest without an actual `AudioContext`, reaching the required coverage independent of the worklet runtime (which Vitest/jsdom cannot execute directly).
- [x] **Test Quality**: Pure DSP helper functions are unit-tested in isolation (AAA pattern, no shared state); component-level tests follow the same mock-`AudioContext` pattern already used for other generator components' test suites.
- [x] **UI Consistency**: Uses existing `Knob`/`Dropdown` control widgets and canvas panel layout conventions already established by `Oscillator`/`SlewLimiter`; no new design tokens.
- [x] **User Feedback**: Visual waveform feedback via `KarplusStrongDisplay` (Decision 6) gives synchronous confirmation of trigger/output activity, consistent with other Generators. Async worklet module loading (a first for this codebase) must not leave the component silently non-functional before the module resolves — see Risks below.
- [x] **Performance**: `AudioWorkletProcessor.process()` is written to avoid allocation per call (pre-allocated delay-line buffer sized once at construction); canvas rendering uses the existing `AnalyserNode`-driven pull pattern already proven not to impact frame rate (Oscilloscope, VuMeter).

No violations requiring Complexity Tracking justification. One architectural risk is tracked below (not a constitution violation, but worth surfacing since it's a first-of-its-kind integration):

**Risk — Async worklet module loading**: `audioContext.audioWorklet.addModule(...)` is asynchronous, while every existing component's `createAudioNodes()` is synchronous. The component must handle the gap between construction and module-ready (e.g., queue/ignore early `pluck()` calls, or defer node creation until the module resolves) without violating the "synchronous visual feedback" user-feedback principle or crashing on a trigger that arrives before the worklet is ready. Resolved in data-model.md / component design below.

## Project Structure

### Documentation (this feature)

```text
specs/034-karplus-strong-oscillator/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── types.ts         # TypeScript type contracts
│   └── validation.ts    # Validation helpers
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit.specify + /speckit.clarify)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── core/                    # App-wide singletons and types
│   ├── types.ts             # EventType enum, PatchData, ComponentData, SignalType, Port, Parameter, etc.
│   ├── EventBus.ts          # Publish-subscribe event system (singleton: eventBus)
│   └── AudioEngine.ts       # Web Audio context wrapper (singleton: audioEngine)
├── components/
│   ├── base/
│   │   └── SynthComponent.ts  # Abstract base class for all components
│   ├── generators/          # Oscillator, LFO, NoiseGenerator, etc.
│   │   └── KarplusStrong.ts # NEW — component class (extends SynthComponent, follows Oscillator pattern)
│   ├── effects/             # Delay, Reverb, Distortion, Chorus
│   ├── processors/          # Filter, VCA, ADSR, etc.
│   ├── utilities/           # StepSequencer, Collider, ChordFinder, etc.
│   ├── analyzers/           # Oscilloscope, etc.
│   └── registerComponents.ts # MODIFIED — register KARPLUS_STRONG type/name/description/category/factory/dimensions
├── worklets/                 # NEW directory — AudioWorkletProcessor sources (mirrors physics/, music/ grouping)
│   └── karplus-strong.worklet.ts  # NEW — AudioWorkletProcessor implementation (registerProcessor)
├── ui/                      # Non-canvas UI widgets (Sidebar, modals, toolbar controls)
├── patch/
│   ├── PatchSerializer.ts   # Serialize/deserialize PatchData ↔ JSON (component.serialize()/deserialize() override, no changes needed here)
│   ├── PatchStorage.ts      # localStorage read/write
│   └── PatchManager.ts      # Patch lifecycle (new/save/load/export) — singleton: patchManager
├── canvas/
│   ├── CanvasComponent.ts   # MODIFIED — createControls() case for Frequency/Damping/Tone/Mode; display wiring; display-name map entry
│   └── displays/
│       └── KarplusStrongDisplay.ts  # NEW — live waveform display (AnalyserNode-driven, Oscilloscope/VuMeter pattern)
├── utils/
│   └── componentLayout.ts  # MODIFIED — getControlLayout() + getPortCounts() sizing cases (sizing only, per project convention)
├── timing/                  # TimingCalculator (BPM ↔ ms conversions) — not modified
├── music/                   # MusicalScale, WeightedRandomSelector, ScaleTypes — not modified
├── physics/                 # PhysicsEngine, CollisionResolver, Vector2D — not modified
├── storage/                 # AcceptanceStorage (localStorage wrappers) — not modified
├── visualization/           # ModulationVisualizer, visual update scheduler — not modified
├── styles/                  # main.css, components.css, canvas.css — not modified
└── main.ts                  # App entry point — wires singletons and UI — not modified

tests/                       # Vitest test files mirroring src/ structure
├── components/generators/KarplusStrong.test.ts    # NEW
└── worklets/karplus-strong-dsp.test.ts            # NEW — tests pure DSP helper functions extracted from the worklet

vite.config.ts                # MODIFIED — confirm/adjust assetsInclude and worklet asset handling for karplus-strong.worklet.ts
index.html                    # Single HTML page; .top-bar + .main-content layout — not modified
```

**Structure Decision**: Single-page browser app with no build-time server. All state is in-memory or `localStorage`. This feature adds one new top-level `src/worklets/` directory (a new responsibility group, not a new architectural layer — analogous to the existing `physics/`/`music/` directories) to hold the AudioWorkletProcessor source, since worklet code runs in a separate global scope and is conceptually distinct from both `components/` (main-thread graph objects) and `canvas/` (rendering). The component itself (`KarplusStrong.ts`) lives in `components/generators/` alongside `Oscillator.ts`, following the established pattern exactly. Patch persistence uses the existing `PatchSerializer` → `PatchStorage` pipeline via the component's own `serialize()`/`deserialize()` overrides (per `SlewLimiter.ts` precedent) — no core pipeline changes needed, since `ComponentData.parameters` already supports a generic `Record<string, number>` (Mode can be serialized as a numeric enum index, consistent with how other discrete/dropdown parameters are stored elsewhere in the system).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations requiring justification. The one new top-level directory (`src/worklets/`) is an organizational addition, not a principle violation — see Project Structure decision above for rationale.
