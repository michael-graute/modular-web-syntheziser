# Implementation Plan: Centralized Animation Loop Migration

**Branch**: `007-visual-update-scheduler` | **Date**: 2025-11-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-visual-update-scheduler/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Migrate all visual components from independent `requestAnimationFrame` loops to a centralized `VisualUpdateScheduler` to reduce CPU usage from 80-98% to 15-30% on macOS Retina displays. The existing `VisualUpdateScheduler` class provides the necessary infrastructure; this migration involves refactoring 4 components (Canvas, OscilloscopeDisplay, SequencerDisplay, Collider) to subscribe to the centralized scheduler instead of managing their own animation loops.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target
**Primary Dependencies**:
- Web Audio API (native browser API)
- Canvas 2D rendering context
- requestAnimationFrame (native browser API)
**Existing Infrastructure**:
- `VisualUpdateScheduler` class at `src/visualization/VisualUpdateScheduler.ts`
- Provides: `onFrame()`, `start()`, `stop()`, FPS monitoring, error isolation
- Already implements centralized requestAnimationFrame loop
**Testing**: Manual testing with Activity Monitor (macOS), Chrome DevTools Performance profiler
**Target Platform**: Modern browsers (Chrome, Safari, Firefox) with requestAnimationFrame support
**Project Type**: Client-side modular web synthesizer application
**Performance Goals**:
- Reduce CPU usage from 80-98% to 15-30% on macOS Retina displays
- Maintain stable 60fps frame rate
- Reduce render calls from ~300/sec to ~60/sec
**Constraints**:
- Must preserve existing visual behavior (no regressions)
- Must maintain throttling (30fps for displays, 60fps for main canvas)
- Must maintain visibility checks (skip off-screen rendering)
- No breaking API changes to visual components
**Scale/Scope**: 4 components migrated (Canvas, OscilloscopeDisplay, SequencerDisplay, Collider)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0.0

Verify feature compliance with Project Constitution principles:

- [x] **Code Quality - Readability and Maintainability**: Migration preserves existing component structure, uses clear naming (subscription handles), follows SRP (each component manages own subscription lifecycle)
- [x] **Code Quality - Code Organization**: Changes localized to individual component files, clear separation maintained between scheduler (infrastructure) and components (consumers)
- [x] **Code Quality - Code Standards**: TypeScript types enforced, no magic numbers (throttling values remain as named constants), follows existing codebase patterns
- [x] **Testing Standards**: Manual performance testing with Activity Monitor, Chrome DevTools profiling. No automated tests required for this refactoring (visual behavior verification)
- [x] **Performance Requirements - Runtime Performance**: Core goal - achieve 60 FPS with reduced CPU usage, eliminate memory leaks via proper cleanup
- [x] **Performance Requirements - Optimization**: Consolidates 5-6 animation loops to 1, maintains existing lazy-loading patterns (visibility checks)
- [x] **Performance Requirements - Monitoring**: Leverages existing FPS monitoring in VisualUpdateScheduler, performance tracked via browser DevTools

**Violations**: None. This is a performance optimization refactoring that strengthens adherence to performance constitution principles.

**Pre-Research Gate**: ✅ PASSED

## Project Structure

### Documentation (this feature)

```text
specs/007-visual-update-scheduler/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── types.ts         # TypeScript interfaces for scheduler integration
│   └── validation.ts    # Runtime validation for subscription lifecycle
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── visualization/
│   ├── VisualUpdateScheduler.ts      # Existing centralized scheduler (NO CHANGES except FR-011, FR-012, FR-013)
│   ├── scheduler.ts                  # NEW: Singleton instance export
│   └── types.ts                      # Existing types (SubscriptionHandle, IVisualUpdateScheduler)
├── canvas/
│   ├── Canvas.ts                     # MODIFIED: Migrate to scheduler
│   ├── displays/
│   │   ├── OscilloscopeDisplay.ts    # MODIFIED: Migrate to scheduler
│   │   ├── SequencerDisplay.ts       # MODIFIED: Migrate to scheduler
│   │   └── ColliderDisplay.ts        # Check if uses animation loop
│   └── ...
├── components/
│   └── utilities/
│       └── Collider.ts               # MODIFIED: Migrate to scheduler
└── main.ts                           # MODIFIED: Initialize scheduler singleton at startup

docs/
└── performance-issues-macos.md       # Existing performance documentation (reference)
```

**Structure Decision**: This is an internal refactoring affecting 4-5 files. No new modules or features added - only migration of existing animation loops to centralized scheduler infrastructure.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. All constitution principles are met or strengthened by this refactoring.

---

## Phase 0: Research Complete

**Output**: [research.md](./research.md)

**Key Decisions**:
1. Background tab handling: Page Visibility API with automatic pause/resume
2. Error handling: Try-catch with component ID logging
3. Concurrent lifecycle: Deferred removal pattern
4. Throttling: Component-level timestamp tracking (no scheduler changes)
5. Singleton: Export from scheduler.ts, initialize in main.ts
6. Verification: Multi-tool approach (Activity Monitor + DevTools)
7. Rollback: Direct migration acceptable, feature flags optional

