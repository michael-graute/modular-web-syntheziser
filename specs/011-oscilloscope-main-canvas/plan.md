# Implementation Plan: Oscilloscope Display — Main Canvas Migration

**Branch**: `011-oscilloscope-main-canvas` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-oscilloscope-main-canvas/spec.md`

## Summary

Migrate `OscilloscopeDisplay` from a separate overlay `<canvas>` element (positioned via CSS transforms) to draw directly onto the main `CanvasRenderingContext2D`, following the pattern already established by `ChordFinderDisplay`. This eliminates font/pixel interpolation artefacts at zoom levels other than 100%, z-index conflicts with dropdown menus, DPR inconsistency, and DOM element leaks on deletion.

The change is self-contained: `OscilloscopeDisplay.ts` is rewritten, `CanvasComponent.ts` gains an inline render call (same pattern as ChordFinder), and all DOM-append/viewport-transform plumbing is removed from both files and from `Canvas.ts`.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**: Web Audio API (AnalyserNode), Canvas 2D API — zero new runtime dependencies
**Storage**: None — display is stateless; audio data pulled from `Oscilloscope` component each frame
**Testing**: Vitest, happy-dom environment
**Target Platform**: Browser (Chrome, Firefox, Safari), runs in main thread renderer
**Performance Goals**: Maintain ≥25 FPS waveform refresh during active audio; no per-frame DOM queries
**Reference Implementation**: `src/canvas/displays/ChordFinderDisplay.ts` — authoritative pattern
**Constraints**:
- No new public API on `Oscilloscope.ts` (audio component stays unchanged)
- No changes to `Canvas.ts` viewport transform logic for the oscilloscope path
- `visualUpdateScheduler` subscription removed; throttle implemented via timestamp comparison inside the render method called by the main loop

## Constitution Check

- [X] **Readability and Maintainability**: Refactor removes complexity (CSS transform hack, DOM management). Result is simpler and self-documenting.
- [X] **Code Organization**: Change stays within the display and canvas layers; audio logic untouched. Single Responsibility preserved.
- [X] **Code Standards**: TypeScript strict, linting required to pass (T009).
- [X] **Test Coverage**: Unit tests for render logic and position/size helpers (T008). Existing tests must continue to pass (T009).
- [X] **Runtime Performance**: 60 FPS main loop + internal 30 FPS throttle. No DOM queries in hot path.
- [X] **Interface Design**: Visual output is identical to current; users see no change except the scaling/blur fix.
- [X] **Memory**: No DOM element to leak. `destroy()` only needs to release the `Oscilloscope` reference.

No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/011-oscilloscope-main-canvas/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
└── tasks.md             ← /speckit.tasks output
```

### Source Code — Files Changed

```text
src/canvas/displays/OscilloscopeDisplay.ts   ← full rewrite (no DOM element)
src/canvas/CanvasComponent.ts                ← add render() call; remove DOM append + updateViewportTransform
src/canvas/Canvas.ts                         ← remove oscilloscope from updateViewportTransform loop
tests/unit/canvas/OscilloscopeDisplay.test.ts  ← new unit tests (T008)
```

### Source Code — Files Unchanged

```text
src/components/analyzers/Oscilloscope.ts     ← audio component; no changes needed
src/canvas/displays/ChordFinderDisplay.ts    ← reference implementation only
src/visualization/scheduler.ts               ← visualUpdateScheduler; no longer used by oscilloscope
```

---

## Phase 0: Research

### Decision Log

**D-001: Throttle mechanism**
- **Decision**: Remove `visualUpdateScheduler` subscription. Instead, throttle inside the `render(ctx, oscilloscope)` call by comparing `performance.now()` to `lastRenderTime` and returning early if < 33 ms have elapsed (≈30 FPS).
- **Rationale**: ChordFinderDisplay has no independent frame loop — it renders on demand from `CanvasComponent.render()`. The oscilloscope needs throttling because waveform drawing is expensive, but the correct place for that guard is inside the display's `render()` method, not a separate scheduler subscription. This keeps the display stateless from the scheduler's perspective.
- **Alternative rejected**: Keep `visualUpdateScheduler` subscription, have it set a dirty flag that `CanvasComponent.render()` checks. More complex with no benefit.

**D-002: Data access pattern**
- **Decision**: Pass the `Oscilloscope` component reference into `render(ctx, oscilloscope)` (or store it in constructor, same as current). Pull `getWaveformData()`, `getSpectrumData()`, and `getParameter('displayMode')` inside `render()`.
- **Rationale**: Current `OscilloscopeDisplay` already holds a reference to `Oscilloscope`. Keeping this avoids introducing a new state snapshot type. If a snapshot type (`OscilloscopeState`) is added later for testability, it can be done as a separate step.
- **Alternative rejected**: Pass a state snapshot like `ChordFinderState`. Requires defining a new type and updating `CanvasComponent`. Valuable for testing but out of scope for this migration.

**D-003: Visibility culling**
- **Decision**: Remove the `isVisible()` check (which uses `getBoundingClientRect()` on the overlay canvas). Replace with a simple bounds check: skip render if the display rect is fully outside the main canvas's logical dimensions.
- **Rationale**: `getBoundingClientRect()` only works on DOM elements. Since there is no overlay canvas, the check must be rewritten. A world-coordinate bounds check is simpler and avoids DOM queries in the hot path.
- **Alternative rejected**: No visibility culling at all. Acceptable for now — the main canvas already clips drawing to its bounds, so extra render calls cause minor wasted work but no visual errors.

**D-004: `isFrozen` / `setFrozen`**
- **Decision**: Retain `isFrozen` state and `setFrozen(frozen)` method. The `render()` call returns early when frozen.
- **Rationale**: The Oscilloscope component may expose a freeze control in future. Keeping this flag costs nothing.

**D-005: CanvasComponent wiring**
- **Decision**: Add the oscilloscope render call in `CanvasComponent.render()` after `renderControls()` and before `ctx.restore()` — identical to where ChordFinder renders (lines 1219–1222 of current `CanvasComponent.ts`).
- **Rationale**: This ensures the display is drawn in the correct order: after component background/ports/controls, and before `renderDropdownMenus()` which runs in a second pass in `Canvas.ts`.

**D-006: `updateViewportTransform` removal**
- **Decision**: Remove `updateViewportTransform()` from `OscilloscopeDisplay`, remove the call in `CanvasComponent.updateViewportTransform()`, and remove the oscilloscope branch from `Canvas.ts` lines 607/621.
- **Rationale**: When drawing on the main canvas, the viewport transform is already applied by `Canvas.ts`'s render loop before `component.render(ctx)` is called. No manual CSS synchronisation is needed.

---

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md).

### API Contracts

See [contracts/](./contracts/).

### Quickstart

See [quickstart.md](./quickstart.md).

---

## Complexity Tracking

No constitution violations. No complexity exceptions needed.
