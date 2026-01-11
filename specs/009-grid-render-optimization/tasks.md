# Tasks: Grid Rendering Performance Optimization

**Input**: Design documents from `/specs/009-grid-render-optimization/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md

**Tests**: No explicit tests requested - manual performance validation using Chrome DevTools

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/` at repository root
- Canvas rendering: `src/canvas/Canvas.ts`
- Constants: `src/utils/constants.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add LOD constants required by all user stories

- [x] T001 Add GRID_LOD_THRESHOLDS constants (ZOOM_25, ZOOM_50, ZOOM_75) to src/utils/constants.ts
- [x] T002 Add GRID_FADE_THRESHOLD constant (0.5) to src/utils/constants.ts

**Checkpoint**: Constants ready for use in Canvas.ts modifications

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core grid cache infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can deliver value until this cache infrastructure exists

- [x] T003 Add private properties for grid caching to src/canvas/Canvas.ts (gridCanvas, gridCtx, gridDirty, lastGridZoom, lastGridPan)
- [x] T004 Implement initGridCanvas() method in src/canvas/Canvas.ts to create offscreen canvas matching main canvas dimensions
- [x] T005 Call initGridCanvas() in Canvas constructor in src/canvas/Canvas.ts
- [x] T006 Implement checkGridDirty() method in src/canvas/Canvas.ts with zoom threshold check (0.001 delta)
- [x] T007 Add pan threshold check (20px delta) to checkGridDirty() method in src/canvas/Canvas.ts

**Checkpoint**: Cache infrastructure ready - user story optimizations can now be implemented

---

## Phase 3: User Story 1 - Responsive Canvas at All Zoom Levels (Priority: P1) 🎯 MVP

**Goal**: Eliminate CPU spikes when zooming out by implementing adaptive LOD grid spacing

**Independent Test**: Measure CPU usage at 200%, 100%, 50%, and 25% zoom using Chrome DevTools Performance profiler. Success = CPU stays below 25% at all zoom levels and maintains 60 FPS.

### Implementation for User Story 1

- [x] T008 [US1] Modify renderGrid() method in src/canvas/Canvas.ts to determine grid spacing based on zoom level (20px at ≥75%, 40px at 50-75%, 80px at 25-50%)
- [x] T009 [US1] Add zoom-based opacity fading logic to renderGrid() in src/canvas/Canvas.ts (fade from 100% at 50% zoom to 0% at 25% zoom)
- [x] T010 [US1] Add conditional grid hiding in renderGrid() when zoom < 0.25 in src/canvas/Canvas.ts
- [x] T011 [US1] Test visual appearance at all zoom levels (200%, 100%, 75%, 50%, 25%) to verify LOD transitions
- [x] T012 [US1] Run Chrome DevTools Performance profiler to measure CPU usage at 50% zoom (target: 45% → 20% reduction)
- [x] T013 [US1] Run Chrome DevTools Performance profiler to measure CPU usage at 25% zoom (target: 60%+ → 10% reduction)
- [x] T014 [US1] Verify 60 FPS maintained at all zoom levels using Performance profiler

**Checkpoint**: User Story 1 complete - CPU usage reduced by 50-60% at low zoom levels via LOD

---

## Phase 4: User Story 2 - Consistent Visual Grid Density (Priority: P2)

**Goal**: Visual grid spacing adapts to prevent clutter at low zoom while maintaining alignment reference

**Independent Test**: Zoom from 200% to 25% and verify grid maintains similar visual density (similar number of visible lines on screen). Grid should not become a solid gray mass at low zoom.

### Implementation for User Story 2

- [x] T015 [US2] Verify grid spacing transitions occur at correct thresholds (75%, 50%, 25%) in src/canvas/Canvas.ts renderGrid() method
- [x] T016 [US2] Test opacity fade smoothness between 50% and 25% zoom by slowly zooming and observing transitions
- [x] T017 [US2] Count visible grid lines on screen at each LOD level (should be approximately consistent: ~75-150 lines visible)
- [x] T018 [US2] Verify no jarring visual changes at LOD threshold crossings (smooth transitions)

**Checkpoint**: User Story 2 complete - Grid maintains visual utility and consistent density across all zoom levels

---

## Phase 5: User Story 3 - Preserved Snap-to-Grid Functionality (Priority: P2)

**Goal**: Snap-to-grid always uses base 20px grid regardless of visual grid spacing

**Independent Test**: Place component at 200% zoom, note position. Zoom to 50% (visual grid is 80px), drag component and verify it snaps to 20px increments (not 80px visual grid). Zoom back to 200% and verify same position.

### Implementation for User Story 3

- [x] T019 [US3] Verify snap-to-grid logic in Canvas.ts or component placement code still uses CANVAS.GRID_SIZE (20px) constant
- [x] T020 [US3] Test component placement at 200% zoom - verify snaps to 20px increments
- [x] T021 [US3] Test component placement at 50% zoom (visual grid 80px) - verify still snaps to 20px, not 80px
- [x] T022 [US3] Place components at 100% zoom, zoom to 50%, move components, zoom back to 200% - verify pixel-perfect alignment maintained
- [x] T023 [US3] Load saved patch and verify all components align to consistent 20px grid at all zoom levels

**Checkpoint**: User Story 3 complete - Snap-to-grid functionality preserved and verified independent of visual grid

---

## Phase 6: User Story 4 - Efficient Memory Usage (Priority: P3)

**Goal**: Add offscreen canvas caching for additional 20-30% CPU reduction while keeping memory overhead under 10MB (1080p)

**Independent Test**: Take Chrome DevTools heap snapshot before and after enabling grid cache. Memory increase should be <10MB for 1920x1080 display. Run for 30 minutes with frequent zooming - heap should remain stable (no leaks).

### Implementation for User Story 4

- [x] T024 [US4] Create renderGridToCache() method in src/canvas/Canvas.ts that renders grid to offscreen canvas using existing LOD logic
- [x] T025 [US4] Move grid rendering logic from renderGrid() into renderGridToCache() in src/canvas/Canvas.ts
- [x] T026 [US4] Apply viewport transform to gridCtx in renderGridToCache() to match main canvas coordinate space
- [x] T027 [US4] Mark gridDirty=false and store lastGridZoom/lastGridPan after rendering in renderGridToCache()
- [x] T028 [US4] Modify render() method in src/canvas/Canvas.ts to call checkGridDirty() before grid rendering
- [x] T029 [US4] Replace direct renderGrid() call with conditional renderGridToCache() + drawImage() blit in render() method
- [x] T030 [US4] Ensure cache only regenerates when gridDirty flag is true in render() method
- [x] T031 [US4] Modify resizeCanvas() method in src/canvas/Canvas.ts to resize gridCanvas to match new dimensions
- [x] T032 [US4] Mark gridDirty=true in resizeCanvas() to force cache regeneration after resize
- [x] T033 [US4] Test browser window resize - verify grid cache recreates without visual artifacts
- [x] T034 [US4] Take Chrome DevTools heap snapshot (before caching) at 1920x1080 resolution
- [x] T035 [US4] Take Chrome DevTools heap snapshot (after caching) and verify memory increase <10MB
- [x] T036 [US4] Run continuous zoom/pan for 30 minutes, take heap snapshot, verify no memory leaks (heap stable within 10%)
- [x] T037 [US4] Verify cache invalidation occurs correctly: zoom by 0.002 (>0.001 threshold) should mark dirty
- [x] T038 [US4] Verify cache invalidation: pan by 25px (>20px threshold) should mark dirty
- [x] T039 [US4] Verify cache NOT invalidated: zoom by 0.0005 (<0.001 threshold) should keep cache
- [x] T040 [US4] Run Chrome DevTools Performance profiler at 50% zoom - verify additional CPU reduction (20% → 12%, total 73% reduction from baseline 45%)

**Checkpoint**: User Story 4 complete - Grid caching adds additional 20-30% CPU reduction, total 60-70% reduction achieved

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Code quality, documentation, and final validation

- [x] T041 [P] Remove all console.log debug statements from src/canvas/Canvas.ts
- [x] T042 [P] Add JSDoc comments to initGridCanvas() method in src/canvas/Canvas.ts
- [x] T043 [P] Add JSDoc comments to renderGridToCache() method in src/canvas/Canvas.ts
- [x] T044 [P] Add JSDoc comments to checkGridDirty() method in src/canvas/Canvas.ts
- [x] T045 [P] Add "why" comments explaining cache invalidation threshold logic in checkGridDirty()
- [x] T046 [P] Add "why" comments explaining LOD threshold selection in renderGridToCache()
- [x] T047 Run npm run lint and fix any warnings in modified files
- [x] T048 Verify variable names are clear (gridDirty not just "dirty", lastGridZoom not just "lastZoom")
- [x] T049 Ensure code follows existing Canvas.ts coding style and conventions
- [x] T050 Run final performance validation across all zoom levels and document results
- [x] T051 Verify quickstart.md accurately reflects implementation (specs/009-grid-render-optimization/quickstart.md)
- [x] T052 Take screenshots of Performance profiler showing before/after CPU metrics at 50% and 25% zoom
- [x] T053 Prepare code review with performance test results and screenshots

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational (Phase 2) completion
  - US1 can proceed independently after Phase 2
  - US2 integrates with US1 (tests the visual quality of LOD from US1)
  - US3 validates that US1 doesn't break existing snap-to-grid
  - US4 builds on US1 by adding caching to the LOD implementation
- **Polish (Phase 7)**: Depends on all user stories (Phase 3-6) being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (Phase 2) - Implements core LOD optimization
- **User Story 2 (P2)**: Depends on US1 completion - Tests visual quality of LOD implementation
- **User Story 3 (P2)**: Depends on US1 completion - Validates snap-to-grid not affected by LOD
- **User Story 4 (P3)**: Depends on US1 completion - Adds caching layer on top of LOD

### Within Each User Story

**US1 Sequence**:
1. Modify renderGrid() with LOD logic (T008, T009, T010)
2. Test visual appearance (T011)
3. Validate performance (T012, T013, T014)

**US2 Sequence**:
1. Verify LOD thresholds (T015)
2. Test visual transitions (T016, T017, T018)

**US3 Sequence**:
1. Verify snap-to-grid logic unchanged (T019)
2. Test at multiple zoom levels (T020, T021, T022, T023)

**US4 Sequence**:
1. Implement cache rendering (T024, T025, T026, T027)
2. Integrate cache into render loop (T028, T029, T030)
3. Handle resize (T031, T032, T033)
4. Validate memory and performance (T034-T040)

### Parallel Opportunities

**Phase 1 (Setup)**:
- T001 and T002 can run in parallel (both add constants)

**Phase 2 (Foundational)**:
- T003, T004, T005 are sequential (must add properties before creating canvas)
- T006 and T007 modify same method (sequential)

**Phase 7 (Polish)**:
- T041-T046 can all run in parallel (different documentation/cleanup tasks)
- T047-T049 are code style checks (can run in parallel)
- T050-T053 are sequential validation steps

---

## Parallel Example: User Story 1

```bash
# After completing T008, T009, T010 (LOD implementation):
# Launch T011 (visual test) while running T012, T013, T014 (performance tests)
# Note: Performance tests at different zoom levels can be run sequentially in same profiling session

