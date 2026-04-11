# Implementation Plan: Chord Finder Utility

**Branch**: `010-chord-finder` | **Date**: 2026-04-10 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/010-chord-finder/spec.md`

## Summary

Build a Chord Finder synthesizer utility module that displays all 7 diatonic chords for a user-selected key in a circular canvas layout, generates musically coherent chord progressions via weighted harmonic rules, and emits 1V/octave CV + gate signals (3 notes per triad) when chord nodes are clicked — wiring seamlessly into the existing oscillator and ADSR patching ecosystem. The component extends `SynthComponent`, follows the `Collider`/`StepSequencer` patterns for audio nodes and serialization, and introduces a new `ChordFinderDisplay` canvas display alongside a pure `ChordTheory` music module.

---

## Technical Context

**Language/Version**: TypeScript 5.6+ (strict, ES2020 target)  
**Primary Dependencies**: Zero runtime dependencies — Web Audio API + DOM only  
**Build Tool**: Vite 6.0.0  
**Storage**: localStorage via existing `PatchSerializer` / `PatchStorage` pattern  
**Testing**: Vitest 2.1.0 + happy-dom, `MockAudioContext`, `MockLocalStorage`  
**Target Platform**: Browser (web app)  
**Performance Goals**: 60 FPS canvas rendering; chord press → CV output with no perceptible latency  
**Constraints**:
- Must not introduce any new npm runtime dependencies
- Must be compatible with existing `ComponentType` enum and `ComponentData` serialization envelope
- CV follows 1V/octave standard: `CV = (MIDI − 60) / 12 + (octave − 4)`
- TypeScript strict mode: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`

---

## Constitution Check

**Constitution Version**: 1.0.0 (project-specific, not VisiMatch)

- [x] **Readability & Maintainability**: `ChordTheory.ts` is pure functions; `ChordFinder.ts` follows SRP with clear separation from display. Named constants for CV math.
- [x] **Code Organization**: Feature-based — new files in `src/components/utilities/`, `src/music/`, `src/canvas/displays/`. Existing patterns followed.
- [x] **Code Standards**: TypeScript strict, no magic numbers, linting enforced by `npm run lint`.
- [x] **Test Coverage ≥ 80%**: Unit tests for `ChordTheory`, `ChordFinder`, and `validation.ts`; integration tests for CV output and persistence.
- [x] **Test Quality**: AAA pattern, isolated, no shared state, behavior-focused.
- [x] **UX Consistency**: Three clear visual states (default / progression / pressed) with immediate hover/active feedback per constitution §Interface Design.
- [x] **Performance**: Canvas rendering via `visualUpdateScheduler` (requestAnimationFrame); `ConstantSourceNode` for zero-latency CV.
- [x] **No security concerns**: Purely local browser app with no network I/O or user-controlled eval paths.

No constitution violations. No complexity tracking required.

---

## Project Structure

### Documentation (this feature)

```text
specs/010-chord-finder/
├── plan.md              ← this file
├── spec.md              ← feature specification
├── research.md          ← Phase 0: decisions and rationale
├── data-model.md        ← Phase 1: entities, state, audio node layout
├── quickstart.md        ← Phase 1: developer onboarding
├── contracts/
│   ├── types.ts         ← public type contracts
│   └── validation.ts    ← validation + encode/decode helpers
└── tasks.md             ← Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code (new files)

```text
src/
├── components/utilities/
│   └── ChordFinder.ts               # SynthComponent: ports, audio nodes, state, serialization
├── music/
│   └── ChordTheory.ts               # Pure functions: chord derivation, naming, progression generation
└── canvas/displays/
    └── ChordFinderDisplay.ts        # Canvas display: circle rendering, hit detection, press animation
```

### Source Code (modified files)

```text
src/core/types.ts                    # Add CHORD_FINDER to ComponentType enum
src/canvas/CanvasComponent.ts        # Add chordFinderDisplay field; wire in factory
src/components/ComponentRegistry.ts  # Register ChordFinder factory
src/components/registerComponents.ts # Call registration
```

### Test Files

```text
tests/
├── unit/
│   ├── music/
│   │   ├── ChordTheory.test.ts               # Diatonic chord derivation, naming, roman numerals
│   │   └── ProgressionGenerator.test.ts      # Progression rules, vii° weighting, length bounds
│   └── components/
│       └── ChordFinder.test.ts               # Ports, CV values, gate on/off, serialize/deserialize
└── persistence/
    └── ChordFinder.persistence.test.ts       # Save/load round-trip, bitmask encode/decode
```

---

## Phase 0: Research

**Status**: Complete — see [research.md](research.md)

Key decisions:
1. Extend `SynthComponent` — same pattern as `Collider`, `StepSequencer`
2. Three `ConstantSourceNode` CV outputs + one gate output
3. Diatonic chords derived from existing `MusicalScale` + `ScaleTypes` infrastructure
4. Weighted Markov-style progression generator (no external library)
5. `ChordFinderDisplay` canvas display, modelled on `ColliderDisplay`
6. Progression serialized as 7-bit bitmask in `ComponentData.parameters`

---

## Phase 1: Design & Contracts

**Status**: Complete

### Artifacts

| Artifact | Path | Status |
|---|---|---|
| Data model | `specs/010-chord-finder/data-model.md` | Done |
| Type contracts | `specs/010-chord-finder/contracts/types.ts` | Done |
| Validation + encode/decode | `specs/010-chord-finder/contracts/validation.ts` | Done |
| Quickstart | `specs/010-chord-finder/quickstart.md` | Done |

### Key Design Decisions

**ChordTheory module** (`src/music/ChordTheory.ts`):
- Pure, side-effect-free functions only
- `getDiatonicChords(rootNote, scaleType)` → `DiatonicChord[]`
- `generateProgression(chords)` → `number[]` (scale degree indices)
- Chord quality lookup table per scale degree (see `data-model.md`)
- Diminished chord weight = 0.2×; starts on degree 0; ends on 0 or V

**ChordFinder component** (`src/components/utilities/ChordFinder.ts`):
- Output ports: `note1`, `note2`, `note3` (CV), `gate` (GATE)
- No input ports (standalone trigger — user clicks the display)
- Parameters: `rootNote` (0–11), `scaleType` (0–1), `octave` (2–6), `progression` (bitmask 0–127)
- `pressChord(scaleDegree)` sets all 3 CV nodes + opens gate
- `releaseChord()` closes gate
- Key change always clears progression
- Serializes to / restores from `ComponentData.parameters` via `validation.ts` helpers

**ChordFinderDisplay** (`src/canvas/displays/ChordFinderDisplay.ts`):
- DPR-aware canvas (same as `ColliderDisplay`)
- 7 arc segments clockwise from top, I=0 at 12 o'clock
- Center text: root + scale abbreviation
- Node states: default (grey) | progression (accent) | pressed (bright)
- Callbacks: `onChordPress(scaleDegree: number)` / `onChordRelease()`
- Hit detection: polar coordinates, each arc covers `2π/7` radians

---

## Complexity Tracking

No constitution violations requiring justification.
