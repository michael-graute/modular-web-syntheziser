# Tasks: Effect Bypass Toggle

**Input**: Design documents from `/specs/001-effect-bypass/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: This feature uses manual testing (no test framework currently exists). Test tasks are not included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single-page browser application
- Source code: `src/` at repository root
- No test framework currently configured

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend existing type definitions and base classes

- [x] T001 [P] Add `isBypassed?: boolean` field to `ComponentData` interface in `src/core/types.ts`
- [x] T002 [P] Add bypass-related constants to `src/utils/constants.ts` (BYPASS_BUTTON_SIZE: 20, BYPASS_BUTTON_MARGIN: 8, BYPASSED_OPACITY: 0.6)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core bypass infrastructure in SynthComponent base class that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add `_isBypassed` private property (default: false) to `SynthComponent` class in `src/components/base/SynthComponent.ts`
- [x] T004 Add `_bypassConnections` private array property to `SynthComponent` class in `src/components/base/SynthComponent.ts`
- [x] T005 [P] Add `isBypassed` getter to `SynthComponent` class in `src/components/base/SynthComponent.ts`
- [x] T006 [P] Implement `isBypassable()` method in `SynthComponent` class that returns true for bypassable component types in `src/components/base/SynthComponent.ts`
- [x] T007 Implement `setBypass(bypassed: boolean)` method in `SynthComponent` class in `src/components/base/SynthComponent.ts`
- [x] T008 [P] Implement protected `enableBypass()` template method in `SynthComponent` class in `src/components/base/SynthComponent.ts`
- [x] T009 [P] Implement protected `disableBypass()` template method in `SynthComponent` class in `src/components/base/SynthComponent.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Quick Effect Bypass During Performance (Priority: P1) 🎯 MVP

**Goal**: Enable users to toggle bypass state on effect/processor components to immediately enable/disable audio processing

**Independent Test**:
1. Add a Delay effect component to the canvas
2. Connect an audio source (e.g., Oscillator) → Delay → Master Output
3. Play audio and hear the delay effect
4. Click the bypass button in the Delay component header
5. Verify audio plays without delay processing (direct pass-through)
6. Click bypass button again to re-enable
7. Verify delay processing resumes with the same parameters

### Implementation for User Story 1

**Component-Specific Bypass Logic** (Parallel - Different Files):

- [x] T010 [P] [US1] Override `enableBypass()` and `disableBypass()` in `src/components/effects/Delay.ts` to handle delay node connections
- [x] T011 [P] [US1] Override `enableBypass()` and `disableBypass()` in `src/components/effects/Reverb.ts` to handle reverb node connections
- [x] T012 [P] [US1] Override `enableBypass()` and `disableBypass()` in `src/components/processors/Filter.ts` to handle filter node connections
- [x] T013 [P] [US1] Override `enableBypass()` and `disableBypass()` in `src/components/processors/VCA.ts` to handle VCA gain node connections
- [x] T014 [P] [US1] Override `enableBypass()` and `disableBypass()` in `src/components/processors/ADSREnvelope.ts` to handle envelope connections
- [x] T015 [P] [US1] Override `enableBypass()` and `disableBypass()` in `src/components/utilities/Mixer.ts` to handle mixer node connections

**Audio Graph Verification** (Sequential - Depends on T010-T015):

- [x] T016 [US1] Manually test bypass toggle for Delay component - verify audio passes through unprocessed when bypassed
- [x] T017 [US1] Manually test bypass toggle for Reverb component - verify audio passes through unprocessed when bypassed
- [x] T018 [US1] Manually test bypass toggle for Filter component - verify audio passes through unprocessed when bypassed
- [x] T019 [US1] Manually test bypass toggle for VCA component - verify audio passes through unprocessed when bypassed
- [x] T020 [US1] Manually test bypass toggle for ADSR Envelope - verify envelope bypasses correctly
- [x] T021 [US1] Manually test bypass toggle for Mixer - verify mixer channels bypass correctly
- [x] T022 [US1] Test chained effects (Delay → Reverb → Filter) with middle effect bypassed

**Checkpoint**: At this point, User Story 1 should be fully functional - bypass toggle works for all components and audio routing is correct

---

## Phase 4: User Story 2 - Visual Feedback for Bypass State (Priority: P2)

**Goal**: Provide clear visual indication of which components are bypassed so users can quickly understand their signal routing

**Independent Test**:
1. Add multiple effect components to the canvas
2. Bypass some components (e.g., Delay bypassed, Reverb active, Filter bypassed)
3. Scan the canvas from normal viewing distance
4. Verify bypassed components are clearly visually distinguished (dimmed appearance, button state)
5. Verify active components appear normal
6. Toggle bypass on a component and verify immediate visual feedback

### Implementation for User Story 2

**UI Controls and Visual Feedback**:

