# Phase 0 Research: Resizable Notes Component

## Decision: Size ownership — `Notes` (SynthComponent) owns persisted width/height, `CanvasComponent` owns live visual width/height

**Rationale**: `PatchSerializer.serializePatch()` maps over `SynthComponent[]` and calls `component.serialize()` — it has no reference to `CanvasComponent` at all (confirmed: no `CanvasComponent`-level serialize/toJSON exists anywhere in the codebase). `CanvasComponent.width`/`height` are plain mutable fields but are never persisted today; every load path (`PatchManager.recreateComponent`) recomputes them from `calculateComponentDimensions(type)`. The only way to persist a custom size without changing `PatchSerializer`'s signature (a much larger, riskier change touching every component) is to have `Notes` itself hold `width`/`height` as state, exactly like it already holds `_text`, and serialize them conditionally. `CanvasComponent` remains the live visual authority during a resize drag (it owns `this.width`/`this.height` used by `createControls()`/`containsPoint()`), but on each resize step (and on load) it pushes the current size into `Notes` via new `setSize(width, height)` / reads it via `getSize()` methods — mirroring the existing `notes.setText(text)` / `notes.getText()` calls already wired into `CanvasComponent.createControls()`'s NOTES block.

**Alternatives considered**:
- *Change `PatchSerializer.serializePatch()` to accept `CanvasComponent[]` and read `width`/`height` directly*: rejected — this is a structural change to the serializer's public contract affecting every component type, for a feature that's scoped to one component. Far larger blast radius than necessary.
- *Add a parallel "canvas layout" save file/section separate from `ComponentData`*: rejected — introduces a second persistence path with its own versioning/backward-compat surface, when the existing `ComponentData.text?` pattern already solves exactly this class of problem (component-specific optional data).
- *Store size only in `CanvasComponent`, forgo persistence*: rejected — the spec's FR-009 and SC-004 explicitly require persisted, restored size; this alternative would fail acceptance criteria.

## Decision: Resize hit-testing and interaction mode mirror the existing drag-to-move and port-hit-test patterns

**Rationale**: The codebase has two directly reusable shapes: (1) `CanvasComponent.getPortAt(x, y)` for AABB/circle hit-testing owned by the component and called from `Canvas.ts`'s mousedown/mousemove cascade, and (2) the `draggedComponents`/`dragStartPos` frame-to-frame delta pattern used for moving components (`Canvas.ts:660-683`, `711-766`). A new `CanvasComponent.getResizeHandleAt(x, y): boolean` method (Notes-only, gated by `this.type === ComponentType.NOTES`) slots into the same hit-test cascade in `handleMouseDown`, alongside `getPortAt`. A new `resizingComponentId: string | null` + `resizeStartPos: Position | null` pair of `Canvas` fields mirrors `draggedComponents`/`dragStartPos` exactly, reusing the same screen→world coordinate conversion (`getEventPosition` + `viewport.screenToWorld`) so resize is zoom-aware for free (satisfies FR-012).

**Alternatives considered**:
- *A generic resize mechanism on `CanvasComponent` usable by any component type*: rejected for this feature — the spec (per its Assumptions) explicitly scopes resize to Notes only. Gating the new hit-test/resize methods by `ComponentType.NOTES` keeps the change minimal and avoids speculating about a generic mechanism's shape before a second consumer exists. The method names avoid "Notes" in their signature so a future generalization is not blocked.
- *A dedicated `ResizeManager` class parallel to `SelectionManager`/`ConnectionManager`*: rejected as over-engineering for a single component type and a single corner — the existing inline `interactionMode` state machine in `Canvas.ts` already handles DRAGGING/CONNECTING/PANNING the same way; RESIZING is one more mode of the same shape.

## Decision: Bottom-left resize math — width tracks `-dx`, height tracks `+dy`, position.x tracks `+dx`, position.y fixed

**Rationale**: Dragging the bottom-left corner down-and-left should grow the component (per spec Acceptance Scenario 1: "drags down and to the left... component grows... top-right corner stays fixed"). For a bottom-left handle: moving the corner left (negative `dx`) increases width and must also decrease `position.x` by the same amount (so the *right* edge, `position.x + width`, stays fixed); moving the corner down (positive `dy`) increases height with `position.y` unchanged (top edge is already fixed since the corner being dragged is on the bottom). Concretely, on each frame-to-frame delta `(dx, dy)`: `newWidth = clamp(width - dx, MIN_WIDTH, ∞)`, `newX = position.x + (width - newWidth)` (so the right edge `x + width` is invariant), `newHeight = clamp(height + dy, MIN_HEIGHT, ∞)`, `position.y` unchanged. This directly satisfies FR-003 (top-right corner fixed) and the edge case requiring independent per-axis resize (a purely horizontal drag leaves height/position.y untouched, and vice versa).

