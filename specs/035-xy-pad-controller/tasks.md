---

description: "Task list for X-Y Pad Controller feature implementation"
---

# Tasks: X-Y Pad Controller

**Input**: Design documents from `/specs/035-xy-pad-controller/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The project constitution mandates 100% coverage for utility/validation functions and comprehensive tests for all public APIs; every prior feature in this codebase ships tests alongside implementation.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact and follow this repo's existing conventions (`src/components/utilities/`, `tests/components/utilities/`, `tests/contracts/`, `tests/canvas/`)

## Path Conventions

Single project (`src/`, `tests/` at repository root), per plan.md's Project Structure section. New files:
- `src/components/utilities/XYPad.ts`, `src/components/utilities/XYPadConstants.ts`
- `src/canvas/displays/XYPadDisplay.ts`
- `tests/components/utilities/XYPad.test.ts` (+ split files as needed, mirroring `Collider.bpmMode.test.ts` / `Looper.transport.test.ts` conventions)
- `tests/canvas/XYPadDisplay.test.ts`
- `tests/contracts/xy-pad-validation.test.ts`, `tests/contracts/xy-pad-types.test.ts`

---

## Phase 1: Setup

**Purpose**: Register the new component type so it exists in the type system and can be instantiated, before any behavior is built.

- [ ] T001 Add `XY_PAD = 'xy-pad'` to the `ComponentType` enum in `src/core/types.ts`
- [ ] T002 [P] Create `src/components/utilities/XYPadConstants.ts` with `XYPadState` enum (`IDLE`, `RECORDING`, `PLAYING`) and `XY_PAD` constants object (`SAMPLE_RATE_HZ: 60`, `MAX_DURATION_MS: 60_000`, `MAX_SAMPLES: 3_600`), per data-model.md and research.md capture-rate decision
- [ ] T003 [P] Verify `specs/035-xy-pad-controller/contracts/types.ts` and `contracts/validation.ts` are ready to be imported directly as source (no changes needed if already correct) — this project imports its spec `contracts/` files straight from `src/` (e.g. `src/components/utilities/Looper.ts:25` imports `validateBarCount` from `../../../specs/015-bpm-looper/contracts/validation`), so `XYPad.ts` will import from `../../../specs/035-xy-pad-controller/contracts/validation` and `contracts/types` rather than duplicating these files under `src/`

**Checkpoint**: `ComponentType.XY_PAD` exists and compiles; no behavior yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core component skeleton, registration, and layout wiring that every user story's UI depends on. Without this phase, nothing can be added to the canvas or tested interactively.

**⚠️ CRITICAL**: No user story work can be manually/visually verified until this phase is complete, though US1's core logic (T010-T013) has no hard dependency on T007-T009 and may be built in parallel.

- [ ] T004 Create `XYPad` class skeleton in `src/components/utilities/XYPad.ts`: extends `SynthComponent`, constructor registers two CV outputs (`x`, `y`) via `addOutput` and two depth parameters (`xDepth`, `yDepth`, default 50, range 0-100, unit `%`) via `addParameter`, implements required abstract methods (`createAudioNodes`, `destroyAudioNodes`, `updateAudioParameter`, `getInputNode`, `getOutputNode`) per data-model.md
- [ ] T005 Implement `getOutputNodeByPort(portId)` override in `src/components/utilities/XYPad.ts` to return the correct per-axis output node for `'x'` vs `'y'`, following the pattern `SynthComponent.getOutputNodeByPort` documents and Collider's dual-output (`frequency`/`gate`) precedent
- [ ] T006 Register `XY_PAD` in `src/components/registerComponents.ts`: one `componentRegistry.register(ComponentType.XY_PAD, 'X-Y Pad', 'Two-axis controller with recordable movement, outputs X and Y as CV', 'Utilities', (id, position) => new XYPad(id, position), calculateComponentDimensions(ComponentType.XY_PAD))` call
- [ ] T007 [P] Add `ComponentType.XY_PAD` case to `calculateComponentDimensions` in `src/utils/componentLayout.ts` returning dimensions metadata (`numKnobs: 2`, `hasDropdown: false`, `hasDisplayArea: true`, `displayHeight` sized for a square-ish pad plus button row)
- [ ] T008 [P] Add `ComponentType.XY_PAD` case to the control-layout switch in `src/utils/componentLayout.ts` (the second switch, matching the LFO/Looper cases already there)
- [ ] T009 [P] Add an icon glyph entry for `ComponentType.XY_PAD` in `getComponentIcon` in `src/ui/Sidebar.ts`

**Checkpoint**: `XY_PAD` can be dragged onto the canvas from the sidebar and renders with correct dimensions (no interactive pad/buttons yet — those are added by the `XYPadDisplay` work in US1).

---

## Phase 3: User Story 1 - Modulate Two Parameters by Dragging the Pad (Priority: P1) 🎯 MVP

**Goal**: A user can add an X-Y Pad, connect its X and Y outputs to two different target parameters, and drive both independently in real time by dragging the pointer across the pad, with per-axis depth control.

**Independent Test**: Add an X-Y Pad to the canvas, connect X and Y outputs to two different target parameters, drag the pointer to each corner and the center of the pad, and verify both target parameters track the pointer position smoothly and independently; adjust each axis's depth control and verify the reachable range scales accordingly.

### Tests for User Story 1

- [ ] T010 [P] [US1] Unit tests for `clampAxis`/`clampPosition` in `tests/contracts/xy-pad-validation.test.ts` — verify values below 0, above 1, and within range are handled correctly (FR-016)
- [ ] T011 [P] [US1] Unit tests for `XYPad` position tracking and depth-scaled connection math in `tests/components/utilities/XYPad.test.ts` — verify `setPosition` updates `getPosition()`, verify `connectTo` creates a per-connection `GainNode` scaler sized from depth% and the target's declared range (mirrors how `tests/components/generators/LFO.cv.test.ts` tests LFO's scaler), verify X and Y scalers are independent
- [ ] T012 [P] [US1] Unit test in `tests/components/utilities/XYPad.test.ts` verifying position holds at last value when pointer interaction stops (FR-006) and that a newly-connected output immediately reflects current resting position (US1 acceptance scenario 4)

### Implementation for User Story 1

- [ ] T013 [US1] Implement `_x`/`_y` state fields, `setPosition(x, y)` (clamping via `clampPosition` from T010), and `getPosition()` in `src/components/utilities/XYPad.ts` (depends on T004)
- [ ] T014 [US1] Implement `connectTo` override in `src/components/utilities/XYPad.ts` mirroring `LFO.connectTo` (`src/components/generators/LFO.ts:181-233`): per-axis `Map<string, ConnectionScaler>`, builds a `GainNode` scaled from `xDepth`/`yDepth` and `target.getParameterRangeForInput(inputId)` (depends on T004, T005)
- [ ] T015 [US1] Implement `updateAudioParameter` in `src/components/utilities/XYPad.ts` to re-scale existing connection `GainNode`s when `xDepth`/`yDepth` change (ramped via existing `CV.RAMP_SECONDS` convention, matching `LFO.ts:161-169`) (depends on T014)
- [ ] T016 [US1] Create `XYPadDisplay` class in `src/canvas/displays/XYPadDisplay.ts`: renders the 2D pad surface and a handle at the current `x`/`y` position, following `LooperDisplay.ts`'s canvas-rendering structure
- [ ] T017 [US1] Implement pointer drag handling in `src/canvas/displays/XYPadDisplay.ts` (mousedown/mousemove/mouseup translated to local/zoom-corrected pad coordinates, calling `xyPad.setPosition(x, y)`), following `LooperDisplay`'s coordinate-translation pattern
- [ ] T018 [US1] Add the `ComponentType.XY_PAD` block to `createControls()` in `src/canvas/CanvasComponent.ts`: instantiate `XYPadDisplay` as a sibling overlay `<canvas>` with `pointerEvents: 'auto'`, wire native pointer events to the display's handlers, add two `Knob` controls for `xDepth`/`yDepth` — follow the Looper block (`CanvasComponent.ts:1437-1496`) as the direct template (depends on T016, T017)
- [ ] T019 [US1] Add a `requestAnimationFrame` render loop for `XYPadDisplay` in `src/canvas/CanvasComponent.ts` (polling the pad's current position each frame), matching the Looper's render-loop scheduling (`CanvasComponent.ts:1487-1495`) (depends on T018)

**Checkpoint**: User Story 1 is fully functional — an X-Y Pad can be added, dragged, connected to two targets with independent depth-scaled output, and this is independently testable/demoable without any Record/Play functionality existing yet.

---

## Phase 4: User Story 2 - Record and Play Back a Movement Gesture (Priority: P2)

**Goal**: A user can record a movement gesture on the pad and play it back on a continuous loop, with manual dragging able to interrupt playback at any time.

**Independent Test**: Start a recording, perform a distinct movement pattern across the pad for a few seconds, stop recording, press play, and verify the X/Y outputs reproduce the same movement pattern over the same duration, looping continuously until stopped.

### Tests for User Story 2

- [ ] T020 [P] [US2] Unit tests for `isPlayableRecording`, `hasReachedRecordingLimit`, `wrapPlaybackTime` in `tests/contracts/xy-pad-validation.test.ts`
- [ ] T021 [P] [US2] State machine unit tests in `tests/components/utilities/XYPad.test.ts` covering every transition in data-model.md's diagram: `pressRecord()` from IDLE, `pressStop()` during RECORDING (finalizes), auto-stop at `MAX_SAMPLES`, `pressPlay()` no-op when no recording exists (FR-012), `pressPlay()` transitions to PLAYING, `pressStop()` during PLAYING (holds last value, FR-006), `setPosition()` during PLAYING (interrupts playback, FR-014), `pressRecord()` during PLAYING (stops playback then starts new capture, discarding the old recording)
- [ ] T022 [P] [US2] Unit test in `tests/components/utilities/XYPad.test.ts` verifying capture starts immediately on `pressRecord()` even with zero pointer movement (flat lead-in, per Clarifications session 2026-07-07 and FR-008)
- [ ] T023 [P] [US2] Unit test in `tests/components/utilities/XYPad.test.ts` verifying playback loops continuously (wraps via `wrapPlaybackTime`) until Stop or manual drag (FR-011)

### Implementation for User Story 2

- [ ] T024 [US2] Implement `pressRecord()`, `pressStop()`, `pressPlay()` state-machine methods in `src/components/utilities/XYPad.ts` per data-model.md's transition table (depends on T013)
- [ ] T025 [US2] Implement the `requestAnimationFrame`-driven capture loop in `src/components/utilities/XYPad.ts`: on `pressRecord()`, starts sampling `(performance.now() - startTime, x, y)` into a pre-allocated `Float32Array` sized for `XY_PAD.MAX_SAMPLES`, auto-stopping via `hasReachedRecordingLimit` (depends on T024, T020)
- [ ] T026 [US2] Implement the playback loop in `src/components/utilities/XYPad.ts`: on `pressPlay()`, a `requestAnimationFrame` loop computes elapsed time, wraps via `wrapPlaybackTime`, finds/interpolates the nearest captured sample, and routes through the same `setPosition`-adjacent output-update path used for live drag (depends on T024, T013)
- [ ] T027 [US2] Add Record/Stop/Play button hit-testing and click dispatch to `src/canvas/displays/XYPadDisplay.ts`, following `LooperDisplay.handleMouseDown`'s button-region + action-string return pattern, and dispatch to `xyPad.pressRecord()`/`pressStop()`/`pressPlay()` from the `CanvasComponent.ts` XY_PAD block (depends on T018, T024)
- [ ] T028 [US2] Add visible state indication (idle/recording/playing color or label) to `XYPadDisplay`'s render method in `src/canvas/displays/XYPadDisplay.ts`, matching the Looper's ring-color state feedback convention (depends on T016)
- [ ] T029 [US2] Disable/grey out the Play button in `src/canvas/displays/XYPadDisplay.ts` when `xyPad.isPlayAvailable()` is false (FR-012) (depends on T027)

**Checkpoint**: User Stories 1 AND 2 both work independently — recording and looped playback function on top of the working live-drag CV output from US1.

---

## Phase 5: User Story 3 - Recording Persists With the Patch (Priority: P3)

**Goal**: A recorded gesture survives patch save/reload and can be played back immediately after loading, without re-recording.

**Independent Test**: Record a movement gesture, save the patch, reload the page (or load the saved patch), press Play, and verify the same recorded gesture plays back.

### Tests for User Story 3

- [ ] T030 [P] [US3] Round-trip unit test in `tests/components/utilities/XYPad.test.ts`: record a gesture, call `serialize()`, construct a new `XYPad`, call `deserialize()` with the result, verify the new instance's unpacked samples exactly match the original (SC-004)
- [ ] T031 [P] [US3] Unit test in `tests/components/utilities/XYPad.test.ts` verifying `deserialize()` always restores `IDLE` state (never resumes `RECORDING`, per data-model.md's reload guard) and that `xDepth`/`yDepth` parameters round-trip correctly
- [ ] T032 [P] [US3] Unit test in `tests/components/utilities/XYPad.test.ts` verifying a pad with no recording serializes without an `audioBlob` field and deserializes with the Play control unavailable (US3 acceptance scenario 3)

### Implementation for User Story 3

- [ ] T033 [US3] Implement `serialize()` override in `src/components/utilities/XYPad.ts`: call `super.serialize()`, then pack the interleaved `(t,x,y)` `Float32Array` and Base64-encode it into `audioBlob` only when a recording exists, reusing the Looper's `_float32ToBase64` approach (depends on T025)
- [ ] T034 [US3] Implement `deserialize()` override in `src/components/utilities/XYPad.ts`: call `super.deserialize()`, decode `audioBlob` via a `_base64ToFloat32`-equivalent helper if present, reconstruct `_recording`, always set state to `IDLE` (depends on T033)

**Checkpoint**: All three user stories are independently functional; a saved patch with a recorded X-Y Pad reloads and plays back correctly.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup after all user stories are complete.

- [ ] T035 [P] Run `vitest run` for the full suite and confirm no regressions in existing component/canvas/contract tests
- [ ] T036 [P] Run `npm run lint` and fix any warnings introduced by the new files
- [ ] T037 Manually walk through quickstart.md's Interaction Lifecycle end-to-end in the running dev server (drag, record, play, save/reload) per this project's verification convention
- [ ] T038 [P] Add X-Y Pad documentation entry to the Help sidebar, following the pattern used for prior features (e.g. Karplus-Strong, per `034-karplus-strong-oscillator`'s Help sidebar commit)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (needs `ComponentType.XY_PAD` to exist) — BLOCKS visual/interactive verification of all user stories
- **User Story 1 (Phase 3)**: Core logic (T013-T015) only depends on Phase 1 (T004); UI (T016-T019) depends on Phase 2 registration being in place to render controls at all
- **User Story 2 (Phase 4)**: Depends on US1's `XYPad`/`XYPadDisplay` skeleton (T013, T016, T018) existing, since Record/Play reuses the same position-update and overlay-canvas plumbing
- **User Story 3 (Phase 5)**: Depends on US2's recording capture (T025) existing — nothing to serialize before a recording can be made
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — fully independent MVP
- **User Story 2 (P2)**: Builds on US1's live position tracking and overlay canvas, but is a separable, independently testable increment (live control still works with zero recordings made)
- **User Story 3 (P3)**: Builds on US2's recording buffer — cannot be tested without a recording to persist, but adds no new interactive surface of its own (pure serialize/deserialize)

### Parallel Opportunities

- T002, T003 (Setup) can run in parallel after T001
- T007, T008, T009 (Foundational) can run in parallel after T006
- T010, T011, T012 (US1 tests) can run in parallel
- T020, T021, T022, T023 (US2 tests) can run in parallel
- T030, T031, T032 (US3 tests) can run in parallel
- T035, T036, T038 (Polish) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit tests for clampAxis/clampPosition in tests/contracts/xy-pad-validation.test.ts"
Task: "Unit tests for XYPad position tracking and depth-scaled connection math in tests/components/utilities/XYPad.test.ts"
Task: "Unit test verifying position holds at last value in tests/components/utilities/XYPad.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T009)
3. Complete Phase 3: User Story 1 (T010-T019)
4. **STOP and VALIDATE**: Drag the pad, connect X/Y to two targets, verify independent depth-scaled CV output
5. Demo if ready — the pad is already useful as a live two-parameter controller even without Record/Play

### Incremental Delivery

1. Setup + Foundational → component exists on canvas
2. Add User Story 1 → live two-axis CV control works → demo (MVP!)
3. Add User Story 2 → record/loop playback works → demo
4. Add User Story 3 → recordings survive patch save/reload → demo
5. Each story adds value without breaking the previous one

---

## Notes

- [P] tasks touch different files or independent test cases with no shared state
- [Story] label maps every user-story-phase task to its spec.md story for traceability
- Tests are written before their corresponding implementation tasks within each story, per this project's established convention
- Commit after each phase checkpoint, consistent with how prior features (e.g. `034-karplus-strong-oscillator`) were delivered in incremental commits
- No task modifies `PatchSerializer.ts`, `PatchManager.ts`, or the `ComponentData` interface — confirmed in research.md/plan.md, `audioBlob` is already generic and the component registry is polymorphic
