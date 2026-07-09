---

description: "Task list for Clock Divider feature implementation"
---

# Tasks: Clock Divider

**Input**: Design documents from `/specs/038-clock-divider/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The project constitution mandates 100% coverage for utility/validation functions and comprehensive tests for all public APIs; every prior feature in this codebase ships tests alongside implementation.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact and follow this repo's existing conventions (`src/components/utilities/`, `tests/components/utilities/`, `specs/038-clock-divider/contracts/`)

## Path Conventions

Single project (`src/`, `tests/` at repository root), per plan.md's Project Structure section. New files:
- `src/components/utilities/ClockDivider.ts`
- `tests/components/utilities/ClockDivider.test.ts`
- `specs/038-clock-divider/contracts/types.ts`, `specs/038-clock-divider/contracts/validation.ts` (already created during `/speckit-plan`)

## Notes carried over from `/speckit-plan`'s research

- All six rate choices persist via the existing generic `Parameter`/`ComponentData.parameters` mechanism — no `ComponentData` schema changes, no custom `serialize()`/`deserialize()` override needed at all (unlike Notes' `text?`/`width?`/`height?`).
- Scheduling reuses StepSequencer's drift-resistant lookahead pattern (`nextTickTime` advanced by addition, never reset), generalized from one to six independently-rated tracks sharing one 25ms-polled `setInterval` loop — this is what guarantees FR-007 (related rates always coincide) by construction.
- Six independently-wired gate outputs reuse ChordFinder's `getOutputNodeByPort` override pattern — the base class's single-output fallback is insufficient once there's more than one port of the same signal type.
- No `bpmMode` (local/global) toggle — Clock Divider always follows global BPM unconditionally, per spec Assumptions.
- No input ports at all — per spec Assumptions, no external clock/gate input in this feature.
- Layout follows Arpeggiator's "N stacked dropdown rows" `calculateComponentHeight` special case, generalized from 4 rows to 6.
- Category `'Controllers'`, matching this project's existing sidebar split (Step Sequencer, Arpeggiator, Chord Finder are already there).

---

## Phase 1: Setup

**Purpose**: Register the new component type so it exists in the type system before any behavior is built.

- [X] T001 Add `CLOCK_DIVIDER = 'clock-divider'` to the `ComponentType` enum in `src/core/types.ts`
- [X] T002 [P] Verify `specs/038-clock-divider/contracts/types.ts` and `contracts/validation.ts` are ready to be imported directly as source (no changes needed if already correct) — `ClockDivider.ts` will import `ClockDividerRate`/`RATE_LABELS`/`CLOCK_DIVIDER_OUTPUT_COUNT`/`DEFAULT_RATES` from `contracts/types` and `clampRateIndex`/`ratePeriodMs`/`advanceTick`/`collectDueTicks` from `../../../specs/038-clock-divider/contracts/validation`

**Checkpoint**: `ComponentType.CLOCK_DIVIDER` exists and compiles; no behavior yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure scheduling-math tests plus the component skeleton, registration, and layout wiring that every user story's UI depends on.

**⚠️ CRITICAL**: No user story work can be manually/visually verified until this phase is complete, though the pure-math tests (T003-T004) have no dependency on the rest of this phase and may be run first.

### Tests for Foundational contracts

- [X] T003 [P] Unit tests for `clampRateIndex`, `ratePeriodMs`, and `pulseWidthMs` in `tests/components/utilities/ClockDivider.test.ts` — verify `clampRateIndex` clamps values below `Div16`(0) and above `X3`(5) to those bounds, rounds fractional values, and passes through valid indices unchanged; verify `ratePeriodMs` returns the correct period for each of the six named rates at a known BPM (e.g. 120 BPM → `/4` = 2000ms, `/2` = 1000ms, `x2` = 250ms, `x3` = 166.67ms); verify `pulseWidthMs` returns exactly `PULSE_DUTY_CYCLE` (25%) of each rate's own period at that same BPM, confirming the pulse width scales per-output rather than being a fixed duration (FR-004, FR-005, FR-006 — see research.md's pulse-width decision, added after `/speckit-analyze` finding U1 showed the original fixed-10ms proposal didn't match StepSequencer's actual proportional gate-duration convention)
- [X] T004 [P] Unit tests for `advanceTick` and `collectDueTicks` in `tests/components/utilities/ClockDivider.test.ts` — verify `advanceTick` adds exactly one pulse period without resetting the cursor's origin (proving the no-drift/no-reset property from research.md decision 1); verify `collectDueTicks` returns zero due ticks when the horizon hasn't reached the cursor, exactly one when it has, and multiple when the horizon spans several periods, correctly advancing the returned cursor past all collected ticks (FR-002, FR-008, FR-010, edge case: BPM change mid-cycle re-locks without a spurious pulse)

### Implementation for Foundational contracts

- [X] T005 [US1] Create `ClockDivider` class skeleton in `src/components/utilities/ClockDivider.ts`: extends `SynthComponent`, constructor calls `super(id, ComponentType.CLOCK_DIVIDER, 'Clock Divider', position)`, loops `CLOCK_DIVIDER_OUTPUT_COUNT` times calling `addOutput('out${i+1}', 'Out ${i+1}', SignalType.GATE)` and `addParameter('rate${i+1}', 'Output ${i+1} Rate', DEFAULT_RATES[i], 0, 5, 1, '')`, implements `getInputNode()` returning `null`, implements `createAudioNodes`/`destroyAudioNodes`/`updateAudioParameter` as no-ops for now (filled in by T017, T019, T020) (depends on T001, T002)
- [X] T006 [US1] Implement `getOutputNode()` (returns `_gateNodes[0]`) and override `protected getOutputNodeByPort(portId: string): AudioNode | null` (switch mapping `'out1'`…`'out6'` to `_gateNodes[0..5]`, `null` for anything else) in `src/components/utilities/ClockDivider.ts`, mirroring `ChordFinder.getOutputNodeByPort`'s exact shape (depends on T005; research.md decision 2)
- [X] T007 [US1] Register `CLOCK_DIVIDER` in `src/components/registerComponents.ts`: one `componentRegistry.register(ComponentType.CLOCK_DIVIDER, 'Clock Divider', 'Derives synchronized division/multiplication gate pulses from the shared tempo', 'Controllers', (id, position) => new ClockDivider(id, position), calculateComponentDimensions(ComponentType.CLOCK_DIVIDER))` call (depends on T005)
- [X] T008 [P] Add `ComponentType.CLOCK_DIVIDER` case to `getControlLayout` in `src/utils/componentLayout.ts` returning `{ hasDropdown: true }` (six dropdowns; row count handled by the height special-case, not this flag — matches Arpeggiator's approach)
- [X] T009 [P] Add `ComponentType.CLOCK_DIVIDER` case to `getPortCounts` in `src/utils/componentLayout.ts` returning `{ inputs: 0, outputs: 6 }`
- [X] T010 [P] Add a `calculateComponentHeight` special case for `ComponentType.CLOCK_DIVIDER` in `src/utils/componentLayout.ts`, generalizing Arpeggiator's exact formula (`HEADER_HEIGHT + portAreaHeight + CONTROL_MARGIN_TOP + dropdownRowHeight * rowCount + 10`) from 4 rows to 6
- [X] T011 [P] Add a width override for `ComponentType.CLOCK_DIVIDER` in `calculateComponentWidth` in `src/utils/componentLayout.ts`, e.g. `width = 160` (comparable to Arpeggiator's other multi-dropdown components), following the pattern of existing per-type width overrides
- [X] T012 [P] Add an icon glyph entry for `ComponentType.CLOCK_DIVIDER` in `getComponentIcon` in `src/ui/Sidebar.ts` — TypeScript's exhaustive `Record<ComponentType, string>` forces this or the build fails
- [X] T013 [P] Add a `[ComponentType.CLOCK_DIVIDER]: 'Clock Divider'` entry to the `getDisplayName` exhaustive map in `src/canvas/CanvasComponent.ts` — TypeScript's exhaustive `Record<ComponentType, string>` forces this or the build fails

**Checkpoint**: `CLOCK_DIVIDER` can be dragged onto the canvas from the sidebar and renders with correct dimensions (no visible dropdowns yet — that's added by the `CanvasComponent.createControls()` work in US1). Pure scheduling math is fully unit-tested.

---

## Phase 3: User Story 1 - Derive Slower Rhythmic Variations from the Shared Tempo (Priority: P1) 🎯 MVP

**Goal**: A user can add a Clock Divider, set one output's rate to a division (e.g. /4), and see/hear a downstream gate-accepting component trigger at that derived rate, staying locked to the global tempo including through live BPM changes.

**Independent Test**: Add a Clock Divider to the canvas, set the global BPM, select a "/4" division on one output, connect that output to any gate-accepting component, and verify the connected component receives a pulse only once every 4 beats of the global tempo.

### Tests for User Story 1

- [X] T014 [P] [US1] Unit tests for `ClockDivider.setRate`/`getRate` in `tests/components/utilities/ClockDivider.test.ts` — verify round-trip for all six outputs independently, verify each output defaults to its `DEFAULT_RATES` value on construction (FR-003, FR-008)
- [X] T015 [P] [US1] Unit test in `tests/components/utilities/ClockDivider.test.ts` verifying `activate()` (which calls `createAudioNodes()`) subscribes to `GLOBAL_BPM_CHANGED`/`TRANSPORT_PLAY`/`TRANSPORT_STOP` and `deactivate()` unsubscribes cleanly, mocking `eventBus`/`globalBpmController` following `StepSequencer.test.ts`'s established mocking conventions (FR-002, FR-010)
- [X] T016 [P] [US1] Unit test in `tests/components/utilities/ClockDivider.test.ts` verifying a change to the global BPM (via a mocked `GLOBAL_BPM_CHANGED` event) updates `_currentBpm` without resetting any output's `_nextTickTime`, proving the no-glitch re-lock behavior (spec edge case, SC-005)

### Implementation for User Story 1

- [X] T017 [US1] Implement `createAudioNodes()` in `src/components/utilities/ClockDivider.ts`: create and start all six `ConstantSourceNode`s at offset 0, `registerAudioNode` each, initialize `_nextTickTime[i] = ctx.currentTime` for all six outputs, subscribe to `EventType.GLOBAL_BPM_CHANGED` (updates `_currentBpm`), `EventType.TRANSPORT_PLAY` (starts the scheduler interval if not running), `EventType.TRANSPORT_STOP` (clears the scheduler interval and zeroes all six gate nodes via `setValueAtTime(0, ctx.currentTime)`), and starts the shared 25ms `setInterval` scheduler loop (depends on T005, T006; research.md decisions 1, 5)
- [X] T018 [US1] Implement the scheduler loop body in `src/components/utilities/ClockDivider.ts`: for each of the six outputs, call `collectDueTicks(_nextTickTime[i], ctx.currentTime + 0.1, _currentBpm, _rates[i])` from `contracts/validation`, for each due tick call `setValueAtTime(1, t)` then `setValueAtTime(0, t + pulseWidthMs(_currentBpm, _rates[i]) / 1000)` on that output's gate node (a pulse proportional to that output's own period — 25% duty cycle via `pulseWidthMs`, matching StepSequencer's actual proportional gate-duration convention, NOT a fixed millisecond width — see research.md's pulse-width decision), and update `_nextTickTime[i]` to the returned cursor (depends on T017; FR-002, FR-006, FR-007, FR-011)
- [X] T019 [US1] Implement `destroyAudioNodes()` in `src/components/utilities/ClockDivider.ts`: clear the scheduler interval, unsubscribe all three event subscriptions, stop/disconnect all six `ConstantSourceNode`s (depends on T017)
- [X] T020 [US1] Implement `updateAudioParameter(parameterId, value)` in `src/components/utilities/ClockDivider.ts`: for `rate1`…`rate6`, update the corresponding entry in `_rates` via `clampRateIndex(value)` — no reset of `_nextTickTime`, per FR-008 (depends on T005)
- [X] T021 [US1] Implement `setRate(outputIndex, rate)`/`getRate(outputIndex)` public methods in `src/components/utilities/ClockDivider.ts`, with `setRate` calling `setParameterValue('rate${outputIndex}', rate)` so the change is both live (via T020) and immediately serializable (depends on T020)
- [X] T022 [US1] Add the `ComponentType.CLOCK_DIVIDER` block to `createControls()` in `src/canvas/CanvasComponent.ts`: loop the six `rateN` parameters, placing one `Dropdown` per row at `baseY + rowH * i` (Arpeggiator's block is the direct template), each dropdown's options built from `CLOCK_DIVIDER_RATES.map(rate => ({ value: rate, label: RATE_LABELS[rate] }))`, wiring dropdown selection to `clockDivider.setRate(i+1, selectedRate)` (depends on T010, T021)

**Checkpoint**: User Story 1 is fully functional — a Clock Divider can be added, one output set to a division rate, connected to a gate-accepting component, and that component triggers at the correct derived rate, staying locked through live BPM changes with no glitch.

---

## Phase 4: User Story 2 - Derive Faster Rhythmic Variations (Multiplication) (Priority: P2)

**Goal**: A user can set a Clock Divider output to a multiplication rate (x2 or x3) and see/hear it pulse faster than the raw global tempo.

**Independent Test**: Add a Clock Divider, set an output to "x2", connect it to a gate-accepting component, and verify it receives twice as many pulses per unit time as the raw global tempo.

### Tests for User Story 2

- [X] T023 [P] [US2] Unit test in `tests/components/utilities/ClockDivider.test.ts` verifying `ratePeriodMs(bpm, ClockDividerRate.X2)` returns exactly half the period of `ratePeriodMs(bpm, ClockDividerRate.Div2)` at the same BPM (i.e. x2 is exactly 4x faster than /2, per the beats-per-pulse table), and `X3` returns exactly one-third of one beat's duration (FR-005)
- [X] T024 [P] [US2] Unit test in `tests/components/utilities/ClockDivider.test.ts` verifying `collectDueTicks` over a fixed horizon returns exactly 2 due ticks per beat for an `X2`-rated output and exactly 3 due ticks per beat for an `X3`-rated output, at a known BPM (spec US2 acceptance scenarios 1-2)

### Implementation for User Story 2

- [X] T025 [US2] No new implementation needed — `ratePeriodMs`/`collectDueTicks` (T003-T004, T018) already handle `X2`/`X3` identically to the division rates, since `RATE_BEATS_PER_PULSE` encodes multiplication as a beats-per-pulse value below 1 (contracts/types.ts); this task is a manual confirmation step: set an output to "x2" in the running dev server and verify it visibly/audibly pulses twice per beat (depends on T018, T022)

**Checkpoint**: User Stories 1 AND 2 both work independently — division and multiplication rates both produce correctly-timed pulses from the same scheduler code path, confirming FR-004/FR-005 are satisfied by the same mechanism with no special-casing.

---

## Phase 5: User Story 3 - Drive Several Independent Rates from One Shared Source (Priority: P2)

**Goal**: Multiple outputs on the same Clock Divider run simultaneously at independent rates with no interference, and mathematically related rates (e.g. /2 and /4) always coincide on shared beats.

**Independent Test**: Add one Clock Divider, configure multiple of its outputs to different divisions/multiplications (e.g. one at "/2", one at "/8", one at "x2"), connect each to a different gate-accepting component, and verify all three fire pulses independently and correctly at their own configured rate, all derived from the same underlying tempo.

### Tests for User Story 3

- [X] T026 [P] [US3] Unit test in `tests/components/utilities/ClockDivider.test.ts` verifying that, given the same starting `_nextTickTime` and BPM, every due tick time produced for a `Div4`-rated output (via `collectDueTicks`) is also present in the due tick times produced for a `Div2`-rated output over the same horizon — directly proving FR-007 and spec US3 acceptance scenario 2 (related rates always coincide) at the pure-function level
- [X] T027 [P] [US3] Unit test in `tests/components/utilities/ClockDivider.test.ts` verifying two `ClockDivider` outputs configured to the same rate (e.g. both `Div4`) produce identical due-tick sequences when driven from the same `_nextTickTime`/BPM — covering the spec edge case "two outputs both set to /4... valid... fan out the same derived rate to multiple destinations"
- [X] T028 [P] [US3] Unit test in `tests/components/utilities/ClockDivider.test.ts` verifying `serialize()` includes all six `rateN` parameters and `deserialize()` restores each output's rate exactly, including a mix of divisions and multiplications across the six outputs (FR-009, SC-003)

### Implementation for User Story 3

- [X] T029 [US3] No new implementation needed — the shared-scheduler-loop design (T017-T018) already advances all six outputs from the same `_currentBpm` on every 25ms poll, which is what makes the coincidence guarantee hold by construction (research.md decision 1); this task is a manual confirmation step: configure three outputs to different rates in the running dev server, connect each to a different gate-accepting component, and verify all three trigger independently and correctly, with /2 and /4 (if both configured) visibly coinciding on shared beats (depends on T018, T022)

**Checkpoint**: All three user stories are independently functional; a Clock Divider with several simultaneously-configured outputs drives multiple destinations correctly, with related rates provably coincident.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup after all user stories are complete.

- [X] T030 [P] Run `vitest run` for the full suite and confirm no regressions in existing component/canvas/contract tests
- [X] T031 [P] Run `tsc --noEmit` (this project has no separate `lint` npm script — confirmed during feature 035) and fix any type errors introduced by the new files
- [X] T032 Manually walk through quickstart.md's Interaction Lifecycle end-to-end in the running dev server (add, configure multiple rates, connect to gate-accepting components, change BPM live, stop/resume transport, save, reload, delete) per this project's verification convention
- [X] T033 [P] Add a Clock Divider documentation entry to the Help sidebar in `src/ui/HelpSidebar.ts`, following the pattern used for prior Controllers-category components (e.g. the Arpeggiator entry), placed in the Controllers section, and add it to the "Component Library" overview bullet list

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (needs `ComponentType.CLOCK_DIVIDER` to exist) — BLOCKS visual/interactive verification of all user stories, though T003-T004's pure-math tests have no dependency on the rest of this phase and may run in parallel with it
- **User Story 1 (Phase 3)**: Core scheduling logic (T017-T021) depends on Phase 2's component skeleton (T005-T006); UI (T022) depends on Phase 2's layout wiring (T008-T013) being in place to render controls at all
- **User Story 2 (Phase 4)**: Depends on US1's scheduler (T018) and UI (T022) already existing — multiplication support requires no new code, only confirmation that the same code path handles it correctly
- **User Story 3 (Phase 5)**: Depends on US1's scheduler (T018) and UI (T022) — the coincidence guarantee and multi-output independence are properties of the shared-scheduler design already built in US1, not new implementation
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — fully independent MVP
- **User Story 2 (P2)**: Builds on US1's scheduler and UI, but is a separable, independently testable increment (proves the existing mechanism generalizes to multiplication with zero new code)
- **User Story 3 (P3)**: Same relationship — proves the existing mechanism generalizes to multiple simultaneous outputs and their coincidence relationship, with zero new implementation code beyond what US1 already built

### Parallel Opportunities

- T001, T002 (Setup) can run in parallel
- T003, T004 (Foundational tests) can run in parallel with each other and with T005-T013 (they test pure functions with no dependency on the component skeleton)
- T008, T009, T010, T011, T012, T013 (Foundational layout/UI wiring) can run in parallel after T005/T007
- T014, T015, T016 (US1 tests) can run in parallel
- T023, T024 (US2 tests) can run in parallel
- T026, T027, T028 (US3 tests) can run in parallel
- T030, T031, T033 (Polish) can run in parallel

---

## Parallel Example: Foundational Contract Tests

```bash
# Launch both pure-math test suites together:
Task: "Unit tests for clampRateIndex and ratePeriodMs in tests/components/utilities/ClockDivider.test.ts"
Task: "Unit tests for advanceTick and collectDueTicks in tests/components/utilities/ClockDivider.test.ts"
```

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit tests for ClockDivider.setRate/getRate in tests/components/utilities/ClockDivider.test.ts"
Task: "Unit test verifying event subscription lifecycle in tests/components/utilities/ClockDivider.test.ts"
Task: "Unit test verifying BPM change re-locks without resetting nextTickTime in tests/components/utilities/ClockDivider.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T013)
3. Complete Phase 3: User Story 1 (T014-T022)
4. **STOP and VALIDATE**: Add a Clock Divider, set one output to "/4", connect it to a gate-accepting component, verify it triggers every 4 beats and stays locked through a live BPM change
5. Demo if ready — the component is already useful for the single most common use case (a slower, tempo-locked derived pulse) even before multiplication or multi-output coincidence are exercised

### Incremental Delivery

1. Setup + Foundational → component exists on canvas, scheduling math is fully unit-tested
2. Add User Story 1 → single-output division works end-to-end, including live BPM re-lock → demo (MVP!)
3. Add User Story 2 → confirm multiplication rates work (no new code) → demo
4. Add User Story 3 → confirm multi-output independence and coincidence (no new code) → demo
5. Each story adds confidence without requiring new implementation beyond US1

---

## Notes

- [P] tasks touch different files or independent test cases with no shared state
- [Story] label maps every user-story-phase task to its spec.md story for traceability
- Tests are written before their corresponding implementation tasks within each story, per this project's established convention
- Commit after each phase checkpoint, consistent with how prior features (e.g. `037-notes-resizable`) were delivered in incremental commits
- No task modifies `PatchSerializer.ts`, `PatchStorage.ts`, or `TimingCalculator.ts` — confirmed in research.md/plan.md, all persistence rides the existing generic `Parameter` mechanism and scheduling reuses `beatsToMs`'s underlying math via this feature's own `ratePeriodMs` wrapper
- US2 and US3 deliberately have no new implementation tasks — this is intentional, not an oversight: the shared-scheduler design built in US1 already generalizes correctly to multiplication and multiple simultaneous outputs by construction (research.md decision 1), so those phases are validation-only
