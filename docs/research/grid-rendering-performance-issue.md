# Grid Rendering Performance Issue - Zoom-Dependent CPU Usage

**Issue Report Date:** 2026-01-11
**Severity:** HIGH
**Status:** Identified, Solution Proposed

---

## Problem Description

CPU usage on macOS is highly dependent on the zoom factor of the main canvas. When zooming out from 200% to 50%, CPU usage **doubles from 20% to 45%**. The background grid rendering is the primary culprit.

### Observed Behavior

| Zoom Level | CPU Usage | Performance Impact |
|------------|-----------|-------------------|
| 200% (zoomed in) | ~20% | Good |
| 100% (normal) | ~30% | Acceptable |
| 50% (zoomed out) | ~45% | Poor |
| 25% (far zoom out) | ~60%+ | Unacceptable |

**Key Finding:** Lower zoom = Higher CPU usage (inverse relationship)

---

## Root Cause Analysis

### Current Grid Rendering Implementation

**Location:** `src/canvas/Canvas.ts:743-773`

```typescript
private renderGrid(): void {
  const bounds = this.viewport.getVisibleBounds(
    this.canvas.clientWidth,
    this.canvas.clientHeight
  );

  const gridSize = CANVAS.GRID_SIZE; // 20 pixels
  const startX = Math.floor(bounds.x / gridSize) * gridSize;
  const startY = Math.floor(bounds.y / gridSize) * gridSize;
  const endX = Math.ceil((bounds.x + bounds.width) / gridSize) * gridSize;
  const endY = Math.ceil((bounds.y + bounds.height) / gridSize) * gridSize;

  this.ctx.strokeStyle = COLORS.GRID;
  this.ctx.lineWidth = 1 / this.viewport.getZoom();

  this.ctx.beginPath();

  // Vertical lines
  for (let x = startX; x <= endX; x += gridSize) {
    this.ctx.moveTo(x, startY);
    this.ctx.lineTo(x, endY);
  }

  // Horizontal lines
  for (let y = startY; y <= endY; y += gridSize) {
    this.ctx.moveTo(startX, y);
    this.ctx.lineTo(endX, y);
  }

  this.ctx.stroke();
}
```

### Why Zoom Out Increases CPU Usage

**The Problem:** Fixed grid size (20px) means more lines are visible when zoomed out.

**Example Calculation (1920x1080 canvas):**

#### At 200% Zoom (Zoomed In)
- Visible world area: 960 x 540 pixels
- Vertical lines: 960 / 20 = **48 lines**
- Horizontal lines: 540 / 20 = **27 lines**
- **Total: 75 lines rendered per frame**

#### At 100% Zoom (Normal)
- Visible world area: 1920 x 1080 pixels
- Vertical lines: 1920 / 20 = **96 lines**
- Horizontal lines: 1080 / 20 = **54 lines**
- **Total: 150 lines rendered per frame** (2x more)

#### At 50% Zoom (Zoomed Out)
- Visible world area: 3840 x 2160 pixels
- Vertical lines: 3840 / 20 = **192 lines**
- Horizontal lines: 2160 / 20 = **108 lines**
- **Total: 300 lines rendered per frame** (4x more)

#### At 25% Zoom (Far Zoom Out)
- Visible world area: 7680 x 4320 pixels
- Vertical lines: 7680 / 20 = **384 lines**
- Horizontal lines: 4320 / 20 = **216 lines**
- **Total: 600 lines rendered per frame** (8x more)

**Result:** Each `ctx.moveTo()` and `ctx.lineTo()` call has a cost. With 600 lines at 60 FPS, you're making **36,000 line drawing operations per second** when zoomed out!

### Additional Performance Issues

**1. No Caching**
- Grid is redrawn every frame (60 FPS)
- Grid is static relative to world coordinates
- Should be cached and only redrawn on zoom/pan

**2. Line Width Calculation**
```typescript
this.ctx.lineWidth = 1 / this.viewport.getZoom();
```
- At 50% zoom: lineWidth = 1 / 0.5 = 2 pixels
- Thicker lines are more expensive to render
- Sub-pixel line widths also cause antialiasing overhead

