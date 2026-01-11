# Research Summary: Grid Rendering Performance Optimization

**Date**: 2026-01-11
**Feature**: Grid Rendering Performance Optimization
**Reference**: Full analysis at `docs/research/grid-rendering-performance-issue.md`

## Problem Statement

Grid rendering performance degrades exponentially when zooming out, causing CPU usage to double from 20% at 200% zoom to 45% at 50% zoom. The root cause is that the current implementation renders all visible grid lines every frame (60 FPS) with a fixed 20px spacing, resulting in 4x more lines at 50% zoom (300 lines) compared to 200% zoom (75 lines).

## Root Cause Analysis

**Current Implementation**:
- Fixed 20px grid spacing regardless of zoom level
- All grid lines redrawn every frame (60 FPS)
- No caching mechanism
- Number of lines scales linearly with visible viewport area

**Performance Impact**:

| Zoom Level | Visible Lines | Draw Operations/sec | CPU Usage |
|------------|--------------|---------------------|-----------|
| 200% | 75 | 4,500 | 20% |
| 100% | 150 | 9,000 | 30% |
| 50% | 300 | 18,000 | 45% |
| 25% | 600 | 36,000 | 60%+ |

At 50% zoom, grid rendering consumes 40-50% of the frame budget (6-8ms out of 16.7ms at 60 FPS).

## Solution Analysis

### Option 1: Offscreen Canvas Caching

**Approach**: Render grid to offscreen canvas once, blit to main canvas every frame using `drawImage()`.

**Benefits**:
- Grid drawn once per zoom/pan change (not 60 times/second)
- `drawImage()` is GPU-accelerated and extremely fast
- Expected CPU reduction: 30-40% at low zoom levels

**Drawbacks**:
- Memory overhead: ~8MB (1920x1080), ~20MB (4K)
- Cache invalidation logic complexity

**Estimated Effort**: 4-6 hours

---

### Option 2: Adaptive Level-of-Detail (LOD)

**Approach**: Increase grid spacing when zoomed out to maintain consistent visual density.

**LOD Thresholds**:

| Zoom Range | Grid Spacing | Line Count (1080p) | Reduction |
|------------|-------------|-------------------|-----------|
| ≥75% | 20px (base) | 150 | Baseline |
| 50-75% | 40px (2x) | 75 | 50% |
| 25-50% | 80px (4x) | 38 | 75% |
| <25% | Hidden | 0 | 100% |

**Benefits**:
- Dramatically reduces line count when zoomed out (75% reduction at 50% zoom)
- Improves UX (prevents visual clutter)
- Expected CPU reduction: 50-60% at low zoom levels
- Simple implementation, no memory overhead

**Drawbacks**:
- Visual grid spacing changes (but snap-to-grid remains constant)
- Requires opacity fading for smooth transitions

**Estimated Effort**: 2-3 hours

---

### Option 3: Combined LOD + Caching (SELECTED)

**Approach**: Use both adaptive grid spacing AND offscreen canvas caching.

**Benefits**:
- Maximum performance improvement: 60-70% CPU reduction
- Best visual quality (LOD prevents clutter, caching ensures speed)
- Responsive at all zoom levels

**Implementation Strategy**:
- Phase 1: Implement LOD (immediate 50-60% gain, low risk)
- Phase 2: Add caching (additional 20-30% gain)

**Estimated Effort**: 6-8 hours total

---

### Option 4: Dot Grid (OUT OF SCOPE)

**Approach**: Render dots at grid intersections instead of lines.

**Benefits**:
- Less visual clutter
- 20-30% CPU reduction

**Drawbacks**:
- Different visual style (UX change)
- Lower performance gains than LOD+Caching

**Decision**: Defer to future enhancement (user preference toggle)

---

## Selected Solution: Combined LOD + Caching

### Decision Rationale

1. **Phased approach reduces risk**: LOD can be validated independently before adding caching
2. **Maximum performance gain**: 60-70% total CPU reduction (50-60% from LOD, additional 20-30% from caching)
3. **Improved UX**: Adaptive spacing actually prevents grid clutter at far zoom
4. **Acceptable memory overhead**: 8-10MB is reasonable for modern systems
5. **Backward compatible**: No API changes, snap-to-grid unchanged

### Technical Implementation Details

#### LOD Threshold Selection

**Chosen Thresholds**:
- **75% zoom**: Transition from 20px to 40px spacing
- **50% zoom**: Transition from 40px to 80px spacing
- **25% zoom**: Hide grid entirely

**Rationale**:
- 75%: Moderate zoom-out, 2x spacing maintains visual utility
- 50%: Far zoom-out, 4x spacing prevents visual clutter
- 25%: Extremely far zoom, grid becomes noise

#### Opacity Fading

**Strategy**: Progressive fade from 100% opacity at 50% zoom to 0% at 25% zoom.

**Formula**: `opacity = min(1.0, currentZoom / 0.5)`

**Rationale**: Smooth visual transition prevents jarring disappearance of grid.

#### Cache Invalidation Thresholds

**Zoom Change Threshold**: 0.001 (0.1% zoom change)
- Sensitive enough to catch meaningful changes
- Not so sensitive as to invalidate on every pixel of zoom

