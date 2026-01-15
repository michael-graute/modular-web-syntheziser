# Tasks: Comprehensive Test Coverage

**Input**: Design documents from `/specs/008-test-coverage/`
**Prerequisites**: plan.md (tech stack), spec.md (user stories), research.md (decisions), data-model.md (fixtures/mocks), contracts/ (interfaces)

**Tests**: This feature IS about creating tests, so all tasks are test-related

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `tests/` at repository root
- Test mocks: `tests/mocks/`
- Test fixtures: `tests/fixtures/`
- Test files: `tests/[module]/[name].test.ts`

---

## Phase 1: Setup (Test Infrastructure)

**Purpose**: Initialize test framework and shared infrastructure

- [ ] T001 Install Vitest testing framework and coverage dependencies (@vitest/coverage-v8, happy-dom)
- [ ] T002 Create vitest.config.ts with coverage thresholds (global: 60%, AudioEngine: 70%, PatchSerializer: 80%, Canvas: 50%)
- [ ] T003 [P] Configure package.json test scripts (test, test:watch, test:ui, test:coverage)
- [ ] T004 [P] Create tests/ directory structure (mocks/, fixtures/, audio/, persistence/, canvas/, utils/)
- [ ] T005 [P] Create tests/setup.ts global test setup file with beforeEach/afterEach hooks

---

## Phase 2: Foundational (Mocks & Fixtures)

**Purpose**: Core mocks and fixtures that ALL user stories depend on

**⚠️ CRITICAL**: No test writing can begin until mocks and fixtures are ready

- [ ] T006 [P] Implement MockAudioContext in tests/mocks/WebAudioAPI.mock.ts
- [ ] T007 [P] Implement MockAudioNode base class in tests/mocks/WebAudioAPI.mock.ts
- [ ] T008 [P] Implement MockOscillatorNode in tests/mocks/WebAudioAPI.mock.ts
- [ ] T009 [P] Implement MockGainNode in tests/mocks/WebAudioAPI.mock.ts
- [ ] T010 [P] Implement MockBiquadFilterNode in tests/mocks/WebAudioAPI.mock.ts
- [ ] T011 [P] Implement MockAnalyserNode in tests/mocks/WebAudioAPI.mock.ts
- [ ] T012 [P] Implement MockAudioParam in tests/mocks/WebAudioAPI.mock.ts
- [ ] T013 [P] Implement MockLocalStorage in tests/mocks/LocalStorage.mock.ts
- [ ] T014 [P] Implement createMouseEvent factory in tests/mocks/DOM.mock.ts
- [ ] T015 [P] Implement createTouchEvent factory in tests/mocks/DOM.mock.ts
- [ ] T016 [P] Create component fixtures (createTestOscillator, createTestFilter, createTestEnvelope, createTestLFO, createTestVCA, createTestOutput, createTestKeyboard, createTestSequencer) in tests/fixtures/components.fixture.ts
- [ ] T017 [P] Create connection fixtures (createTestConnection) in tests/fixtures/connections.fixture.ts
- [ ] T018 [P] Create patch fixtures (createEmptyPatch, createSimplePatch, createComplexPatch, createSubtractivePatch, createFMPatch) in tests/fixtures/patches.fixture.ts
- [ ] T019 [P] Create assertion helpers for components in tests/fixtures/assertion-helpers.ts
- [ ] T020 [P] Create assertion helpers for connections in tests/fixtures/assertion-helpers.ts
- [ ] T021 [P] Create assertion helpers for patches in tests/fixtures/assertion-helpers.ts
- [ ] T022 [P] Create assertion helpers for audio in tests/fixtures/assertion-helpers.ts

**Checkpoint**: Foundation ready - test implementation can now begin in parallel

---

## Phase 3: User Story 1 - Confident Refactoring (Priority: P1) 🎯 MVP

**Goal**: Enable developers to refactor audio engine code without fear of breaking existing behavior through comprehensive AudioEngine test coverage

**Independent Test**: Run `npm test -- AudioEngine.test.ts` and verify all AudioContext initialization, node connection, and state transition scenarios pass without requiring UI or canvas tests

