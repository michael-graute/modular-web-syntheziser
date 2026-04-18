# Tasks: ChordFinder–Keyboard Visual Sync

**Input**: Design documents from `/specs/014-chordfinder-keyboard-sync/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Included — the contracts and validation helpers require 100% coverage per the constitution.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in all task descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new files or directories are required — all changes extend existing files. This phase documents the one-time review needed before work begins.

- [ ] T001 Review src/core/types.ts, src/keyboard/Keyboard.ts, src/keyboard/KeyboardController.ts, and src/components/utilities/ChordFinder.ts to confirm current API surface before editing

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type system extensions and contract artifacts that ALL user stories depend on.

**⚠️ CRITICAL**: No user story implementation can begin until T002–T004 are complete.

- [ ] T002 Add `CHORD_NOTES_ON = 'chord:notes-on'` and `CHORD_NOTES_OFF = 'chord:notes-off'` to the `EventType` enum in src/core/types.ts
- [ ] T003 Add `ChordNotesOnPayload` and `ChordNotesOffPayload` interfaces to src/core/types.ts (fields: `notes: [number, number, number]`, `sourceId: string`) matching specs/014-chordfinder-keyboard-sync/contracts/types.ts
- [ ] T004 [P] Write unit tests for the validation helpers in tests/contracts/validation.test.ts covering `validateChordNotesOnPayload`, `validateChordNotesOffPayload`, and `isNoteInKeyboardRange` from specs/014-chordfinder-keyboard-sync/contracts/validation.ts (100% coverage required)

**Checkpoint**: EventType enum and payload types in place — user story implementation can begin.

---

## Phase 3: User Story 1 - Chord Playback Highlights Keys (Priority: P1) 🎯 MVP

**Goal**: When a chord is pressed in ChordFinder, the three notes light up on the Keyboard canvas in the same blue style as manually-pressed keys. When the chord is released, the highlights are removed.

**Independent Test**: Add ChordFinder and Keyboard modules to the canvas, press any chord button, verify three keys turn blue. Release the button, verify keys return to white/dark.

### Implementation for User Story 1

- [ ] T005 [US1] Add `pressedByChordFinder: boolean` (default `false`) to the `Key` interface in src/keyboard/Keyboard.ts and initialize it in the key-generation loop
- [ ] T006 [US1] Update the canvas render method in src/keyboard/Keyboard.ts so that a key renders with the pressed (blue) color when `key.isPressed || key.pressedByChordFinder` is true
- [ ] T007 [US1] Add public method `pressKeyFromChordFinder(note: number): void` to src/keyboard/Keyboard.ts — finds the matching Key by MIDI note, sets `pressedByChordFinder = true`, calls `render()`
- [ ] T008 [US1] Add public method `releaseKeyFromChordFinder(note: number): void` to src/keyboard/Keyboard.ts — finds the matching Key by MIDI note, sets `pressedByChordFinder = false`, calls `render()`
- [ ] T009 [US1] Add public method `releaseAllChordFinderKeys(): void` to src/keyboard/Keyboard.ts — clears `pressedByChordFinder` on all keys with a single `render()` call
- [ ] T010 [US1] Add private field `lastPressedNotes: [number, number, number] | null = null` to ChordFinder class in src/components/utilities/ChordFinder.ts
- [ ] T011 [US1] In `pressChord(scaleDegree)` in src/components/utilities/ChordFinder.ts, after existing CV/gate logic: compute shifted MIDI notes (`chord.notes[i] + (this.config.octave - 4) * 12`), store in `lastPressedNotes`, emit `EventType.CHORD_NOTES_ON` via `eventBus` with `{ notes, sourceId: this.id }`
- [ ] T012 [US1] In `releaseChord()` in src/components/utilities/ChordFinder.ts, after existing gate-off logic: if `lastPressedNotes` is not null, emit `EventType.CHORD_NOTES_OFF` via `eventBus` with `{ notes: lastPressedNotes, sourceId: this.id }`, then set `lastPressedNotes = null`
- [ ] T012b [US1] In `setOctave(octave)` in src/components/utilities/ChordFinder.ts, after the existing CV output update: if `lastPressedNotes !== null` (a chord is currently held), recompute the three shifted MIDI notes for the new octave, update `lastPressedNotes`, and emit `EventType.CHORD_NOTES_ON` via `eventBus` with `{ notes: updatedNotes, sourceId: this.id }` — this covers US1 acceptance scenario 3 (octave change while chord is playing moves the keyboard highlights)
- [ ] T013 [US1] Add private fields `currentChordNotes: number[] = []`, `unsubscribeChordOn: (() => void) | null = null`, and `unsubscribeChordOff: (() => void) | null = null` to KeyboardController in src/keyboard/KeyboardController.ts
- [ ] T014 [US1] Add private method `subscribeToChordEvents()` in src/keyboard/KeyboardController.ts that subscribes to `EventType.CHORD_NOTES_ON` on `eventBus`: for each received payload, call `keyboard.releaseAllChordFinderKeys()`, then call `keyboard.pressKeyFromChordFinder(note)` for each note in `payload.notes`, store payload.notes in `currentChordNotes`
- [ ] T015 [US1] In `subscribeToChordEvents()` in src/keyboard/KeyboardController.ts, also subscribe to `EventType.CHORD_NOTES_OFF`: call `keyboard.releaseAllChordFinderKeys()`, clear `currentChordNotes = []`
- [ ] T016 [US1] Call `this.subscribeToChordEvents()` at the end of the KeyboardController constructor in src/keyboard/KeyboardController.ts
- [ ] T017 [US1] Write unit tests for Keyboard chord-finder methods in tests/keyboard/Keyboard.chordfinder.test.ts covering: `pressKeyFromChordFinder` sets flag and triggers render, `releaseKeyFromChordFinder` clears flag and triggers render, `releaseAllChordFinderKeys` clears all flags with one render call, render uses blue color when `pressedByChordFinder` is true

**Checkpoint**: User Story 1 is fully functional. ChordFinder chord presses and octave changes highlight the correct keys on Keyboard. All tests pass.

---

## Phase 4: User Story 2 - No Keyboard Module Required (Priority: P2)

**Goal**: ChordFinder works without errors when no Keyboard module (and thus no KeyboardController) is present in the patch.

**Independent Test**: Remove the Keyboard module from a patch, press chords in ChordFinder repeatedly — no errors, CV/gate audio output unchanged.

### Implementation for User Story 2

- [ ] T018 [US2] Verify that ChordFinder's `eventBus.emit(CHORD_NOTES_ON/OFF)` calls in src/components/utilities/ChordFinder.ts are fire-and-forget — confirm no error is thrown when there are zero subscribers (EventBus already supports this; this is a no-op verification task)
- [ ] T019 [US2] Write a unit test in tests/components/ChordFinder.emit.test.ts that instantiates ChordFinder without any KeyboardController present, calls `pressChord()` and `releaseChord()`, and asserts no error is thrown and CV/gate output values are correct

**Checkpoint**: User Stories 1 and 2 both work. ChordFinder is safe to use in any patch configuration.

---

## Phase 5: User Story 3 - Multiple Keyboard Modules Sync (Priority: P3)

**Goal**: When multiple Keyboard modules exist in a patch (multiple KeyboardController instances), all of them highlight the chord notes when ChordFinder plays.

**Independent Test**: Add two Keyboard modules and one ChordFinder to a patch, press a chord — both keyboards highlight the same three keys.

### Implementation for User Story 3

- [ ] T020 [US3] Confirm (by code review) that because each KeyboardController independently subscribes to `eventBus` in its constructor, multiple instances will each receive `CHORD_NOTES_ON` / `CHORD_NOTES_OFF` events — no code change needed if already correct; document finding in a comment if needed
- [ ] T021 [US3] Add `destroy()` method to KeyboardController in src/keyboard/KeyboardController.ts that calls `this.unsubscribeChordOn?.()` and `this.unsubscribeChordOff?.()` to prevent memory leaks when a Keyboard module is removed from the canvas
- [ ] T022 [US3] Ensure the canvas component teardown path for the Keyboard module calls `keyboardController.destroy()` — locate the removal handler in src/canvas/ or src/main.ts and wire it up
- [ ] T023 [US3] Write an integration test in tests/keyboard/KeyboardController.chordfinder.test.ts that creates two KeyboardController instances, emits `CHORD_NOTES_ON` via eventBus, and asserts both controllers' keyboards have `pressedByChordFinder = true` for the correct keys

**Checkpoint**: All three user stories work. Multiple Keyboard instances sync correctly. Teardown is leak-free.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation helpers, atomic chord-swap edge case, and final verification.

- [ ] T024 [P] Copy validation helpers from specs/014-chordfinder-keyboard-sync/contracts/validation.ts into src/keyboard/KeyboardValidation.ts (or inline into KeyboardController as private methods) so they can be used in production code for defensive note-range checks
- [ ] T025 Write an integration test in tests/keyboard/KeyboardController.chordfinder.test.ts for the atomic chord-swap (FR-009): emit CHORD_NOTES_ON for chord A, then immediately emit CHORD_NOTES_ON for chord B, assert only chord B keys are highlighted (no overlap) and render was called exactly twice total
- [ ] T026 Write an integration test in tests/keyboard/KeyboardController.chordfinder.test.ts for the additive coexistence scenario (FR-006/007): manually press a key that is also in a ChordFinder chord, release the ChordFinder chord, assert the manually-pressed key remains highlighted
- [ ] T027 [P] Run `vitest run` and `npm run lint` to confirm all tests pass and no linting warnings are introduced
- [ ] T028 [P] Manually validate the feature using the steps in specs/014-chordfinder-keyboard-sync/quickstart.md — all 8 test steps must pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **User Story 1 (Phase 3)**: Depends on Phase 2 — T005–T009 (Keyboard) and T010–T012 (ChordFinder) can run in parallel; T013–T016 (KeyboardController wiring) depend on T005–T012
- **User Story 2 (Phase 4)**: Depends on Phase 2 — can run in parallel with Phase 3 (different files)
- **User Story 3 (Phase 5)**: Depends on Phase 3 completion (KeyboardController subscription must exist before destroy() is added)
- **Polish (Phase 6)**: Depends on Phases 3–5

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational. Independent of US2/US3.
- **US2 (P2)**: Depends on Foundational. Independent of US1/US3 (verifies fire-and-forget behavior).
- **US3 (P3)**: Depends on US1 (KeyboardController subscription wired in Phase 3).

### Within User Story 1 — Parallel Opportunities

```bash
# These tasks touch different files and can run in parallel after T002–T004:
T005–T009  →  src/keyboard/Keyboard.ts            (Key interface + methods)
T010–T012  →  src/components/utilities/ChordFinder.ts  (emit events)

