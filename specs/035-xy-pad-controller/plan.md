# Implementation Plan: X-Y Pad Controller

**Branch**: `035-xy-pad-controller` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/035-xy-pad-controller/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

A new `XY_PAD` component provides a 2D draggable canvas surface with two independent CV outputs (X, Y), each scaled to its connected target's parameter range via a per-axis 0-100% depth control — reusing the LFO's per-connection `GainNode` scaler adapter pattern. A Record/Stop/Play control set captures pointer position at ~60 samples/sec (rAF-driven, bounded to 60s) into a `(t, x, y)` sample buffer, packed into a `Float32Array` and persisted through the existing generic `ComponentData.audioBlob` Base64 slot (the same mechanism the Looper uses for its audio buffer) — no patch-format or serializer changes required. The interactive pad and its buttons follow the Looper's dedicated-overlay-canvas precedent (a sibling `HTMLCanvasElement` with its own pointer handlers) rather than retrofitting the 1D `controls[]` array, since 2D drag doesn't fit the existing `Knob`/`Slider` single-axis model.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**: Web Audio API, DOM — zero runtime dependencies
**Storage**: `localStorage` via existing `PatchSerializer` / `PatchStorage` pattern
**Testing**: Vitest (run via `vitest run`)
**Target Platform**: Browser (Vite dev server / static build)
**Project Type**: Single-page modular synthesizer app (`src/` flat structure with `core/`, `components/`, `ui/`, `patch/`, `canvas/`, `timing/` directories)
**Performance Goals**: 60 FPS canvas rendering; audio parameter changes take effect within one Web Audio scheduler tick (~128 samples)
**Constraints**:
- Zero new runtime dependencies — Web Audio API + DOM only
- TypeScript strict mode enforced
- Follows existing singleton export pattern (`audioEngine`, `patchManager`, `eventBus`)
- Patch format changes must be backward-compatible (legacy patches must load without error)
- Reuse `ComponentData.audioBlob` (generic Base64 slot already used by Looper) for recorded movement data — no `ComponentData`/`PatchSerializer` schema changes
- New component must register through the single `ComponentRegistry` entry point (`registerComponents.ts`) — no separate factory or sidebar wiring needed beyond an icon glyph
- 2D drag interaction has no existing reusable control (`Knob`/`Slider` are single-axis) — follow the Looper's dedicated-overlay-canvas pattern instead of extending `controls[]`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0

Verify feature compliance with project constitution principles:

- [x] **Readability & Maintainability**: `XYPad.ts` mirrors `LFO.ts`/`Looper.ts` structure (state machine + CV adapter); a dedicated `XYPadDisplay.ts` (canvas rendering) keeps the pointer/render logic out of the audio-graph class, matching the `Looper`/`LooperDisplay` split.
- [x] **Code Organization**: New files land in `src/components/utilities/` (`XYPad.ts`, `XYPadConstants.ts`) and `src/canvas/displays/` (`XYPadDisplay.ts`), matching existing category placement for gesture/utility components (Collider, Looper).
- [x] **Code Standards**: Sample rate (60/sec), max duration (60s), and derived sample cap are named constants in `XYPadConstants.ts` (mirrors `LooperConstants.ts`), not inline magic numbers.
- [x] **Test Coverage**: State machine transitions (record/stop/play/loop), depth-scaling math, and Base64 pack/unpack of the sample buffer are pure-logic and unit-testable without a real AudioContext, matching existing `SlewLimiterValidation.ts`-style separation.
- [x] **Test Quality**: New tests live under `tests/` mirroring `src/components/utilities/XYPad.ts`, isolated per-test component instances (no shared state), consistent with existing suite conventions.
- [x] **UI Consistency**: Reuses the Looper's overlay-canvas + `Button`-style Record/Stop/Play affordance and the LFO's depth-knob convention — no new design tokens.
- [x] **User Feedback**: Pad handle position updates synchronously on drag; Record/Play state is shown via visible state indication on the overlay canvas (color/label), consistent with Looper's ring-color state feedback.
- [x] **Performance**: Drag updates and rAF-driven sampling are UI-thread, non-blocking; CV output scaling uses `GainNode`s (audio-thread, zero-cost per sample) exactly like LFO's existing per-connection scalers.