### Implementation for User Story 1

- [ ] T023 [P] [US1] Create AudioEngine.test.ts test file structure with describe blocks for initialization, node connections, and state transitions in tests/audio/AudioEngine.test.ts
- [ ] T024 [P] [US1] Write test: "should initialize AudioContext on first call" in tests/audio/AudioEngine.test.ts
- [ ] T025 [P] [US1] Write test: "should create AudioContext and set isReady() to true" in tests/audio/AudioEngine.test.ts
- [ ] T026 [P] [US1] Write test: "should transition AudioContext from suspended to running state" in tests/audio/AudioEngine.test.ts
- [ ] T027 [P] [US1] Write test: "should handle AudioContext initialization failure gracefully" in tests/audio/AudioEngine.test.ts
- [ ] T028 [P] [US1] Write test: "should connect two audio nodes successfully" in tests/audio/AudioEngine.test.ts
- [ ] T029 [P] [US1] Write test: "should track connected nodes after connection" in tests/audio/AudioEngine.test.ts
- [ ] T030 [P] [US1] Write test: "should disconnect audio nodes properly" in tests/audio/AudioEngine.test.ts
- [ ] T031 [P] [US1] Write test: "should clean up connections when component is destroyed" in tests/audio/AudioEngine.test.ts
- [ ] T032 [P] [US1] Write test: "should prevent duplicate connections between same nodes" in tests/audio/AudioEngine.test.ts
- [ ] T033 [P] [US1] Write test: "should handle multiple sequential node connections" in tests/audio/AudioEngine.test.ts
- [ ] T034 [P] [US1] Write test: "should resume suspended AudioContext on user interaction" in tests/audio/AudioEngine.test.ts
- [ ] T035 [P] [US1] Write test: "should handle concurrent initialization calls" in tests/audio/AudioEngine.test.ts
- [ ] T036 [US1] Create AudioEngine.integration.test.ts for multi-component routing scenarios in tests/audio/AudioEngine.integration.test.ts
- [ ] T037 [P] [US1] Write integration test: "should route audio through oscillator → filter chain" in tests/audio/AudioEngine.integration.test.ts
- [ ] T038 [P] [US1] Write integration test: "should handle complex multi-component audio graph" in tests/audio/AudioEngine.integration.test.ts
- [ ] T039 [P] [US1] Write integration test: "should disconnect component from complex audio graph" in tests/audio/AudioEngine.integration.test.ts
- [ ] T040 [P] [US1] Write integration test: "should register and unregister components correctly" in tests/audio/AudioEngine.integration.test.ts
- [ ] T041 [US1] Run AudioEngine tests and verify 70%+ coverage threshold is met

**Checkpoint**: At this point, AudioEngine test suite should be fully functional with 70%+ coverage, enabling confident refactoring

---

## Phase 4: User Story 2 - Reliable State Persistence (Priority: P2)

**Goal**: Ensure saving and loading patches preserves all settings exactly so users don't lose work or configuration

**Independent Test**: Create patches with various component configurations, serialize them to JSON, deserialize back, and verify all components, connections, and parameter values match the original without requiring audio playback or UI rendering

### Implementation for User Story 2

