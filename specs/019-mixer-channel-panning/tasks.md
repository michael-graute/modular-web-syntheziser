# Tasks: Mixer Channel Panning

**Input**: Design documents from `/specs/019-mixer-channel-panning/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in each task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add MockStereoPannerNode to the test mock layer — this is a prerequisite shared across all user stories.

- [ ] T001 Add `MockStereoPannerNode` class (exposing `pan: MockAudioParam`) to `tests/mocks/WebAudioAPI.mock.ts` following the `MockGainNode` pattern; register it on the mock `AudioContext` as `createStereoPanner()`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Register the four pan parameters and create the four `StereoPannerNode` instances in the Mixer component — all user story work depends on these nodes existing.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 In `src/components/utilities/Mixer.ts` constructor, call `addParameter()` four times to register `pan1`–`pan4` with range [−1.0, +1.0], step 0.01, default 0.0, unit `''`, following the `gain1`–`gain4` pattern
- [ ] T003 In `src/components/utilities/Mixer.ts` `createAudioNodes()`, create four `StereoPannerNode`s via `ctx.createStereoPanner()`, register them as `stereoPanner1`–`stereoPanner4` via `registerAudioNode()`, and wire the signal chain: `channelGain → stereoPanner → outputGain` (replacing the existing `channelGain → outputGain` direct connection)
- [ ] T004 In `src/components/utilities/Mixer.ts` `destroyAudioNodes()`, disconnect and null out `stereoPanner1`–`stereoPanner4` alongside the existing node teardown

**Checkpoint**: Foundation ready — four StereoPannerNodes exist in the signal chain; user story implementation can now begin.

---

## Phase 3: User Story 1 — Pan a Channel Left or Right (Priority: P1) 🎯 MVP

**Goal**: Moving a channel's pan knob immediately repositions that channel's audio in the stereo field, independently per channel.

**Independent Test**: Connect one audio source to a Mixer channel. Adjust its pan knob fully left and confirm audio is heard only in the left output. Adjust fully right and confirm audio is heard only in the right output. Set to center and confirm equal levels on both sides.

### Tests for User Story 1

- [ ] T005 [P] [US1] In `tests/components/Mixer.test.ts`, write tests covering: constructor registers `pan1`–`pan4` with correct defaults; `createAudioNodes()` creates 4 `StereoPannerNode`s; signal chain order is `channelGain → stereoPanner → outputGain`; `updateAudioParameter('pan1', value)` calls `stereoPanner1.pan.setValueAtTime(value, now)`; all four panners update independently

### Implementation for User Story 1

- [ ] T006 [US1] In `src/components/utilities/Mixer.ts` `updateAudioParameter()`, handle `pan1`–`pan4` cases: call `stereoPanner[N].pan.setValueAtTime(value, audioContext.currentTime)` for the matching channel index, following the existing `gain1`–`gain4` handler pattern
- [ ] T007 [US1] In `src/components/utilities/Mixer.ts` bypass logic, include `channelGain[N] → stereoPanner[N]` and `stereoPanner[N] → outputGain` in `_bypassConnections` so `disableBypass()` restores the panner connections automatically (per Decision 6 in research.md)

**Checkpoint**: User Story 1 is fully functional — all four channels pan independently; run `vitest run` to verify T005 passes.

---

## Phase 4: User Story 2 — Pan Position Persisted with Patch (Priority: P2)

**Goal**: Pan positions for all four channels round-trip correctly through save/load; legacy patches without pan data load without error and default to center.

**Independent Test**: Set unique pan positions on all four channels, save the patch, reload it, and verify each channel's pan knob restores to its saved value. Then load a legacy patch (no pan keys) and verify all channels default to 0.0.

### Tests for User Story 2

- [ ] T008 [P] [US2] In `tests/components/Mixer.test.ts`, add tests covering: serialize produces `pan1`–`pan4` keys in `ComponentData.parameters`; deserialize restores each channel's pan value and calls `stereoPanner[N].pan.setValueAtTime`; a legacy patch object missing `pan1`–`pan4` loads without error and all four panners default to 0.0

### Implementation for User Story 2

- [ ] T009 [US2] Read `src/components/utilities/Mixer.ts` `serialize()` and `deserialize()`: confirm that `pan1`–`pan4` are included in `ComponentData.parameters` via the `SynthComponent.addParameter()` pipeline with no custom serialization; if they are not, wire them explicitly; confirm that loading a patch object without `pan1`–`pan4` keys falls back to the 0.0 constructor default without throwing

**Checkpoint**: User Story 2 complete — patch round-trip preserves all pan positions; legacy patches load cleanly.

---

## Phase 5: User Story 3 — Visual Pan Position Indicator (Priority: P3)

**Goal**: Each channel's pan knob renders at the correct angle: straight up at center (0), full-left at the left stop (~7 o'clock), full-right at the right stop (~5 o'clock).

**Independent Test**: Set a channel pan to full-left, full-right, and center. Verify the knob indicator angle visually matches the described positions in each case.

### Tests for User Story 3

- [ ] T010 [P] [US3] In `tests/components/Mixer.test.ts` (or a canvas unit test), assert that the pan knob angle calculation maps 0.0 → 0° offset (12 o'clock), −1.0 → full-left stop, +1.0 → full-right stop, using the same angle formula as other knobs in `src/canvas/CanvasComponent.ts`

### Implementation for User Story 3

- [ ] T011 [P] [US3] In `src/utils/componentLayout.ts`, add `numPanKnobs: 4` to the Mixer layout descriptor and increase the Mixer component height by 74 px (`+10` spacing + `+12` label + `+40` knob + `+12` value text), following the existing knob-row height formula
- [ ] T012 [US3] In `src/canvas/CanvasComponent.ts`, render a pan knob row below the existing fader row in the Mixer block: 4 knobs spaced identically to the fader row, labelled `PAN`, each knob angle driven by the channel's `pan[N]` parameter value from `getParameter('panN')?.getValue()` (depends on T011)

**Checkpoint**: User Story 3 complete — all four pan knobs render correctly in the Mixer canvas.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, integration check, and cleanup.

- [ ] T013 [P] In `tests/utils/panValidation.test.ts`, write unit tests for all three exported functions in `specs/019-mixer-channel-panning/contracts/validation.ts`: `clampPan` (clamps below −1.0, clamps above +1.0, passes through in-range values); `isValidPan` (returns false for NaN/Infinity/out-of-range, true for boundary and mid-range values); `isCenterPan` (true for 0.0, false for 0.5, respects custom epsilon)
- [ ] T014 [P] Run `vitest run` and confirm all tests in `tests/components/Mixer.test.ts` and `tests/utils/panValidation.test.ts` pass with no regressions in other test files
- [ ] T015 [P] Run `npm run lint` (or `tsc --noEmit`) and resolve any TypeScript strict-mode errors introduced by the new pan parameters or node registrations
- [ ] T016 Manually verify the three quickstart.md integration scenarios in the browser: basic stereo spread (Scenario 1), all pans at center identical to pre-feature behavior (Scenario 2), legacy patch load defaulting to 0.0 (Scenario 3)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (MockStereoPannerNode must exist before Mixer audio node tests run) — **BLOCKS all user stories**
- **User Story phases (3–5)**: All depend on Phase 2 completion
  - US1 (Phase 3) and US2 (Phase 4) can proceed in parallel after Phase 2
  - US3 (Phase 5) can proceed independently after Phase 2 (T002 registers parameters) — canvas rendering reads `getParameter('panN')` which only requires parameters to be registered, not the US1 `updateAudioParameter` handler
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on US2 or US3
- **US2 (P2)**: Can start after Phase 2 — serialization pipeline is set up in Phase 2; US2 just verifies it
- **US3 (P3)**: Can start after Phase 2 — canvas changes are independent of audio logic; depends on layout descriptor update (T011) before canvas render task (T012)

### Within Each User Story

- Tests written first (T005/T008/T010) — run `vitest run` to confirm they fail before implementation
- Audio nodes before parameter handlers (T003 before T006)
- Layout descriptor (T011) before canvas render (T012)

### Parallel Opportunities

- T005 (US1 tests) and T011 (layout) can run in parallel — different files
- T008 (US2 tests) can run in parallel with T011 (layout) — different files
- T010 (US3 tests) can run in parallel with T011 (layout) — different files
- T013 (test run) and T014 (lint) can run in parallel in Phase 6

---

## Parallel Example: User Story 1

```bash
# Write test and start implementation in parallel (different files):
Task A: T005 — tests/components/Mixer.test.ts (pan unit tests)
Task B: T006 — src/components/utilities/Mixer.ts (updateAudioParameter pan handler)
# T007 depends on T003 (bypass connections) — run after T003
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T004)
3. Complete Phase 3: User Story 1 (T005–T007)
4. **STOP and VALIDATE**: Run `vitest run`; connect an oscillator to Mixer channel 1 in the browser and verify left/right panning works
5. Deliver US1 as MVP if needed

### Incremental Delivery

1. Phase 1 + Phase 2 → audio infrastructure ready
2. Phase 3 (US1) → stereo panning works ✓ **Demo-able**
3. Phase 4 (US2) → pan positions persist across saves ✓ **Demo-able**
4. Phase 5 (US3) → pan knobs visible in Mixer canvas ✓ **Full feature complete**
5. Phase 6 → polish, lint, manual QA

---

## Notes

- **Testing command**: Always use `vitest run` (not `npm test` — that starts watch mode and never exits)
- **[P]** tasks touch different files and have no shared dependencies — safe to parallelize
- **[Story]** label maps each task to its user story for traceability
- Each user story is independently completable and testable
- Pan range constants (`PAN_MIN`, `PAN_MAX`, `PAN_DEFAULT`, `PAN_STEP`) are defined in `specs/019-mixer-channel-panning/contracts/validation.ts` — reference these values in the implementation
- Backward compatibility: legacy patches missing `pan1`–`pan4` keys must silently default to 0.0 — no migration needed
