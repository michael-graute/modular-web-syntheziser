# Tasks: Chord Finder Utility

**Input**: Design documents from `/specs/010-chord-finder/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- All paths are relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the new component type and scaffold all new files so the TypeScript project compiles cleanly before any logic is written.

- [X] T001 Add `CHORD_FINDER = 'chord-finder'` to the `ComponentType` enum in `src/core/types.ts`
- [X] T002 Create empty scaffold `src/components/utilities/ChordFinder.ts` — class extending `SynthComponent`, constructor only, imports from `src/core/types.ts`
- [X] T003 [P] Create empty scaffold `src/music/ChordTheory.ts` — module with exported placeholder functions matching signatures in `specs/010-chord-finder/quickstart.md`
- [X] T004 [P] Create empty scaffold `src/canvas/displays/ChordFinderDisplay.ts` — class skeleton, no rendering logic yet
- [X] T005 Register `ChordFinder` in `src/components/ComponentRegistry.ts` — add factory entry returning `new ChordFinder(id, position)`
- [X] T006 Call registration in `src/components/registerComponents.ts` — add import and registration call alongside existing components
- [X] T007 Verify project compiles with `npm run build` (or `npx tsc --noEmit`) — fix any type errors before proceeding

**Checkpoint**: Project compiles. `ComponentType.CHORD_FINDER` resolves. All new files exist.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the music theory core (`ChordTheory`) and the type/validation contracts. All user story phases depend on these pure, independently testable modules.

- [X] T008 Implement `getDiatonicChords(rootNote, scaleType)` in `src/music/ChordTheory.ts` — returns 7 `DiatonicChord` objects using `MusicalScale` intervals and the quality lookup table from `specs/010-chord-finder/data-model.md`
- [X] T009 Implement `getChordName(rootNote, quality)` in `src/music/ChordTheory.ts` — returns display string (e.g. "Am", "Bdim", "C") using root note + quality suffix rules
- [X] T010 Implement `getRomanNumeral(scaleDegree, quality)` in `src/music/ChordTheory.ts` — returns roman numeral label (e.g. "I", "ii", "vii°")
- [X] T011 [P] Write unit tests for `getDiatonicChords` in `tests/unit/music/ChordTheory.test.ts` — test C Major (7 chords, qualities, names) and A Natural Minor; assert `cvVoltages` follow 1V/octave formula
- [X] T012 [P] Write unit tests for `getChordName` and `getRomanNumeral` in `tests/unit/music/ChordTheory.test.ts` — cover major, minor, and diminished cases for multiple root notes
- [X] T013 Implement `generateProgression(chords)` in `src/music/ChordTheory.ts` — weighted Markov chain: starts on degree 0, vii° weight = 0.2×, length 4–8, ends on degree 0 or V (degree 4)
- [X] T014 Write unit tests for `generateProgression` in `tests/unit/music/ProgressionGenerator.test.ts` — assert: all degrees valid (0–6), length in [4,8], starts on 0, vii° frequency < 30% across 100 runs, two consecutive runs differ

**Checkpoint**: `npm test` passes for all ChordTheory tests. Music logic is complete and verified independently.

---

## Phase 3: User Story 1 — Select a Key and Explore Available Chords (Priority: P1) 🎯 MVP

**Goal**: User selects a root note + scale type; the Chord Finder displays all 7 diatonic chords in a circular canvas layout with chord names and quality labels.

**Independent Test**: Open app, add a Chord Finder module, select "C Major" — verify 7 chord nodes (C, Dm, Em, F, G, Am, Bdim) appear clockwise in a circle. Change key to "A Minor" — verify circle updates immediately.

- [X] T015 [US1] Implement `ChordFinder` constructor in `src/components/utilities/ChordFinder.ts` — add parameters `rootNote` (0, range 0–11), `scaleType` (0, range 0–1), `octave` (4, range 2–6), `progression` (0, range 0–127); call `getDiatonicChords` to populate internal state
- [X] T016 [US1] Implement `selectKey(rootNote, scaleType)` method in `src/components/utilities/ChordFinder.ts` — updates config, recomputes `diatonicChords` via `ChordTheory.getDiatonicChords`, clears `progression` parameter to 0
- [X] T017 [US1] Implement `ChordFinderDisplay` canvas setup in `src/canvas/displays/ChordFinderDisplay.ts` — DPR-aware canvas creation, `setCanvas(width, height)`, `updateViewportTransform(zoom, panX, panY)` following `ColliderDisplay` pattern
- [X] T018 [US1] Implement chord circle rendering in `src/canvas/displays/ChordFinderDisplay.ts` — draw 7 arc segments clockwise (I at 12 o'clock, each arc = 2π/7 radians), chord name + roman numeral text inside each arc, centre text shows "root scaletype" (e.g. "C maj")
- [X] T019 [US1] Implement three node visual states in `src/canvas/displays/ChordFinderDisplay.ts` — default (dark grey `#333`), in-progression (accent teal `#4ECDC4`), pressed (bright `#FFFFFF`); `render(state: ChordFinderState)` applies correct state per node
- [X] T020 [US1] Wire `ChordFinderDisplay` into `CanvasComponent` in `src/canvas/CanvasComponent.ts` — add `chordFinderDisplay?: ChordFinderDisplay` field; instantiate and position display when `type === ComponentType.CHORD_FINDER`
- [X] T021 [US1] Subscribe to `visualUpdateScheduler` in `ChordFinder.ts` — call `chordFinderDisplay.render(this.getState())` each frame via `SubscriptionHandle`; unsubscribe in `destroy()`
- [X] T022 [P] [US1] Write unit tests for `ChordFinder` constructor and `selectKey` in `tests/unit/components/ChordFinder.test.ts` — assert 7 diatonic chords populated, key change clears progression, re-query returns updated chords