- [ ] T042 [P] [US2] Create PatchSerializer.test.ts test file structure with describe blocks for serialization, deserialization, and data integrity in tests/persistence/PatchSerializer.test.ts
- [ ] T043 [P] [US2] Write test: "should serialize patch with 5 components and 8 connections without data loss" in tests/persistence/PatchSerializer.test.ts
- [ ] T044 [P] [US2] Write test: "should deserialize patch JSON and restore all components exactly" in tests/persistence/PatchSerializer.test.ts
- [ ] T045 [P] [US2] Write test: "should preserve parameter values during serialize/deserialize cycle" in tests/persistence/PatchSerializer.test.ts
- [ ] T046 [P] [US2] Write test: "should handle complex parameter values (negative, zero, maximum)" in tests/persistence/PatchSerializer.test.ts
- [ ] T047 [P] [US2] Write test: "should serialize empty patch correctly" in tests/persistence/PatchSerializer.test.ts
- [ ] T048 [P] [US2] Write test: "should serialize complex patch with multiple component types" in tests/persistence/PatchSerializer.test.ts
- [ ] T049 [P] [US2] Write test: "should preserve connection port indices during serialization" in tests/persistence/PatchSerializer.test.ts
- [ ] T050 [P] [US2] Write test: "should handle floating-point parameter precision accurately" in tests/persistence/PatchSerializer.test.ts
- [ ] T051 [P] [US2] Write test: "should throw error when deserializing invalid JSON" in tests/persistence/PatchSerializer.test.ts
- [ ] T052 [P] [US2] Write test: "should handle missing required fields in patch JSON" in tests/persistence/PatchSerializer.test.ts
- [ ] T053 [US2] Create PatchStorage.test.ts test file structure with describe blocks for save, load, delete, and error handling in tests/persistence/PatchStorage.test.ts
- [ ] T054 [P] [US2] Write test: "should save patch to mocked localStorage with correct key" in tests/persistence/PatchStorage.test.ts
- [ ] T055 [P] [US2] Write test: "should load patch from mocked localStorage successfully" in tests/persistence/PatchStorage.test.ts
- [ ] T056 [P] [US2] Write test: "should restore patch with all visual positions intact" in tests/persistence/PatchStorage.test.ts
- [ ] T057 [P] [US2] Write test: "should restore patch with all audio connections intact" in tests/persistence/PatchStorage.test.ts
- [ ] T058 [P] [US2] Write test: "should restore patch with all parameter states intact" in tests/persistence/PatchStorage.test.ts
- [ ] T059 [P] [US2] Write test: "should delete patch from localStorage correctly" in tests/persistence/PatchStorage.test.ts
- [ ] T060 [P] [US2] Write test: "should list all saved patches" in tests/persistence/PatchStorage.test.ts
- [ ] T061 [P] [US2] Write test: "should return null when loading non-existent patch" in tests/persistence/PatchStorage.test.ts
- [ ] T062 [P] [US2] Write test: "should handle corrupted patch JSON by loading default empty patch" in tests/persistence/PatchStorage.test.ts
- [ ] T063 [P] [US2] Write test: "should notify user when corrupted patch is encountered" in tests/persistence/PatchStorage.test.ts
- [ ] T064 [US2] Run PatchSerializer and PatchStorage tests and verify 80%+ (Serializer) and 75%+ (Storage) coverage thresholds are met

**Checkpoint**: At this point, patch serialization/storage test suites should be fully functional with 80%+/75%+ coverage, ensuring reliable state persistence

---

## Phase 5: User Story 3 - Predictable Canvas Interactions (Priority: P3)

**Goal**: Provide automated tests for drag-and-drop, connection creation, and viewport navigation so developers can add new features without breaking existing interaction patterns

**Independent Test**: Simulate mouse events (mousedown, mousemove, mouseup) and touch events, then verify component positions, connection states, and viewport transforms match expected values without requiring audio playback or visual inspection

### Implementation for User Story 3

