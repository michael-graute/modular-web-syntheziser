# Implementation Plan: 4-Voice Polyphony

**Branch**: `032-polyphony` | **Date**: 2026-06-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/032-polyphony/spec.md`

## Summary

Add 4-voice polyphony to the modular web synthesiser by introducing a new `POLY_CV` signal type that bundles 4 voice slots (frequency + gate per slot) in a single cable, extending `KeyboardInput` with a mono/poly mode toggle and embedded `VoiceAllocator`, and creating three new components — `PolyOscillator`, `PolyADSR`, `PolyVCA`. The POLY_CV signal travels as a JavaScript getter function (not a Web Audio node), keeping audio graph complexity minimal while enabling fully independent per-voice oscillator, envelope, and gain control.

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
- POLY_CV signal travels via JS getter (not Web Audio), matching the existing `getGateValue`/`getCurrentFrequency` pattern used by StepSequencer and Arpeggiator

## Constitution Check

**Constitution Version**: 1.0

- [x] **Readability & Maintainability**: All new types are self-documenting (`VoiceSlot`, `VoiceAllocator`, `PolyConsumer`). All methods stay under 50 lines. Max nesting depth is 2 (for/if inside RAF loop).
- [x] **Code Organization**: New components follow the existing `generators/` / `processors/` / `utilities/` split. `VoiceAllocator` is a utility embedded in `KeyboardInput` (not a shared singleton) — no cross-cutting concerns introduced.
- [x] **Code Standards**: No magic numbers — `VOICE_COUNT = 4`, `SUM_GAIN = 0.25` defined as named constants. TypeScript strict mode satisfied by the contracts in `contracts/types.ts`.
- [x] **Test Coverage**: `VoiceAllocator` (critical logic) covered at 100%. Connection validation helpers in `contracts/validation.ts` covered at 100%. PolyOscillator/PolyADSR polling logic covered by unit tests. Integration test for full poly chain.
- [x] **Test Quality**: All tests follow AAA, are isolated (no shared RAF/audio state), descriptively named.
- [x] **UI Consistency**: `polyMode` toggle is a `Button` control — same widget used by bypass. Poly component controls (waveform Dropdown, ADSR Sliders) mirror their mono equivalents exactly.
- [x] **User Feedback**: Mode toggle button label updates immediately (`MONO` / `POLY`). No operation takes > 300ms.
- [x] **Performance**: 4 additional OscillatorNodes are lightweight. RAF polling shared with existing Oscilloscope/Collider pattern. Summing gain at 0.25 prevents clipping without a DynamicsCompressor.

## Project Structure

### Documentation (this feature)

```text
specs/032-polyphony/
├── plan.md              # This file
├── research.md          # Phase 0 — signal architecture, audio graph design decisions
├── data-model.md        # Phase 1 — entity shapes, port layouts, state transitions
├── quickstart.md        # Phase 1 — step-by-step implementation guide
├── contracts/
│   ├── types.ts         # TypeScript type contracts
│   └── validation.ts    # Validation helpers (100% test coverage required)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (new / modified)

```text
src/core/types.ts                          ← add POLY_CV SignalType; 3 new ComponentTypes
src/utils/validators.ts                    ← POLY_CV isolation in areSignalTypesCompatible
src/utils/constants.ts                     ← COLORS.POLY_CV = '#c084fc'
src/components/utilities/VoiceAllocator.ts ← new; pure JS, no Web Audio
src/components/utilities/KeyboardInput.ts  ← extend with polyMode param + VoiceAllocator
src/components/generators/PolyOscillator.ts ← new
src/components/processors/PolyADSR.ts      ← new
src/components/processors/PolyVCA.ts       ← new
src/canvas/Connection.ts                   ← POLY_CV color in getColor()
src/canvas/ConnectionManager.ts            ← register VoiceSlotsGetter on poly-cv cables
src/canvas/CanvasComponent.ts              ← createControls() cases for new types
src/utils/componentLayout.ts              ← layout entries for 3 new types; update Keyboard port count
src/components/registerComponents.ts      ← register PolyOscillator, PolyADSR, PolyVCA

tests/unit/VoiceAllocator.test.ts
tests/unit/PolyOscillator.test.ts
tests/unit/PolyADSR.test.ts
tests/integration/poly-chain.test.ts
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| POLY_CV uses JS getter, not Web Audio | Web Audio cannot transport structured voice slot objects | 4 parallel CV cables rejected by spec; no alternative stays zero-dependency |
| 4× internal node duplication in poly components | Independent per-voice control is the feature requirement | A single shared OscillatorNode cannot produce 4 independent pitches simultaneously |