**3. No Level-of-Detail (LOD)**
- Grid density remains constant regardless of zoom
- At far zoom, grid becomes visual noise
- Should reduce grid density or hide entirely when zoomed out

**4. Path Complexity**
- All lines are added to a single path
- Single `stroke()` call for all lines
- While batching is good, the path becomes very complex at low zoom

---

## Performance Impact Breakdown

### CPU Time Distribution (estimated at 50% zoom)

| Operation | % of Frame Time | Notes |
|-----------|----------------|-------|
| Grid rendering | **40-50%** | 300 lines × (moveTo + lineTo) |
| Component rendering | 20-25% | 5-8 components |
| Connection rendering | 10-15% | Bezier curves |
| Text rendering | 10-15% | 50-100 labels |
| Other | 5-10% | Event handling, etc. |

**Conclusion:** Grid rendering consumes nearly half of the frame budget when zoomed out!

---

## Proposed Solutions

### Solution 1: Static Grid Caching with Offscreen Canvas ⭐ RECOMMENDED

**Concept:** Render grid to an offscreen canvas once, blit to main canvas each frame.

**Implementation:**

```typescript
class Canvas {
  private gridCanvas: HTMLCanvasElement | null = null;
  private gridCtx: CanvasRenderingContext2D | null = null;
  private gridDirty = true;
  private lastGridZoom = 0;
  private lastGridPan = { x: 0, y: 0 };

  /**
   * Initialize offscreen grid canvas
   */
  private initGridCanvas(): void {
    this.gridCanvas = document.createElement('canvas');
    this.gridCanvas.width = this.canvas.width;
    this.gridCanvas.height = this.canvas.height;
    this.gridCtx = this.gridCanvas.getContext('2d');
  }

  /**
   * Render grid to offscreen canvas (only when dirty)
   */
  private renderGridToCache(): void {
    if (!this.gridDirty || !this.gridCtx) {
      return;
    }

    // Clear offscreen canvas
    this.gridCtx.clearRect(0, 0, this.gridCanvas!.width, this.gridCanvas!.height);

    // Save and apply viewport transform
    this.gridCtx.save();
    this.viewport.applyTransform(this.gridCtx);

    // Render grid (same logic as current)
    const bounds = this.viewport.getVisibleBounds(
      this.canvas.clientWidth,
      this.canvas.clientHeight
    );

    const gridSize = CANVAS.GRID_SIZE;
    const startX = Math.floor(bounds.x / gridSize) * gridSize;
    const startY = Math.floor(bounds.y / gridSize) * gridSize;
    const endX = Math.ceil((bounds.x + bounds.width) / gridSize) * gridSize;
    const endY = Math.ceil((bounds.y + bounds.height) / gridSize) * gridSize;

    this.gridCtx.strokeStyle = COLORS.GRID;
    this.gridCtx.lineWidth = 1 / this.viewport.getZoom();

    this.gridCtx.beginPath();

    // Vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      this.gridCtx.moveTo(x, startY);
      this.gridCtx.lineTo(x, endY);
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      this.gridCtx.moveTo(startX, y);
      this.gridCtx.lineTo(endX, y);
    }

    this.gridCtx.stroke();
    this.gridCtx.restore();

    this.gridDirty = false;
    this.lastGridZoom = this.viewport.getZoom();
    this.lastGridPan = { ...this.viewport.getPan() };
  }

  /**
   * Check if grid needs to be re-rendered
   */
  private checkGridDirty(): void {
    const currentZoom = this.viewport.getZoom();
    const currentPan = this.viewport.getPan();

    // Mark dirty if zoom changed
    if (Math.abs(currentZoom - this.lastGridZoom) > 0.001) {
      this.gridDirty = true;
    }

    // Mark dirty if pan changed significantly (moved > 1 grid cell)
    const panDeltaX = Math.abs(currentPan.x - this.lastGridPan.x);
    const panDeltaY = Math.abs(currentPan.y - this.lastGridPan.y);
    if (panDeltaX > CANVAS.GRID_SIZE || panDeltaY > CANVAS.GRID_SIZE) {
      this.gridDirty = true;
    }
  }

  /**
   * Main render loop
   */
  private render = (): void => {
    if (!this.isRunning) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.showGrid) {
      this.checkGridDirty();
      this.renderGridToCache();

      // Blit cached grid to main canvas (very fast!)
      if (this.gridCanvas) {
        this.ctx.drawImage(this.gridCanvas, 0, 0);
      }
    }

    // Continue with normal rendering
    this.ctx.save();
    this.viewport.applyTransform(this.ctx);

    this.connectionManager.render(this.ctx);
    this.components.forEach((component) => component.render(this.ctx));
    // ... rest of rendering
  };

  /**
   * Handle canvas resize
   */
  private resizeCanvas(): void {
    // ... existing resize logic ...

    // Resize grid canvas to match
    if (this.gridCanvas) {
      this.gridCanvas.width = this.canvas.width;
      this.gridCanvas.height = this.canvas.height;
      this.gridDirty = true;
    }
  }
}
```

