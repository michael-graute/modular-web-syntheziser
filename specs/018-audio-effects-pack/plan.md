# Implementation Plan: Audio Effects Pack (Bitcrusher, Flanger, Phaser, Tremolo)

**Branch**: `018-audio-effects-pack` | **Date**: 2026-04-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/018-audio-effects-pack/spec.md`

## Summary

Add four new effect modules — Bitcrusher, Flanger, Phaser, and Tremolo — to the modular synthesizer. Each follows the existing `SynthComponent` + `Chorus`-style pattern: a TypeScript class under `src/components/effects/`, registered in `registerComponents.ts`, with a knob/slider control panel, wet/dry mix, and bypass support. No new runtime dependencies; all DSP uses the Web Audio API.

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

- [x] **Readability & Maintainability**: Each effect class follows the same structure as Chorus.ts. Functions stay under 50 lines; nesting ≤ 3 levels.
- [x] **Code Organization**: New files go under `src/components/effects/`. Enum additions in `core/types.ts`. UI additions in `ui/Sidebar.ts` and `utils/componentLayout.ts`.
- [x] **Code Standards**: No magic numbers — all parameter bounds defined as named constants in `contracts/types.ts`. TypeScript strict satisfied; no new lint warnings.
- [x] **Test Coverage**: Critical DSP logic (parameter clamping, bypass toggle, wet/dry routing) covered at ≥ 80%. All public APIs (`createAudioNodes`, `updateAudioParameter`, `enableBypass`, `disableBypass`) have tests.
- [x] **Test Quality**: Tests isolated (mocked AudioContext per test). AAA pattern throughout. Descriptive names.
- [x] **UI Consistency**: Knob/slider panel only, matching existing Chorus/Distortion layout. No new design tokens.
- [x] **User Feedback**: Bypass toggle provides immediate visual state change via existing active/bypass indicator pattern. Parameter changes take effect within one scheduler tick.
- [x] **Performance**: No canvas rendering added. Audio processing is non-blocking (all AudioNode operations on audio thread).

## Project Structure

### Documentation (this feature)

```text
specs/018-audio-effects-pack/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── types.ts         # TypeScript type contracts
│   └── validation.ts    # Validation helpers
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code Changes

```text
src/
├── core/
│   └── types.ts                          # Add BITCRUSHER, FLANGER, PHASER, TREMOLO to ComponentType
├── components/
│   └── effects/
│       ├── Bitcrusher.ts                 # NEW
│       ├── Flanger.ts                    # NEW
│       ├── Phaser.ts                     # NEW
│       └── Tremolo.ts                    # NEW
│   └── registerComponents.ts            # Register 4 new types
│   └── base/
│       └── SynthComponent.ts            # Add 4 new types to isBypassable()
├── ui/
│   └── Sidebar.ts                       # Add icons for 4 new types
└── utils/
    └── componentLayout.ts               # Add knob counts and port counts for 4 new types

tests/
└── components/
    ├── Bitcrusher.test.ts               # NEW
    ├── Flanger.test.ts                  # NEW
    ├── Phaser.test.ts                   # NEW
    └── Tremolo.test.ts                  # NEW
```

## Complexity Tracking

No constitution violations. All four effects are structurally identical to the existing `Chorus` class. The Phaser's chained `BiquadFilterNode` allpass stages are the most complex DSP (variable chain length of 2/4/6/8 nodes), but stay within function length limits by decomposing into small private helpers. The Bitcrusher uses a `ScriptProcessorNode` for sample-level processing, which is unique among the four effects.

---

## Phase 0: Research

See [research.md](research.md).

---

## Phase 1: Design & Contracts

See [data-model.md](data-model.md) and [contracts/](contracts/).
