# Quickstart Guide: Resizable Notes Component

**Feature**: `037-notes-resizable`
**Created**: 2026-07-08
**Target Audience**: Developers implementing this feature
**Prerequisites**: Familiarity with TypeScript 5.6+, this project's `Canvas`/`CanvasComponent` architecture, the existing drag-to-move implementation (`Canvas.ts`'s `draggedComponents`/`dragStartPos`), and the Notes component from feature `036-notes-component`.

---

## Architecture Overview

This feature adds a bottom-left-corner drag handle to the existing Notes component (`src/components/utilities/Notes.ts` + `src/canvas/displays/NotesDisplay.ts` from feature 036). It reuses three existing patterns rather than inventing new ones:

1. **Hit-testing**: `CanvasComponent.getResizeHandleAt(x, y)` — new method, same shape as the existing `getPortAt(x, y)`, gated to `ComponentType.NOTES` only.
2. **Drag interaction**: A new `RESIZING` interaction mode in `Canvas.ts`, mirroring the existing `DRAGGING` (move) mode's frame-to-frame delta pattern (`resizeStartPos` reset every mousemove, same as `dragStartPos`).
3. **Persistence**: `Notes` gains `setSize`/`getSize`, mirroring its existing `setText`/`getText` — `ComponentData` gains optional `width?`/`height?` fields, mirroring the existing `text?` field.

```typescript
// src/components/utilities/Notes.ts — extended
export class Notes extends SynthComponent {
  private _text: string = '';
  private _width: number | undefined;
  private _height: number | undefined;

  setSize(width: number, height: number): void {
    this._width = width;
    this._height = height;
  }

  getSize(): { width: number; height: number } | null {
    if (this._width === undefined || this._height === undefined) return null;
    return { width: this._width, height: this._height };
  }

  override serialize(): ComponentData {
    const base = super.serialize(); // existing text handling unchanged
    if (this._width !== undefined && this._height !== undefined) {
      base.width = this._width;
      base.height = this._height;
    }
    return base;
  }

  override deserialize(data: ComponentData): void {
    super.deserialize(data); // existing text handling unchanged
    if (data.width !== undefined && data.height !== undefined) {
      this.setSize(data.width, data.height);
    }
  }
}
```

```typescript
// specs/037-notes-resizable/contracts/validation.ts — pure resize math
import { applyBottomLeftResize } from '../../../specs/037-notes-resizable/contracts/validation';

const result = applyBottomLeftResize(
  { x: component.position.x, y: component.position.y },
  { width: component.width, height: component.height },
  dx, dy
);
component.position.x = result.position.x;
component.width = result.size.width;
component.height = result.size.height;
```

## Component Setup

1. Add `width?: number; height?: number` to the `ComponentData` interface in `src/core/types.ts`, commented like the existing `text?` field.
2. Extend `src/components/utilities/Notes.ts` with `_width`/`_height` state, `setSize`/`getSize`, and extend the existing `serialize()`/`deserialize()` overrides (do not replace them — `text` handling is unchanged).
3. Add `CanvasComponent.getResizeHandleAt(x, y): boolean` — AABB/small-square hit-test around the bottom-left corner (`this.position.x`, `this.position.y + this.height`), gated by `this.type === ComponentType.NOTES`.
4. Add `CanvasComponent.resizeBy(dx, dy): void` — calls `applyBottomLeftResize` from this feature's `contracts/validation.ts`, applies the result to `this.position`/`this.width`/`this.height`, calls the existing `updateControlPositions()`, and calls `(this.synthComponent as Notes).setSize(this.width, this.height)`.
5. Add `NotesDisplay.updateSize(width, height): void` in `src/canvas/displays/NotesDisplay.ts` — updates the textarea's `style.width`/`style.height` (currently only `updatePosition` exists; size is set once in the constructor and never updated).
6. In `CanvasComponent.createControls()`'s existing `ComponentType.NOTES` block: stop hardcoding the textarea height as the literal `180` — derive it from `this.height` instead (mirroring how `displayWidth` already derives from `this.width`), and call `notesDisplay.updateSize(...)` in the `else` (already-exists) branch alongside the existing `updatePosition(...)` call.

## Module Integration

