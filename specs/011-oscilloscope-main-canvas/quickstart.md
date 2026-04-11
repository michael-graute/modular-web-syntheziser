# Quickstart: Oscilloscope Display — Main Canvas Migration

**Feature**: 011-oscilloscope-main-canvas
**Date**: 2026-04-11

---

## What This Migration Changes

The `OscilloscopeDisplay` class is rewritten to draw directly on the main canvas context rather than managing its own overlay `<canvas>` element. The public API shrinks — three methods are removed, one is added.

---

## File-by-File Guide

### 1. `src/canvas/displays/OscilloscopeDisplay.ts` — Full Rewrite

**Before** (overlay canvas pattern):
```typescript
// Constructor: creates a DOM element
this.canvas = document.createElement('canvas');
this.canvas.style.position = 'absolute';
// ...
this.subscription = visualUpdateScheduler.onFrame(...); // independent loop

// Separate render() with no ctx parameter
private render(): void {
  this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  // ...
}

// Caller must append to DOM
display.getCanvas(); // returns HTMLCanvasElement

// Viewport sync on every zoom/pan
updateViewportTransform(zoom, panX, panY): void {
  this.canvas.style.transform = `scale(${zoom})`;
  // ...
}
```

**After** (main canvas pattern — follow ChordFinderDisplay):
```typescript
// Constructor: stores position/size only, no DOM element
constructor(x, y, width, height, oscilloscope) {
  this.baseX = x; this.baseY = y;
  this.baseWidth = width; this.baseHeight = height;
  this.oscilloscope = oscilloscope;
  this.isFrozen = false;
  this.lastRenderTime = 0;
  this.frameInterval = 1000 / 30; // 30 FPS throttle
}

// render() receives the main context
render(ctx: CanvasRenderingContext2D): void {
  // Throttle to 30 FPS
  const now = performance.now();
  if (now - this.lastRenderTime < this.frameInterval) return;
  if (this.isFrozen) return;
  this.lastRenderTime = now;

  // Draw at world coordinates (viewport transform already applied by Canvas.ts)
  const { baseX: x, baseY: y, baseWidth: w, baseHeight: h } = this;
  ctx.save();
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  this.drawGrid(ctx, x, y, w, h);
  // ... waveform / spectrum drawing using x, y offsets
  ctx.restore();
}

// destroy() is trivial — no DOM element
destroy(): void {
  this.oscilloscope = null; // release reference
}
```

---

### 2. `src/canvas/CanvasComponent.ts` — Three Changes

**Remove**: `appendChild` call when creating the display:
```typescript
// DELETE these lines:
const canvasElement = document.getElementById('synth-canvas');
if (canvasElement && canvasElement.parentElement) {
  canvasElement.parentElement.appendChild(this.oscilloscopeDisplay.getCanvas());
}
```

**Add**: Render call in `render(ctx)`, after `renderControls()`:
```typescript
// In render(), after renderControls(ctx) and before ctx.restore():
if (this.oscilloscopeDisplay) {
  this.oscilloscopeDisplay.render(ctx);
}
```

**Remove**: Oscilloscope branch from `updateViewportTransform()`:
```typescript
// DELETE:
if (this.oscilloscopeDisplay) {
  this.oscilloscopeDisplay.updateViewportTransform(zoom, panX, panY);
}
```

---

### 3. `src/canvas/Canvas.ts` — One Change

The `updateViewportTransform` calls at lines 607 and 621 iterate over all components. Since `CanvasComponent.updateViewportTransform()` no longer has an oscilloscope branch, no change to `Canvas.ts` is strictly required — but any comments referencing the oscilloscope should be updated for accuracy.

---

## Validation Scenarios

### Scenario 1 — Waveform sharp at 50% zoom
```
1. Add Oscilloscope module, connect an audio source
2. Open browser at 130% system scale (or use a Retina display)
3. Zoom canvas to 50%
4. Observe waveform trace and grid lines
Expected: Lines are pixel-crisp, not blurred/anti-aliased
```

### Scenario 2 — Dropdown not obscured
```
1. Add Oscilloscope module
2. Click the "Display" dropdown on the module
Expected: Dropdown list renders fully above the oscilloscope display area
```

### Scenario 3 — No DOM leak on delete
```
1. Add Oscilloscope module
2. Open browser devtools → Elements → locate canvas container
3. Delete the Oscilloscope module
Expected: No <canvas> child element removed (there was none); element count unchanged
```

### Scenario 4 — Two oscilloscopes independent
```
1. Add two Oscilloscope modules connected to different audio sources
2. Both display areas render independently with correct data
Expected: No cross-contamination of waveform data between the two displays
```

### Scenario 5 — CV values (ChordFinderDisplay reference)
```
C Major oct 4 waveform: flat line at 0.000V baseline before audio starts
After pressing chord: waveform reflects gate envelope shape
```

---

## Drawing Coordinate Reference

All drawing coordinates are in **world space** (same units as component positions). The main canvas's viewport transform (`ctx.setTransform(...)` applied in `Canvas.ts`) converts world → screen automatically.

```
World coordinates:
  x = this.baseX       (component left edge + margin)
  y = this.baseY       (below the last control)
  w = this.baseWidth   (component width - 2 × margin)
  h = this.baseHeight  (fixed: 150px world units)

Grid:
  vertical lines:   x + i * (w / 8)  for i in 1..7
  horizontal lines: y + i * (h / 6)  for i in 1..5
  center line:      y + h / 2

Waveform:
  sliceWidth = w / data.length
  sample_y   = y + (h / 2) * (1 - sample * gain)    (mode 0: full height)
             = y + (h / 4) * (1 - sample * gain)    (mode 2: top half)

Spectrum:
  barWidth   = w / data.length
  bar_height = (sample / 255) * h                    (mode 1: full height)
             = (sample / 255) * (h / 2)              (mode 2: bottom half)
  bar_y      = y + h - bar_height
```
