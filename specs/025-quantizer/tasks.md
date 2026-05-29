# Tasks: Quantizer

**Input**: Design documents from `specs/025-quantizer/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the new component type and wire up the minimal scaffolding all later phases depend on.

- [ ] T001 Add `QUANTIZER = 'quantizer'` to `ComponentType` enum in `src/core/types.ts`
- [ ] T002 Add `QUANTIZER` entry to the `names` record in `CanvasComponent.ts` (line ~1877) in `src/canvas/CanvasComponent.ts`
- [ ] T003 Add `QUANTIZER` dimensions case in `src/utils/componentLayout.ts`

**Checkpoint**: TypeScript compiles without errors — `ComponentType.QUANTIZER` is valid everywhere.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure-logic validation helpers and contracts that all user story phases depend on. No Web Audio API required — fully unit-testable.

- [ ] T004 [P] Copy `specs/025-quantizer/contracts/types.ts` to confirm it compiles cleanly; run `vitest run` to verify no existing tests regress
- [ ] T005 [P] Copy `specs/025-quantizer/contracts/validation.ts` to confirm it compiles cleanly
- [ ] T006 Write unit tests for `buildPitchTable()` covering all 8 scale types and all 12 root notes in `tests/components/utilities/Quantizer.test.ts`
- [ ] T007 Write unit tests for `quantizeCv()` — in-range CV, lower clamp (below C0), upper clamp (above C8), tie-breaking (higher pitch wins) in `tests/components/utilities/Quantizer.test.ts`
- [ ] T008 Write unit tests for `midiToNoteLabel()`, `cvToMidi()`, `midiToCv()`, `serializeQuantizerConfig()`, `deserializeQuantizerConfig()` in `tests/components/utilities/Quantizer.test.ts`
- [ ] T009 Run `vitest run tests/components/utilities/Quantizer.test.ts` and confirm all pure-function tests pass

**Checkpoint**: All contract helper tests green. Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 — LFO Melody Generator (Priority: P1) 🎯 MVP

**Goal**: A user can connect LFO → Quantizer → Oscillator and hear pitches snapped to the selected scale in real time (continuous / trigger-free mode).

**Independent Test**: Connect LFO (slow sweep) → Quantizer (C Major) → Oscillator → Master Output; verify audible pitch only lands on C D E F G A B.

### Implementation

- [ ] T010 [US1] Create `src/components/utilities/Quantizer.ts` — class skeleton extending `SynthComponent`, constructor with default `QuantizerConfig` (C Major), port declarations (`cv-in` CV, `gate-in` Gate, `cv-out` CV)
- [ ] T011 [US1] Implement `createAudioNodes()` in `src/components/utilities/Quantizer.ts` — create `ConstantSourceNode` for CV output and a second one for gate input polling; start both nodes
- [ ] T012 [US1] Implement `destroyAudioNodes()` in `src/components/utilities/Quantizer.ts` — stop and disconnect both `ConstantSourceNode` instances, cancel visual scheduler subscription, reset `lastGateValue`
- [ ] T013 [US1] Implement `getInputNode()` / `getOutputNode()` in `src/components/utilities/Quantizer.ts` — return correct nodes for `cv-in`, `gate-in`, `cv-out` port IDs
- [ ] T014 [US1] Implement `rebuildPitchTable()` in `src/components/utilities/Quantizer.ts` — calls `buildPitchTable(rootNote, scaleType)` from contracts/validation.ts, stores result
- [ ] T015 [US1] Implement control-rate `update()` method in `src/components/utilities/Quantizer.ts` — trigger-free path: read `cvInputNode.offset.value`, call `quantizeCv()`, write result to `cvOutputNode.offset`, update `currentNoteLabel` via `midiToNoteLabel()`
- [ ] T016 [US1] Subscribe `update()` to `visualUpdateScheduler` in `createAudioNodes()` in `src/components/utilities/Quantizer.ts`
- [ ] T017 [US1] Implement `updateParameter()` in `src/components/utilities/Quantizer.ts` — handle `rootNote` (0–11) and `scaleType` (0–7) parameter updates, call `rebuildPitchTable()` on change
- [ ] T018 [US1] Import and register `Quantizer` in `src/components/registerComponents.ts` under `'Utilities'` group with `calculateComponentDimensions(ComponentType.QUANTIZER)`
- [ ] T019 [US1] Add `if (this.type === ComponentType.QUANTIZER)` block in `createControls()` in `src/canvas/CanvasComponent.ts` — root note dropdown (0–11), scale type dropdown (0–7), read-only note label display
- [ ] T020 [US1] Write component integration test: instantiate `Quantizer`, call `createAudioNodes()`, verify `cvOutputNode` exists and initial output equals `midiToCv(quantizeCv(0, buildPitchTable('C', 'major')))` in `tests/components/utilities/Quantizer.test.ts`

**Checkpoint**: LFO → Quantizer → Oscillator patch plays in-scale pitches. Note label updates in real time. All US1 tests green.

---

## Phase 4: User Story 2 — Trigger-Locked Pitch Steps (Priority: P2)

**Goal**: When a gate/trigger input is connected, the Quantizer only updates its output pitch on a rising edge — pitch holds between triggers.

**Independent Test**: Connect Sequencer clock gate out → Quantizer trigger-in; slow LFO → Quantizer cv-in; verify pitch only changes on clock pulses.

### Implementation

- [ ] T021 [US2] Implement trigger-mode path in `update()` in `src/components/utilities/Quantizer.ts` — detect rising edge (`lastGateValue < 0.5 && currentGate >= 0.5`), update `heldCv` only on rising edge, always write `heldCv` to output
- [ ] T022 [US2] Implement `triggerConnected` state tracking in `src/components/utilities/Quantizer.ts` — set to `true` when `gate-in` port receives a connection (override `onPortConnected` / `onPortDisconnected` or equivalent hook used by other components)
- [ ] T023 [US2] Write unit tests for trigger-mode: assert output does NOT change mid-cycle, assert output DOES change on rising edge, assert no spurious updates between edges, assert output holds last quantized value when CV input is disconnected (input reads 0.0) while trigger is active in `tests/components/utilities/Quantizer.test.ts`

**Checkpoint**: With trigger wired, pitch only steps on rising gate edge. US2 tests green. US1 still passes.

---

## Phase 5: User Story 3 — Real-Time Scale & Root Switching (Priority: P2)

**Goal**: Changing root note or scale type takes effect immediately, with no audio dropout or glitch.

**Independent Test**: Change root from C to F while a patch is playing; verify output immediately produces only F Major pitches.

### Implementation

- [ ] T024 [US3] Verify `rebuildPitchTable()` is called synchronously inside `updateParameter()` before the next `update()` tick in `src/components/utilities/Quantizer.ts` (already implicit from T017 — add explicit test coverage)
- [ ] T025 [US3] Write unit tests for real-time config change: set root=C/scale=Major, quantize a CV, change root to F, quantize same CV, verify new output is in F Major in `tests/components/utilities/Quantizer.test.ts`
- [ ] T026 [US3] Verify dropdown controls in `CanvasComponent.ts` call `updateParameter()` immediately on user interaction — check against existing dropdown pattern (no extra work needed if standard pattern followed; add note if discrepancy found) in `src/canvas/CanvasComponent.ts`

**Checkpoint**: Live root/scale changes heard immediately without clicks. US3 tests green. US1 + US2 still pass.

---

## Phase 6: User Story 4 — Patch Save & Restore (Priority: P3)

**Goal**: A patch containing a configured Quantizer saves and restores with all parameters and connections intact.

**Independent Test**: Save a patch with Quantizer root=G, scale=Harmonic Minor; reload page; verify Quantizer opens with the same settings.

### Implementation

- [ ] T027 [US4] Implement `serialize()` in `src/components/utilities/Quantizer.ts` — use `serializeQuantizerConfig()` to write `rootNote` and `scaleType` as numeric parameters into `ComponentData`
- [ ] T028 [US4] Implement `deserialize()` in `src/components/utilities/Quantizer.ts` — use `deserializeQuantizerConfig()` to restore config from `ComponentData.parameters`, call `rebuildPitchTable()`, call `updateParameter()` for each value to sync canvas controls
- [ ] T029 [US4] Write unit tests for round-trip serialization: serialize a non-default config (root=G, scale=harmonic-minor), deserialize, verify restored config matches original in `tests/components/utilities/Quantizer.test.ts`
- [ ] T030 [US4] Write unit test for unknown/missing parameter graceful fallback: deserialize an empty params object, verify defaults (C Major) are used in `tests/components/utilities/Quantizer.test.ts`

**Checkpoint**: Patch save/load cycle preserves Quantizer config perfectly. US4 tests green. All prior stories still pass.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge-case hardening, visual polish, and final validation.

- [ ] T031 [P] Verify CV clamping in `update()` — add assertion-style guard: if `cvInputNode.offset.value` is outside `[CV_MIN, CV_MAX]`, clamp before passing to `quantizeCv()` (already in contracts but verify runtime path) in `src/components/utilities/Quantizer.ts`
- [ ] T032 [P] Verify note label renders correctly for accidentals (e.g. "A#4", "C#3") and boundary notes ("C0", "C8") — visual check and unit assertion in `tests/components/utilities/Quantizer.test.ts`
- [ ] T033 [P] Run full test suite `vitest run` and confirm zero regressions across all existing tests
- [ ] T034 [P] Run `npm run lint` and fix any TypeScript strict-mode or linting warnings introduced by new files
- [ ] T035 Smoke-test in browser: build `LFO → Quantizer → Oscillator → Master Out` patch, verify all 8 scale types and several root notes produce correct in-scale pitches
- [ ] T036 Smoke-test trigger mode: wire `Step Sequencer` clock → Quantizer gate-in, verify pitch steps only on beat
- [ ] T037 Smoke-test patch persistence: save, reload, verify Quantizer state restored
- [ ] T038 Update `docs/research/missing-features.md` — mark Quantizer as implemented in `docs/research/missing-features.md`

**Checkpoint**: All tests green, lint clean, manual smoke tests pass. Feature ready for review.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (needs `ComponentType.QUANTIZER` to exist)
- **Phase 3 (US1)**: Depends on Phase 2 — BLOCKS all other user stories
- **Phase 4 (US2)**: Depends on Phase 3 (trigger mode extends the `update()` method)
- **Phase 5 (US3)**: Depends on Phase 3 (parameter update path already exists from US1)
- **Phase 6 (US4)**: Depends on Phase 3 (serialize/deserialize needs audio nodes to exist)
- **Phase 7 (Polish)**: Depends on all story phases complete

### User Story Dependencies

- **US1 (P1)**: Core — all other stories build on it
- **US2 (P2)**: Extends US1's `update()` — implement after US1
- **US3 (P2)**: Extends US1's `updateParameter()` — can be done in parallel with US2
- **US4 (P3)**: Uses US1's audio node lifecycle — implement after US1; independent of US2/US3

### Parallel Opportunities

Within Phase 2: T004 and T005 are parallel (different files).  
Within Phase 3: T010–T016 are sequential (build the class incrementally); T020 parallels T019.  
Within Phase 7: T031–T034 are all parallel (different concerns, different files).  
US2 and US3 phases can be worked in parallel by two developers once US1 is complete.

---

## Parallel Example: Phase 2 (Foundational)

```
Parallel launch:
  T004: Verify contracts/types.ts compiles
  T005: Verify contracts/validation.ts compiles

