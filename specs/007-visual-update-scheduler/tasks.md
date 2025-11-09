# Tasks: Centralized Animation Loop Migration

**Input**: Design documents from `/specs/007-visual-update-scheduler/`
**Prerequisites**: plan.md (complete), spec.md (complete), research.md (complete), data-model.md (complete), contracts/ (complete)

**Tests**: No automated tests requested - verification via manual performance testing with Activity Monitor and Chrome DevTools

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single TypeScript project: `src/` at repository root
- Tests: Manual verification with browser DevTools

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create scheduler singleton and initialize at application startup

- [ ] T001 Create singleton scheduler instance export in src/visualization/scheduler.ts
- [ ] T002 Initialize scheduler singleton at application startup in src/main.ts

**Checkpoint**: Scheduler singleton created and initialized - ready for component migration

---

## Phase 2: Foundational (Scheduler Enhancements)

**Purpose**: Enhance VisualUpdateScheduler with FR-011, FR-012, FR-013 capabilities

**⚠️ CRITICAL**: These enhancements must be complete before component migrations to ensure proper error handling, background tab pause, and safe lifecycle management

- [ ] T003 [P] Implement FR-011: Page Visibility API pause/resume in src/visualization/VisualUpdateScheduler.ts
- [ ] T004 [P] Implement FR-012: Enhanced error logging with component ID in src/visualization/VisualUpdateScheduler.ts
- [ ] T005 Implement FR-013: Deferred removal pattern for safe unsubscribe during callback execution in src/visualization/VisualUpdateScheduler.ts

**Checkpoint**: Scheduler enhancements complete - components can now safely migrate with full error isolation and background tab handling

---

## Phase 3: User Story 1 - Reduced CPU Usage on macOS (Priority: P1) 🎯 MVP

**Goal**: Migrate all 4 visual components to centralized scheduler to reduce CPU usage from 80-98% to 15-30% on macOS Retina displays

**Independent Test**: Open Activity Monitor on macOS, run application with 2 oscilloscopes + 1 sequencer + 1 collider, verify CPU drops from 80-98% to 15-30%

### Implementation for User Story 1

**Canvas Migration** (60fps, main render loop):

- [ ] T006 [P] [US1] Migrate Canvas.ts to use centralized scheduler in src/canvas/Canvas.ts
  - Import visualUpdateScheduler and SubscriptionHandle
  - Replace animationFrameId property with subscription property
  - Remove render() method's requestAnimationFrame call
  - Subscribe to scheduler in constructor with component ID 'Canvas'
  - Update destroy() method to call subscription.unsubscribe()
  - Preserve existing rendering logic (no throttling needed - 60fps)

**OscilloscopeDisplay Migration** (30fps throttled, visibility checked):

- [ ] T007 [P] [US1] Migrate OscilloscopeDisplay.ts to use centralized scheduler in src/canvas/displays/OscilloscopeDisplay.ts
  - Import visualUpdateScheduler and SubscriptionHandle
  - Replace animationFrame property with subscription property
  - Remove startAnimation() method entirely
  - Subscribe to scheduler in constructor with component ID 'OscilloscopeDisplay'
  - Preserve existing 30fps throttling logic (lastRenderTime, frameInterval)
  - Preserve existing visibility check (isVisible())
  - Preserve existing frozen state check (isFrozen)
  - Update destroy() method to call subscription.unsubscribe()

**SequencerDisplay Migration** (30fps throttled, visibility checked):

- [ ] T008 [P] [US1] Migrate SequencerDisplay.ts to use centralized scheduler in src/canvas/displays/SequencerDisplay.ts
  - Import visualUpdateScheduler and SubscriptionHandle
  - Replace animationFrame property with subscription property
  - Remove startAnimation() method entirely
  - Subscribe to scheduler in constructor with component ID 'SequencerDisplay'
  - Preserve existing 30fps throttling logic (lastRenderTime, frameInterval)
  - Preserve existing visibility check (isVisible())
  - Preserve existing frozen state check (isFrozen)
  - Update destroy() method to call subscription.unsubscribe()

**Collider Migration** (30fps rendering, 60fps physics):