- [ ] T065 [P] [US3] Create Canvas.drag.test.ts test file structure with describe blocks for component drag-and-drop in tests/canvas/Canvas.drag.test.ts
- [ ] T066 [P] [US3] Write test: "should update component position when dragged 50px right and 30px down" in tests/canvas/Canvas.drag.test.ts
- [ ] T067 [P] [US3] Write test: "should handle drag operation with mouse down, move, and up events" in tests/canvas/Canvas.drag.test.ts
- [ ] T068 [P] [US3] Write test: "should cancel drag operation on mouse up outside canvas" in tests/canvas/Canvas.drag.test.ts
- [ ] T069 [P] [US3] Write test: "should snap component to grid when snap-to-grid enabled (20px spacing)" in tests/canvas/Canvas.drag.test.ts
- [ ] T070 [P] [US3] Write test: "should handle touch events for component drag on mobile devices" in tests/canvas/Canvas.drag.test.ts
- [ ] T071 [P] [US3] Write test: "should prevent drag when component is locked" in tests/canvas/Canvas.drag.test.ts
- [ ] T072 [US3] Create Canvas.connection.test.ts test file structure with describe blocks for connection creation in tests/canvas/Canvas.connection.test.ts
- [ ] T073 [P] [US3] Write test: "should create valid connection when dragging from output port to input port" in tests/canvas/Canvas.connection.test.ts
- [ ] T074 [P] [US3] Write test: "should validate port compatibility before creating connection" in tests/canvas/Canvas.connection.test.ts
- [ ] T075 [P] [US3] Write test: "should prevent duplicate connections between same ports" in tests/canvas/Canvas.connection.test.ts
- [ ] T076 [P] [US3] Write test: "should highlight valid drop targets during connection drag" in tests/canvas/Canvas.connection.test.ts
- [ ] T077 [P] [US3] Write test: "should cancel connection creation on mouse up outside valid port" in tests/canvas/Canvas.connection.test.ts
- [ ] T078 [P] [US3] Write test: "should delete connection when clicking delete button" in tests/canvas/Canvas.connection.test.ts
- [ ] T079 [US3] Create Canvas.viewport.test.ts test file structure with describe blocks for pan/zoom operations in tests/canvas/Canvas.viewport.test.ts
- [ ] T080 [P] [US3] Write test: "should zoom in when user scrolls up with mouse wheel" in tests/canvas/Canvas.viewport.test.ts
- [ ] T081 [P] [US3] Write test: "should zoom out when user scrolls down with mouse wheel" in tests/canvas/Canvas.viewport.test.ts
- [ ] T082 [P] [US3] Write test: "should scale all component positions proportionally when zooming" in tests/canvas/Canvas.viewport.test.ts
- [ ] T083 [P] [US3] Write test: "should pan viewport when middle mouse button dragging" in tests/canvas/Canvas.viewport.test.ts
- [ ] T084 [P] [US3] Write test: "should clamp zoom level to min/max bounds" in tests/canvas/Canvas.viewport.test.ts
- [ ] T085 [P] [US3] Write test: "should reset viewport transform on reset button click" in tests/canvas/Canvas.viewport.test.ts
- [ ] T086 [US3] Run Canvas tests and verify 50%+ coverage threshold is met

**Checkpoint**: At this point, canvas interaction test suites should be fully functional with 50%+ coverage, enabling predictable UI behavior

---

## Phase 6: User Story 4 - Validated Musical Calculations (Priority: P3)

**Goal**: Ensure accurate timing and scale calculations so synthesizer produces musically correct output at all BPM settings and scale selections

**Independent Test**: Call MusicalScale and TimingCalculator methods with various inputs and verify outputs match music theory expectations (frequency ratios, interval counts, gate durations) without requiring audio output or UI

### Implementation for User Story 4

**Note**: Existing test files (MusicalScale.test.ts, TimingCalculator.test.ts, Vector2D.test.ts) already exist and should remain unchanged per FR-008. This phase ensures ongoing coverage.

- [ ] T087 [P] [US4] Verify existing MusicalScale.test.ts covers all scale types (Major, Harmonic Minor, Natural Minor, Lydian, Mixolydian) in tests/utils/MusicalScale.test.ts
- [ ] T088 [P] [US4] Verify existing test: "should return 261.63 Hz for C Major octave 4 note 0 (middle C)" in tests/utils/MusicalScale.test.ts
- [ ] T089 [P] [US4] Verify existing test: "should return correct semitone intervals for Harmonic Minor scale [2,1,2,2,1,3,1]" in tests/utils/MusicalScale.test.ts
- [ ] T090 [P] [US4] Verify existing TimingCalculator.test.ts covers all gate sizes (whole, half, quarter, eighth, sixteenth) in tests/utils/TimingCalculator.test.ts
- [ ] T091 [P] [US4] Verify existing test: "should return 0.5 seconds gate duration for BPM 120 and quarter note" in tests/utils/TimingCalculator.test.ts
- [ ] T092 [P] [US4] Verify existing test: "should return 0.05 seconds gate duration for BPM 300 (maximum) and sixteenth note" in tests/utils/TimingCalculator.test.ts
- [ ] T093 [P] [US4] Add test for edge case: "should handle BPM 30 (minimum) and whole note gate duration" in tests/utils/TimingCalculator.test.ts (if not already covered)
- [ ] T094 [P] [US4] Add test for edge case: "should validate BPM range (30-300) and throw error for invalid values" in tests/utils/TimingCalculator.test.ts (if not already covered)
- [ ] T095 [US4] Run MusicalScale, TimingCalculator, and Vector2D tests and verify coverage maintained

