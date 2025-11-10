# Tasks: Parameter-Aware LFO Depth

**Input**: Design documents from `/specs/008-lfo-parameter-depth/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No automated test infrastructure exists in this codebase. Manual testing will be performed via acceptance scenarios.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Critical Constraint**: Do NOT modify LFO component visual implementation. This feature only changes depth calculation logic.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This is a single TypeScript audio application with paths at repository root:
- **Source**: `src/`
- **Specs**: `specs/008-lfo-parameter-depth/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new modulation module directory structure

- [ ] T001 Create modulation module directory at src/modulation/
- [ ] T002 [P] Copy type definitions from specs/008-lfo-parameter-depth/contracts/types.ts to src/modulation/types.ts
- [ ] T003 [P] Copy validation logic from specs/008-lfo-parameter-depth/contracts/validation.ts to src/modulation/validation.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core depth calculation infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Implement ParameterAwareDepthCalculator class in src/modulation/ParameterAwareDepthCalculator.ts with calculateModulationRanges() and applyModulation() methods per contracts/types.ts interface
- [ ] T005 Add helper methods to Parameter class in src/components/base/Parameter.ts: getUpwardRange(), getDownwardRange(), canBeModulated(), getModulationBounds()
- [ ] T006 Extend Connection interface in src/core/types.ts to support optional modulationMetadata field per contracts/types.ts ModulationConnection interface

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Basic Parameter-Aware Modulation (Priority: P1) 🎯 MVP

**Goal**: Connect an LFO to a parameter and automatically calculate modulation range based on parameter bounds and base value, ensuring output never exceeds min/max limits

**Independent Test**:
1. Create LFO and Oscillator components
2. Connect LFO output to Oscillator frequency parameter (min=1000, max=15000)
3. Set oscillator frequency base value to 7000
4. Set LFO depth to 50%
5. Verify modulated frequency alternates between 3500 and 10500 (±3500 from base)

### Implementation for User Story 1

- [ ] T007 [P] [US1] Create ModulationConnectionManager class in src/modulation/ModulationConnectionManager.ts to track scaling GainNodes for each CV connection and manage ModulationConnection instances (interface defined in types.ts). Implement FR-013 enforcement: check for existing CV connection to target parameter before creating new connection, reject or replace existing connection
- [ ] T008 [US1] Enhance ConnectionManager.createConnection() in src/core/ConnectionManager.ts to detect CV signal type connections and create scaling GainNode between LFO output and target AudioParam
- [ ] T009 [US1] Implement depth calculation trigger in ConnectionManager when CV connection created: call ParameterAwareDepthCalculator.calculateModulationRanges() and set scaling GainNode gain value
- [ ] T010 [US1] Add event listener in ConnectionManager for LFO depth parameter changes to recalculate scaling GainNode gain for all connected parameters
- [ ] T011 [US1] Add event listener in ConnectionManager for parameter base value changes to recalculate scaling GainNode gain
- [ ] T012 [US1] Update ConnectionManager.removeConnection() to properly disconnect and cleanup scaling GainNodes for CV connections
- [ ] T013 [US1] Add console logging for depth calculations (parameter bounds, calculated ranges, applied gain) for debugging

**Checkpoint**: User Story 1 complete - Basic parameter-aware modulation functional. Test with acceptance scenarios from spec.md (frequency=7000 depth=50% → 3500-10500, cutoff=5000 depth=100% → 20-20000, volume=0.5 depth=50% → 0.25-0.75)

---

## Phase 4: User Story 2 - Asymmetric Range Handling (Priority: P2)

**Goal**: Handle cases where parameter base value is near boundaries by applying depth percentage independently to upward and downward ranges

**Independent Test**:
1. Create LFO and Oscillator components
2. Connect LFO to oscillator frequency (min=1000, max=15000)
3. Set frequency base value to 14000 (near maximum)
4. Set LFO depth to 50%
5. Verify modulated frequency ranges from 7500 to 14500 (downward: 50% of 13000 = 6500, upward: 50% of 1000 = 500)

### Implementation for User Story 2