**Benefits:**
- ✅ Grid drawn once per zoom/pan change, not 60 times per second
- ✅ `drawImage()` is extremely fast (GPU-accelerated)
- ✅ Expected CPU reduction: **30-40% when zoomed out**
- ✅ No visual quality loss
- ✅ Low implementation complexity

**Drawbacks:**
- ⚠️ Extra memory for offscreen canvas (~8MB for 1920x1080 RGBA)
- ⚠️ Needs cache invalidation logic

**Estimated effort:** 4-6 hours
**Estimated gain:** 30-40% CPU reduction at low zoom levels

---

### Solution 2: Adaptive Grid Level-of-Detail (LOD) ⭐ HIGHLY RECOMMENDED

**Concept:** Increase grid spacing when zoomed out to maintain consistent visual density.

**Implementation:**

```typescript
private renderGrid(): void {
  const bounds = this.viewport.getVisibleBounds(
    this.canvas.clientWidth,
    this.canvas.clientHeight
  );

  const zoom = this.viewport.getZoom();

  // Adaptive grid size based on zoom level
  let gridSize = CANVAS.GRID_SIZE;

  // At zoom < 0.5 (zoomed out), use larger grid spacing
  if (zoom < 0.5) {
    gridSize = CANVAS.GRID_SIZE * 4; // 80px spacing
  } else if (zoom < 0.75) {
    gridSize = CANVAS.GRID_SIZE * 2; // 40px spacing
  }

  // Hide grid entirely when too zoomed out
  if (zoom < 0.25) {
    return; // No grid rendering
  }

  const startX = Math.floor(bounds.x / gridSize) * gridSize;
  const startY = Math.floor(bounds.y / gridSize) * gridSize;
  const endX = Math.ceil((bounds.x + bounds.width) / gridSize) * gridSize;
  const endY = Math.ceil((bounds.y + bounds.height) / gridSize) * gridSize;

  this.ctx.strokeStyle = COLORS.GRID;
  this.ctx.lineWidth = 1 / zoom;

  // Fade grid opacity when zoomed out
  this.ctx.globalAlpha = Math.min(1.0, zoom / 0.5);

  this.ctx.beginPath();

  // Vertical lines
  for (let x = startX; x <= endX; x += gridSize) {
    this.ctx.moveTo(x, startY);
    this.ctx.lineTo(x, endY);
  }

  // Horizontal lines
  for (let y = startY; y <= endY; y += gridSize) {
    this.ctx.moveTo(startX, y);
    this.ctx.lineTo(endX, y);
  }

  this.ctx.stroke();
  this.ctx.globalAlpha = 1.0;
}
```

**Zoom-based Grid Spacing Table:**

| Zoom Level | Grid Size | Lines (1920x1080) | Reduction |
|------------|-----------|-------------------|-----------|
| 200% | 20px | 75 | Baseline |
| 100% | 20px | 150 | 2x |
| 75% | 40px | 75 | 50% fewer |
| 50% | 80px | 38 | 75% fewer |
| 25% | Hidden | 0 | 100% fewer |