**Checkpoint**: Chord Finder module can be added to the canvas, a key selected, and 7 chord nodes render correctly in the circle. MVP is working.

---

## Phase 4: User Story 2 — Generate a Random Chord Progression (Priority: P2)

**Goal**: User clicks "Generate Progression"; a musically coherent 4–8 chord progression is generated and the relevant chord nodes are highlighted in accent colour on the circle.

**Independent Test**: With a key selected, click "Generate" — verify 4–8 nodes highlight in teal; click again — verify a different progression appears; change key — verify highlights clear.

- [ ] T023 [US2] Implement `generateProgression()` method in `src/components/utilities/ChordFinder.ts` — calls `ChordTheory.generateProgression(this.diatonicChords)`, stores result by encoding to bitmask via `encodeProgressionBitmask` from `specs/010-chord-finder/contracts/validation.ts`, updates `progression` parameter
- [ ] T024 [US2] Add "Generate" button control to `ChordFinder` module in `src/canvas/CanvasComponent.ts` — add a `Button` control labelled "Generate"; wire `onClick` to call `chordFinder.generateProgression()`
- [ ] T025 [US2] Ensure `render()` in `ChordFinderDisplay` reads `state.config.progression` — decode bitmask to active degree set; apply `in-progression` colour to matching arc segments
- [ ] T026 [US2] Verify key change clears progression highlight — confirm `selectKey()` sets `progression = 0`, and `render()` shows no highlights after a key change
- [ ] T027 [P] [US2] Write unit tests for `generateProgression()` in `tests/unit/components/ChordFinder.test.ts` — assert progression parameter updates, two consecutive calls differ, degrees are valid 0–6, bitmask encode/decode round-trips correctly

**Checkpoint**: Generating a progression highlights the correct nodes. Changing key clears highlights. Consecutive generates produce different results.

---

## Phase 5: User Story 3 — Play a Chord via CV Output (Priority: P3)

**Goal**: Clicking and holding a chord node emits 1V/octave CV for the triad's 3 notes and opens the gate; releasing closes the gate.

**Independent Test**: Connect Chord Finder `note1` output to an oscillator frequency input. Click and hold "C" chord node — oscillator plays C. Release — gate closes. Test with octave set to 5 — verify C outputs 1.000V.