- [ ] T014 [US2] Enhance ParameterAwareDepthCalculator.calculateModulationRanges() in src/modulation/ParameterAwareDepthCalculator.ts to calculate independent upward and downward ranges (upward = (max - base) * depth%, downward = (base - min) * depth%)
- [ ] T015 [US2] Implement averaged gain calculation in ParameterAwareDepthCalculator: gainValue = (upwardRange + downwardRange) / 2 per research.md decision
- [ ] T016 [US2] Add edge case handling in validation.ts for base value at exact minimum or maximum (unidirectional modulation)
- [ ] T017 [US2] Add edge case handling for zero range parameters (min === max) - return validation error preventing modulation connection
- [ ] T018 [US2] Add edge case handling for base value outside parameter range - clamp to bounds and log warning
- [ ] T019 [US2] Add console logging for asymmetric calculations showing upward range, downward range, and averaged gain

**Checkpoint**: User Story 2 complete - Asymmetric range handling working. Test with spec.md scenario (base=14000 depth=50% → 7500-14500) and edge cases (base at min/max, zero range)

---

## Phase 5: User Story 3 - Depth Adjustment Feedback (Priority: P3)

**Goal**: Display calculated modulation range directly on or adjacent to LFO depth control UI element

**Independent Test**:
1. Create LFO and connect to parameter with known bounds
2. Open LFO depth control UI
3. Adjust depth slider from 0% to 100%
4. Verify real-time display shows calculated range (e.g., "3500-10500" at 50% depth)

**⚠️ NOTE**: User requested NO visual implementation changes to LFO component. This story may need to be deferred or implemented via existing UI extension points only.

### Implementation for User Story 3

- [ ] T020 [US3] Investigate existing LFO UI extension points in src/canvas/ for adding depth feedback display without modifying LFO component visual implementation
- [ ] T021 [US3] IF extension points exist: Emit ModulationUpdateEvent from ModulationConnectionManager when depth/base value changes with calculated range data
- [ ] T022 [US3] IF extension points exist: Create event listener in appropriate canvas/UI component to receive ModulationUpdateEvent and update display
- [ ] T023 [US3] IF extension points exist: Format calculated range for display (e.g., "±3500" for symmetric, "7500-14500" for asymmetric)
- [ ] T024 [US3] IF NO extension points: Document this story as requiring future LFO UI refactoring and mark as deferred

**Checkpoint**: User Story 3 complete OR deferred - Visual feedback implemented via extension points or documented for future implementation

---

## Phase 6: Integration & Persistence

**Purpose**: Ensure parameter-aware modulation integrates with existing patch save/load system

- [ ] T025 [P] Update PatchSerializer.serializeConnection() in src/patch/PatchSerializer.ts to include modulationMetadata if present on ModulationConnection
- [ ] T026 [P] Update PatchSerializer.deserializeConnection() in src/patch/PatchSerializer.ts to restore modulationMetadata when loading patches
- [ ] T027 Add backward compatibility handling in PatchSerializer for connections without modulationMetadata (treat as standard connections)
- [ ] T028 Test patch save/load with parameter-aware modulation connections to ensure GainNodes are recreated correctly

**Checkpoint**: Patches with parameter-aware modulation can be saved and loaded correctly

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation, and code quality

- [ ] T029 Manual acceptance testing per spec.md User Story 1 scenarios (3 test cases)
- [ ] T030 Manual acceptance testing per spec.md User Story 2 scenarios (2 test cases)
- [ ] T031 [P] Manual testing of all edge cases from spec.md (base at min, base at max, zero range, negative range, very small range, base outside range)
- [ ] T032 [P] Performance validation: measure depth calculation time, verify <1ms per connection per SC-003
- [ ] T033 Verify LFO component visual implementation unchanged (no modifications to LFO.ts createAudioNodes, updateAudioParameter, or bypass methods)
- [ ] T034 [P] Update CLAUDE.md to document completed feature (add to ## Completed Features section)
- [ ] T035 Code review and cleanup: remove debug console.logs, ensure TypeScript types are correct, verify all imports
- [ ] T036 Run quickstart.md validation examples to verify developer documentation accuracy

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-5)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed) or sequentially (P1 → P2 → P3)
  - US2 builds on US1 calculations but is independently testable
  - US3 is independent of US1/US2 (only adds visual feedback)
