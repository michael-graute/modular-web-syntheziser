# Tasks: LFO Runtime Toggle

**Input**: Design documents from `/specs/005-lfo-runtime-toggle/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Manual testing only (audio features require listen tests). No automated test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/` at repository root (browser-based modular synthesizer)
- TypeScript 5.6+, Web Audio API, Canvas 2D
- No backend/frontend split - purely client-side

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new infrastructure needed - feature reuses existing bypass pattern from effects (001-effect-bypass)

✅ **All setup already complete** - Skip to Foundational phase

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Verify existing bypass infrastructure is functional before modifying LFO

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T001 Verify SynthComponent base class has bypass methods (setBypass, isBypassed, enableBypass, disableBypass) in src/components/base/SynthComponent.ts
- [x] T002 Verify CanvasComponent renders bypass button for isBypassable() components in src/canvas/CanvasComponent.ts
- [x] T003 Verify PatchSerializer serializes/deserializes isBypassed field in src/patch/PatchSerializer.ts
- [x] T004 Verify existing effect (e.g., Distortion) bypass works correctly as reference implementation

**Checkpoint**: ✅ Foundation verified - user story implementation can now begin

---

## Phase 3: User Story 1 - Toggle LFO Modulation (Priority: P1) 🎯 MVP

**Goal**: Enable users to toggle LFO modulation on/off at runtime via button in component header, preserving all LFO settings and maintaining phase continuity.

**Independent Test**: Click the on/off button in the LFO component header and observe that modulation starts/stops while preserving all LFO settings (rate, depth, waveform, etc.). Verify parameter holds current value when toggled off.

### Implementation for User Story 1

- [x] T005 [US1] Override isBypassable() method to return true in src/components/generators/LFO.ts (line ~50-60)
- [x] T006 [US1] Implement enableBypass() method to disconnect oscillator output in src/components/generators/LFO.ts
- [x] T007 [US1] Implement disableBypass() method to reconnect oscillator output in src/components/generators/LFO.ts
- [x] T008 [US1] Verify oscillator.connect(gainNode) exists in createAudioNodes() for initial enabled state in src/components/generators/LFO.ts

**Manual Testing for User Story 1**:
- [x] T009 [US1] Test toggle off stops modulation and parameter holds value (quickstart.md Test 2)
- [x] T010 [US1] Test toggle on resumes modulation from current phase (quickstart.md Test 3)
- [x] T011 [US1] Test parameter editing while bypassed works correctly (quickstart.md Test 4)
- [x] T012 [US1] Test rapid toggling processes all events (quickstart.md Test 8)
- [x] T013 [US1] Test no audio clicks/pops during toggle (quickstart.md Test 9)

**Checkpoint**: At this point, User Story 1 should be fully functional - LFO toggle works with audio control

---

## Phase 4: User Story 2 - Visual State Indication (Priority: P2)

**Goal**: Provide clear visual feedback of LFO enabled/disabled state through button appearance and component dimming.

**Independent Test**: Observe the visual state of the on/off button and LFO component in both enabled and disabled states, verifying that the difference is immediately apparent.

### Implementation for User Story 2

✅ **No new implementation needed** - CanvasComponent automatically provides visual feedback:
- Bypass button automatically renders when isBypassable() returns true (implemented in T005)
- Component dimming (0.4 opacity) automatically applies when bypassed
- Button state changes automatically handled

**Manual Testing for User Story 2**:
- [x] T014 [US2] Test bypass button appears in LFO header (quickstart.md Test 1)
- [x] T015 [US2] Test component dims to 0.4 opacity when bypassed (quickstart.md Test 1)
- [x] T016 [US2] Test button shows clear on/off states (color/appearance changes) (quickstart.md Test 1)
- [x] T017 [US2] Test multiple LFOs show independent states (quickstart.md Test 7)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - toggle works with clear visual feedback

---

## Phase 5: User Story 3 - State Persistence (Priority: P3)

**Goal**: Preserve LFO on/off state when saving and loading projects via localStorage.

