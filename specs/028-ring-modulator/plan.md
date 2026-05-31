# Implementation Plan: Ring Modulator

**Branch**: `028-ring-modulator` | **Date**: 2026-05-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/028-ring-modulator/spec.md`

## Summary

Implement a Ring Modulator effect component that multiplies two audio-rate input signals (carrier × modulator) to produce sum and difference frequencies. The Web Audio API `GainNode` naturally accepts audio-rate modulation of its `gain` AudioParam, making it the native primitive for ring modulation: the carrier feeds into a `GainNode` whose `gain` is driven by the modulator signal. The component supports bypass (carrier pass-through) and has no user-adjustable parameters beyond the bypass toggle.

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

- [x] **Readability & Maintainability**: Ring Modulator is a pure multiplier with ~3 audio nodes; all functions stay well under 50 lines. Multi-port input routing via `getInputNode(portId)` override is a clear pattern already established by FMOscillator and Mixer.
- [x] **Code Organization**: New file at `src/components/effects/RingModulator.ts`; registered in `registerComponents.ts`; wired into `ComponentType` enum, `isBypassable()`, `componentLayout.ts`, `Sidebar.ts` icon map, and `CanvasComponent.ts` (no-op case, bypass auto-rendered).
- [x] **Code Standards**: No magic numbers needed; `1.0` gain values follow existing convention. TypeScript strict mode satisfied by explicit null guards on audio nodes.
- [x] **Test Coverage**: Constructor, `createAudioNodes`, `getInputNode` routing, bypass enable/disable, and serialize will reach ≥ 80% coverage. No utility functions; bypass logic is tested inline.
- [x] **Test Quality**: Tests follow AAA pattern, isolated via `beforeEach` with `vi.clearAllMocks()`, match `Bitcrusher.test.ts` structure.
- [x] **UI Consistency**: No controls rendered (pure multiplier). Bypass button auto-appears because `isBypassable()` returns true — same path as every other effect. No new design tokens.
- [x] **User Feedback**: Bypass button provides synchronous visual state change.
- [x] **Performance**: Two `GainNode` instances + one `connect` to an `AudioParam` — negligible CPU overhead. No render loop or display added.

## Project Structure

### Documentation (this feature)

```text
specs/028-ring-modulator/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── types.ts         # TypeScript type contracts
│   └── validation.ts    # Validation helpers / constants
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── core/types.ts                          # Add ComponentType.RING_MODULATOR
├── components/
│   ├── base/SynthComponent.ts             # Add RING_MODULATOR to isBypassable()
│   ├── effects/
│   │   └── RingModulator.ts              # NEW — core audio component
│   └── registerComponents.ts             # Add registration entry
├── canvas/CanvasComponent.ts             # Add icon to icon/display-name map only — no case in createControls() needed
├── ui/Sidebar.ts                         # Add icon symbol for RING_MODULATOR
└── utils/componentLayout.ts             # Add port counts + empty control layout

tests/
└── components/
    └── RingModulator.test.ts             # NEW — unit tests
```

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The ring modulator is the simplest effect in the project: two GainNodes, no parameters, no display, no custom controls.

---

## Phase 0: Research

*See [research.md](./research.md) for full findings.*