- [ ] T028 [US3] Implement audio node creation in `ChordFinder.ts` — create 4 `ConstantSourceNode` instances (`note1Output`, `note2Output`, `note3Output`, `gateOutput`) in `initAudioNodes()`; call `.start()` on each; set initial offset to 0
- [ ] T029 [US3] Add output ports in `ChordFinder` constructor in `src/components/utilities/ChordFinder.ts` — `addOutput('note1', 'Note 1', SignalType.CV)`, `addOutput('note2', 'Note 2', SignalType.CV)`, `addOutput('note3', 'Note 3', SignalType.CV)`, `addOutput('gate', 'Gate', SignalType.GATE)`
- [ ] T030 [US3] Override `getOutputNodeByPort(portId)` in `ChordFinder.ts` — return the matching `ConstantSourceNode` for `note1`, `note2`, `note3`, `gate`
- [ ] T031 [US3] Implement `pressChord(scaleDegree)` in `ChordFinder.ts` — guard: return immediately (no output, no gate) if `diatonicChords` is empty (no key selected); otherwise compute `cvVoltages[i] + (octave - 4)` for each note; call `setValueAtTime` on all 3 note nodes and gate node (1.0); call `triggerGateOn()` on all registered gate targets; set `pressedDegree`
- [ ] T032 [US3] Implement `releaseChord()` in `ChordFinder.ts` — set gate node offset to 0.0; call `triggerGateOff()` on all registered gate targets; clear `pressedDegree`
- [ ] T033 [US3] Implement hit detection in `ChordFinderDisplay.ts` — `mousedown`: compute polar angle of click, map to scale degree (arc = 2π/7 per degree, degree 0 at −π/2), call `onChordPress(scaleDegree)`; `mouseup`/`mouseleave`: call `onChordRelease()`
- [ ] T034 [US3] Wire `ChordFinderDisplay` press/release callbacks to `ChordFinder` in `CanvasComponent.ts` — `display.onChordPress = (deg) => chordFinder.pressChord(deg)`, `display.onChordRelease = () => chordFinder.releaseChord()`
- [ ] T035 [US3] Implement gate target registration in `ChordFinder.ts` — `registerGateTarget(target)` / `unregisterGateTarget(target)` using a `Set<SynthComponent>`; call `triggerGateOn/Off` on all targets from `pressChord`/`releaseChord`
- [ ] T036 [P] [US3] Write unit tests for CV output in `tests/unit/components/ChordFinder.test.ts` — assert `note1Output.offset.value` = 0.000 for C Major octave 4; = 1.000 for C Major octave 5; assert gate = 1.0 during press, 0.0 after release; assert `triggerGateOn/Off` called on registered targets; assert `pressChord()` with no key selected emits no CV and does not change gate state

**Checkpoint**: Patching `note1` to an oscillator and clicking a chord produces the correct pitch. Gate opens on press, closes on release.

---

## Phase 6: User Story 4 — Persist Key and Progression State (Priority: P4)

**Goal**: Saving and reloading a patch restores the selected key, scale type, octave, and chord progression exactly.

**Independent Test**: Set key to G Major, octave 5, generate a progression. Save patch. Reload patch. Verify key, octave, and highlighted progression nodes are identical.

- [ ] T037 [US4] Implement `serialize()` in `ChordFinder.ts` — call `serializeChordFinderConfig(config)` from `specs/010-chord-finder/contracts/validation.ts`; return `ComponentData` with the 4 numeric parameters (`rootNote`, `scaleType`, `octave`, `progression`)
- [ ] T038 [US4] Implement `deserialize(data)` in `ChordFinder.ts` — call `deserializeChordFinderConfig(params)` from `specs/010-chord-finder/contracts/validation.ts`; restore config, recompute `diatonicChords`, decode progression bitmask to `config.progression`
- [ ] T039 [P] [US4] Write persistence tests in `tests/persistence/ChordFinder.persistence.test.ts` — serialize then deserialize: assert rootNote, scaleType, octave unchanged; assert progression bitmask round-trips; test with progression = 0 (no progression); test with all degrees active (bitmask = 127)

**Checkpoint**: Full save/load cycle preserves all Chord Finder state. Integration with existing `PatchSerializer` verified.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Visual refinement, edge case hardening, and integration smoke-test.