- [ ] T009 [P] [US1] Migrate Collider.ts to use centralized scheduler in src/components/utilities/Collider.ts
  - Import visualUpdateScheduler and SubscriptionHandle
  - Replace animationFrameId property with subscription property
  - Remove animate() method's requestAnimationFrame call
  - Subscribe to scheduler in constructor with component ID 'Collider'
  - Preserve physics update at 60fps, rendering at 30fps throttling
  - Update destroy() method to call subscription.unsubscribe()

### Verification for User Story 1

- [ ] T010 [US1] Baseline performance measurement before final verification
  - Document current CPU usage with Activity Monitor (expect 80-98%)
  - Count active requestAnimationFrame loops in Chrome DevTools Performance tab (expect 5-6)
  - Count render calls per second in Chrome DevTools (expect ~300)
  - Take screenshots for comparison

- [ ] T011 [US1] Verify CPU reduction on macOS in Activity Monitor
  - Open Activity Monitor
  - Filter for browser process
  - Create 2 oscilloscopes + 1 sequencer + 1 collider
  - Record CPU usage over 60 seconds
  - Verify: 15-30% CPU (down from 80-98%) ✓ SC-001

- [ ] T012 [US1] Verify single animation loop in Chrome DevTools Performance
  - Open DevTools → Performance tab
  - Record 10-second profile
  - Search for "requestAnimationFrame" in call tree
  - Verify: Exactly 1 animation loop active ✓ SC-003
  - Verify: ~60 render calls/sec (down from ~300) ✓ SC-004

- [ ] T013 [US1] Verify visual behavior unchanged for all components
  - Canvas: Check rendering quality, smoothness, no stuttering
  - OscilloscopeDisplay: Check waveform updates, 30fps feel maintained
  - SequencerDisplay: Check step indicator updates, 30fps feel maintained
  - Collider: Check physics simulation smooth, collision rendering at 30fps
  - Verify: No visual regressions ✓ SC-006

- [ ] T014 [US1] Verify 60fps frame rate maintained
  - Use visualUpdateScheduler.getCurrentFPS() in console
  - Check FPS display (if available)
  - Verify: Stable 60fps ✓ SC-002

**Checkpoint**: User Story 1 complete - All components migrated, CPU reduced 60-70%, single animation loop, no visual regressions

---

## Phase 4: User Story 2 - Consistent Animation Performance (Priority: P2)

**Goal**: Verify all migrated components render smoothly and consistently without glitches or lag

**Independent Test**: Create patch with multiple visual components, play continuous tone, verify all displays update smoothly without stuttering or frame drops

### Implementation for User Story 2

**Note**: No code changes needed - this story validates the quality of the US1 migration

### Verification for User Story 2

- [ ] T015 [P] [US2] Test multiple visual components rendering simultaneously
  - Create patch with 3 oscilloscopes + 2 sequencers + 1 collider
  - Play continuous audio tone
  - Verify: All components render at stable frame rate ✓ Acceptance 1

- [ ] T016 [P] [US2] Test adding new components doesn't degrade existing components
  - Start with 2 oscilloscopes rendering
  - Add 2 more oscilloscopes one by one
  - Verify: Existing components maintain rendering quality ✓ Acceptance 2

- [ ] T017 [P] [US2] Test visual updates remain synchronized with audio
  - Play audio through patch
  - Verify oscilloscope waveforms match audio output
  - Verify sequencer display updates in sync with audio timing
  - Verify: No lag or drift between visual and audio ✓ Acceptance 3

- [ ] T018 [US2] Test error isolation works correctly
  - Temporarily inject error in one component's callback (throw new Error)
  - Verify error logged to console with component ID
  - Verify other components continue rendering normally
  - Remove injected error after test
  - Verify: Error in one component doesn't prevent others from rendering ✓ SC-008

**Checkpoint**: User Story 2 complete - Animation performance verified smooth and consistent across all components

---

## Phase 5: User Story 3 - Memory Stability During Long Sessions (Priority: P3)

**Goal**: Verify proper cleanup of animation subscriptions to prevent memory leaks during long sessions

**Independent Test**: Run application for 2+ hours while adding/removing components, verify memory usage stable in DevTools Memory profiler

### Verification for User Story 3

