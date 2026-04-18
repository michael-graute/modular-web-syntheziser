# Implementation Plan: ChordFinder–Keyboard Visual Sync

**Branch**: `014-chordfinder-keyboard-sync` | **Date**: 2026-04-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/014-chordfinder-keyboard-sync/spec.md`

## Summary

When a chord is pressed in the ChordFinder module, the three chord notes are visually highlighted on all Keyboard modules in the patch using the same blue pressed-key style as manual input. Highlights from ChordFinder and manual input are tracked independently via separate flags on each Key object, allowing additive coexistence and independent clearing. The bridge uses two new EventBus events (`CHORD_NOTES_ON` / `CHORD_NOTES_OFF`) emitted by ChordFinder and consumed by KeyboardController — no direct cross-module coupling, no new runtime dependencies, no persistence changes.

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

- [x] **Readability & Maintainability**: All new methods are single-responsibility and well under 50 lines. New flags are self-documenting (`pressedByChordFinder`).
- [x] **Code Organization**: EventBus events go in `core/types.ts`; ChordFinder changes stay in `components/utilities/`; Keyboard/KeyboardController changes stay in `keyboard/`. No layer boundaries crossed.
- [x] **Code Standards**: Two new named event type constants in the enum (no magic strings at call sites). TypeScript strict mode satisfied — payload types are explicit interfaces.
- [x] **Test Coverage**: New validation helpers (`validation.ts`) require 100% coverage. `pressKeyFromChordFinder`/`releaseKeyFromChordFinder` are public APIs that require test suites. EventBus subscription logic requires integration tests.
- [x] **Test Quality**: Tests will be isolated (no shared eventBus state across tests; each test creates fresh instances).
- [x] **UI Consistency**: No new design tokens. ChordFinder-sourced highlights reuse the existing `#60a5fa` / `#4a9eff` pressed-key colors.
- [x] **User Feedback**: Highlight appears synchronously within the same animation frame as the chord press (FR-008).
- [x] **Performance**: Only two extra boolean flags per key (24–48 keys total). Render is called once per chord event, not per frame. No impact on 60 FPS budget.

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

## Implementation Approach

### Step 1 — Extend EventType enum and add payload interfaces (`src/core/types.ts`)

Add to `EventType`:
```
CHORD_NOTES_ON  = 'chord:notes-on'
CHORD_NOTES_OFF = 'chord:notes-off'
```

Add payload interfaces (see `contracts/types.ts` for full definitions):
```typescript
interface ChordNotesOnPayload  { notes: [number, number, number]; sourceId: string; }
interface ChordNotesOffPayload { notes: [number, number, number]; sourceId: string; }
```

### Step 2 — Add `pressedByChordFinder` flag to Keyboard Key interface and render logic (`src/keyboard/Keyboard.ts`)

- Add `pressedByChordFinder: boolean` to the `Key` interface (default `false`)
- Initialize `pressedByChordFinder: false` in `generateKeys()`
- Update render condition: `key.isPressed || key.pressedByChordFinder` → highlight color
- Add public methods:
  - `pressKeyFromChordFinder(note: number): void` — sets `pressedByChordFinder = true`, calls `render()`
  - `releaseKeyFromChordFinder(note: number): void` — sets `pressedByChordFinder = false`, calls `render()`
  - `releaseAllChordFinderKeys(): void` — clears all `pressedByChordFinder` flags, calls `render()` once

### Step 3 — Subscribe to chord events in KeyboardController (`src/keyboard/KeyboardController.ts`)

- Add private fields:
  - `currentChordNotes: number[] = []`
  - `unsubscribeChordOn: (() => void) | null = null`
  - `unsubscribeChordOff: (() => void) | null = null`
- In constructor, after existing setup, call `this.subscribeToChordEvents()`
- `subscribeToChordEvents()`:
  - Subscribe to `EventType.CHORD_NOTES_ON`: clear previous chord notes, apply new ones, store in `currentChordNotes`
  - Subscribe to `EventType.CHORD_NOTES_OFF`: clear current chord notes, reset `currentChordNotes`
- `destroy()`: call both unsubscribe functions

### Step 4 — Emit chord events from ChordFinder (`src/components/utilities/ChordFinder.ts`)

- Add private field `lastPressedNotes: [number, number, number] | null = null`
- In `pressChord(scaleDegree)`, after existing CV/gate logic:
  - Compute shifted MIDI notes: `chord.notes[i] + (this.config.octave - 4) * 12`
  - Store in `lastPressedNotes`
  - Emit `EventType.CHORD_NOTES_ON` with `{ notes, sourceId: this.id }`
- In `releaseChord()`, after existing gate-off logic:
  - If `lastPressedNotes` is not null, emit `EventType.CHORD_NOTES_OFF` with `{ notes: lastPressedNotes, sourceId: this.id }`
  - Clear `lastPressedNotes`

### Step 5 — Write tests

New test files:
- `tests/keyboard/Keyboard.chordfinder.test.ts` — unit tests for `pressKeyFromChordFinder`, `releaseKeyFromChordFinder`, render flag logic, additive coexistence
- `tests/keyboard/KeyboardController.chordfinder.test.ts` — integration tests for EventBus subscription, chord swap atomicity, destroy cleanup
- `tests/components/ChordFinder.emit.test.ts` — unit tests for correct MIDI note calculation and event emission
- `tests/contracts/validation.test.ts` — 100% coverage of `validateChordNotesOnPayload` / `validateChordNotesOffPayload` / `isNoteInKeyboardRange` (matches T004 test path)

## Complexity Tracking

No constitution violations. No complexity justifications needed.
