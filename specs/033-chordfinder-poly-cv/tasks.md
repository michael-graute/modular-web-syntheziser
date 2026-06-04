# Tasks: ChordFinder Poly CV Output

**Input**: Design documents from `specs/033-chordfinder-poly-cv/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Contracts and test scaffolding — no source files changed yet.

- [ ] T001 [P] Add VoiceSlot import to `src/components/utilities/ChordFinder.ts` (import type from `./VoiceAllocator`)
- [ ] T002 [P] Verify `specs/033-chordfinder-poly-cv/contracts/types.ts` compiles cleanly (slot-index constants + `ChordFinderPolyCvSource` interface resolve correctly against `VoiceAllocator`)
- [ ] T003 [P] Verify `specs/033-chordfinder-poly-cv/contracts/validation.ts` compiles cleanly (`assertValidChordPolySlots`, `areChordSlotsActive`, `areChordSlotsReleased`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The core poly slot infrastructure in ChordFinder that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Add `private polySlots: VoiceSlot[]` field to `src/components/utilities/ChordFinder.ts`, initialized as 4-element array with `voiceIndex`, `frequency: 0`, `gate: 0 as 0 | 1`, `note: null`, `timestamp: 0`
- [ ] T005 Register `poly-cv` output port in the `ChordFinder` constructor in `src/components/utilities/ChordFinder.ts`: `this.addOutput('poly-cv', 'Poly CV', SignalType.POLY_CV)` (after existing gate output)
- [ ] T006 Add `getVoiceSlots(): Readonly<VoiceSlot[]>` public method to `src/components/utilities/ChordFinder.ts` returning `this.polySlots`
- [ ] T007 Add `case 'poly-cv': return null` to `getOutputNodeByPort()` in `src/components/utilities/ChordFinder.ts`

**Checkpoint**: ChordFinder now has a poly-cv port and `getVoiceSlots()` — ConnectionManager can register it as a POLY_CV source. Slot values are all zero until a chord is pressed.

---

## Phase 3: User Story 1 — ChordFinder Drives a Poly Voice Chain (Priority: P1) 🎯 MVP

**Goal**: Pressing a chord button populates the 3 active poly slots with the correct frequencies and gate=1; releasing sets gate=0 with frequencies retained.

**Independent Test**: Connect ChordFinder poly-cv → PolyOscillator → PolyADSR → PolyVCA → Master Out. Press any chord button — three distinct pitches with envelope shaping. Release — three voices fade out.

### Implementation for User Story 1

- [ ] T008 [US1] Update `pressChord()` in `src/components/utilities/ChordFinder.ts`: after the existing mono CV writes, set `polySlots[0..2].frequency = midiToHz(chord.notes[i]! + octaveShift)` and `polySlots[0..2].gate = 1` (slot 3 remains unchanged)
- [ ] T009 [US1] Update `releaseChord()` in `src/components/utilities/ChordFinder.ts`: after the existing mono gate release, set `polySlots[0..2].gate = 0` (frequencies intentionally retained)
- [ ] T010 [US1] Write test file `tests/components/ChordFinder.poly.test.ts`: initial state — all slots gate=0, `assertValidChordPolySlots` passes, `areChordSlotsReleased` = true
- [ ] T011 [US1] Extend `tests/components/ChordFinder.poly.test.ts`: `pressChord(0)` — `areChordSlotsActive` = true, slot 3 gate=0, slot frequencies match expected Hz values for root chord
- [ ] T012 [US1] Extend `tests/components/ChordFinder.poly.test.ts`: `releaseChord()` — `areChordSlotsReleased` = true, slot[0..2].frequency > 0 (frequencies retained after release)
- [ ] T013 [US1] Extend `tests/components/ChordFinder.poly.test.ts`: slot 3 invariant — after press and release, `polySlots[3].gate === 0` and `polySlots[3].frequency === 0`
- [ ] T014 [US1] Extend `tests/components/ChordFinder.poly.test.ts`: `getVoiceSlots()` returns the same array reference (not a copy) — pointer identity check
- [ ] T015 [US1] Extend `tests/components/ChordFinder.poly.test.ts`: chord-change-while-held — call `pressChord(0)`, then `pressChord(2)` without releasing; assert slots 0–2 reflect the new triad's frequencies and gate remains 1 (US1 Acceptance Scenario 3)
- [ ] T016 [US1] Extend `tests/components/ChordFinder.poly.test.ts`: octave sync — call `pressChord(0)` at octave 3, then `setOctave(4)` (which internally re-calls `pressChord`); assert slot frequencies increase by the expected ratio (FR-008)
- [ ] T017 [US1] Run `vitest run tests/components/ChordFinder.poly.test.ts` and confirm all tests pass

**Checkpoint**: User Story 1 complete. ChordFinder correctly populates and releases the poly voice slots. The full poly chain patch is now audibly functional.

---

## Phase 4: User Story 2 — Existing Mono Outputs Remain Functional (Priority: P2)

**Goal**: All existing note1/note2/note3/gate mono outputs continue to work exactly as before; adding poly-cv port does not break any existing behaviour or saved patches.

**Independent Test**: Load an existing ChordFinder patch with mono outputs wired. Verify all connections restore without error and pressing chords produces the same mono CV values as before.

### Implementation for User Story 2

- [ ] T018 [US2] Run existing test suite `vitest run tests/components/ChordFinder.emit.test.ts` — confirm all pre-existing tests still pass with no changes needed
- [ ] T019 [US2] Run `vitest run tests/unit/components/ChordFinder.test.ts` — confirm all pre-existing unit tests still pass
- [ ] T020 [US2] Run `vitest run tests/persistence/ChordFinder.persistence.test.ts` — confirm patch save/load tests still pass (poly-cv port requires no serialization)
- [ ] T021 [P] [US2] Extend `tests/components/ChordFinder.poly.test.ts`: simultaneous mono+poly — after `pressChord(0)`, assert `note1Output.offset.value` matches `polySlots[0].frequency` (both reflect the same Hz value)

**Checkpoint**: Confirmed zero regression on existing mono behaviour. Serialization unchanged. US1 and US2 both independently verified.

---

## Phase 5: User Story 3 — Poly ChordFinder Feeds Existing Mono Effects Chain (Priority: P3)

**Goal**: PolyVCA's mixed output connects to mono effects (Filter, Reverb, Master Out) without any change to those components. This story is validated by the existing 032-polyphony infrastructure — no new code is needed.

**Independent Test**: Connect PolyVCA audio out → Filter → Master Out. Play chords via ChordFinder. All three voices pass through the filter.

### Implementation for User Story 3

- [ ] T022 [US3] Manual smoke test per `specs/033-chordfinder-poly-cv/quickstart.md`: full poly chain patch (ChordFinder → PolyOscillator → PolyADSR → PolyVCA → Filter → Master Out), confirm voices pass through filter
- [ ] T023 [P] [US3] Extend `tests/components/ChordFinder.poly.test.ts`: verify POLY_CV port is registered with `SignalType.POLY_CV` — inspect `getOutputPorts()` to confirm the port exists with correct signal type

**Checkpoint**: All three user stories complete and independently verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: TypeScript correctness, spec note correction, final validation.

- [ ] T024 [P] Run full TypeScript type-check: `npx tsc --noEmit` — confirm no new type errors introduced by ChordFinder changes
- [ ] T025 [P] Run full test suite: `vitest run` — confirm all tests pass including pre-existing ChordFinder and Keyboard tests
- [ ] T026 Run `npm run lint` — confirm no new linting warnings in `src/components/utilities/ChordFinder.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately (contracts already written)
- **Foundational (Phase 2)**: Depends on T001 (VoiceSlot import) — BLOCKS all user story implementation
- **User Story 1 (Phase 3)**: Depends on Foundational (T004–T007) — core poly chain functionality
- **User Story 2 (Phase 4)**: Depends on Foundational (T004–T007) — runs existing tests; T021 also requires US1 (T008–T009)
- **User Story 3 (Phase 5)**: Depends on US1 (T008–T009) being complete for the manual smoke test
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1**: Depends on Foundational only — no dependency on US2 or US3
- **US2**: T018–T020 can run after Foundational (parallel with US1); T021 requires US1 complete
- **US3**: T022 requires US1 complete; T023 can run after Foundational