- [ ] T019 [US3] Memory leak test: component creation and destruction cycle
  - Open Chrome DevTools → Memory tab
  - Take heap snapshot (baseline)
  - Add 10 visual components (mix of oscilloscopes, sequencers, colliders)
  - Wait 5 seconds
  - Remove all 10 components
  - Force garbage collection (trash can icon)
  - Take second heap snapshot
  - Compare: Memory within 10% of baseline ✓ SC-005
  - Verify: visualUpdateScheduler.getCallbackCount() === 0 ✓ SC-007

- [ ] T020 [US3] Memory leak test: subscription cleanup verification
  - Create 5 oscilloscopes
  - Check: visualUpdateScheduler.getCallbackCount() === 6 (5 + canvas)
  - Destroy 3 oscilloscopes
  - Check: visualUpdateScheduler.getCallbackCount() === 3 (2 + canvas)
  - Destroy remaining 2 oscilloscopes
  - Check: visualUpdateScheduler.getCallbackCount() === 1 (canvas only)
  - Verify: All subscriptions properly cleaned up ✓ Acceptance 2

- [ ] T021 [US3] Long-running session stability test
  - Run application for 2+ hours
  - Periodically add/remove components (every 10-15 minutes)
  - Monitor memory usage in DevTools Memory tab
  - Verify: Memory usage not increasing by more than 10% ✓ Acceptance 1
  - Verify: No orphaned callbacks in scheduler ✓ Acceptance 3

- [ ] T022 [US3] Background tab pause/resume test
  - Open application with multiple components
  - Check CPU usage in Activity Monitor (should be 15-30%)
  - Switch to different browser tab (background application)
  - Check: visualUpdateScheduler.isPaused() === true (if method exists)
  - Check CPU usage: Should drop to near 0%
  - Switch back to application tab
  - Check: visualUpdateScheduler.isPaused() === false
  - Check: Visual rendering resumes smoothly
  - Verify: FR-011 background tab pause working correctly

**Checkpoint**: User Story 3 complete - Memory stable, proper cleanup verified, no leaks

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, final validation, and completion

- [ ] T023 [P] Update CLAUDE.md with completed feature status
  - Add 007-visual-update-scheduler to completed features
  - Document migration outcome (CPU reduction achieved)
  - Note migration pattern for future components

- [ ] T024 [P] Update docs/performance-issues-macos.md with results
  - Mark Priority 3 as COMPLETE
  - Document actual CPU usage after migration (before/after numbers)
  - Document render calls reduction (before/after numbers)
  - Add verification screenshots if available

- [ ] T025 Run complete quickstart.md validation checklist
  - Follow all steps in quickstart.md verification section
  - Check all migration checklist items
  - Verify all success criteria met
  - Document any deviations or issues

- [ ] T026 Final acceptance verification against all success criteria
  - ✓ SC-001: CPU 15-30% on macOS (from 80-98%)
  - ✓ SC-002: Stable 60fps maintained
  - ✓ SC-003: Exactly 1 requestAnimationFrame loop
  - ✓ SC-004: ~60 render calls/sec (from ~300)
  - ✓ SC-005: Memory stable during 2+ hour sessions
  - ✓ SC-006: No visual regressions
  - ✓ SC-007: Proper subscription cleanup
  - ✓ SC-008: Error isolation working

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion - BLOCKS all component migrations
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion
- **User Story 2 (Phase 4)**: Depends on User Story 1 (Phase 3) completion - validates migration quality
- **User Story 3 (Phase 5)**: Depends on User Story 1 (Phase 3) completion - validates memory management
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: CPU reduction via migration - Must complete first (critical path)
- **User Story 2 (P2)**: Animation performance validation - Depends on US1 migrations
- **User Story 3 (P3)**: Memory stability validation - Depends on US1 migrations
- **US2 and US3 can proceed in parallel** once US1 is complete (both are validation stories)

### Within Each User Story

**User Story 1 (Implementation)**:
- T001-T002 (Setup) must complete first
- T003-T005 (Foundational) must complete before T006-T009
- T006-T009 (Component migrations) can run in parallel [P]
- T010-T014 (Verification) must run after migrations complete

**User Story 2 (Validation)**:
- T015-T017 can run in parallel [P]
- T018 runs last (error injection test)

**User Story 3 (Validation)**:
- T019-T022 run sequentially (each builds on previous)

### Parallel Opportunities

**Setup Phase (Phase 1)**:
- T001 and T002 are sequential (singleton before initialization)

