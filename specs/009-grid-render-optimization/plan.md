# Implementation Plan: Grid Rendering Performance Optimization

**Branch**: `009-grid-render-optimization` | **Date**: 2026-01-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-grid-render-optimization/spec.md`

## Summary

Optimize grid rendering to eliminate zoom-dependent CPU usage spikes. Current implementation renders all grid lines every frame (60 FPS), causing CPU usage to double from 20% to 45% when zooming from 200% to 50% due to exponential increase in visible lines (75 → 300 lines). Solution combines adaptive Level-of-Detail (LOD) grid spacing with offscreen canvas caching to achieve 60-70% CPU reduction at low zoom levels while maintaining 60 FPS and visual quality.

**Primary Requirement**: Reduce grid rendering CPU usage to below 25% at all zoom levels (FR-001) while maintaining 60 FPS (FR-002) and preserving snap-to-grid functionality (FR-004).

**Technical Approach**: Two-phase implementation - Phase 1 implements adaptive grid spacing (LOD) for immediate 50-60% CPU reduction with minimal code changes. Phase 2 adds offscreen canvas caching for additional 20-30% reduction, bringing total improvement to 60-70%.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target
**Primary Dependencies**:
- Canvas 2D API (browser-native, no external libraries)
- Existing VisualUpdateScheduler (centralized 60 FPS animation loop)
- Existing Viewport class (zoom/pan state management)
**Storage**: No data persistence required (runtime optimization only)
**Testing**: Manual performance testing with Chrome DevTools Performance profiler, visual regression testing
**Target Platform**: Modern browsers (Chrome, Safari, Firefox, Edge) with Canvas 2D support
**Project Type**: Single-page web application (modular synthesizer) with Canvas-based UI
**Performance Goals**:
- CPU usage <25% at all zoom levels (currently 20% at 200%, 45% at 50%, 60%+ at 25%)
- Maintain 60 FPS at all zoom levels
- Memory overhead <10MB (1080p), <20MB (4K)
**Constraints**:
- Existing snap-to-grid functionality must remain unchanged (20px base grid)
- Canvas rendering pipeline must maintain 60 FPS target
- No visual quality degradation
- Backward compatible (no API changes to Canvas or Viewport classes)
**Scale/Scope**: Single Canvas class modification, affects all users during zoom/pan operations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: Project Constitution from `.specify/memory/constitution.md`

Verify feature compliance with Project Constitution principles:

- [x] **Readability and Maintainability**: Code uses clear variable names (gridDirty, lastGridZoom, gridCanvas). Complex caching logic will include explanatory comments on "why" (performance optimization). Functions remain under 50 lines. No deep nesting (max 2 levels in cache invalidation logic).
- [x] **Code Organization**: Changes isolated to Canvas.ts renderGrid() method and private helper methods. Clear separation of concerns (rendering vs caching). Minimal dependencies (only Viewport for state).
- [x] **Code Standards**: TypeScript with strict typing. Uses existing constants (CANVAS.GRID_SIZE, COLORS.GRID). No magic numbers (all thresholds defined as named constants). Removes debug console.log statements before commit.
- [x] **Performance Requirements**: Directly addresses runtime performance (target: 60 FPS maintained, CPU <25%). Implements caching strategy. No memory leaks (proper canvas disposal on resize). This feature IS the performance optimization.
- [x] **Code Review Standards**: Changes require review with performance testing validation. Must measure before/after CPU usage at different zoom levels. Performance profiling evidence required.

**No Constitution violations** - This is a focused performance optimization within existing Canvas rendering system.

## Project Structure

### Documentation (this feature)

```text
specs/009-grid-render-optimization/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: Solution analysis (references existing analysis doc)
├── data-model.md        # Not applicable (no data models)
├── quickstart.md        # Phase 1: Developer guide for grid rendering optimization
├── contracts/           # Not applicable (no API contracts)
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
src/
├── canvas/
│   ├── Canvas.ts                    # PRIMARY: Grid rendering optimization
│   │   ├── renderGrid()             # Modified: Add LOD logic
│   │   ├── renderGridToCache()      # New: Offscreen canvas rendering
│   │   ├── checkGridDirty()         # New: Cache invalidation logic
│   │   ├── initGridCanvas()         # New: Offscreen canvas setup
│   │   ├── resizeCanvas()           # Modified: Resize grid cache
│   │   └── render()                 # Modified: Use cached grid
│   └── Viewport.ts                  # No changes (read-only access to zoom/pan)
├── utils/
│   └── constants.ts                 # Modified: Add GRID_LOD_THRESHOLDS, GRID_FADE_THRESHOLD
└── styles/
    └── main.css                     # No changes

