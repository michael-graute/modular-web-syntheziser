# Research: Oscilloscope Display — Main Canvas Migration

**Feature**: 011-oscilloscope-main-canvas
**Date**: 2026-04-11

---

## RT-001: Render Architecture — Overlay Canvas vs. Main Canvas

**Decision**: Draw directly on the main `CanvasRenderingContext2D` (no overlay element).

**Rationale**:
- CSS `transform: scale()` on an overlay canvas scales the bitmap pixels, not the drawing commands. At zoom ≠ 100% this blurs lines and smears text because the browser resizes the raster image rather than re-executing the draw calls at the new scale.
- Drawing on the main canvas uses the same coordinate transform the main canvas applies, so lines are always drawn at native pixel density — crisp at any zoom.
- `ChordFinderDisplay` proves the pattern works in this codebase (PR 5035801).

**Alternatives considered**:
- **Resize overlay canvas on zoom**: Rewrite `width`/`height` attributes on each zoom change and re-render. Technically correct but requires keeping the overlay element and all DOM management code — more complexity for the same end result.
- **OffscreenCanvas + blit**: Render to an `OffscreenCanvas` and `drawImage` the result onto the main canvas. Adds a blit step with no benefit vs. direct rendering for this use case.

---

## RT-002: Frame Throttling Without a Scheduler Subscription

**Decision**: Throttle inside `render()` via timestamp comparison; remove `visualUpdateScheduler` subscription.

**Rationale**:
- The main canvas render loop calls `component.render(ctx)` at ~60 FPS. The oscilloscope display is expensive (1024-point FFT bars, time-domain trace). Throttling to ~30 FPS avoids doubling render cost.
- Timestamp-based throttle (`performance.now() - lastRenderTime < 33`) is a single branch check — negligible overhead per skipped frame.
- Removing the scheduler subscription eliminates an external dependency and matches the ChordFinder pattern exactly.

**Alternatives considered**:
- **Dirty flag set by scheduler**: A separate subscription sets `isDirty = true` every 33 ms; `render()` checks the flag. More moving parts with no benefit.
- **Always render at 60 FPS**: Simplest, but doubles drawing work. Acceptable for a single oscilloscope; potentially problematic with multiple instances.

---

## RT-003: Data Access — Reference vs. State Snapshot

**Decision**: Retain the `Oscilloscope` component reference in `OscilloscopeDisplay`; pull data inside `render()`.

**Rationale**:
- Current design already passes the `Oscilloscope` reference to the display constructor. Keeping this requires zero changes to `CanvasComponent`'s data wiring.
- `getWaveformData()` and `getSpectrumData()` return typed array views into the analyser's internal buffer — no allocation per call.
- A formal state snapshot type (like `ChordFinderState`) would be cleaner for unit testing but is out of scope for a migration focused on rendering architecture.

**Alternatives considered**:
- **OscilloscopeState snapshot**: Define `{ displayMode, waveformData, spectrumData, gain }` and pass it into `render(ctx, state)`. Enables pure unit tests but requires a new type and changes to `CanvasComponent`'s render call. Deferred.

---

## RT-004: Visibility Culling

**Decision**: Remove `isVisible()` (`getBoundingClientRect()`-based). Accept minor over-rendering when component is off-screen.

**Rationale**:
- `getBoundingClientRect()` is only meaningful on DOM elements. With no overlay canvas, it cannot be used.
- The main canvas clips all drawing to its element bounds. Off-screen draw calls complete quickly because the GPU discards pixels outside the viewport.
- A world-coordinate bounds check could replace it, but the performance gain is negligible for a single oscilloscope.

**Alternatives considered**:
- **World-coordinate bounds check**: Compare `baseX + baseWidth` against `canvasWidth / zoom` etc. Correct but requires passing viewport state into `render()`. Deferred until profiling shows it's needed.

---

## RT-005: Z-Index and Dropdown Rendering Order

**Decision**: Render oscilloscope in `CanvasComponent.render()` after `renderControls()`, before `ctx.restore()`. Dropdown menus are drawn in a subsequent pass (`Canvas.ts` line 776: `component.renderDropdownMenus(ctx)`).

**Rationale**:
- This is the identical ordering used for ChordFinder. The main canvas painter's algorithm guarantees dropdowns always appear on top of the oscilloscope display area.
- No z-index property, stacking context, or DOM ordering is involved — the problem is eliminated structurally.

---

## RT-006: Files Changed (Scope Boundary)

| File | Change |
|------|--------|
| `src/canvas/displays/OscilloscopeDisplay.ts` | Full rewrite: remove DOM canvas, add `render(ctx)` |
| `src/canvas/CanvasComponent.ts` | Add render call; remove DOM append and `updateViewportTransform` call |
| `src/canvas/Canvas.ts` | Remove oscilloscope from viewport transform loop |
| `tests/unit/canvas/OscilloscopeDisplay.test.ts` | New unit tests |
| `src/components/analyzers/Oscilloscope.ts` | **No changes** |
| `src/visualization/scheduler.ts` | **No changes** |