- [ ] T040 [P] Handle no-key-selected state in `ChordFinderDisplay.ts` — if `diatonicChords` is empty, render placeholder text "Select a key" in centre and show 7 greyed-out inactive arc segments
- [ ] T041 [P] Disable "Generate" button when no key is selected — check `diatonicChords.length === 0` before calling `generateProgression()`; log a warning if called in invalid state
- [ ] T042 [P] Add rapid-click guard in `ChordFinderDisplay.ts` — if a chord is already pressed (`pressedDegree !== null`), release it before pressing the new one (prevents stuck gate on rapid multi-click)
- [ ] T043 [P] Add octave control to `ChordFinder` module in `src/canvas/CanvasComponent.ts` — add a `Dropdown` or stepped `Slider` control labelled "Oct" showing C2–C6; wire value change to `chordFinder.setOctave(value)`
- [ ] T044 Implement `setOctave(octave)` in `ChordFinder.ts` — clamp to [2,6], update `octave` parameter; if a chord is currently pressed, immediately update CV node offsets
- [ ] T045 [P] Add `destroy()` cleanup in `ChordFinder.ts` — unsubscribe from `visualUpdateScheduler`, stop and disconnect all 4 `ConstantSourceNode` instances, clear gate targets
- [ ] T046 Run `npm test && npm run lint` — fix all test failures and lint warnings
- [ ] T047 Smoke-test against quickstart.md validation scenarios — manually verify: C Major circle, A Minor circle, generate progression highlights, chord click CV values (C Major oct 4: 0.000V, 0.333V, 0.583V; oct 5: 1.000V, 1.333V, 1.583V), patch save/reload

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user story phases**
- **Phase 3 (US1)**: Depends on Phase 2 — no dependency on US2/US3/US4
- **Phase 4 (US2)**: Depends on Phase 2 + Phase 3 (progression display builds on circle render)
- **Phase 5 (US3)**: Depends on Phase 2 + Phase 3 (audio nodes wired to display callbacks)
- **Phase 6 (US4)**: Depends on Phase 2 + Phase 3 (serialize/deserialize uses config from US1)
- **Phase 7 (Polish)**: Depends on all story phases complete

### User Story Dependencies

- **US1 (P1)**: Start after Phase 2 — foundation for all other stories
- **US2 (P2)**: Start after US1 canvas display is in place (T018 complete)
- **US3 (P3)**: Start after US1 component scaffold is in place (T015 complete); can run in parallel with US2
- **US4 (P4)**: Start after US1 parameter infrastructure is in place (T015 complete); can run in parallel with US2 and US3

### Within Each Phase

- `[P]` tasks within a phase have no inter-dependencies and can run simultaneously
- Non-`[P]` tasks must complete sequentially in listed order

### Parallel Opportunities

- T003, T004 (Phase 1) — scaffold files in parallel
- T011, T012 (Phase 2) — chord theory unit tests in parallel
- T022, T024–T027, T028–T036, T037–T039 — `[P]` tasks within each story phase
- US2, US3, US4 can all proceed in parallel once US1's T015 and T018 are done

---

## Parallel Example: Phase 2 Foundational

```
# Run simultaneously after T008-T010 are complete:
T011: Write unit tests for getDiatonicChords
T012: Write unit tests for getChordName / getRomanNumeral
```

## Parallel Example: Phase 5 (US3)

```
# Run simultaneously:
T028: Create audio nodes
T029: Add output ports
T036: Write CV output unit tests

# After T028-T031 complete:
T033: Hit detection (canvas)
T034: Wire callbacks
T035: Gate target registration
```

---

## Implementation Strategy

### MVP First (User Story 1 — Visual Circle Only)

1. Complete Phase 1: Setup (T001–T007)
2. Complete Phase 2: Foundational (T008–T014)
3. Complete Phase 3: US1 (T015–T022)
4. **STOP and VALIDATE**: Chord circle renders for all 12 keys × 2 scale types
5. Demo / checkpoint before adding audio output

### Incremental Delivery

1. Phase 1 + 2 → Music theory verified ✓
2. + Phase 3 (US1) → Visual chord circle MVP ✓
3. + Phase 4 (US2) → Progression generation ✓
4. + Phase 5 (US3) → CV/gate audio output ✓
5. + Phase 6 (US4) → Patch persistence ✓
6. + Phase 7 → Production-ready ✓

### Parallel Team Strategy

After Phase 2 is complete:
- **Developer A**: Phase 3 (US1 — circle display)
- **Developer B**: Phase 5 (US3 — audio nodes, can scaffold independently)
- **Developer C**: Phase 6 (US4 — serialization, can scaffold independently)

---

## Notes

- `[P]` tasks operate on different files with no shared state — safe to parallelize
- `[Story]` label maps each task to a specific user story for traceability
- CV formula everywhere: `CV = (midiNote − 60) / 12 + (octave − 4)`
- Progression bitmask: bit N set → degree N in progression (see `contracts/validation.ts`)
- Chord quality table per scale degree is in `specs/010-chord-finder/data-model.md`
- Visual colour palette: default `#333`, progression `#4ECDC4`, pressed `#FFFFFF`
- DPR-aware canvas pattern: follow `src/canvas/displays/ColliderDisplay.ts` exactly