**Benefits:**
- ✅ Dramatically reduces line count when zoomed out
- ✅ Maintains visual consistency (grid doesn't become cluttered)
- ✅ Expected CPU reduction: **50-60% when zoomed out**
- ✅ Simple implementation
- ✅ No memory overhead

**Drawbacks:**
- ⚠️ Snap-to-grid behavior changes with zoom (could be confusing)
  - **Solution:** Keep snap-to-grid at base 20px, only visual grid changes

**Estimated effort:** 2-3 hours
**Estimated gain:** 50-60% CPU reduction at low zoom levels

---

### Solution 3: Combine Caching + LOD ⭐⭐⭐ BEST SOLUTION

**Concept:** Use both offscreen canvas caching AND adaptive grid density.

**Benefits:**
- ✅ Maximum performance improvement
- ✅ Expected CPU reduction: **60-70% when zoomed out**
- ✅ Best visual quality
- ✅ Responsive at all zoom levels

**Implementation:**
Combine the code from Solution 1 and Solution 2.

**Estimated effort:** 6-8 hours
**Estimated gain:** 60-70% CPU reduction at low zoom levels

---

### Solution 4: Dot Grid Instead of Line Grid

**Concept:** Render dots at grid intersections instead of lines.

```typescript
private renderGrid(): void {
  const bounds = this.viewport.getVisibleBounds(
    this.canvas.clientWidth,
    this.canvas.clientHeight
  );

  const gridSize = CANVAS.GRID_SIZE;
  const startX = Math.floor(bounds.x / gridSize) * gridSize;
  const startY = Math.floor(bounds.y / gridSize) * gridSize;
  const endX = Math.ceil((bounds.x + bounds.width) / gridSize) * gridSize;
  const endY = Math.ceil((bounds.y + bounds.height) / gridSize) * gridSize;

  const zoom = this.viewport.getZoom();
  const dotRadius = 1 / zoom;

  this.ctx.fillStyle = COLORS.GRID;

  // Render dots at intersections
  for (let x = startX; x <= endX; x += gridSize) {
    for (let y = startY; y <= endY; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}
```

**Benefits:**
- ✅ Less visual clutter
- ✅ Fewer draw operations (dots only at intersections)
- ✅ Modern design aesthetic
- ✅ Expected CPU reduction: 20-30%

**Drawbacks:**
- ⚠️ Different visual style (might not be preferred)
- ⚠️ Harder to align components visually without lines

**Estimated effort:** 1-2 hours
**Estimated gain:** 20-30% CPU reduction

---

## Recommended Implementation Plan

### Phase 1: Quick Win - Adaptive LOD (Week 1) ✅ IMMEDIATE

**Priority:** CRITICAL
**Effort:** 2-3 hours
**Gain:** 50-60% CPU reduction

Implement Solution 2 (Adaptive Grid LOD) first:
- Fastest to implement
- Immediate performance benefit
- No memory overhead
- Reversible if not desired

**Steps:**
1. Modify `renderGrid()` to use adaptive grid sizing
2. Keep snap-to-grid at base 20px (don't change snapping behavior)
3. Test at various zoom levels
4. Tune threshold values for optimal balance

### Phase 2: Advanced - Add Caching (Week 2-3) ✅ HIGH PRIORITY

**Priority:** HIGH
**Effort:** 4-6 hours
**Gain:** Additional 20-30% CPU reduction

Add Solution 1 (Offscreen Canvas Caching):
- Combines with LOD for maximum performance
- Cache invalidation on zoom/pan changes
- Significantly reduces draw calls

**Steps:**
1. Create offscreen canvas for grid
2. Implement cache invalidation logic
3. Update on zoom/pan/resize events
4. Test memory usage

### Phase 3: Polish - Consider Dot Grid (Optional)

**Priority:** LOW
**Effort:** 1-2 hours
**Gain:** Visual preference

Optionally implement Solution 4 (Dot Grid):
- Add as a user preference toggle
- "Line Grid" vs "Dot Grid" option
- Let users choose their preferred style

---

## Expected Performance Results

### Current Performance (No Optimization)

| Zoom | Grid Lines | CPU Usage | FPS |
|------|-----------|-----------|-----|
| 200% | 75 | 20% | 60 |
| 100% | 150 | 30% | 60 |
| 50% | 300 | 45% | 60 |
| 25% | 600 | 60%+ | 55-60 |

### After LOD Implementation (Solution 2)

| Zoom | Grid Lines | CPU Usage | FPS | Improvement |
|------|-----------|-----------|-----|-------------|
| 200% | 75 | 20% | 60 | 0% |
| 100% | 150 | 30% | 60 | 0% |
| 50% | 38 | 20% | 60 | **-56% CPU** ✅ |
| 25% | 0 | 10% | 60 | **-83% CPU** ✅ |

### After LOD + Caching (Solution 3)

| Zoom | Grid Redraws/sec | CPU Usage | FPS | Improvement |
|------|------------------|-----------|-----|-------------|
| 200% | 0-5 | 15% | 60 | **-25% CPU** ✅ |
| 100% | 0-5 | 20% | 60 | **-33% CPU** ✅ |
| 50% | 0-5 | 12% | 60 | **-73% CPU** ✅ |
| 25% | 0 | 8% | 60 | **-87% CPU** ✅ |

---

## Code Changes Required

### Files to Modify

1. **`src/canvas/Canvas.ts`**
   - Add offscreen canvas properties
   - Modify `renderGrid()` with LOD logic
   - Add cache invalidation in zoom/pan handlers
   - Update `resizeCanvas()` to resize grid cache

2. **`src/canvas/Viewport.ts`** (if needed)
   - Add event emitters for zoom/pan changes
   - Or add getters for current state

3. **`src/utils/constants.ts`** (optional)
   - Add `GRID_LOD_THRESHOLDS` configuration
   - Add `GRID_FADE_THRESHOLD` for opacity

### Backward Compatibility

- ✅ No breaking changes
- ✅ Existing snap-to-grid behavior unchanged
- ✅ Visual appearance similar (just cleaner when zoomed out)
- ✅ No API changes

---

## Testing Plan

### Performance Testing

1. **Baseline Measurement**
   - Record CPU usage at 200%, 100%, 50%, 25% zoom
   - Use Chrome DevTools Performance profiler
   - Document frame times

2. **Post-Implementation Measurement**
   - Repeat same tests
   - Compare CPU usage reduction
   - Verify 60 FPS maintained

3. **Memory Testing**
   - Check memory usage with offscreen canvas
   - Monitor for memory leaks
   - Test on different screen resolutions

### Visual Testing

1. **Zoom Smoothness**
   - Ensure smooth transitions between LOD levels
   - No jarring visual changes
   - Grid opacity fades nicely

2. **Snap-to-Grid Behavior**
   - Verify components still snap to 20px grid
   - Test at all zoom levels
   - Ensure consistency

3. **Cross-browser Testing**
   - Chrome (primary target)
   - Safari (macOS)
   - Firefox
   - Edge

---

## Conclusion

The grid rendering performance issue is caused by the **linear increase in grid lines as zoom decreases**. At 50% zoom, the canvas renders 4x more lines than at 200% zoom, causing CPU usage to double.

**Immediate Action Required:**

1. ✅ **Implement Adaptive LOD (Solution 2)** - 2-3 hours, 50-60% CPU reduction
2. ✅ **Add Offscreen Caching (Solution 1)** - 4-6 hours, additional 20-30% reduction
3. ✅ **Test and tune** - 2 hours

**Total effort:** ~8-11 hours
**Total gain:** **60-70% CPU reduction at low zoom levels**

This is a **high-impact, low-effort optimization** that will dramatically improve performance, especially on macOS where CPU usage is currently problematic.

---

## References

- [Canvas Performance - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [Offscreen Canvas - MDN](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
- [requestAnimationFrame - MDN](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)

---

**Next Steps:** Implement Solution 2 (Adaptive LOD) immediately for quick performance win.