# No parallel opportunities within US1 - tasks are sequential (implement → test → validate)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002) - 5 minutes
2. Complete Phase 2: Foundational (T003-T007) - 1 hour
3. Complete Phase 3: User Story 1 (T008-T014) - 2-3 hours
4. **STOP and VALIDATE**: Test at all zoom levels, measure CPU reduction (target: 50-60% at 50% zoom)
5. Deploy/demo if performance targets met (SC-001, SC-002, SC-003, SC-004)

**Total MVP Time**: 3-4 hours for 50-60% CPU reduction

### Incremental Delivery

1. Complete Setup + Foundational (Phase 1-2) → Foundation ready - 1 hour
2. Add User Story 1 (Phase 3) → Test independently → 50-60% CPU reduction achieved - 2-3 hours
3. Add User Story 2 (Phase 4) → Validate visual quality → Grid density consistent - 1 hour
4. Add User Story 3 (Phase 5) → Validate snap-to-grid → Backward compatibility confirmed - 1 hour
5. Add User Story 4 (Phase 6) → Add caching → Additional 20-30% CPU reduction → Total 60-70% reduction - 3-4 hours
6. Polish (Phase 7) → Code review prep → Production ready - 1 hour

**Total Time**: 9-11 hours for complete optimization with 60-70% CPU reduction

