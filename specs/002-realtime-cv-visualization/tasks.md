# Tasks: Realtime CV Parameter Visualization

**Input**: Design documents from `/specs/002-realtime-cv-visualization/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No automated tests requested - using manual testing approach

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Project structure: TypeScript browser application with `src/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure for visualization feature

- [ ] T001 Create visualization directory structure at src/visualization/
- [ ] T002 [P] Create types file at src/visualization/types.ts with all interfaces (IModulationVisualizer, IVisualizableControl, IParameterValueSampler, IVisualUpdateScheduler)
- [ ] T003 [P] Create AudioWorklet file at public/worklets/parameter-sampler.js for 20Hz parameter sampling
- [ ] T004 [P] Configure Vite to serve worklet files with correct MIME types in vite.config.ts
- [ ] T005 [P] Add SharedArrayBuffer support headers to Vite config (Cross-Origin-Opener-Policy, Cross-Origin-Embedder-Policy)

**Validation**: Directory structure exists, types compile, worklet file accessible

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Extend Parameter class in src/components/base/Parameter.ts to add isModulated, modulatedValue, baseValue properties
- [ ] T007 [P] Modify Knob class in src/canvas/controls/Knob.ts to implement IVisualizableControl interface
- [ ] T008 [P] Modify Slider class in src/canvas/controls/Slider.ts to implement IVisualizableControl interface
- [ ] T009 [P] Modify Button class in src/canvas/controls/Button.ts to implement IVisualizableControl interface
- [ ] T010 Add setVisualValue(normalizedValue: number) method to Knob in src/canvas/controls/Knob.ts
- [ ] T011 Add setVisualValue(normalizedValue: number) method to Slider in src/canvas/controls/Slider.ts
- [ ] T012 Add setVisualValue(normalizedValue: number) method to Button in src/canvas/controls/Button.ts
- [ ] T013 [P] Add isVisible boolean property and visibility methods to Knob in src/canvas/controls/Knob.ts
- [ ] T014 [P] Add isVisible boolean property and visibility methods to Slider in src/canvas/controls/Slider.ts
- [ ] T015 [P] Add isVisible boolean property and visibility methods to Button in src/canvas/controls/Button.ts
- [ ] T016 Extend EventBus in src/core/EventBus.ts to add ModulationEventType enum and modulation event interfaces

**Checkpoint**: Foundation ready - all controls implement IVisualizableControl, user story implementation can now begin

---

## Phase 3: User Story 1 - Visual Feedback for CV-Controlled Parameters (Priority: P1) 🎯 MVP

**Goal**: When a CV source connects to a parameter, the UI control visually updates in realtime to reflect the modulated value

**Independent Test**: Connect an LFO to oscillator detune parameter → verify knob rotates continuously to reflect LFO output

### Implementation for User Story 1

- [ ] T017 [P] [US1] Create ParameterValueSampler class in src/visualization/ParameterValueSampler.ts implementing IParameterValueSampler
- [ ] T018 [P] [US1] Create VisualUpdateScheduler class in src/visualization/VisualUpdateScheduler.ts implementing IVisualUpdateScheduler
- [ ] T019 [US1] Implement SharedArrayBuffer initialization in ParameterValueSampler.initialize() method
- [ ] T020 [US1] Implement AudioWorklet loading and registration in ParameterValueSampler.initialize() method
- [ ] T021 [US1] Implement registerParameter() method in ParameterValueSampler to map parameters to buffer indices
- [ ] T022 [US1] Implement getValue() method in ParameterValueSampler to read from SharedArrayBuffer using Atomics.load()
- [ ] T023 [US1] Implement 20Hz sampling logic in public/worklets/parameter-sampler.js AudioWorkletProcessor
- [ ] T024 [US1] Implement requestAnimationFrame loop in VisualUpdateScheduler with frame delta tracking
- [ ] T025 [US1] Implement onFrame callback subscription system in VisualUpdateScheduler
- [ ] T026 [US1] Implement getCurrentFPS() method in VisualUpdateScheduler
- [ ] T027 [US1] Create ModulationVisualizer class in src/visualization/ModulationVisualizer.ts implementing IModulationVisualizer
- [ ] T028 [US1] Implement initialize() method in ModulationVisualizer to setup sampler and scheduler
- [ ] T029 [US1] Implement trackParameter() method in ModulationVisualizer to register parameter-control pairs
- [ ] T030 [US1] Implement untrackParameter() method in ModulationVisualizer with cleanup
- [ ] T031 [US1] Implement update loop in ModulationVisualizer.onFrame() to read sampled values and update controls
- [ ] T032 [US1] Implement basic value propagation (no interpolation yet) from sampler to controls
- [ ] T033 [US1] Add ModulationVisualizer initialization in src/main.ts after AudioEngine and Canvas setup
- [ ] T034 [US1] Hook trackParameter() calls in src/main.ts for all existing parameter controls
- [ ] T035 [US1] Add clamping logic in ModulationVisualizer to respect parameter min/max ranges (FR-006)
- [ ] T036 [US1] Test User Story 1: Connect LFO to parameter, verify visual updates at 20Hz