**Independent Test**: Toggle an LFO off, save/close the project, reopen it, and verify the LFO remains in the off state.

### Implementation for User Story 3

✅ **No new implementation needed** - PatchSerializer already handles isBypassed field:
- serialize() already includes isBypassed: component.isBypassed()
- deserialize() already calls component.setBypass(data.isBypassed ?? false)
- Default enabled state (FR-011) automatically handled by ?? false fallback

**Manual Testing for User Story 3**:
- [x] T018 [US3] Test save patch with LFO enabled, reload, verify enabled (quickstart.md Test 5)
- [x] T019 [US3] Test save patch with LFO disabled, reload, verify disabled (quickstart.md Test 5)
- [x] T020 [US3] Test save patch with multiple LFOs in mixed states, reload, verify all states preserved (quickstart.md Test 5)
- [x] T021 [US3] Test load old patch (no isBypassed field) defaults to enabled (quickstart.md Test 6, backward compatibility)

**Checkpoint**: All user stories should now be independently functional - complete feature working

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [x] T022 [P] Run all manual tests from quickstart.md (Tests 1-10)
- [x] T023 [P] Verify parameter hold accuracy with oscilloscope (quickstart.md Test 10)
- [x] T024 [P] Test edge case: Multiple LFOs on same parameter with mixed states
- [x] T025 Update CLAUDE.md with feature completion status (already updated by update-agent-context.sh)
- [x] T026 [P] Create manual test report documenting all test results
- [x] T027 Final code review: verify clean implementation, no debug statements, proper error handling

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: ✅ Skipped - no new infrastructure needed
- **Foundational (Phase 2)**: Verification only - BLOCKS all user stories (~15 min)
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (P1): Core toggle functionality - MUST complete first
  - User Story 2 (P2): Depends on US1 (visual feedback requires toggle to exist)
  - User Story 3 (P3): Independent of US1/US2 but less critical
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Requires US1 complete (button needs toggle functionality to show state changes)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2 (serialization is automatic)

**Sequential Order Required**: US1 → US2 → US3 (US2 needs US1, US3 independent but lowest priority)

### Within Each User Story

- **User Story 1**: T005 → T006, T007 → T008 (sequential dependencies)
- **User Story 2**: No implementation tasks (automatic via existing infrastructure)
- **User Story 3**: No implementation tasks (automatic via existing infrastructure)
- **Polish**: All tasks can run in parallel

### Parallel Opportunities

- **Foundational Phase**: All verification tasks (T001-T004) can run in parallel [P]
- **User Story 1**: T006 and T007 can be implemented in parallel after T005 completes
- **User Story 1 Testing**: T009-T013 can run in parallel after implementation complete
- **User Story 2 Testing**: T014-T017 can run in parallel after US1 complete
- **User Story 3 Testing**: T018-T021 can run in parallel after US1 complete
- **Polish Phase**: T022, T023, T024, T026, T027 can run in parallel

---

## Parallel Example: User Story 1

