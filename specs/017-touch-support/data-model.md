# Data Model: Touch Support

This feature introduces no new persisted entities and no changes to `PatchData` or `ComponentData`. All new state is transient (in-memory, per-interaction session).

---

## New Transient State — Canvas.ts

### ActivePointer

Tracks a single active touch point on the canvas.

| Field | Type | Description |
|-------|------|-------------|
| `pointerId` | `number` | Unique pointer ID assigned by the browser |
| `startX` | `number` | Canvas-relative screen X at `pointerdown` |
| `startY` | `number` | Canvas-relative screen Y at `pointerdown` |
| `currentX` | `number` | Latest canvas-relative screen X |
| `currentY` | `number` | Latest canvas-relative screen Y |
| `longPressTimer` | `ReturnType<typeof setTimeout> \| null` | Handle for the 500ms long-press timeout; cleared on move > 8px or `pointerup` |

**Stored in**: `private activePointers: Map<number, ActivePointer>` on `Canvas`.

**Lifecycle**:
- Created on `pointerdown`
- Updated on `pointermove`
- Deleted on `pointerup` / `pointercancel`

---

### Derived Interaction State

These values are derived from `activePointers` on each pointer event and stored in existing fields:

| Derived value | Existing field | How derived |
|---------------|---------------|-------------|
| Single-finger drag intent | `this.interactionMode` (existing `InteractionMode` enum) | Distance from `startX/Y` > 8px |
| Two-finger centroid | Computed inline in `pointermove` handler | `(p1.currentX + p2.currentX) / 2` |
| Two-finger distance | Computed inline for pinch | `Math.hypot(dx, dy)` between two active pointers |
| Previous two-finger distance | `private prevPinchDistance: number \| null` | Stored on each two-pointer `pointermove` frame |

---

## New Transient State — Context Menu

### ContextMenuState

| Field | Type | Description |
|-------|------|-------------|
| `targetComponentId` | `string` | ID of the component the long-press was on |
| `x` | `number` | Viewport X position for menu placement (screen pixels) |
| `y` | `number` | Viewport Y position for menu placement (screen pixels) |
| `visible` | `boolean` | Whether the menu DOM element is shown |

**Stored in**: Local state in a new `ContextMenu` class in `src/ui/ContextMenu.ts`.

**Lifecycle**:
- Shown on long-press detection
- Hidden on any tap outside the menu element, or after an action is selected

---

## New Transient State — Sidebar

| State | Where stored | Description |
|-------|-------------|-------------|
| `isOpen: boolean` | DOM class `sidebar--open` on `.sidebar` | Toggled by `#sidebar-toggle` button click |
| Touch device detection | `body.touch-device` CSS class | Set once on init via `matchMedia('(pointer: coarse)')` |

No JavaScript object stores sidebar state — CSS class presence is the single source of truth.

---

## No Changes Required

- `PatchData` — no new fields
- `ComponentData` — no new fields
- `PatchSerializer` / `PatchStorage` — no changes
- `EventBus` event types — no new events required (long-press triggers existing `deleteComponent` flow)
- `Viewport` — no new methods; existing `panBy`, `zoomAt`, `screenToWorld` are sufficient