**Checkpoint**: At this point, User Story 1 should be fully functional - parameter controls update when CV-modulated, independently testable

---

## Phase 4: User Story 2 - Smooth Visual Transitions (Priority: P2)

**Goal**: Parameter controls animate smoothly with fluid 60 FPS motion instead of 20 Hz jumps

**Independent Test**: Connect slow LFO (0.5 Hz) to parameter → verify smooth animation without stuttering or visible jumps

### Implementation for User Story 2

- [ ] T037 [US2] Implement linear interpolation helper method in ModulationVisualizer
- [ ] T038 [US2] Add ParameterVisualization state tracking in ModulationVisualizer (lastRenderedValue, targetValue, interpolationProgress)
- [ ] T039 [US2] Modify ModulationVisualizer.onFrame() to interpolate between 20Hz samples at 60 FPS
- [ ] T040 [US2] Update interpolationProgress calculation based on frame delta time
- [ ] T041 [US2] Implement smooth value transitions in setVisualValue() for Knob controls
- [ ] T042 [US2] Implement smooth value transitions in setVisualValue() for Slider controls
- [ ] T043 [US2] Implement smooth value transitions in setVisualValue() for Button controls
- [ ] T044 [US2] Add audio-rate modulation detection (>20 Hz) in ModulationVisualizer
- [ ] T045 [US2] Implement reduced update rate for audio-rate modulation per FR-007
- [ ] T046 [US2] Test User Story 2: Connect slow LFO (0.5 Hz), verify smooth 60 FPS motion
- [ ] T047 [US2] Test User Story 2: Connect fast LFO (10 Hz), verify rapid but smooth updates
- [ ] T048 [US2] Test User Story 2: Verify 10 simultaneous modulated parameters render smoothly

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - smooth 60 FPS visuals for all modulation speeds

---

## Phase 5: User Story 3 - Multiple CV Source Visualization (Priority: P3)

**Goal**: Parameter controls accurately reflect combined effect of multiple simultaneous CV sources

**Independent Test**: Connect LFO and envelope to same parameter → verify control shows combined modulation result

### Implementation for User Story 3

- [ ] T049 [US3] Create CVConnectionState interface in src/visualization/types.ts for tracking connection lifecycle
- [ ] T050 [US3] Implement connection state tracking Map in ModulationVisualizer
- [ ] T051 [US3] Implement onConnectionCreated() method in ModulationVisualizer
- [ ] T052 [US3] Implement onConnectionDestroyed() method in ModulationVisualizer
- [ ] T053 [US3] Implement fade-in transition using AudioParam.exponentialRampToValueAtTime() in onConnectionCreated()
- [ ] T054 [US3] Implement fade-out transition using AudioParam.exponentialRampToValueAtTime() in onConnectionDestroyed()
- [ ] T055 [US3] Implement 100ms fade progress tracking with requestAnimationFrame
- [ ] T056 [US3] Add connection lifecycle state machine (connecting → connected → disconnecting → disconnected)
- [ ] T057 [US3] Emit ModulationEventType.CONNECTION_CREATED events via EventBus
- [ ] T058 [US3] Emit ModulationEventType.CONNECTION_DESTROYED events via EventBus
- [ ] T059 [US3] Emit ModulationEventType.FADE_COMPLETED events via EventBus
- [ ] T060 [US3] Hook onConnectionCreated() in ConnectionManager.createConnection() method in src/canvas/ConnectionManager.ts
- [ ] T061 [US3] Hook onConnectionDestroyed() in ConnectionManager.destroyConnection() method in src/canvas/ConnectionManager.ts
- [ ] T062 [US3] Implement ModulationState tracking in ModulationVisualizer with modulationSources array
- [ ] T063 [US3] Update ModulationState.isModulated flag when connections added/removed
- [ ] T064 [US3] Test User Story 3: Connect 2 CV sources to one parameter, verify combined visual result
- [ ] T065 [US3] Test User Story 3: Connect 3 CV sources, verify accurate summed modulation
- [ ] T066 [US3] Test User Story 3: Add/remove connections dynamically, verify 100ms smooth transitions