No violations identified. Complexity Tracking section below is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/035-xy-pad-controller/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── types.ts         # TypeScript type contracts
│   └── validation.ts    # Validation helpers
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── core/                    # App-wide singletons and types
│   ├── types.ts             # EventType enum, PatchData, ComponentData, etc.
│   ├── EventBus.ts          # Publish-subscribe event system (singleton: eventBus)
│   └── AudioEngine.ts       # Web Audio context wrapper (singleton: audioEngine)
├── components/
│   ├── base/
│   │   └── SynthComponent.ts  # Abstract base class for all components
│   ├── generators/          # Oscillator, LFO, NoiseGenerator, etc.
│   ├── effects/             # Delay, Reverb, Distortion, Chorus
│   ├── processors/          # Filter, VCA, ADSR, etc.
│   ├── utilities/           # StepSequencer, Collider, ChordFinder, etc.
│   └── analyzers/           # Oscilloscope, etc.
├── ui/                      # Non-canvas UI widgets (Sidebar, modals, toolbar controls)
├── patch/
│   ├── PatchSerializer.ts   # Serialize/deserialize PatchData ↔ JSON
│   ├── PatchStorage.ts      # localStorage read/write
│   └── PatchManager.ts      # Patch lifecycle (new/save/load/export) — singleton: patchManager
├── canvas/                  # Canvas rendering and CanvasComponent wrapper
├── timing/                  # TimingCalculator (BPM ↔ ms conversions)
├── music/                   # MusicalScale, WeightedRandomSelector, ScaleTypes
├── physics/                 # PhysicsEngine, CollisionResolver, Vector2D
├── storage/                 # AcceptanceStorage (localStorage wrappers)
├── visualization/           # ModulationVisualizer, visual update scheduler
├── styles/                  # main.css, components.css, canvas.css
└── main.ts                  # App entry point — wires singletons and UI

tests/                       # Vitest test files mirroring src/ structure
index.html                   # Single HTML page; .top-bar + .main-content layout
```

**Structure Decision**: Single-page browser app with no build-time server. All state is in-memory or `localStorage`. New features add files under the relevant `src/` subdirectory and are wired up in `main.ts`. Patch persistence uses the `PatchSerializer` → `PatchStorage` pipeline; no changes to this pipeline are needed unless a feature adds top-level `PatchData` fields.

**New files for this feature**:
```text
src/components/utilities/
├── XYPad.ts                 # SynthComponent subclass: state machine, CV outputs, depth scalers, serialize/deserialize
└── XYPadConstants.ts        # Sample rate, max duration, sample-cap constants (mirrors LooperConstants.ts)
src/canvas/displays/
└── XYPadDisplay.ts          # Overlay <canvas>: pad rendering, handle, Record/Stop/Play buttons, pointer handlers (mirrors LooperDisplay.ts)
tests/components/utilities/
└── XYPad.test.ts            # State machine, depth-scaling math, Base64 pack/unpack of the sample buffer
```

**Files requiring a new case/entry for `ComponentType.XY_PAD`** (per existing registration conventions, confirmed in codebase research):
- `src/core/types.ts` — add `XY_PAD` to the `ComponentType` enum
- `src/components/registerComponents.ts` — one `componentRegistry.register(...)` call (category `'Utilities'`)
- `src/utils/componentLayout.ts` — new case in both `calculateComponentDimensions` and the control-layout switch
- `src/canvas/CanvasComponent.ts` — new `if (this.type === ComponentType.XY_PAD)` block in `createControls()`, following the Looper block's overlay-canvas + click-dispatch pattern
- `src/ui/Sidebar.ts` — icon glyph entry in `getComponentIcon`

No changes needed to `PatchSerializer.ts`, `PatchManager.ts`, or `ComponentData` — the registry is polymorphic and `audioBlob` is already generic.

## Complexity Tracking

No constitution violations — this section is not applicable.