- **Integration (Phase 6)**: Can proceed in parallel with user stories or after
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Enhances US1 calculation but independently testable with boundary cases
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - No dependencies on US1/US2, adds visual feedback only

### Within Each User Story

- **US1**: ModulationConnectionManager (T007) → ConnectionManager enhancement (T008) → Calculation triggers (T009) → Event listeners (T010-T011) → Cleanup (T012) → Logging (T013)
- **US2**: All tasks (T014-T019) enhance ParameterAwareDepthCalculator and validation, can run in sequence
- **US3**: Investigation (T020) → IF block branches based on extension point availability (T021-T024)

### Parallel Opportunities

- **Phase 1 Setup**: All tasks (T001-T003) can run in parallel - different directories
- **Phase 2 Foundational**: Tasks T005 and T006 can run in parallel (different files), T004 depends on T006
- **Phase 6 Integration**: T025 and T026 can run in parallel (same file but independent methods)
- **Phase 7 Polish**: T029-T032 can run in parallel (independent testing), T034-T035 can run in parallel (different files)

---

## Parallel Example: Setup Phase

```bash
# Launch all setup tasks together:
Task: "Create modulation module directory at src/modulation/"
Task: "Copy type definitions from specs/008-lfo-parameter-depth/contracts/types.ts to src/modulation/types.ts"
Task: "Copy validation logic from specs/008-lfo-parameter-depth/contracts/validation.ts to src/modulation/validation.ts"
```

## Parallel Example: User Story 1 Core Implementation

```bash
# After T007 completes, launch connection enhancements together:
Task: "Add event listener in ConnectionManager for LFO depth parameter changes"
Task: "Add event listener in ConnectionManager for parameter base value changes"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T006) - CRITICAL CHECKPOINT
3. Complete Phase 3: User Story 1 (T007-T013)
4. **STOP and VALIDATE**: Test with spec.md acceptance scenarios:
   - Frequency 7000, depth 50% → 3500-10500 ✓
   - Cutoff 5000, depth 100% → clamped at 20 ✓
   - Volume 0.5, depth 50% → 0.25-0.75 ✓
5. Deploy/demo basic parameter-aware modulation (MVP!)

### Incremental Delivery

1. Complete Setup + Foundational (T001-T006) → Foundation ready
2. Add User Story 1 (T007-T013) → Test independently → **MVP Delivered**
3. Add User Story 2 (T014-T019) → Test independently → Asymmetric handling added
4. Add User Story 3 (T020-T024) → Test independently → Visual feedback added (or deferred)
5. Add Integration (T025-T028) → Patch persistence working
6. Complete Polish (T029-T036) → Feature complete and documented

### Single Developer Strategy

Sequential priority order:
1. Phase 1: Setup
2. Phase 2: Foundational (MUST complete before proceeding)
3. Phase 3: User Story 1 (P1) - Core MVP
4. VALIDATE MVP before continuing
5. Phase 4: User Story 2 (P2) - Asymmetric enhancement
6. Phase 5: User Story 3 (P3) - Visual feedback (may defer if blocked)
7. Phase 6: Integration - Persistence
8. Phase 7: Polish - Final validation

---

## Notes

- **[P] tasks**: Different files, no dependencies, can parallelize if desired
- **[Story] labels**: Map to spec.md user stories for traceability
- **Critical Constraint**: Tasks T020-T024 may need deferral if LFO UI has no extension points (per user request for no visual changes)
- **No Automated Tests**: Manual testing via acceptance scenarios (no test infrastructure exists)
- **Performance Target**: <1ms calculation latency (SC-003) - validate in T032
- **Backward Compatibility**: Existing patches without modulationMetadata must continue working (T027)
- Each user story is independently testable at its checkpoint
- Stop at any checkpoint to validate before proceeding
- LFO component (src/components/generators/LFO.ts) should remain unchanged except for event listeners connecting to it
