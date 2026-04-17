# Performance Investigation: High CPU / MTLCompiler Load on macOS

**Date**: 2026-04-17  
**Symptom**: `MTLCompiler` process reaching 180% CPU in Chrome on macOS when running the app  
**Root cause**: Multiple compounding rendering issues — uncapped frame rate, GPU state thrashing, no dirty-flag optimization

---

## What is MTLCompiler?

`MTLCompiler` is Apple's Metal shader compiler service. Chrome's Canvas 2D implementation is backed by Metal on macOS. MTLCompiler spikes when the browser needs to **recompile GPU shaders**, which happens when the canvas 2D rendering state changes in ways that require a new shader variant — for example, turning `shadowBlur` on and off, or rapidly changing `globalAlpha`, `fillStyle`, and `strokeStyle` in alternating patterns.

---

## Findings

### 1. Uncapped RAF — doubles all work on 120 Hz displays

**File**: [src/visualization/VisualUpdateScheduler.ts](../src/visualization/VisualUpdateScheduler.ts)  
**Line**: 40

`VisualUpdateScheduler.initialize()` accepts a `targetFPS` parameter, but the parameter is named `_targetFPS` (underscore = unused). The scheduler calls `requestAnimationFrame` unconditionally every tick with no time-based throttle. On a 120 Hz MacBook Pro display Chrome renders at 120 FPS, doubling all per-frame costs below.

```ts
// Current — targetFPS is logged but never enforced
initialize(_targetFPS: number = 60, ...): void { ... }
```

**Impact**: Every other finding listed below is twice as bad on a ProMotion display.

---

### 2. `ctx.shadowBlur` on hovered connections — primary MTLCompiler trigger

**File**: [src/canvas/Connection.ts](../src/canvas/Connection.ts)  
**Lines**: 96–101

```ts
if (this.isHovered) {
  ctx.shadowBlur = 10;       // ← triggers GPU blur pass + shader recompile
  ctx.shadowColor = color;
  ctx.stroke();
  ctx.shadowBlur = 0;        // ← state change triggers another shader variant
}
```

`shadowBlur` is one of the most expensive Canvas 2D operations on Metal. It:
- Forces a multi-pass Gaussian blur on the GPU
- Causes MTLCompiler to recompile shaders each time the shadow state toggles
- Cannot be batched with adjacent draw calls

The hover state itself is not the primary problem — it's the fact that the `shadowBlur = 0` reset happens unconditionally in the hover branch, making the GPU cycle between two shader variants every frame while a cable is hovered.

**Impact**: Direct cause of MTLCompiler activity. Estimated 20–30% CPU reduction if removed.

---

### 3. No dirty-flag optimization on any display

None of the embedded displays check whether their content has changed before redrawing. All three redraw their full content unconditionally at full frame rate:

| Display | File | Cost per frame |
|---|---|---|
| `StepSequencerDisplay` | [src/canvas/displays/StepSequencerDisplay.ts](../src/canvas/displays/StepSequencerDisplay.ts) | High — 16 cells, text, velocity bars, borders |
| `OscilloscopeDisplay` | [src/canvas/displays/OscilloscopeDisplay.ts](../src/canvas/displays/OscilloscopeDisplay.ts) | Medium — grid + waveform path |
| `ChordFinderDisplay` | [src/canvas/displays/ChordFinderDisplay.ts](../src/canvas/displays/ChordFinderDisplay.ts) | Medium — 7 arc segments, text labels |

The `StepSequencerDisplay` is the heaviest: it draws 16 individual step cells per frame, each with fill, stroke, text rendering for note name and gate length, and a velocity bar. This runs at full uncapped frame rate even when the sequencer is stopped and nothing is changing.

**Impact**: Largest per-frame GPU work when components are on the canvas.

---

### 4. Collider creates a second GPU framebuffer

**File**: [src/canvas/displays/ColliderDisplay.ts](../src/canvas/displays/ColliderDisplay.ts)  
**Lines**: 33–59

`ColliderDisplay` creates a separate `HTMLCanvasElement` with `position: absolute; z-index: 100` overlaid on top of the main canvas. This means:

- Two composited GPU surfaces instead of one
- The browser's compositor must merge them every frame via a Metal blit operation
- CSS `transform: scale(zoom)` is applied on drag/zoom, which forces a GPU layer repaint