**Status**: ✅ Complete - All research questions resolved

---

## Phase 1: Design & Contracts Complete

**Outputs**:
- [data-model.md](./data-model.md) - Runtime entity relationships and state machines
- [contracts/types.ts](./contracts/types.ts) - TypeScript type definitions
- [contracts/validation.ts](./contracts/validation.ts) - Runtime validation rules
- [quickstart.md](./quickstart.md) - Developer migration guide

**Key Design Decisions**:
1. **Entity Model**: Scheduler (singleton) → SubscriptionMetadata (internal) → SubscriptionHandle (returned to components)
2. **Lifecycle Management**: Deferred removal pattern prevents concurrent modification
3. **Error Isolation**: Each callback wrapped in try-catch, errors logged with component ID
4. **Performance Tracking**: Leverages existing FPS monitoring in VisualUpdateScheduler
5. **Migration Pattern**: Component-level throttling, visibility checks preserved

**Status**: ✅ Complete

---

## Post-Design Constitution Check

Re-checking constitution compliance after design decisions:

- [x] **Code Quality - Readability and Maintainability**: Design preserves existing patterns, deferred removal pattern is well-documented standard approach
- [x] **Code Quality - Code Organization**: Singleton pattern isolates scheduler initialization, clear separation of concerns maintained
- [x] **Code Quality - Code Standards**: TypeScript types fully defined in contracts/, validation rules enforce runtime checks
- [x] **Testing Standards**: Quickstart provides comprehensive testing checklist (visual, performance, memory)
- [x] **Performance Requirements - Runtime Performance**: Design achieves 60 FPS target, CPU reduction validated via multi-tool approach
- [x] **Performance Requirements - Optimization**: Component-level throttling maintains existing optimizations without scheduler complexity
- [x] **Performance Requirements - Monitoring**: Performance metrics defined, validation checklist ensures measurement

**Post-Design Gate**: ✅ PASSED

**Design-Phase Improvements**:
- Added comprehensive validation rules (contracts/validation.ts)
- Defined structured error context for logging (FR-012)
- Added leak detector for proactive memory leak warnings
- Documented 4 common migration patterns in quickstart

---

## Implementation Readiness

### Files to Modify

1. **src/visualization/scheduler.ts** (NEW)
   - Create singleton instance export
   - ~5 lines of code

2. **src/visualization/VisualUpdateScheduler.ts** (ENHANCED)
   - Add FR-011: Page Visibility API pause/resume
   - Add FR-012: Enhanced error logging with component ID
   - Add FR-013: Deferred removal pattern
   - ~50 lines of code added/modified

3. **src/main.ts** (MODIFIED)
   - Initialize scheduler singleton at startup
   - ~3 lines of code

4. **src/canvas/Canvas.ts** (MIGRATED)
   - Remove independent animation loop
   - Subscribe to centralized scheduler
   - Update destroy method
   - ~20 lines modified

5. **src/canvas/displays/OscilloscopeDisplay.ts** (MIGRATED)
   - Remove independent animation loop
   - Subscribe to centralized scheduler
   - Update destroy method
   - ~20 lines modified

6. **src/canvas/displays/SequencerDisplay.ts** (MIGRATED)
   - Remove independent animation loop
   - Subscribe to centralized scheduler
   - Update destroy method
   - ~20 lines modified

7. **src/components/utilities/Collider.ts** (MIGRATED)
   - Remove independent animation loop
   - Subscribe to centralized scheduler
   - Update destroy method
   - ~20 lines modified

**Total Estimated Changes**: ~155 lines across 7 files

### Risk Assessment

**Low Risk**:
- Existing VisualUpdateScheduler already tested and working
- Component-level throttling preserves existing behavior
- Migration pattern is straightforward and repeatable
- Easy to verify success (CPU usage, FPS, visual checks)

**Mitigations**:
- Migrate components one at a time
- Test each component after migration
- Performance profiling after each component
- Rollback plan: Git revert single component if issues found

---

## Next Steps

1. **Run `/speckit.tasks`** to generate detailed implementation tasks
2. **Implement** using quickstart guide as reference
3. **Test** using verification checklists in quickstart
4. **Measure** CPU usage, FPS, and memory before/after
5. **Document** results in docs/performance-issues-macos.md
6. **Update** CLAUDE.md with completion status

---

## Summary

**Planning Complete**: ✅

All planning phases finished:
- ✅ Technical Context defined
- ✅ Constitution Check passed (pre and post design)
- ✅ Phase 0: Research completed
- ✅ Phase 1: Design & Contracts completed
- ✅ Agent context updated (CLAUDE.md)

**Ready for**: `/speckit.tasks` to generate implementation checklist

**Estimated Effort**: 4-6 hours (as documented in performance-issues-macos.md)

**Success Criteria**: Clearly defined and measurable (see spec.md Success Criteria section)