# These tasks depend on T005–T012 completing first:
T013–T016  →  src/keyboard/KeyboardController.ts  (subscribe + wire)

# Tests can be written in parallel with implementation:
T017       →  tests/keyboard/Keyboard.chordfinder.test.ts
```

---

## Parallel Example: User Story 1

```
Phase 2 complete → start simultaneously:

  Stream A (Keyboard.ts):
    T005 → T006 → T007 → T008 → T009

  Stream B (ChordFinder.ts):
    T010 → T011 → T012 → T012b

  Stream C (tests, can start anytime):
    T004 (validation tests) → T017 (Keyboard unit tests)

  When Stream A + B complete:
    T013 → T014 → T015 → T016  (KeyboardController wiring)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (review)
2. Complete Phase 2: Foundational — add event types to types.ts
3. Complete Phase 3: User Story 1 — Keyboard flag + ChordFinder emit + KeyboardController subscribe
4. **STOP and VALIDATE**: Press chords in ChordFinder, confirm Keyboard highlights
5. Run `vitest run` — all tests pass

### Incremental Delivery

1. Setup + Foundational → types extended
2. US1 → core visual sync working (MVP — demonstrable)
3. US2 → graceful no-keyboard behavior confirmed
4. US3 → multi-keyboard + destroy() wired up
5. Polish → edge case tests + manual quickstart validation

---

## Notes

- [P] tasks touch different files and have no blocking dependencies
- [Story] labels map each task to its user story for traceability
- Tests for US1 can be written in parallel with implementation (TDD or post-implementation)
- US2 requires no new source code if EventBus already supports zero-subscriber emit (very likely)
- US3's T020 may be a no-op if multiple KeyboardController instances already work by construction
- Commit after each checkpoint to keep history clean
- `vitest run` (not `npm test`) per project memory
