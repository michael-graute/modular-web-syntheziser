# Implementation Plan: FM Oscillator Component

**Branch**: `020-fm-oscillator` | **Date**: 2026-05-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/020-fm-oscillator/spec.md`

## Summary

Add a new `FMOscillator` component to the synthesizer that enables audio-rate frequency modulation (FM synthesis) by extending the existing `Oscillator` class with an FM audio input port and an FM Depth parameter. An internal `GainNode` scales the incoming modulation signal before routing it to the carrier `OscillatorNode.frequency` AudioParam. The existing `Oscillator` component and connection validation logic are untouched — the FM Input port is typed `AUDIO`, so existing `AUDIO → AUDIO` validation already permits FM connections.

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

**Constitution Version**: 1.0

- [x] **Readability & Maintainability**: `FMOscillator` extends `Oscillator`; all methods are short (under 20 lines each). No complex nesting.
- [x] **Code Organization**: New file goes in `src/components/generators/` alongside `Oscillator.ts`. Registration in `registerComponents.ts`. Enum addition in `types.ts`. Validator change in `validators.ts`. All grouped by responsibility.
- [x] **Code Standards**: Strict mode satisfied. No magic numbers — `FM_DEPTH_DEFAULT`, `FM_DEPTH_MIN`, `FM_DEPTH_MAX` constants defined. No lint warnings expected.
- [x] **Test Coverage**: Critical path (FM signal routing, depth parameter, save/load) must reach ≥ 80% coverage. Public API (`getInputNode`, `updateAudioParameter`) fully tested.
- [x] **Test Quality**: Tests are isolated (mock AudioContext), use AAA pattern, have descriptive names.
- [x] **UI Consistency**: Component uses same `calculateComponentDimensions` / `registerAllComponents` pattern as all other generators. No new design tokens.
- [x] **User Feedback**: Connecting to the FM port is synchronous and gives immediate visual feedback via the existing connection line drawing.
- [x] **Performance**: One additional `GainNode` per FM Oscillator instance (~0.1% CPU). Canvas rendering unaffected.

No constitution violations. Complexity tracking section not required.

## Project Structure

### Documentation (this feature)

```text
specs/020-fm-oscillator/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── types.ts         ← TypeScript type contracts
│   └── validation.ts    ← Validation helpers
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code Changes

```text
src/
├── core/
│   └── types.ts                          ← add FM_OSCILLATOR to ComponentType enum
├── utils/
│   └── componentLayout.ts               ← add FM_OSCILLATOR dimension cases
├── components/
│   ├── generators/
│   │   └── FMOscillator.ts              ← NEW: FM synthesis oscillator
│   └── registerComponents.ts            ← register FM_OSCILLATOR in Generators group
tests/
└── components/
    └── generators/
        └── FMOscillator.test.ts         ← NEW: unit tests
```

## Complexity Tracking

No violations.