**Foundational Phase (Phase 2)**:
- T003 and T004 can run in parallel [P] (different concerns)
- T005 runs last (depends on callback structure from T003-T004)

**User Story 1 Implementation**:
- T006, T007, T008, T009 can all run in parallel [P] (different files, no dependencies)

**User Story 2 Validation**:
- T015, T016, T017 can run in parallel [P] (independent test scenarios)

**Between User Stories**:
- Once US1 complete, US2 and US3 can proceed in parallel (both validation, no conflicts)

---

## Parallel Example: User Story 1 Component Migrations

```bash
# After Foundational phase complete, launch all 4 component migrations together:

Task 1: "Migrate Canvas.ts to use centralized scheduler in src/canvas/Canvas.ts"
Task 2: "Migrate OscilloscopeDisplay.ts to use centralized scheduler in src/canvas/displays/OscilloscopeDisplay.ts"
Task 3: "Migrate SequencerDisplay.ts to use centralized scheduler in src/canvas/displays/SequencerDisplay.ts"
Task 4: "Migrate Collider.ts to use centralized scheduler in src/components/utilities/Collider.ts"

# All 4 tasks modify different files and have no dependencies on each other
# Can be completed simultaneously by parallel agents or in any order
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T005) - CRITICAL
3. Complete Phase 3: User Story 1 (T006-T014)
4. **STOP and VALIDATE**: Test CPU reduction independently
5. Measure success criteria: CPU 15-30%, single loop, 60 render calls/sec
6. If successful: Deploy MVP with 60-70% CPU reduction achieved ✓

### Incremental Delivery

1. **Foundation** (Phase 1-2): Scheduler ready with enhancements
2. **MVP** (Phase 3): All components migrated, CPU reduced, single loop → **SHIP IT**
3. **Quality Validation** (Phase 4): Animation performance verified → Document
4. **Memory Validation** (Phase 5): Long-term stability verified → Document
5. **Polish** (Phase 6): Documentation updated → Feature complete

### Parallel Team Strategy

With multiple developers or parallel agents:

1. **Sequential Setup**: One developer completes Phase 1-2 (foundational)
2. **Parallel Migration (Phase 3)**:
   - Agent A: T006 (Canvas migration)
   - Agent B: T007 (OscilloscopeDisplay migration)
   - Agent C: T008 (SequencerDisplay migration)
   - Agent D: T009 (Collider migration)
3. **Sequential Verification**: One developer runs T010-T014
4. **Parallel Validation (Phase 4-5)**:
   - Agent A: User Story 2 validation
   - Agent B: User Story 3 validation
5. Converge for final polish

---

## Notes

- **[P] tasks**: Different files, no dependencies, safe for parallel execution
- **[US1], [US2], [US3] labels**: Map tasks to user stories for traceability
- **Migration Pattern**: Each component follows identical pattern (see quickstart.md)
- **Testing**: Manual performance verification only (no automated tests requested)
- **Risk Mitigation**: Migrate one component at a time, test after each if cautious
- **Rollback**: Git revert individual component if issues found
- **Verification Tools**: Activity Monitor (CPU), Chrome DevTools Performance (loops), Chrome DevTools Memory (leaks)
- **Success Threshold**: Primary goal is US1 (P1) - CPU reduction from 80-98% to 15-30%
- **Time Estimate**: 4-6 hours total per plan.md

---

## Task Count Summary

- **Phase 1 (Setup)**: 2 tasks
- **Phase 2 (Foundational)**: 3 tasks
- **Phase 3 (User Story 1)**: 9 tasks (4 implementation + 5 verification)
- **Phase 4 (User Story 2)**: 4 tasks (all verification)
- **Phase 5 (User Story 3)**: 4 tasks (all verification)
- **Phase 6 (Polish)**: 4 tasks

**Total**: 26 tasks
- Implementation: 9 tasks (T001-T009)
- Verification: 13 tasks (T010-T022)
- Documentation: 4 tasks (T023-T026)

**Parallel Opportunities**: 9 tasks can run in parallel (marked with [P])

**Critical Path**: Phase 1 → Phase 2 → T006-T009 (parallel) → T010-T014 → US2/US3 (parallel) → Polish

**MVP Scope**: Phase 1-3 only (14 tasks) delivers core value (CPU reduction)