docs/
└── research/
    └── grid-rendering-performance-issue.md  # Existing analysis (reference only)
```

**Structure Decision**: Performance optimization focused entirely within Canvas.ts. No new modules needed. Constants added to existing constants.ts for LOD thresholds (0.75, 0.50, 0.25) and opacity fade threshold (0.5). Changes are backward compatible and require no modifications to consuming code.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations to track - all constitution principles satisfied.*

---

## Phase 0: Research & Solution Analysis

**Status**: ✅ COMPLETE (existing analysis at `docs/research/grid-rendering-performance-issue.md`)

The comprehensive performance analysis has already been completed and documents:

1. **Root Cause**: Fixed 20px grid with no caching causes exponential increase in draw operations when zoomed out (75 lines at 200% → 300 lines at 50% → 600 lines at 25%)
2. **Proposed Solutions**:
   - Solution 1: Offscreen canvas caching (30-40% CPU reduction)
   - Solution 2: Adaptive LOD grid spacing (50-60% CPU reduction)
   - Solution 3: Combined LOD + Caching (60-70% CPU reduction) ⭐ BEST
   - Solution 4: Dot grid (20-30% reduction, out of scope)
3. **Implementation Plan**: Two-phase approach (LOD first, then caching)
4. **Performance Targets**: Detailed CPU reduction expectations per zoom level

### Research Findings Summary

**Decision**: Implement combined LOD + Caching approach (Solution 3)

**Rationale**:
- **LOD provides immediate value**: 50-60% CPU reduction with minimal code changes (2-3 hours)
- **Caching compounds benefit**: Additional 20-30% reduction for total 60-70% improvement
- **Phased approach reduces risk**: LOD can be validated independently before adding caching complexity
- **No memory concerns**: 8-10MB overhead is acceptable for modern systems
- **Visual quality maintained**: Adaptive spacing actually improves UX by preventing grid clutter

**Alternatives Considered**:
- **LOD only**: Good but leaves performance on table (only 50-60% vs 60-70%)
- **Caching only**: Complex without LOD benefits, still renders too many lines
- **WebGL rewrite**: Massive effort (5+ months) for similar gains, text rendering nightmare
- **Dot grid**: Different UX, lower gains (20-30%), can be future enhancement

### Technical Decisions

#### LOD Threshold Values

| Zoom Range | Grid Spacing | Rationale |
|------------|-------------|-----------|
| ≥75% | 20px (base) | Full detail needed for precise alignment |
| 50-75% | 40px (2x) | Moderate spacing, still useful for reference |
| 25-50% | 80px (4x) | Wide spacing prevents clutter at far zoom |
| <25% | Hidden | Grid becomes visual noise, no alignment value |

**Opacity Fading**: Progressive fade from 100% opacity at 50% zoom to 0% at 25% zoom for smooth visual transitions.

#### Cache Invalidation Thresholds

| Trigger | Threshold | Rationale |
|---------|-----------|-----------|
| Zoom change | >0.001 | Detects meaningful zoom changes (0.1% sensitivity) |
| Pan change | >20px (1 grid cell) | Only invalidate when new grid lines appear |
| Resize | Any change | Canvas dimensions changed, cache must be recreated |

**Cache Strategy**: Mark-dirty + lazy regeneration. Check on every frame, regenerate only when dirty flag set.

#### Memory Management

- **Offscreen canvas size**: Match main canvas dimensions (auto-scales with DPR)
- **Memory limit**: ~8MB for 1920x1080, ~20MB for 4K (RGBA channels)
- **Disposal strategy**: Recreate canvas on resize, set old reference to null for GC
- **Monitoring**: No runtime monitoring needed (one-time allocation)

---

## Phase 1: Design & Implementation Planning

### Modified Files

#### 1. `src/canvas/Canvas.ts` (PRIMARY)

**New Private Properties**:
```typescript
// Grid caching
private gridCanvas: HTMLCanvasElement | null = null;
private gridCtx: CanvasRenderingContext2D | null = null;
private gridDirty: boolean = true;
private lastGridZoom: number = 0;
private lastGridPan: { x: number; y: number } = { x: 0, y: 0 };
```

**New Methods**:
- `initGridCanvas()`: Create offscreen canvas matching main canvas dimensions
- `renderGridToCache()`: Render grid to offscreen canvas using LOD logic
- `checkGridDirty()`: Compare current zoom/pan to cached state, mark dirty if thresholds exceeded

**Modified Methods**:
- `renderGrid()`: Replace with LOD logic (adaptive grid spacing based on zoom)
- `render()`: Check dirty, regenerate cache if needed, blit cached grid via drawImage()
- `resizeCanvas()`: Resize grid cache to match new dimensions, mark dirty

**LOD Logic (in renderGridToCache)**:
```typescript
const zoom = this.viewport.getZoom();