**Checkpoint**: All user stories should now be independently functional - multiple CV sources visualize correctly with smooth fades

---

## Phase 6: Edge Cases & Polish

**Purpose**: Handle edge cases and optimize performance

- [ ] T067 [P] Implement manual parameter adjustment handler in ModulationVisualizer per FR-010
- [ ] T068 [P] Add logic to update base value when user manually adjusts modulated parameter
- [ ] T069 [P] Ensure CV modulation continues relative to new base value after manual adjustment
- [ ] T070 [P] Implement IntersectionObserver setup in Canvas.ts for visibility tracking
- [ ] T071 [P] Hook IntersectionObserver callbacks to control.setVisibility() methods
- [ ] T072 [P] Modify render() methods in Knob/Slider/Button to skip when isVisible=false per FR-011
- [ ] T073 Add memory cleanup in VisualizationHandle.dispose() to prevent leaks
- [ ] T074 Add proper EventBus unsubscription in ModulationVisualizer.dispose()
- [ ] T075 Add IntersectionObserver cleanup when controls are destroyed
- [ ] T076 Implement error handling for SharedArrayBuffer not supported (ModulationVisualizerError)
- [ ] T077 Implement error handling for AudioContext unavailable (ModulationVisualizerError)
- [ ] T078 Add graceful degradation when SharedArrayBuffer is not available (disable feature)
- [ ] T079 [P] Add console warnings for out-of-range CV values being clamped
- [ ] T080 [P] Add performance monitoring logging (FPS, sample rate, update latency)
- [ ] T081 Verify parameter controls skip rendering when off-screen (check with DevTools Performance)
- [ ] T082 Verify no memory leaks over 5-minute test (check with DevTools Memory profiler)

---

## Phase 7: Manual Testing & Validation

**Purpose**: Comprehensive manual testing per quickstart.md checklist

- [ ] T083 Manual test: Create CV connection LFO → oscillator detune, verify knob rotates at LFO rate
- [ ] T084 Manual test: Connect slow LFO (0.5 Hz), verify smooth visual motion without stuttering
- [ ] T085 Manual test: Connect fast LFO (10 Hz), verify rapid but smooth updates
- [ ] T086 Manual test: Connect 10 different CV sources to 10 parameters, verify all update smoothly
- [ ] T087 Manual test: Manually adjust parameter while modulated, verify modulation continues relative to new value
- [ ] T088 Manual test: Set CV modulation beyond parameter range, verify values clamped at min/max
- [ ] T089 Manual test: Scroll parameter control off-screen, verify rendering stops (DevTools Performance)
- [ ] T090 Manual test: Scroll back on-screen, verify rendering resumes correctly
- [ ] T091 Manual test: Create CV connection, verify 100ms fade-in with no audio clicks
- [ ] T092 Manual test: Destroy CV connection, verify 100ms fade-out with no audio clicks
- [ ] T093 Performance test: Run with 10 modulated parameters for 30 seconds, verify no frame drops below 55 FPS
- [ ] T094 Performance test: Verify main thread usage < 10% per frame (DevTools Performance)
- [ ] T095 Performance test: Check Memory tab for leaks, verify heap stabilizes after 1 minute
- [ ] T096 Performance test: Verify audio thread usage remains low (< 5% CPU)
- [ ] T097 Verify all Success Criteria met: SC-001 through SC-006
- [ ] T098 Run full quickstart.md validation checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational (Phase 2) completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Edge Cases (Phase 6)**: Can start after User Story 1 (Phase 3), benefits from all stories complete
- **Testing (Phase 7)**: Depends on all implementation phases (1-6) being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on User Story 1 (Phase 3) - Extends interpolation on top of basic updates
- **User Story 3 (P3)**: Depends on User Story 1 (Phase 3) - Extends connection handling but should be independently testable

