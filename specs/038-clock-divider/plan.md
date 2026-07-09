# Implementation Plan: Clock Divider

**Branch**: `038-clock-divider` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/038-clock-divider/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

A new `CLOCK_DIVIDER` component derives six simultaneous, independently-rated gate pulse trains (four divisions — /2, /4, /8, /16 — and two multiplications — x2, x3) from the patch's shared global tempo, so a single component can drive several differently-timed destinations (Step Sequencer, Collider, Arpeggiator, or any gate-accepting input) without manual tempo calculation or per-rate drift. It has no audio nodes and no inputs — only six `SignalType.GATE` outputs — and reuses three already-proven architectural patterns from this codebase rather than inventing new ones: StepSequencer's drift-resistant lookahead scheduler (generalized from one to six independent tick cursors sharing one poll loop, guaranteeing related rates like /2 and /4 always coincide), ChordFinder's multi-output `getOutputNodeByPort` override (for six independently-wired outputs from one component), and the generic `Parameter`-backed serialization every enum-like choice in this codebase already uses (so no `ComponentData` schema changes or custom serialize/deserialize override are needed at all).

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**: Web Audio API (`ConstantSourceNode` gate outputs, `AudioContext.currentTime`-space scheduling) — zero new runtime dependencies
**Storage**: `localStorage` via existing `PatchSerializer` / `PatchStorage` pattern — no schema changes; all state is `Parameter`-backed and persists through the existing generic mechanism
**Testing**: Vitest (run via `vitest run`)
**Target Platform**: Browser (Vite dev server / static build)
**Project Type**: Single-page modular synthesizer app (`src/` flat structure with `core/`, `components/`, `ui/`, `patch/`, `canvas/`, `timing/` directories)
**Performance Goals**: 60 FPS canvas rendering maintained; scheduler runs on a shared 25ms poll loop (matching StepSequencer's established interval) with a 100ms lookahead window, keeping all six outputs sample-accurately scheduled via `AudioParam.setValueAtTime` regardless of main-thread jitter
**Constraints**:
- Zero new runtime dependencies — Web Audio API + DOM only
- TypeScript strict mode enforced
- Follows existing singleton export pattern (`audioEngine`, `globalBpmController`, `eventBus`)
- No `bpmMode` (local/global) toggle — Clock Divider always follows the shared global tempo unconditionally, per spec Assumptions; this is a deliberate scope boundary, not an oversight
- No external clock/gate input — per spec Assumptions, this feature is scoped to global-tempo-following only; the component has zero input ports
- All six outputs MUST be derived from the same underlying tempo reference so mathematically related rates (e.g. /2 and /4) always coincide on shared beats (FR-007) — this rules out independent per-output timers and requires the shared-scheduler-loop design from research.md

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0

Verify feature compliance with project constitution principles:

- [x] **Readability & Maintainability**: Scheduling math (`clampRateIndex`, `ratePeriodMs`, `advanceTick`, `collectDueTicks`) lives in small, independently-readable pure functions in `contracts/validation.ts`, not inlined in the component; `ClockDivider.ts` itself only glues these to the Web Audio API and event subscriptions.
- [x] **Code Organization**: New code slots into the existing `components/utilities/` (`ClockDivider.ts`) split — no new top-level directories or architectural layers; reuses `StepSequencer`'s scheduler shape and `ChordFinder`'s multi-output shape rather than introducing a third pattern.
- [x] **Code Standards**: Rate values are a named `ClockDividerRate` enum with parallel `RATE_BEATS_PER_PULSE`/`RATE_LABELS` lookup maps (no magic numbers/strings); `CLOCK_DIVIDER_OUTPUT_COUNT` is a named constant, not a hardcoded `6` scattered through the codebase.
- [x] **Test Coverage**: `contracts/validation.ts`'s pure functions (100% DOM-free) get 100% coverage per the Constitution's utility-function requirement; `ClockDivider`'s public API (`setRate`/`getRate`, serialize/deserialize round-trip, `getOutputNodeByPort`) gets full unit coverage following `XYPad.test.ts`'s established mocking conventions.
- [x] **Test Quality**: New tests live under `tests/components/utilities/ClockDivider.test.ts`, isolated per-test instances, AAA pattern, consistent with this project's existing utility-component test files.
- [x] **UI Consistency**: Reuses Arpeggiator's exact "N stacked dropdown rows" layout pattern (`calculateComponentHeight` special case, `CanvasComponent.createControls()` block) — no new design tokens or control types introduced.
- [x] **User Feedback**: Rate changes take effect on the next natural pulse boundary with no perceptible lag (FR-008); each output's current rate is always visible on-canvas via its dropdown label (SC-004).
- [x] **Performance**: The shared 25ms-poll/100ms-lookahead scheduler is the same mechanism StepSequencer already runs continuously without measurable performance impact; no new per-frame canvas rendering work (dropdowns are static controls, not an animated display).

No violations identified. Complexity Tracking section below is not applicable.

## Project Structure

### Documentation (this feature)

```text
specs/038-clock-divider/
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

**Structure Decision**: Single-page browser app with no build-time server. This feature adds one new `src/` file (`ClockDivider.ts`) and modifies five existing files for registration/layout/UI wiring — the same integration surface every prior new component type has required (confirmed against feature 036/037's precedent). No `ComponentData` schema changes and no `PatchSerializer`/`PatchStorage` changes — all state is `Parameter`-backed and persists through the fully generic existing mechanism.

**Files requiring changes**:
- `src/core/types.ts` — add `CLOCK_DIVIDER` to the `ComponentType` enum
- `src/components/utilities/ClockDivider.ts` — new file: the component itself (six gate outputs, shared scheduler, `getOutputNodeByPort` override, no custom serialize/deserialize needed)
- `src/components/registerComponents.ts` — one `componentRegistry.register(...)` call, category `'Controllers'`
- `src/utils/componentLayout.ts` — new cases in `getControlLayout`, `getPortCounts`, a new `calculateComponentHeight` special case (Arpeggiator's pattern, 6 rows instead of 4), and a `calculateComponentWidth` entry
- `src/canvas/CanvasComponent.ts` — new `if (this.type === ComponentType.CLOCK_DIVIDER)` block in `createControls()` (six stacked `Dropdown`s, Arpeggiator's block is the template), plus the `getDisplayName` exhaustive map entry (TypeScript forces this)
- `src/ui/Sidebar.ts` — icon glyph entry in the exhaustive `getComponentIcon` map (TypeScript forces this too)

New files:
- `specs/038-clock-divider/contracts/types.ts` — `ClockDividerRate` enum, `RATE_BEATS_PER_PULSE`/`RATE_LABELS` maps, `CLOCK_DIVIDER_OUTPUT_COUNT`/`DEFAULT_RATES` constants
- `specs/038-clock-divider/contracts/validation.ts` — `clampRateIndex`, `ratePeriodMs`, `advanceTick`, `collectDueTicks` (pure, 100%-covered scheduling math)
- `tests/components/utilities/ClockDivider.test.ts` — new test file, following `XYPad.test.ts`'s conventions

No changes needed to `PatchSerializer.ts`, `PatchStorage.ts`, `TimingCalculator.ts` (its existing `beatsToMs` is reused as-is, no modification), or any component type other than Clock Divider.

## Complexity Tracking

No constitution violations — this section is not applicable.