**Pan Change Threshold**: 20px (1 grid cell)
- Only invalidate when new grid lines would appear
- Prevents invalidation during minor viewport adjustments

**Resize Trigger**: Any canvas dimension change
- Canvas size changed, cache must match new dimensions

#### Cache Strategy

**Mark-Dirty + Lazy Regeneration**:
1. Check on every frame (60 FPS)
2. Compare current zoom/pan to cached state
3. Mark `gridDirty=true` if thresholds exceeded
4. Regenerate only when dirty flag set
5. Blit cached grid every frame via `drawImage()`

**Memory Management**:
- Offscreen canvas matches main canvas dimensions (auto-scales with DPR)
- On resize: set old canvas reference to null (enables GC), create new canvas
- No runtime monitoring needed (one-time allocation per canvas size)

---

## Performance Expectations

### Baseline (Current)

| Zoom | CPU | FPS | Grid Render Time |
|------|-----|-----|-----------------|
| 200% | 20% | 60 | 2.5-3.3ms |
| 100% | 30% | 60 | 4.2-5.0ms |
| 50% | 45% | 60 | 6.7-8.3ms |
| 25% | 60%+ | 55-60 | 8.3-10ms+ |

### Post-LOD (Phase 1)

| Zoom | CPU | FPS | Grid Render Time | Improvement |
|------|-----|-----|-----------------|-------------|
| 200% | 20% | 60 | 2.5-3.3ms | 0% (baseline) |
| 100% | 30% | 60 | 4.2-5.0ms | 0% (baseline) |
| 50% | 20% | 60 | 1.7-2.5ms | **-56% CPU** |
| 25% | 10% | 60 | 0ms | **-83% CPU** |

### Post-Caching (Phase 2)

| Zoom | CPU | FPS | Grid Render Time | Improvement |
|------|-----|-----|-----------------|-------------|
| 200% | 15% | 60 | 0.8-1.2ms | **-25% CPU** |
| 100% | 20% | 60 | 1.2-1.7ms | **-33% CPU** |
| 50% | 12% | 60 | 0.8-1.2ms | **-73% CPU** |
| 25% | 8% | 60 | 0ms | **-87% CPU** |

---

## Implementation Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cache invalidation too aggressive | Medium | Medium | Profile and tune thresholds (increase to 0.01 zoom, 40px pan) |
| Cache invalidation too conservative | Low | High | Add safety: force invalidate every 60 frames (1 sec) |
| Memory overhead on low-end devices | Low | Medium | Monitor heap, add size limit check |
| LOD transitions jarring | Medium | Low | Add opacity interpolation during LOD crossover |
| Snap-to-grid confusion | Low | Low | Document clearly, add tooltip |
| DPR scaling issues on Retina | Low | Medium | Test on 2x DPR displays, ensure canvas scaled correctly |

---

## Alternative Approaches Considered

### WebGL Rewrite

**Rejected because**:
- Massive effort (5+ months for full rewrite)
- Text rendering nightmare in WebGL (requires SDF or texture atlases)
- Gains similar to LOD+Caching (10-20% additional at best)
- Current app renders 50-100 text labels per frame (WebGL poor fit)

### Dirty Region Tracking

**Rejected because**:
- Complex implementation (track which components changed)
- Grid is static relative to viewport (already optimized by caching)
- Minimal gains beyond caching (cache hit rate already 95%+)

### Render-to-Texture (WebGL)

**Rejected because**:
- Requires WebGL rewrite of entire rendering system
- Same drawbacks as full WebGL approach
- Caching achieves similar result with Canvas 2D

---

## Best Practices Applied

### Canvas 2D Optimization

1. **Batch draw operations**: Single `stroke()` call for all grid lines
2. **Use offscreen canvas for static content**: Grid is static relative to viewport
3. **Minimize state changes**: Set `strokeStyle`, `lineWidth` once per grid render
4. **Respect device pixel ratio**: Scale canvas by DPR for sharp rendering on Retina

### Level-of-Detail (LOD)

1. **Choose appropriate thresholds**: Based on visual utility (grid still useful at 50%, noise at 25%)
2. **Smooth transitions**: Opacity fading prevents jarring visual changes
3. **Maintain functional consistency**: Snap-to-grid always uses 20px base grid

### Caching Strategy

1. **Mark-dirty pattern**: Track state changes, invalidate only when needed
2. **Lazy regeneration**: Regenerate on-demand, not speculatively
3. **Clear invalidation conditions**: Explicit thresholds (0.001 zoom, 20px pan)
4. **Memory management**: Dispose old caches on resize for GC

---

## References

- **Full Analysis**: `docs/research/grid-rendering-performance-issue.md`
- **Canvas Performance Best Practices**: [MDN - Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- **Offscreen Canvas**: [MDN - OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
- **Device Pixel Ratio**: [MDN - Window.devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)

---

## Next Steps

1. ✅ Research complete - Solution selected (LOD + Caching)
2. ➡️ **Phase 1**: Implement LOD (2-3 hours)
3. ➡️ **Phase 2**: Add caching (4-6 hours)
4. ➡️ **Phase 3**: Performance validation and documentation