Additionally, the Collider registers its own `onFrame` callback in `visualUpdateScheduler` ([Collider.ts:421](../src/components/utilities/Collider.ts#L421)), so with a Collider present the physics `animate()` function runs at full uncapped frame rate. Physics is capped at 60 Hz via `renderInterval` for the *visual* pass, but the physics update path (collision detection, position integration) still runs at the full RAF frequency.

**Impact**: Extra GPU memory bandwidth + compositor overhead when Collider is on canvas.

---

### 5. Excessive `ctx.save()` / `ctx.restore()` pairs per frame

Every connection, control (knob, slider, button), and display saves and restores canvas context state independently. At 120 FPS with several components on the canvas:

- 1 save/restore at Canvas level
- 1 per connection (arbitrary number of cables)
- 1 per control (several per component)
- 1–2 per display (per component with a display)

Each save/restore flushes pending GPU state. At high frequency these flushes prevent Chrome from batching draw calls into a single Metal command buffer, causing many small command buffer submissions instead of a few large ones — which is expensive on Apple Silicon where Metal is optimized for large batched submissions.

**Impact**: Prevents GPU batching; multiplies MTLCompiler overhead.

---

## Full Per-Component Render Profile

| Component | Render location | Frame rate (60 Hz screen) | Frame rate (120 Hz screen) | Dirty flag? | Own RAF? | Save/restore pairs |
|---|---|---|---|---|---|---|
| Main Canvas | Canvas.ts | 60 FPS | 120 FPS | — | ✓ centralized | 2–3 |
| StepSequencerDisplay | Main canvas | 60 FPS | 120 FPS | ❌ | ❌ | 2+ |
| OscilloscopeDisplay | Main canvas | 60 FPS | 120 FPS | ❌ | ❌ | 1 |
| ChordFinderDisplay | Main canvas | 60 FPS | 120 FPS | ❌ | ❌ | 1 |
| ColliderDisplay | Separate canvas | 30 FPS render / 60+ FPS physics | 30 FPS render / 120 FPS physics | ❌ | ✓ own callback | 0 |
| Connections | Main canvas | 60 FPS | 120 FPS | ❌ | ❌ | 1 per cable |
| Controls (knobs, sliders) | Main canvas | 60 FPS | 120 FPS | ❌ | ❌ | 1 per control |
| Grid | Cached offscreen canvas | 60 FPS blit | 120 FPS blit | ✓ LOD-based | ❌ | 3 per regeneration |

---

## Recommended Fixes

### Fix 1 — Cap RAF to 60 FPS (highest impact, lowest risk)

**File**: [src/visualization/VisualUpdateScheduler.ts](../src/visualization/VisualUpdateScheduler.ts)

Add a time-based throttle to `onAnimationFrame`. Store `targetFrameTime = 1000 / targetFPS` during `initialize()` and skip frames that arrive too soon.

```ts
initialize(targetFPS: number = 60, ...): void {
  this.targetFrameTime = 1000 / targetFPS;
  // ...
}

private onAnimationFrame(timestamp: number): void {
  const deltaMs = timestamp - this.lastFrameTime;
  if (deltaMs < this.targetFrameTime) {
    this.scheduleNextFrame();
    return;                    // skip — too soon
  }
  // ... existing render logic
}
```

**Expected reduction**: ~50% CPU on 120 Hz displays (all work halved).

---

### Fix 2 — Remove `shadowBlur` from connections

**File**: [src/canvas/Connection.ts](../src/canvas/Connection.ts), lines 96–101

Replace the GPU blur with a wider semi-transparent stroke pass. Visually similar, no MTLCompiler involvement.

```ts
if (this.isHovered) {
  // Glow via wide semi-transparent stroke — no shadowBlur, no shader recompile
  ctx.strokeStyle = color + '55';         // ~33% opacity
  ctx.lineWidth = CONNECTION.CABLE_WIDTH + 8;
  ctx.stroke();
  // Redraw solid cable on top
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = CONNECTION.CABLE_WIDTH + 2;
  ctx.stroke();
}
```

**Expected reduction**: Eliminates MTLCompiler recompilation on hover. Primary fix for the shader spike.

---

### Fix 3 — Cap Collider physics update rate

**File**: [src/components/utilities/Collider.ts](../src/components/utilities/Collider.ts), `animate()` method (~line 569)

Add a physics rate cap alongside the existing render throttle so physics doesn't run at 120 Hz on ProMotion screens.

```ts
private physicsInterval: number = 1000 / 60; // cap physics at 60 Hz

private animate = (): void => {
  if (!this.isRunning) return;
  const currentTime = performance.now();
  if (currentTime - this.lastUpdateTime < this.physicsInterval) return;
  // ... existing physics + render logic
};
```

**Expected reduction**: Halves Collider physics compute on 120 Hz displays.

---

### Fix 4 — Add dirty-flag to StepSequencerDisplay (medium-term)

**File**: [src/canvas/displays/StepSequencerDisplay.ts](../src/canvas/displays/StepSequencerDisplay.ts)

Add an `isDirty` flag, set it when:
- A step is toggled/edited
- The sequencer advances to the next step
- The transport state changes (play/stop)
- Any parameter changes

Skip the full redraw when `!isDirty`. This is the largest win for static patches.

---

### Fix 5 — Merge Collider into main canvas (long-term)

Remove the separate `HTMLCanvasElement` for the Collider. Render the physics visualization directly onto the main canvas during the standard `render()` pass (the same approach used by all other displays). This eliminates the extra GPU framebuffer and the CSS transform layer.

This requires refactoring `ColliderDisplay` and `ColliderRenderer` to draw to a passed `CanvasRenderingContext2D` instead of owning their own canvas.

---

## Priority Order

| Fix | Effort | Impact | Risk |
|---|---|---|---|
| 1 — Cap RAF to 60 FPS | Very low (3 lines) | High — halves all work on 120 Hz | None |
| 2 — Remove shadowBlur | Low (5 lines) | High — stops MTLCompiler recompilation | None |
| 3 — Cap Collider physics | Very low (2 lines) | Medium | None |
| 4 — Dirty flag on displays | Medium (per display) | High — eliminates idle redraw | Low |
| 5 — Merge Collider canvas | High (refactor) | Medium | Medium |

Fixes 1, 2, and 3 together can be implemented in under an hour and should reduce the MTLCompiler load from ~180% to under 40% in typical usage.