// Determine grid spacing based on zoom level
let gridSize = CANVAS.GRID_SIZE; // Default 20px
if (zoom < GRID_LOD_THRESHOLDS.ZOOM_50) {
  gridSize = CANVAS.GRID_SIZE * 4; // 80px at <50% zoom
} else if (zoom < GRID_LOD_THRESHOLDS.ZOOM_75) {
  gridSize = CANVAS.GRID_SIZE * 2; // 40px at 50-75% zoom
}

// Hide grid below 25% zoom
if (zoom < GRID_LOD_THRESHOLDS.ZOOM_25) {
  return; // No rendering
}

// Apply opacity fade between 25-50% zoom
const opacity = Math.min(1.0, zoom / GRID_FADE_THRESHOLD);
this.gridCtx.globalAlpha = opacity;
```

**Cache Invalidation Logic (in checkGridDirty)**:
```typescript
const currentZoom = this.viewport.getZoom();
const currentPan = this.viewport.getPan();

// Mark dirty if zoom changed beyond threshold
if (Math.abs(currentZoom - this.lastGridZoom) > 0.001) {
  this.gridDirty = true;
}

// Mark dirty if pan moved more than 1 grid cell
const panDeltaX = Math.abs(currentPan.x - this.lastGridPan.x);
const panDeltaY = Math.abs(currentPan.y - this.lastGridPan.y);
if (panDeltaX > CANVAS.GRID_SIZE || panDeltaY > CANVAS.GRID_SIZE) {
  this.gridDirty = true;
}
```

#### 2. `src/utils/constants.ts`

**New Constants**:
```typescript
// Grid Level-of-Detail thresholds
export const GRID_LOD_THRESHOLDS = {
  ZOOM_25: 0.25,  // Hide grid below this
  ZOOM_50: 0.50,  // 4x spacing (80px) below this
  ZOOM_75: 0.75,  // 2x spacing (40px) below this
  // Above 0.75: base 20px spacing
};

