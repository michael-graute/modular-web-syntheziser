# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

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

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0

Verify feature compliance with project constitution principles:

- [ ] **Readability & Maintainability**: Are types self-documenting? Do functions stay under 50 lines? Is nesting ≤ 3 levels?
- [ ] **Code Organization**: Is new code grouped by responsibility (not layer)? Does it follow the existing `core/` / `components/` / `ui/` / `patch/` / `canvas/` split?
- [ ] **Code Standards**: Does all code pass linting without warnings? Are magic numbers replaced with named constants? Is TypeScript strict mode satisfied?
- [ ] **Test Coverage**: Does critical logic reach ≥ 80% coverage? Do utility/validation functions reach 100%? Do all public APIs have tests?
- [ ] **Test Quality**: Are tests isolated (no shared state)? Do they follow AAA pattern? Are they named descriptively?
- [ ] **UI Consistency**: Does new UI match existing top-bar / sidebar / canvas widget patterns? Are no new design tokens introduced without justification?
- [ ] **User Feedback**: Do user actions receive synchronous visual feedback? Are loading states shown for operations > 300ms?
- [ ] **Performance**: Is canvas rendering still ≥ 60 FPS after the change? Are audio-thread operations non-blocking?

If any principle is violated, document in **Complexity Tracking** section below.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
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

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| [describe violation] | [current need] | [why simpler approach is insufficient] |