### Fast Path (LOD Only, No Caching)

If time is limited:
1. Complete Phases 1-5 only (Setup → Foundational → US1 → US2 → US3)
2. Skip Phase 6 (User Story 4 - caching)
3. Result: 50-60% CPU reduction in 5-6 hours
4. Can add caching later as enhancement (Phase 6 can be done independently)

---

## Success Criteria Validation

| Success Criterion | Validation Task(s) | Pass Threshold |
|------------------|-------------------|----------------|
| SC-001: CPU <25% all zoom levels | T012, T013, T014, T040 | All zoom levels <25% CPU |
| SC-002: 60 FPS maintained | T014 | Performance profiler shows consistent 60 FPS |
| SC-003: 50% zoom CPU 45%→20% | T012 | CPU at 50% zoom ≤20% after LOD |
| SC-004: 25% zoom CPU 60%+→15% | T013 | CPU at 25% zoom ≤15% after LOD |
| SC-005: Memory <10MB (1080p) | T034, T035 | Heap increase ≤10MB |
| SC-006: 95% redraw reduction | T037, T038, T039 | Cache invalidates only at thresholds |
| SC-007: Smooth zoom transitions | T016, T018 | No jarring LOD changes observed |
| SC-008: Pixel-perfect alignment | T022, T023 | Components align at all zoom levels |
| SC-009: Consistent visual density | T017 | ~75-150 visible lines at all LOD levels |
| SC-010: No memory leaks | T036 | Heap stable after 30 min (<10% variance) |

---

## Notes

- [P] tasks = different files/independent work, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- All user stories depend on Foundational phase (Phase 2) being complete
- User Story 4 (caching) can be deferred if time is limited - US1-3 deliver 50-60% improvement
- Commit after completing each user story phase for easy rollback
- Performance testing requires Chrome DevTools - ensure profiling enabled
- Memory testing requires heap snapshots - may need to close other tabs for accurate measurement