// Grid opacity fade threshold
export const GRID_FADE_THRESHOLD = 0.5; // Start fading below 50% zoom
```

### Testing Strategy

#### Performance Testing (Manual with Chrome DevTools)

1. **Baseline Measurement** (before optimization):
   - Open Chrome DevTools → Performance tab
   - Record performance at 200%, 100%, 50%, 25% zoom
   - Document CPU usage % and FPS for each zoom level
   - Take screenshot of Performance timeline showing grid rendering cost

2. **Post-LOD Measurement** (after Phase 1):
   - Repeat same test at all zoom levels
   - Verify CPU reduction: 50% zoom should drop from 45% to ~20%
   - Verify 60 FPS maintained at all zoom levels
   - Verify visual: grid spacing adapts correctly

3. **Post-Caching Measurement** (after Phase 2):
   - Repeat same test at all zoom levels
   - Verify additional CPU reduction: 50% zoom should drop to ~12%
   - Verify cache invalidation: zoom/pan triggers regeneration only when needed
   - Monitor memory: heap snapshot should show <10MB increase (1080p)

#### Visual Regression Testing (Manual)

1. **Grid Appearance**:
   - At 200% zoom: verify grid lines at 20px spacing
   - At 100% zoom: verify grid lines at 20px spacing
   - At 75% zoom: verify grid lines at 40px spacing (2x)
   - At 50% zoom: verify grid lines at 80px spacing (4x)
   - At 25% zoom: verify grid is hidden or very faint

2. **Snap-to-Grid Validation**:
   - Place component at 200% zoom, note position
   - Zoom to 50% zoom (visual grid is 80px, but snap should be 20px)
   - Drag component, verify it snaps to 20px increments (not 80px visual grid)
   - Zoom back to 200%, verify component aligns to same grid position

3. **Transition Smoothness**:
   - Zoom from 200% to 25% slowly
   - Verify no jarring visual changes at LOD thresholds (75%, 50%, 25%)
   - Verify opacity fades smoothly between 50% and 25%

#### Memory Leak Testing (Manual)

1. **Heap Profiling**:
   - Open Chrome DevTools → Memory tab
   - Take heap snapshot (initial)
   - Zoom/pan for 30 minutes continuously
   - Take heap snapshot (after 30 min)
   - Compare heap sizes: should be within 10% variance
   - Check Detached DOM Elements: grid canvas should not accumulate

2. **Resize Testing**:
   - Take heap snapshot
   - Resize browser window 10 times
   - Take heap snapshot
   - Verify old grid canvases are garbage collected (no retention)

### Success Criteria Validation

Map each Success Criterion to test procedure:

| SC | Criterion | Test Method | Pass Threshold |
|----|-----------|-------------|----------------|
| SC-001 | CPU <25% at all zoom levels | DevTools Performance profiler | All zoom levels show <25% CPU |
| SC-002 | 60 FPS maintained | DevTools Performance profiler | No dropped frames, consistent 60 FPS |
| SC-003 | 50% zoom CPU 45%→20% | DevTools Performance profiler | CPU at 50% zoom ≤20% |
| SC-004 | 25% zoom CPU 60%→15% | DevTools Performance profiler | CPU at 25% zoom ≤15% |
| SC-005 | Memory <10MB (1080p) | DevTools Memory profiler | Heap increase ≤10MB |
| SC-006 | 95% redraw reduction | Cache hit rate logging | Redraws only on zoom/pan threshold |
| SC-007 | Smooth zoom transitions | Visual inspection | No jarring LOD threshold changes |
| SC-008 | Pixel-perfect alignment | Component placement test | Same position at all zoom levels |
| SC-009 | Consistent visual density | Visual inspection | Similar line count on screen 75-200% |
| SC-010 | No memory leaks | 30-min heap profiling | Heap stable within 10% |

---

## Phase 2: Implementation Sequence

### Task 1: Add LOD Constants (5 min)

**File**: `src/utils/constants.ts`

Add GRID_LOD_THRESHOLDS and GRID_FADE_THRESHOLD constants.

**Acceptance**: Constants compile, no TS errors.

---

### Task 2: Implement Adaptive Grid Spacing (LOD) (2-3 hours)

**File**: `src/canvas/Canvas.ts`

**Steps**:
1. Modify `renderGrid()` method
2. Add zoom-based grid size selection logic
3. Add zoom-based opacity fading
4. Test visually at all zoom levels

**Acceptance**:
- Grid spacing adapts at 75%, 50%, 25% thresholds
- Opacity fades smoothly below 50% zoom
- Snap-to-grid still uses 20px base grid
- CPU usage reduced by 50-60% at 50% zoom

---

### Task 3: Add Grid Cache Infrastructure (1 hour)

**File**: `src/canvas/Canvas.ts`

**Steps**:
1. Add private properties (gridCanvas, gridCtx, gridDirty, lastGridZoom, lastGridPan)
2. Implement `initGridCanvas()` method
3. Call `initGridCanvas()` in constructor
4. No rendering changes yet (cache not used)

**Acceptance**:
- Offscreen canvas created on Canvas initialization
- Canvas dimensions match main canvas
- No visual changes (cache not active yet)

---

### Task 4: Implement Cache Invalidation Logic (1 hour)

**File**: `src/canvas/Canvas.ts`

**Steps**:
1. Implement `checkGridDirty()` method
2. Add zoom threshold check (0.001 delta)
3. Add pan threshold check (20px delta)
4. Test with console.log to verify dirty flag updates

**Acceptance**:
- Dirty flag set when zoom changes >0.001
- Dirty flag set when pan moves >20px
- Dirty flag not set for sub-threshold changes

---

### Task 5: Implement Grid Cache Rendering (2 hours)

**File**: `src/canvas/Canvas.ts`

**Steps**:
1. Create `renderGridToCache()` method
2. Move grid rendering logic from `renderGrid()` to `renderGridToCache()`
3. Render to offscreen canvas instead of main canvas
4. Apply viewport transform to offscreen context
5. Mark dirty=false and store last zoom/pan after rendering

**Acceptance**:
- Grid renders to offscreen canvas
- Offscreen canvas matches main canvas viewportTransform
- Visual appearance unchanged (using temp drawImage in render())

---

### Task 6: Integrate Cache into Main Render Loop (1 hour)

**File**: `src/canvas/Canvas.ts`

**Steps**:
1. Modify `render()` method
2. Add `checkGridDirty()` call before grid rendering
3. Replace `renderGrid()` with `renderGridToCache()` + `drawImage()`
4. Only regenerate cache if dirty flag set

**Acceptance**:
- Cache regenerates only when zoom/pan thresholds exceeded
- drawImage() blits cached grid every frame (fast)
- Visual appearance identical to pre-caching
- CPU usage reduced by additional 20-30% at 50% zoom

---

### Task 7: Handle Canvas Resize (30 min)

**File**: `src/canvas/Canvas.ts`

**Steps**:
1. Modify `resizeCanvas()` method
2. Resize gridCanvas to match new dimensions
3. Mark gridDirty=true to force regeneration
4. Test by resizing browser window

**Acceptance**:
- Grid cache resizes with main canvas
- No visual artifacts during resize
- Grid regenerates correctly after resize
- No memory leaks (old canvas GC'd)

---

### Task 8: Performance Validation (2 hours)

**Tools**: Chrome DevTools Performance profiler, Memory profiler

**Steps**:
1. Run baseline performance tests (document current CPU at all zoom levels)
2. Run post-LOD tests (verify 50-60% reduction)
3. Run post-caching tests (verify additional 20-30% reduction)
4. Run memory leak tests (30 min continuous zoom/pan, heap snapshot comparison)
5. Document all results with screenshots

**Acceptance**:
- All Success Criteria (SC-001 through SC-010) validated and documented
- Performance metrics logged in test summary document

---

### Task 9: Code Review Prep (1 hour)

**Steps**:
1. Remove all console.log debug statements
2. Add JSDoc comments to new methods (initGridCanvas, renderGridToCache, checkGridDirty)
3. Ensure variable names are clear (gridDirty not just "dirty")
4. Add "why" comments for complex cache invalidation logic
5. Run `npm run lint` and fix all warnings

**Acceptance**:
- No console.log statements
- All new methods have JSDoc
- Linting passes with 0 warnings
- Code follows existing Canvas.ts style

---

## Phase 3: Documentation & Knowledge Transfer

### Developer Quickstart Guide

Create `specs/009-grid-render-optimization/quickstart.md` with:

1. **Problem Statement**: Why grid rendering was slow (exponential line count)
2. **Solution Overview**: LOD + Caching approach
3. **Code Walkthrough**: Explain each new method and its purpose
4. **Performance Results**: Before/after CPU metrics
5. **Future Enhancements**: Dot grid option, user preferences for grid visibility
6. **Debugging Tips**: How to verify cache invalidation is working

### Integration Notes

**For Future Developers**:
- Grid cache is automatically managed, no external API changes
- Snap-to-grid remains at 20px regardless of visual grid spacing
- Cache invalidation thresholds are configurable in constants.ts
- Memory overhead is ~8-10MB (1080p), ~20MB (4K) - acceptable for modern systems

**Potential Future Work**:
- Add user preference for grid visibility (toggle in UI)
- Implement dot grid as alternative style (user preference)
- Extend LOD to other canvas elements (connections, components) if needed
- Add performance monitoring dashboard (track CPU/FPS in production)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cache invalidation too aggressive (invalidates too often) | Performance gain reduced | Tune thresholds based on profiling, use larger deltas (0.01 zoom, 40px pan) |
| Cache invalidation too conservative (misses updates) | Visual artifacts (stale grid) | Add safety check: force invalidate every N frames (e.g., every 60 frames = 1 sec) |
| Memory overhead on low-end devices | Browser slowdown/crash | Monitor heap size, add memory limit check before creating large caches |
| LOD threshold transitions jarring visually | User distraction during zoom | Add smooth interpolation between LOD levels (blend two grid spacings during transition) |
| Snap-to-grid confusion with adaptive visual grid | User reports "grid not working" | Ensure documentation clearly states snap grid is always 20px, add tooltip/help text |
| Device pixel ratio (DPR) not respected | Blurry grid on Retina displays | Multiply canvas dimensions by DPR, ensure gridCtx scales accordingly |

---

## Rollback Plan

If performance gains are insufficient or bugs found:

1. **Phase 1 Rollback (LOD only)**:
   - Revert `renderGrid()` to original fixed 20px spacing
   - Remove LOD constants from constants.ts
   - No cache infrastructure changed (Phase 2 not started)

2. **Phase 2 Rollback (Caching)**:
   - Comment out cache usage in `render()` method
   - Keep LOD changes (Phase 1) active
   - Revert to direct rendering (bypass drawImage call)

3. **Full Rollback**:
   - Checkout original Canvas.ts from main branch
   - Remove LOD constants from constants.ts
   - No data loss (runtime optimization only, no persistence)

**Detection**: Monitor user reports of visual artifacts, frame drops, or high memory usage. If CPU usage does not meet targets (<25% at all zoom levels), rollback and re-evaluate solution approach.

---

## Success Metrics

**Primary KPIs** (from Success Criteria):
- CPU usage <25% at all zoom levels ✅ Target
- 60 FPS maintained across all zoom interactions ✅ Target
- Memory overhead <10MB (1080p), <20MB (4K) ✅ Target
- No memory leaks after 30 min usage ✅ Target

**Secondary KPIs**:
- Cache hit rate >95% (redraws only when zoom/pan thresholds exceeded)
- Visual grid density consistent across 75-200% zoom range
- Snap-to-grid alignment pixel-perfect at all zoom levels

**Post-Launch Monitoring**:
- Track user reports of performance issues (expect decrease)
- Monitor browser console errors related to grid rendering (expect none)
- Gather user feedback on visual grid changes (expect positive or neutral)

---

## Appendix: Performance Analysis Summary

**Current Performance** (No Optimization):

| Zoom | Grid Lines | CPU | FPS | Frame Time | Grid Render % |
|------|-----------|-----|-----|------------|--------------|
| 200% | 75 | 20% | 60 | 16.7ms | 15-20% |
| 100% | 150 | 30% | 60 | 16.7ms | 25-30% |
| 50% | 300 | 45% | 60 | 16.7ms | 40-50% |
| 25% | 600 | 60%+ | 55-60 | 17-20ms | 50-60% |

**Expected Performance** (LOD + Caching):

| Zoom | Grid Lines (LOD) | CPU | FPS | Frame Time | Grid Render % |
|------|-----------------|-----|-----|------------|--------------|
| 200% | 75 (cached) | 15% | 60 | 16.7ms | 5% |
| 100% | 150 (cached) | 20% | 60 | 16.7ms | 10% |
| 50% | 38 (cached, 80px spacing) | 12% | 60 | 16.7ms | 5% |
| 25% | 0 (hidden) | 8% | 60 | 16.7ms | 0% |

**Improvement Summary**:
- 50% zoom: **45% → 12% CPU** (73% reduction) ✅ Exceeds SC-003 target
- 25% zoom: **60%+ → 8% CPU** (87% reduction) ✅ Exceeds SC-004 target
- Cache hit rate: **95%+** (redraws <5% of frames) ✅ Meets SC-006 target
- Memory overhead: **~8-10MB** (1080p) ✅ Meets SC-005 target

**Root Cause Resolution**:
- Eliminated 60 FPS × 300 lines = 18,000 draw ops/sec at 50% zoom
- Replaced with 60 FPS × 1 blit = 60 ops/sec (99.7% reduction in draw calls)
- LOD reduced line count by 75% (300 → 38 at 50% zoom)
- Combined effect: 60-70% total CPU reduction while maintaining visual quality