**Checkpoint**: At this point, musical utility test suites should maintain or improve existing coverage, ensuring accurate calculations

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and validation across all test suites

- [ ] T096 [P] Run full test suite (`npm test`) and verify all 80+ test cases pass in under 10 seconds
- [ ] T097 [P] Run coverage report (`npm run test:coverage`) and verify global 60%+ threshold met
- [ ] T098 [P] Verify AudioEngine module coverage is 70%+ lines per FR-009
- [ ] T099 [P] Verify PatchSerializer module coverage is 80%+ lines per FR-009
- [ ] T100 [P] Verify PatchStorage module coverage is 75%+ lines per FR-009
- [ ] T101 [P] Verify Canvas module coverage is 50%+ lines per FR-009
- [ ] T102 [P] Generate HTML coverage report and review uncovered lines in coverage/index.html
- [ ] T103 [P] Update README.md or quickstart.md with testing workflow and coverage badge (if applicable)
- [ ] T104 [P] Configure CI/CD pipeline to run tests and fail on coverage violations
- [ ] T105 [P] Add pre-commit hook to run tests locally before commits (optional, per research.md decision)
- [ ] T106 Run `npm run test:ui` to verify interactive test UI works correctly
- [ ] T107 Validate that test suite meets all success criteria from spec.md (SC-001 through SC-010)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3 → US4)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1) - AudioEngine**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2) - PatchSerializer/Storage**: Can start after Foundational (Phase 2) - No dependencies on other stories (uses mocked localStorage, no audio needed)
- **User Story 3 (P3) - Canvas Interactions**: Can start after Foundational (Phase 2) - No dependencies on other stories (uses mocked events, no audio needed)
- **User Story 4 (P3) - Musical Utilities**: Can start after Foundational (Phase 2) - No dependencies on other stories (existing tests, just validation)

**All user stories are independently testable and can be implemented in parallel after Foundational phase**

### Within Each User Story

- Test files can be created in parallel (marked [P])
- Individual test cases within files can be written in parallel (marked [P])
- Tests should be run after implementation to verify coverage thresholds
- Story complete when coverage threshold met

### Parallel Opportunities

- All Setup tasks (T001-T005) marked [P] can run in parallel
- All Foundational mock/fixture tasks (T006-T022) marked [P] can run in parallel
- Once Foundational phase completes, **all 4 user stories can start in parallel** (independent test suites)
- All test cases within a user story marked [P] can be written in parallel
- All Polish tasks (T096-T107) marked [P] can run in parallel

---

## Parallel Example: User Story 1 (AudioEngine Tests)

```bash
# After Foundational phase completes, launch all AudioEngine test tasks in parallel:

# Unit tests (can all be written simultaneously):
Task T024: "Write test: should initialize AudioContext on first call"
Task T025: "Write test: should create AudioContext and set isReady() to true"
Task T026: "Write test: should transition AudioContext from suspended to running state"
Task T027: "Write test: should handle AudioContext initialization failure gracefully"
Task T028: "Write test: should connect two audio nodes successfully"
Task T029: "Write test: should track connected nodes after connection"
Task T030: "Write test: should disconnect audio nodes properly"
Task T031: "Write test: should clean up connections when component is destroyed"
Task T032: "Write test: should prevent duplicate connections between same nodes"
Task T033: "Write test: should handle multiple sequential node connections"
Task T034: "Write test: should resume suspended AudioContext on user interaction"
Task T035: "Write test: should handle concurrent initialization calls"

# Integration tests (can be written simultaneously with unit tests):
Task T037: "Write integration test: should route audio through oscillator → filter chain"
Task T038: "Write integration test: should handle complex multi-component audio graph"
Task T039: "Write integration test: should disconnect component from complex audio graph"
Task T040: "Write integration test: should register and unregister components correctly"
```