### Within Each User Story

- T008 (press) before T009 (release) — release logic requires understanding of press state
- T010–T016 (tests) written against T008–T009 implementation
- T017 (test run) after all test files written

### Parallel Opportunities

- T001, T002, T003 (Phase 1) — all parallel, different files
- T004, T005, T006, T007 (Phase 2) — sequential within ChordFinder.ts (same file, logical order)
- T010–T016 (test cases) — parallel if using separate `it()` blocks in the same file
- T018, T019, T020 (existing test runs, Phase 4) — all parallel
- T024, T025, T026 (Phase 6) — all parallel

---

## Parallel Example: User Story 1

```bash
# After Phase 2 (Foundational) is complete:

# These two implementation tasks are sequential (same method, logical order):
Task T008: Update pressChord() in src/components/utilities/ChordFinder.ts
Task T009: Update releaseChord() in src/components/utilities/ChordFinder.ts

# These test authoring tasks can be written in parallel (separate it() blocks):
Task T010: Initial state test
Task T011: pressChord test
Task T012: releaseChord test
Task T013: slot 3 invariant test
Task T014: getVoiceSlots reference test
Task T015: chord-change-while-held test (US1 Scenario 3)
Task T016: octave sync test (FR-008)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003) — fast, contracts already exist
2. Complete Phase 2: Foundational (T004–T007) — ~15 lines in ChordFinder.ts
3. Complete Phase 3: User Story 1 (T008–T017) — pressChord/releaseChord updates + tests
4. **STOP and VALIDATE**: `vitest run tests/components/ChordFinder.poly.test.ts` — all green
5. Manual patch test: ChordFinder → PolyOscillator → PolyADSR → PolyVCA → Master Out

### Incremental Delivery

1. Foundational → poly-cv port exists, `getVoiceSlots()` returns zero slots
2. US1 complete → poly chain produces 3 enveloped voices from chord buttons
3. US2 complete → confirmed zero regression on mono outputs and serialization
4. US3 complete → confirmed PolyVCA→Filter integration works unchanged
5. Polish → type-check, lint, spec correction all clean

### Total Scope

**1 source file modified** (`src/components/utilities/ChordFinder.ts`) — approximately 25–30 lines added.
**1 test file added** (`tests/components/ChordFinder.poly.test.ts`) — approximately 80–100 lines.
**0 other source files changed**.

---

## Notes

- [P] tasks = different files or independent operations, no blocking dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- `gate: 0 | 1` (numeric) — NOT boolean — matches the existing `VoiceSlot` interface from `VoiceAllocator.ts`
- `polySlots[3]` is always `gate: 0, frequency: 0` — never written by pressChord/releaseChord
- Frequencies are retained on release (MUST NOT reset to 0) to preserve PolyADSR release tail