### Within Each User Story

- **User Story 1**: Sampler and Scheduler can be built in parallel (T017-T026), then integrated in ModulationVisualizer (T027-T032)
- **User Story 2**: All interpolation tasks (T037-T045) are sequential on US1 completion
- **User Story 3**: Connection state tracking (T049-T058) in parallel with event hooks (T060-T061), then integration (T062-T063)

### Parallel Opportunities

**Phase 1 (Setup)**: All tasks marked [P] can run in parallel (T002, T003, T004, T005)

**Phase 2 (Foundational)**:
- Control modifications run in parallel: T007-T009 (interfaces), T010-T012 (setVisualValue), T013-T015 (visibility)
- T016 (EventBus) can run in parallel with control modifications

**Phase 3 (User Story 1)**:
- T017 and T018 can start in parallel (different classes)
- T019-T023 (ParameterValueSampler implementation) sequential
- T024-T026 (VisualUpdateScheduler implementation) sequential but parallel to T019-T023

**Phase 4 (User Story 2)**:
- T037-T040 (interpolation logic) sequential
- T041-T043 (control updates) can run in parallel

**Phase 5 (User Story 3)**:
- T049-T052 (state tracking) can run in parallel
- T053-T059 (transitions and events) sequential
- T060-T061 (hooks) can run in parallel

**Phase 6 (Edge Cases)**:
- All tasks marked [P] can run in parallel (T067-T069, T070-T072, T079-T080)

---

## Parallel Example: User Story 1

```bash
# These tasks can run in parallel:
Task T017: "Create ParameterValueSampler class"
Task T018: "Create VisualUpdateScheduler class"

# After both complete, these run sequentially:
Task T019-T026: Complete sampler and scheduler implementation

# Then integrate:
Task T027-T036: ModulationVisualizer integration
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T016) - CRITICAL
3. Complete Phase 3: User Story 1 (T017-T036)
4. **STOP and VALIDATE**: Test User Story 1 independently (T036)
5. Demo/Deploy MVP if ready

**Estimated Time**: 8-10 hours

### Incremental Delivery

1. Setup + Foundational → Foundation ready (T001-T016)
2. Add User Story 1 → Test independently (T017-T036) → MVP! 🎯
3. Add User Story 2 → Test independently (T037-T048) → Enhanced smoothness
4. Add User Story 3 → Test independently (T049-T066) → Complete feature
5. Edge Cases + Testing (T067-T098) → Production ready

**Total Estimated Time**: 16-20 hours

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T016)
2. Once Foundational is done:
   - Developer A: User Story 1 (T017-T036)
   - Developer B: Start User Story 2 prep (read research.md, understand interpolation)
3. After US1 complete:
   - Developer A: User Story 3 (T049-T066)
   - Developer B: User Story 2 (T037-T048)
4. Both: Edge Cases (T067-T082) and Testing (T083-T098)

---

## Task Statistics

- **Total Tasks**: 98
- **Setup Phase**: 5 tasks
- **Foundational Phase**: 11 tasks (BLOCKS all stories)
- **User Story 1 (P1)**: 20 tasks - MVP scope
- **User Story 2 (P2)**: 12 tasks - Enhanced UX
- **User Story 3 (P3)**: 18 tasks - Advanced features
- **Edge Cases**: 16 tasks - Polish
- **Testing**: 16 tasks - Validation

**Parallel Opportunities**: 24 tasks marked [P] can run concurrently

**Critical Path**: Setup → Foundational → US1 → US2 → US3 → Edge Cases → Testing

**Suggested MVP**: Complete through Phase 3 (User Story 1) for ~36 tasks = 8-10 hours

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No automated tests - using manual testing approach per plan.md
- Avoid: same file conflicts, forgetting cleanup in dispose methods, blocking main thread in audio worklet