Then sequential:
  T006 → T007 → T008 → T009 (build tests incrementally)
```

## Parallel Example: Phase 7 (Polish)

```
Parallel launch:
  T031: Verify CV clamping path
  T032: Verify note label edge cases
  T033: Full vitest run
  T034: npm run lint

Then sequential:
  T035 → T036 → T037 → T038 (manual smoke tests + docs)
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1 (Setup) — ~3 tasks
2. Complete Phase 2 (Foundational) — pure logic + tests, no Web Audio
3. Complete Phase 3 (US1) — full component, controls, scheduler integration
4. **STOP and VALIDATE**: LFO → Quantizer → Oscillator plays in-scale pitches
5. All 8 scales and 12 root notes verified via unit tests

### Incremental Delivery

1. Phase 1 + 2 → contract tests all green
2. Phase 3 (US1) → MVP Quantizer usable in patches
3. Phase 4 (US2) → trigger-gated melodic stepping
4. Phase 5 (US3) → live scale switching
5. Phase 6 (US4) → patch persistence
6. Phase 7 → production-ready

---

## Notes

- `[P]` = different files or concerns, no dependencies on incomplete tasks in the same phase
- `[USn]` = maps task to user story for traceability
- Contracts (`specs/025-quantizer/contracts/`) are already written — import, don't rewrite
- All pure functions (`buildPitchTable`, `quantizeCv`, etc.) are unit-testable without a Web Audio context
- Web Audio context mocking follows the pattern used in existing utility component tests
- Run `vitest run` (not `npm test`) to avoid watch mode hanging