```bash
# After T005 completes, implement bypass methods together:
Task T006: "Implement enableBypass() method to disconnect oscillator output"
Task T007: "Implement disableBypass() method to reconnect oscillator output"

# After implementation complete, run all manual tests together:
Task T009: "Test toggle off stops modulation and parameter holds value"
Task T010: "Test toggle on resumes modulation from current phase"
Task T011: "Test parameter editing while bypassed works correctly"
Task T012: "Test rapid toggling processes all events"
Task T013: "Test no audio clicks/pops during toggle"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational verification (~15 min)
2. Complete Phase 3: User Story 1 implementation (~30 min)
3. Complete Phase 3: User Story 1 testing (~45 min)
4. **STOP and VALIDATE**: Test toggle works, modulation stops/starts, phase continues
5. Demo/review if ready - **Basic feature is functional at this point**

**Total MVP Time**: ~90 minutes

### Incremental Delivery

1. Complete Foundational verification → Foundation ready (~15 min)
2. Add User Story 1 → Test independently → **MVP functional** (~75 min total)
3. Add User Story 2 → Test independently → **Visual feedback complete** (~30 min)
4. Add User Story 3 → Test independently → **Persistence complete** (~20 min)
5. Polish → **Feature complete** (~30 min)

**Total Feature Time**: ~2.5 hours (matches quickstart estimate)

### Single Developer Strategy

**Day 1** (90 minutes):
1. Verify existing bypass infrastructure (15 min) - Phase 2
2. Implement User Story 1 (30 min) - Phase 3 implementation
3. Test User Story 1 (45 min) - Phase 3 manual testing
4. **Checkpoint**: Core toggle works, ready for review

**Day 2** (60 minutes):
1. Test User Story 2 visual feedback (30 min) - Phase 4 testing
2. Test User Story 3 persistence (20 min) - Phase 5 testing
3. Polish & final validation (10 min) - Phase 6
4. **Complete**: All stories validated, feature ready

---

## Task Count Summary

### By Phase
- Phase 1 (Setup): 0 tasks (skipped)
- Phase 2 (Foundational): 4 tasks (verification)
- Phase 3 (User Story 1): 9 tasks (4 implementation + 5 testing)
- Phase 4 (User Story 2): 4 tasks (testing only)
- Phase 5 (User Story 3): 4 tasks (testing only)
- Phase 6 (Polish): 6 tasks

**Total**: 27 tasks

### By Type
- Implementation: 4 tasks (15%)
- Manual Testing: 17 tasks (63%)
- Verification: 4 tasks (15%)
- Documentation/Polish: 2 tasks (7%)

### Parallel Opportunities
- 4 tasks in Foundational can run in parallel
- 2 tasks in US1 implementation can run in parallel (after T005)
- 5 tasks in US1 testing can run in parallel (after implementation)
- 4 tasks in US2 testing can run in parallel (after US1)
- 4 tasks in US3 testing can run in parallel (after US1)
- 5 tasks in Polish can run in parallel

**Total Parallelizable**: 24 tasks (89%)

---

## Independent Test Criteria

### User Story 1 - Toggle LFO Modulation
✅ **Pass Criteria**:
- Clicking bypass button stops modulation immediately
- Clicking bypass button again resumes modulation
- Parameter holds current value when toggled off (no jump)
- All LFO settings (rate, depth, waveform) preserved across toggle
- Phase continues (doesn't reset to start of cycle)
- Can edit parameters while bypassed, changes apply when re-enabled

### User Story 2 - Visual State Indication
✅ **Pass Criteria**:
- Bypass button visible in LFO component header
- Button shows clear "on" state (bright/blue) when enabled
- Button shows clear "off" state (dark/dim) when disabled
- Component dims to 0.4 opacity when bypassed
- Component returns to full opacity when enabled
- Multiple LFOs show independent visual states

### User Story 3 - State Persistence
✅ **Pass Criteria**:
- Save patch with LFO enabled → reload → LFO is enabled
- Save patch with LFO disabled → reload → LFO is disabled
- Save patch with multiple LFOs in mixed states → reload → all states preserved
- Load old patch (no isBypassed field) → LFO defaults to enabled
- Exported patches preserve state when imported

---

## Suggested MVP Scope

**Minimum Viable Product**: User Story 1 Only

**Rationale**:
- User Story 1 provides core functionality (toggle on/off)
- User Story 2 is automatic (no implementation needed)
- User Story 3 is automatic (no implementation needed)
- Total MVP effort: ~90 minutes

**MVP Delivers**:
- LFO can be toggled on/off at runtime
- Modulation stops/starts correctly
- Phase continuity maintained
- Visual feedback works (automatic)
- Persistence works (automatic)

**To reach full feature**: Just run tests for US2 and US3 (~50 minutes additional)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Manual testing is required for audio features (listen tests)
- No automated test infrastructure needed for this feature
- Commit after each implementation task or logical group
- Stop at any checkpoint to validate story independently
- Most complexity is already solved by existing bypass infrastructure
- Total implementation: ~20 lines of code across 1 file (LFO.ts)