**Alternatives considered**:
- *Track cumulative delta from drag-start instead of frame-to-frame*: rejected — the existing move-drag pattern (`dragStartPos` reset every mousemove frame) already handles multi-frame accumulation correctly and simply; matching it avoids introducing a second, subtly different delta-tracking convention in the same file.

## Decision: Minimum size uses existing `COMPONENT.MIN_WIDTH`/`MIN_HEIGHT` constants; no new constants needed for the floor

**Rationale**: `src/utils/constants.ts` already defines `COMPONENT.MIN_WIDTH` (120) and `COMPONENT.MIN_HEIGHT` (80), used as the fallback in `CanvasComponent`'s constructor when no explicit dimensions are passed. These are already the project's canonical "smallest sensible component" values and nothing today enforces them dynamically (since no component resizes at runtime). Reusing them for the resize clamp avoids introducing parallel/duplicate magic numbers, satisfying the constitution's "avoid magic numbers" principle and FR-004 without inventing new tunables. The Notes-specific default (240×~430 per `calculateComponentDimensions(NOTES)`) remains the initial size for new components and the fallback for legacy patches (FR-009a); `COMPONENT.MIN_WIDTH`/`MIN_HEIGHT` only bound how far a user can shrink it.

**Alternatives considered**:
- *Introduce Notes-specific `NOTES.MIN_WIDTH`/`MIN_HEIGHT` constants in the `037` contracts, larger than the generic component minimums (to guarantee some visible text area)*: considered viable, but deferred to implementation-time judgment — if `COMPONENT.MIN_WIDTH`×`MIN_HEIGHT` (120×80) proves too small to show a usable text area alongside the header, a Notes-specific floor can be added in `contracts/types.ts` (mirroring `NOTES.MAX_TEXT_LENGTH`'s precedent from feature 036) without any spec change, since the spec only requires "a minimum width and height... keeps the header and text area usable" (FR-004) without mandating specific values (per spec Assumptions).

## Decision: Cursor feedback hooks into the existing ad hoc hover-cursor branch in `Canvas.ts`'s `handleMouseMove`

**Rationale**: There is no centralized cursor-recompute function — `canvas.style.cursor` is set ad hoc in ~9 places. The one hover-driven branch (`Canvas.ts:770-782`, active when `interactionMode === NONE`) already checks `getPortAt` and falls back through `'crosshair'`/`'pointer'`/`'grab'`. Adding a `getResizeHandleAt` check before the `getPortAt` check in that same branch, setting `cursor = 'sw-resize'` when hit, is the minimal, consistent change — it reuses the existing per-frame hover recompute rather than adding a second competing cursor-management system.

**Alternatives considered**:
- *CSS `:hover` + `cursor` on the textarea/DOM overlay element*: rejected — the resize corner sits on the `<canvas>` element itself (the component body is canvas-rendered; only the text area is a DOM overlay), so CSS hover on a DOM element can't reach it. Must be handled via the canvas's JS-driven cursor logic like every other canvas-region cursor today.

## Decision: `NotesDisplay` gains an `updateSize(width, height)` method; `CanvasComponent`'s Notes block stops hardcoding textarea height as a literal `180`

**Rationale**: Confirmed via research that `NotesDisplay.updatePosition(x, y)` only ever updates `left`/`top`, never `width`/`height` — and `CanvasComponent.createControls()`'s Notes block passes a hardcoded `180` for height on construction and never updates it afterward (dead code path today, since size never changes post-construction). To satisfy FR-011 (text area scales with the component), the `else` branch (component already has a `notesDisplay`) must call a new `updateSize()` alongside the existing `updatePosition()`, and the constructor call must use `this.height`-derived values instead of the literal `180`, consistent with how `displayWidth` is already derived from `this.width`.

**Alternatives considered**: None — this is a straightforward gap-fill required for the feature to work at all; no alternative approach considered.

## Decision: `ComponentData` gains optional `width?: number; height?: number` fields, mirroring the existing `text?`/`audioBlob?` precedent

**Rationale**: This is the established, already-proven pattern in this codebase for adding component-specific optional persisted state (see `audioBlob?: string` for Looper, `text?: string` for Notes itself, both added via the same "one small optional field" approach documented in prior features' plans). Both fields are optional so legacy patches (no stored size) deserialize with `width`/`height` absent, and `Notes.deserialize()` falls back to `undefined` — signaling to `CanvasComponent`/`PatchManager` to use `calculateComponentDimensions(NOTES)` instead, which satisfies FR-009a (backward compatibility) with no special-casing beyond "field absent → use default."

**Alternatives considered**: None viable — this is the only pattern already validated three times in this codebase (`isBypassed?`, `audioBlob?`, `text?`) for exactly this kind of addition.