---

## Parallel Example: All User Stories (After Foundational Phase)

```bash
# Once Foundational phase (T001-T022) completes, launch all user stories in parallel:

# Developer/Agent A: User Story 1 (AudioEngine) - T023-T041
# Developer/Agent B: User Story 2 (PatchSerializer/Storage) - T042-T064
# Developer/Agent C: User Story 3 (Canvas Interactions) - T065-T086
# Developer/Agent D: User Story 4 (Musical Utilities) - T087-T095

# All stories are independent and can complete in any order
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational - mocks and fixtures (T006-T022) **CRITICAL**
3. Complete Phase 3: User Story 1 - AudioEngine tests (T023-T041)
4. **STOP and VALIDATE**: Run `npm test -- AudioEngine.test.ts` and verify 70%+ coverage
5. Deploy/demo if ready (functional test suite for AudioEngine)

### Incremental Delivery

1. Complete Setup (T001-T005) + Foundational (T006-T022) → Test infrastructure ready
2. Add User Story 1 (T023-T041) → Test independently → 70%+ AudioEngine coverage (MVP!)
3. Add User Story 2 (T042-T064) → Test independently → 80%+ PatchSerializer, 75%+ PatchStorage coverage
4. Add User Story 3 (T065-T086) → Test independently → 50%+ Canvas coverage
5. Add User Story 4 (T087-T095) → Test independently → Maintain existing utility coverage
6. Complete Polish (T096-T107) → 60%+ global coverage, all thresholds met
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers/agents:

1. Team completes Setup (T001-T005) + Foundational (T006-T022) together
2. Once Foundational is done:
   - Developer/Agent A: User Story 1 - AudioEngine (T023-T041)
   - Developer/Agent B: User Story 2 - PatchSerializer/Storage (T042-T064)
   - Developer/Agent C: User Story 3 - Canvas Interactions (T065-T086)
   - Developer/Agent D: User Story 4 - Musical Utilities (T087-T095)
3. Stories complete and validate independently
4. Team completes Polish (T096-T107) together

---

## Task Summary

**Total Tasks**: 107
- **Phase 1 (Setup)**: 5 tasks
- **Phase 2 (Foundational)**: 17 tasks (mocks + fixtures)
- **Phase 3 (US1 - AudioEngine)**: 19 tasks (12 unit + 4 integration + validation)
- **Phase 4 (US2 - Persistence)**: 23 tasks (11 serializer + 11 storage + validation)
- **Phase 5 (US3 - Canvas)**: 22 tasks (7 drag + 7 connection + 7 viewport + validation)
- **Phase 6 (US4 - Utilities)**: 9 tasks (verification + edge cases)
- **Phase 7 (Polish)**: 12 tasks (validation + CI/CD)

**Parallel Opportunities**: 87 tasks marked [P] can run in parallel within their phase

**Independent Test Criteria**:
- **US1**: Run `npm test -- AudioEngine.test.ts`, verify 70%+ coverage, no UI/canvas dependencies
- **US2**: Run `npm test -- PatchSerializer.test.ts PatchStorage.test.ts`, verify 80%/75%+ coverage, no audio/UI dependencies
- **US3**: Run `npm test -- Canvas.*.test.ts`, verify 50%+ coverage, no audio dependencies
- **US4**: Run `npm test -- tests/utils/`, verify existing coverage maintained, no audio/UI dependencies

**Suggested MVP Scope**: User Story 1 only (AudioEngine test suite with 70%+ coverage)

**Format Validation**: ✅ All tasks follow checklist format with checkbox, ID, [P] marker (if parallel), [Story] label (if user story), description with file path

---

## Notes

- [P] tasks = different files or independent test cases, no dependencies
- [Story] label (US1, US2, US3, US4) maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group of tests
- Stop at any checkpoint to validate story independently
- Run coverage after each story to ensure thresholds met
- All tests use mocks from Foundational phase (no real audio, no real localStorage, no real browser)
