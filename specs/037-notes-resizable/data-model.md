# Phase 1 Data Model: Resizable Notes Component

## Notes (SynthComponent subclass) — extended state

Extends the existing `Notes` class (`src/components/utilities/Notes.ts`, feature 036). Adds a second piece of state alongside `_text`.

### State

| Field | Type | Notes |
|---|---|---|
| `_text` | `string` | Existing (feature 036). Unchanged by this feature. |
| `_width` | `number \| undefined` | New. The component's custom width in canvas (world) units. `undefined` means "use the type's default width" — this is the state on a freshly-created Notes component and on legacy patches with no stored size. |
| `_height` | `number \| undefined` | New. Same semantics as `_width`, for height. |

`_width`/`_height` are always set or read together (never independently) since a resize drag always changes both dimensions together relative to the fixed top-right corner (per FR-003) — but they are stored as two separate optional fields, not a combined tuple, to match the flat shape of `ComponentData` and avoid introducing a new nested type for two numbers.

### Methods (new public API)

- `setSize(width: number, height: number): void` — Stores the new size. Called by `CanvasComponent` on every resize-drag frame (to keep `Notes`'s state in sync with the live visual size) and once on initial mount if a size was restored from a saved patch. No clamping is performed here — `CanvasComponent` is responsible for enforcing the minimum-size floor (`COMPONENT.MIN_WIDTH`/`MIN_HEIGHT`) before calling `setSize`, consistent with `CanvasComponent` already owning all other layout math (ports, knobs, control positions) for every component type. `Notes` does not need to know about `COMPONENT` layout constants.
- `getSize(): { width: number; height: number } | null` — Returns the current custom size, or `null` if none has ever been set (fresh component / legacy patch with no stored size). `CanvasComponent` calls this once when constructing/loading a Notes component's visual wrapper, to decide whether to use the stored size or fall back to `calculateComponentDimensions(NOTES)`.

### Serialization

`serialize()` (extends the existing feature-036 override):
- Existing `text` field handling is unchanged.
- `width`/`height` — set on the returned `ComponentData` only when both `_width` and `_height` are defined (mirrors the existing conditional `text` assignment pattern — omit both-or-neither, since a size is only meaningful as a pair).

`deserialize(data)` (extends the existing feature-036 override):
- Existing `text` restoration is unchanged.
- If `data.width` and `data.height` are both present, calls `this.setSize(data.width, data.height)`; otherwise leaves `_width`/`_height` as `undefined` (so `getSize()` returns `null`, and the caller falls back to the type default) — this is what satisfies FR-009a (legacy patch backward compatibility) with no special-casing beyond "field absent → undefined → caller uses default."

## ComponentData schema change (`src/core/types.ts`)

Two new optional fields on the existing interface, following the same precedent as `text?: string` (feature 036) and `audioBlob?: string` (feature 015):

| Field | Type | Notes |
|---|---|---|
| `width?` | `number` | Custom component width in canvas units — used by Notes; ignored by all other components. |
| `height?` | `number` | Custom component height in canvas units — used by Notes; ignored by all other components. |

Backward compatibility:
- **Old patch → new code**: fields absent → `Notes.deserialize` leaves `_width`/`_height` undefined → `getSize()` returns `null` → `PatchManager.recreateComponent` falls back to `calculateComponentDimensions(NOTES)`, producing the exact same default size Notes components have always loaded at (satisfies FR-009a).
- **New patch → old code**: fields present but unread by pre-037 code (which doesn't call `getSize()`) → ignored, no error, component just loads at its old fixed default size in the old code — acceptable, since patches are expected to be opened by the version of the app that saved them or newer.

## CanvasComponent — live visual size (not persisted directly)

Not a new data entity — `CanvasComponent.width`/`height` (`src/canvas/CanvasComponent.ts`) already exist as plain mutable public fields (feature-agnostic, used by every component type for layout). This feature is the first to mutate them after construction. No schema change here; `CanvasComponent` remains the live visual authority during an active resize drag, and pushes its committed size into `Notes` (the thing that actually gets persisted) via `setSize()`.

| Member (existing, now mutated post-construction) | Purpose in this feature |
|---|---|
| `width: number` | Mutated on each resize-drag frame via a new `resizeBy(dx, dy)` method (see below). Drives `createControls()`'s layout math (already width-derived for every component type — no changes needed there beyond Notes' own block). |
| `height: number` | Same, for height. |
| `position.x` | Mutated alongside `width` during a bottom-left-corner resize, so the component's right edge (`position.x + width`) stays fixed (FR-003). `position.y` is never touched by resize (top edge is already fixed for a bottom-left handle). |

### New methods

- `getResizeHandleAt(x: number, y: number): boolean` — Hit-test for the bottom-left corner's resize handle, gated to `this.type === ComponentType.NOTES` (returns `false` for all other component types, keeping this feature's surface area minimal per research.md). Mirrors the shape of the existing `getPortAt(x, y)` method: takes world-space coordinates, returns a hit/no-hit result for use in `Canvas.ts`'s hit-test cascade and hover-cursor recompute.
- `resizeBy(dx: number, dy: number): void` — Applies one frame's delta to `width`/`height`/`position.x`, clamped to `COMPONENT.MIN_WIDTH`/`MIN_HEIGHT` (research.md's "bottom-left resize math" decision), then calls the existing `updateControlPositions()` (already used by `moveBy`) to re-run `createControls()` so all child controls/displays reposition for the new size, and calls `(this.synthComponent as Notes).setSize(this.width, this.height)` to keep the persisted-state mirror in sync every frame (simplest correctness-first approach; avoids a separate "commit on mouseup" step and matches how `moveBy` already writes `position` every frame rather than only on mouseup).

## State Transitions

None — resizing is a continuous drag, not a discrete state machine. The component is either being resized (mouse down on the handle, `Canvas.interactionMode === RESIZING`) or not; there is no intermediate/pending state. This mirrors the existing DRAGGING (move) interaction mode exactly.