- [x] T023 [P] [US2] Add `bypassButton?: Button` property to `CanvasComponent` class in `src/canvas/CanvasComponent.ts`
- [x] T024 [US2] Implement `renderBypassButton()` private method in `CanvasComponent` class in `src/canvas/CanvasComponent.ts`
- [x] T025 [US2] Implement `toggleBypass()` private method in `CanvasComponent` class in `src/canvas/CanvasComponent.ts`
- [x] T026 [US2] Update `render()` method in `CanvasComponent` class to apply opacity dimming (0.6 alpha) when component is bypassed in `src/canvas/CanvasComponent.ts`
- [x] T027 [US2] Update `render()` method in `CanvasComponent` class to call `renderBypassButton()` for bypassable components in `src/canvas/CanvasComponent.ts`

**Event Handling**:

- [x] T028 [US2] Update `handleControlMouseDown()` method in `CanvasComponent` class to check bypass button first in `src/canvas/CanvasComponent.ts`
- [x] T029 [US2] Update `handleControlMouseUp()` method in `CanvasComponent` class to handle bypass button clicks in `src/canvas/CanvasComponent.ts`

**Visual Verification** (Depends on T023-T029):

- [x] T030 [US2] Manually test bypass button appears in header of all bypassable components
- [x] T031 [US2] Manually test bypass button shows correct active/inactive state (blue when active, gray when bypassed)
- [x] T032 [US2] Manually test component dimming - verify bypassed components render at 0.6 opacity
- [x] T033 [US2] Manually test visual feedback in complex patch with multiple bypassed and active components
- [x] T034 [US2] Manually test rapid bypass toggling - verify smooth visual transitions at 60 FPS

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - bypass toggles correctly AND provides clear visual feedback

---

## Phase 5: User Story 3 - Bypass State Persistence (Priority: P3)

**Goal**: Persist bypass state in patches so users can save and reload their bypass configurations

**Independent Test**:
1. Create a patch with multiple components
2. Toggle bypass on some components (e.g., Delay bypassed, Filter bypassed)
3. Save the patch with a name
4. Close and reopen the application (or just reload the page)
5. Load the saved patch
6. Verify all components restore with correct bypass states
7. Verify bypassed components are dimmed and audio passes through unprocessed
8. Test export/import of the patch to verify bypass state transfers

### Implementation for User Story 3

**Patch Serialization**:

- [x] T035 [P] [US3] Update `serializeComponent()` method in `PatchSerializer` class to include `isBypassed` field (if true) in `src/patch/PatchSerializer.ts`
- [x] T036 [P] [US3] Update `deserializeComponent()` method in `PatchSerializer` class to restore bypass state from ComponentData in `src/patch/PatchSerializer.ts`
- [x] T037 [US3] Ensure `deserializeComponent()` calls `component.setBypass(true)` AFTER audio nodes are created in `src/patch/PatchSerializer.ts`

**Backward Compatibility**:

- [x] T038 [US3] Test loading old patches (without `isBypassed` field) - verify they load correctly with all components active (default false)
- [x] T039 [US3] Test saving and loading new patches with bypass state - verify state persists correctly

**Full Persistence Verification** (Depends on T035-T039):

- [x] T040 [US3] Create test patch with mixed bypass states (some bypassed, some active)
- [x] T041 [US3] Save patch and reload - verify all bypass states restore correctly
- [x] T042 [US3] Test patch export/import - verify bypass states transfer between systems
- [x] T043 [US3] Test parameter changes on bypassed components - verify parameters are saved and applied when re-enabled
- [x] T044 [US3] Test backward compatibility - load old patch (created before this feature) and verify no errors

**Checkpoint**: All user stories should now be independently functional - bypass toggles, visual feedback, and persistence all work

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [x] T045 [P] Verify no TypeScript compilation errors (`npm run build`)
- [x] T046 [P] Verify all constants are used from `src/utils/constants.ts` (no magic numbers)
- [x] T047 Test edge case: Bypass component in feedback loop - verify no audio artifacts
- [x] T048 Test edge case: Bypass multiple components rapidly (stress test)
- [x] T049 Test edge case: Toggle bypass while no audio is playing
- [x] T050 Test edge case: Toggle bypass during active audio processing
- [x] T051 Verify CV/Gate connections remain active when audio is bypassed
- [x] T052 Test performance: Verify 60 FPS canvas rendering with many bypassed components
- [x] T053 Verify no console errors or warnings during bypass operations
- [x] T054 Code cleanup: Remove any debug logging or commented-out code
- [x] T055 Run complete quickstart.md validation - verify all steps work correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 but adds independent visual layer
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Adds persistence layer independently

### Within Each User Story

**US1 (Audio Logic)**:
- Component-specific overrides (T010-T015) can run in parallel
- Audio verification (T016-T022) must run sequentially after implementation

**US2 (Visual Feedback)**:
- UI implementation tasks (T023-T027) must run sequentially (same file)
- Event handling (T028-T029) must run after UI implementation
- Visual verification (T030-T034) runs after all implementation

**US3 (Persistence)**:
- Serialization tasks (T035-T036) can run in parallel
- Integration task (T037) must run after serialization
- Testing (T038-T044) must run after all implementation