1. **`src/canvas/Canvas.ts`**:
   - Add `RESIZING` to the `InteractionMode` enum.
   - Add `resizingComponentId: string | null` and `resizeStartPos: Position | null` fields, mirroring `draggedComponents`/`dragStartPos`.
   - In `handleMouseDown`'s hit-test cascade, after the `getPortAt` check and before the generic drag-start fallback: call `clickedComponent.getResizeHandleAt(worldPos.x, worldPos.y)`; if hit, set `interactionMode = RESIZING`, `resizingComponentId = clickedComponent.id`, `resizeStartPos = { ...worldPos }`, and return early (don't fall through to normal component-body dragging).
   - In `handleMouseMove`, add a `RESIZING` branch parallel to the existing `DRAGGING` branch: compute `dx = worldPos.x - resizeStartPos.x`, `dy = worldPos.y - resizeStartPos.y`, call `component.resizeBy(dx, dy)`, then re-snapshot `resizeStartPos = { ...worldPos }` (same frame-to-frame pattern as `dragStartPos`). Call `this.updateComponentViewportTransforms()` afterward so the Notes textarea overlay stays visually attached.
   - In the hover branch (`interactionMode === NONE`), add a `getResizeHandleAt` check before the existing `getPortAt` check; set `cursor = 'sw-resize'` when hit.
   - In `handleMouseUp` (and `handlePointerCancel`'s reset path), clear `resizingComponentId`/`resizeStartPos` and reset `interactionMode` to `NONE`, mirroring how dragging state is already cleared there.
2. **`src/patch/PatchManager.ts`**: In `recreateComponent`, after `synthComponent.deserialize(componentData)`: if `synthComponent` is a `Notes` instance, call `synthComponent.getSize()` — if non-null, use that width/height when constructing `CanvasComponent` instead of `calculateComponentDimensions(componentData.type)`'s output; otherwise fall back to the computed default (unchanged behavior, satisfies FR-009a).

Patch save works automatically once `Notes.serialize()` includes `width`/`height`: `PatchSerializer` is polymorphic over `component.serialize()`, no changes needed there.

## Interaction Lifecycle

```
Hover over Notes component's bottom-left corner → cursor changes to a resize cursor
Press mouse down on the corner → resize drag begins (interactionMode = RESIZING)
Drag down-left → component grows (width and height increase, top-right corner stays fixed)
Drag up-right → component shrinks, stopping at the minimum width/height
Release mouse button → resize ends, size is locked in
Type in the (now-resized) text area → existing text is preserved, area reflects new size
Save patch → width/height land in ComponentData (omitted when never resized)
Load patch → deserialize restores width/height (or falls back to default if absent)
Zoom/pan canvas mid-resize → drag delta is computed in world coordinates, so resize feels consistent regardless of zoom
```

## Testing Strategy

- `clampSize` / `applyBottomLeftResize` (`contracts/validation.ts`) — 100% coverage, no DOM/Canvas mocks needed: boundary values at/below/above `RESIZE.MIN_WIDTH`/`MIN_HEIGHT`; pure horizontal-only and pure vertical-only deltas (dx=0 or dy=0) confirm the other axis/position is untouched; growing and shrinking in both directions.
- `Notes` unit tests (extending the existing `tests/components/utilities/Notes.test.ts`): `setSize`/`getSize` round-trip; `getSize()` returns `null` before any `setSize` call; `serialize()` omits `width`/`height` when never set; `serialize()`/`deserialize()` round-trips a set size exactly; `deserialize()` on data with no `width`/`height` leaves `getSize()` returning `null` (legacy-patch compatibility, FR-009a).
- `CanvasComponent` resize behavior is harder to unit test in isolation (it's deeply coupled to canvas/DOM state) — cover it via the pure `contracts/validation.ts` functions plus a manual dev-server walkthrough (this project's established convention for canvas-interaction verification, since canvas rendering can't be reliably driven by browser-automation tooling).

## Common Pitfalls & Debugging

- **Do not forget to update `NotesDisplay`'s textarea size on resize** — `updatePosition()` alone only moves the element; without a new `updateSize()` call, the textarea will visually lag behind the resized canvas-drawn component border.
- **Do not accumulate delta from drag-start** — follow the existing move-drag convention of resetting the reference position every mousemove frame; accumulating from a single start point (without resetting) will cause the resize to run away or lag if frames are dropped.
- **Remember the fixed corner is top-right, not top-left** — a bottom-left-handle resize must move `position.x` (not just `width`) as the left edge moves, while `position.y` never changes (top edge is already fixed since the handle is on the bottom).
- **Gate all new hit-test/resize code to `ComponentType.NOTES`** — this feature is intentionally scoped to Notes only; a resize handle appearing on other component types would be an unintended regression.
- **Legacy patches must not shrink** — a Notes component saved before this feature shipped has no `width`/`height` in its `ComponentData`; confirm `PatchManager.recreateComponent`'s fallback path (`calculateComponentDimensions`) is still hit when both fields are absent, not just when one is.