### Parallel Opportunities

- **Setup Phase**: T001 and T002 can run in parallel (different files)
- **Foundational Phase**: T005-T006, T008-T009 can run in parallel (different methods)
- **US1**: T010-T015 can ALL run in parallel (different component files)
- **US3**: T035 and T036 can run in parallel (different methods)
- **Polish Phase**: T045, T046 can run in parallel

### Critical Path

The minimum path to deliver US1 (MVP):
```
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 →
T010 (Delay) → T016 (Test Delay) → Done (Minimal MVP with one component)
```

Full US1 delivery requires completing all component implementations (T010-T015) and their tests (T016-T022).

---

## Parallel Example: User Story 1

```bash
# After Foundational phase (T003-T009) completes, launch all component implementations together:

Task: "Override enableBypass/disableBypass in src/components/effects/Delay.ts"
Task: "Override enableBypass/disableBypass in src/components/effects/Reverb.ts"
Task: "Override enableBypass/disableBypass in src/components/processors/Filter.ts"
Task: "Override enableBypass/disableBypass in src/components/processors/VCA.ts"
Task: "Override enableBypass/disableBypass in src/components/processors/ADSREnvelope.ts"
Task: "Override enableBypass/disableBypass in src/components/utilities/Mixer.ts"

# All 6 tasks work on different files with no dependencies - perfect for parallel execution
# After completion, run tests T016-T022 sequentially to verify each component
```

---

## Parallel Example: User Story 3

```bash
# Within US3, launch serialization methods in parallel:

Task: "Update serializeComponent() in src/patch/PatchSerializer.ts"
Task: "Update deserializeComponent() in src/patch/PatchSerializer.ts"

# These are different methods in the same file but can be worked on concurrently
# After completion, run integration task T037, then tests T038-T044
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

**Recommended approach for quickest delivery:**

1. **Phase 1**: Setup (T001-T002) - ~10 minutes
2. **Phase 2**: Foundational (T003-T009) - ~30 minutes
3. **Phase 3**: User Story 1 (T010-T022) - ~3 hours
   - Can deliver incrementally: Complete one component (e.g., Delay) first for fastest MVP
   - Then add remaining components
4. **STOP and VALIDATE**: Test bypass toggle on all implemented components
5. **Result**: Users can bypass effects - core value delivered

**Minimal MVP** (Deliver fastest):
- Complete Setup + Foundational + only Delay component (T010, T016)
- Demonstrates bypass works, can add more components incrementally

**Full MVP** (Complete US1):
- All components support bypass
- All audio routing tested
- Users can toggle any effect/processor

### Incremental Delivery

**Each user story adds complete, independent value:**

1. **Setup + Foundational** → Foundation ready (~40 minutes)
2. **+ User Story 1** → Bypass toggle works (core feature) (~3 hours)
   - ✅ Can ship: Users can toggle bypass on all components
3. **+ User Story 2** → Visual feedback added (~1 hour)
   - ✅ Can ship: Users can see bypass state clearly
4. **+ User Story 3** → State persistence (~45 minutes)
   - ✅ Can ship: Users can save/load bypass configurations
5. **+ Polish** → Production ready (~1 hour)

**Total time**: ~6-7 hours for complete feature

### Parallel Team Strategy

With 2-3 developers:

**Phase 1-2**: Team works together (~40 minutes)
- Developer A: T001-T004
- Developer B: T005-T007
- Developer C: T008-T009

**Phase 3** (US1): Split component implementations
- Developer A: T010 (Delay), T011 (Reverb)
- Developer B: T012 (Filter), T013 (VCA)
- Developer C: T014 (ADSR), T015 (Mixer)
- Then each tests their components (T016-T022)

**Phase 4** (US2): Single developer (same file changes)
- Developer A: T023-T029, then testing T030-T034

**Phase 5** (US3): Single developer (same file changes)
- Developer B: T035-T037, then testing T038-T044

**Phase 6** (Polish): Team validates together
- All developers: Testing and verification

**Result**: Feature complete in ~3-4 hours with 3 developers

---

## Notes

- [P] tasks = different files, no dependencies - safe to parallelize
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Manual testing required (no test framework currently exists)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- TypeScript strict mode enabled - ensure all type checks pass
- Web Audio API documentation: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

---

## Task Count Summary

- **Setup**: 2 tasks (~10 minutes)
- **Foundational**: 7 tasks (~30 minutes) - BLOCKS all stories
- **User Story 1**: 13 tasks (~3 hours) - Core bypass functionality
- **User Story 2**: 12 tasks (~1 hour) - Visual feedback
- **User Story 3**: 10 tasks (~45 minutes) - Persistence
- **Polish**: 11 tasks (~1 hour) - Final validation

**Total**: 55 tasks
**Estimated Total Time**: 6-7 hours (solo) or 3-4 hours (team of 3)
**Parallel Opportunities**: 11 parallelizable tasks across different files
