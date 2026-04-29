# Implementation Plan: Touch Support for iPad & Large Touch Devices

**Branch**: `017-touch-support` | **Date**: 2026-04-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/017-touch-support/spec.md`

## Summary

Add full touch support to the modular synthesizer so that iPad and other large touch devices can interact with the canvas (knob/slider control, component move, cable patching, pan/zoom, long-press context menu) and the sidebar (collapsible with tap-to-add). The implementation replaces the three separate inline `mousedown`/`mousemove`/`mouseup` listener sets in `Canvas.ts` and `Keyboard.ts` with the **Pointer Events API**, which unifies mouse, touch, and stylus input without adding any runtime dependencies.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**: Web Audio API, DOM — zero runtime dependencies
**Storage**: No patch format changes required
**Testing**: Vitest (run via `vitest run`)
**Target Platform**: Browser (Vite dev server / static build); primary touch target is iPadOS Safari 16+
**Performance Goals**: Touch feedback within one animation frame (~16ms); canvas rendering remains ≥ 60 FPS
**Constraints**:
- Zero new runtime dependencies — Web Audio API + DOM only
- TypeScript strict mode enforced
- Pointer Events API is available in all target browsers (iPadOS 13.4+, Chrome, Firefox, Edge)
- Mouse interactions must be fully preserved (pointer events fire for mouse too)
- `touch-action: none` on canvas is required alongside `e.preventDefault()` for iOS Safari

## Constitution Check

**Constitution Version**: 1.0

- [x] **Readability & Maintainability**: Pointer handler extracted into named private methods; coordinate helper keeps handlers ≤ 50 lines. `ActivePointer` map is self-documenting.
- [x] **Code Organization**: `ContextMenu` in `src/ui/`; gesture helpers in `src/canvas/`; touch detection util in `src/canvas/` or inline in `Canvas.ts`.
- [x] **Code Standards**: Named constants (`GESTURE_CONFIG`) replace magic numbers 8 and 500. No linting warnings expected.
- [x] **Test Coverage**: `isDragIntent`, `getEventPosition`, `pointerDistance`, `pointerMidpoint`, `isCoarsePointerDevice` are pure functions → 100% coverage achievable. Canvas integration tested via pointer event simulation.
- [x] **Test Quality**: Tests use synthetic `PointerEvent` construction; no shared mutable state.
- [x] **UI Consistency**: Context menu styled consistently with existing modals (dark background, `border-radius`, same font tokens). Sidebar toggle button uses existing `<button>` styles.
- [x] **User Feedback**: Pointer feedback is synchronous (within one rAF). Context menu appears immediately on long-press trigger.
- [x] **Performance**: `activePointers` Map has at most 10 entries (browser touch limit). No per-frame allocations in the hot path.

## Project Structure

### Documentation (this feature)

```text
specs/017-touch-support/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── types.ts         # TypeScript type contracts
│   └── validation.ts    # Pure helper functions
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code Changes (repository root)

```text
src/
├── canvas/
│   ├── Canvas.ts                  # MODIFY — replace mouse listeners with pointer listeners;
│   │                              #   add activePointers Map, prevPinchDistance, long-press logic
│   └── GestureHelpers.ts          # NEW — getEventPosition, isDragIntent, pointerDistance,
│                                  #   pointerMidpoint (extracted from contracts/validation.ts)
├── ui/
│   ├── Sidebar.ts                 # MODIFY — add touch tap-to-add alongside dragstart
│   └── ContextMenu.ts             # NEW — long-press context menu (delete action)
├── keyboard/
│   └── Keyboard.ts                # MODIFY — replace mousedown/mouseup with pointerdown/pointerup
│                                  #   + setPointerCapture for chord multi-touch
├── styles/
│   ├── canvas.css                 # MODIFY — add touch-action: none to #synth-canvas
│   └── main.css                   # MODIFY — sidebar collapse CSS, touch-device class,
│                                  #   sidebar toggle button, touch-action: manipulation on buttons
└── main.ts                        # MODIFY — touch device detection on init; wire sidebar toggle

index.html                         # MODIFY — add #sidebar-toggle button
```

## Complexity Tracking

> No constitution violations. Feature is additive and replaces existing event handler registrations.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| — | — | — |

---

## Phase 0: Research

**Status**: Complete — see [research.md](research.md)

Key decisions:
1. Pointer Events API as unified input layer (no touch/mouse split)
2. Distance threshold of 8px for drag-vs-tap disambiguation
3. 500ms long-press timer with movement cancellation
4. Two-pointer tracking in `Map<number, ActivePointer>` for pan + pinch
5. `touch-action: none` on canvas + `matchMedia('(pointer: coarse)')` for sidebar detection

---

## Phase 1: Design & Contracts

**Status**: Complete

### Interaction Architecture

#### Canvas.ts — Pointer Event Replacement

Current mouse listeners (lines 162–164) are replaced with:

```
canvas.addEventListener('pointerdown',  handlePointerDown,  { passive: false });
canvas.addEventListener('pointermove',  handlePointerMove,  { passive: false });
canvas.addEventListener('pointerup',    handlePointerUp);
canvas.addEventListener('pointercancel', handlePointerCancel);
```

`handlePointerDown(e: PointerEvent)`:
1. Call `e.preventDefault()` (suppress browser scroll/zoom)
2. Call `canvas.setPointerCapture(e.pointerId)` so move/up fire even if finger leaves canvas
3. Compute `screenPos = getEventPosition(e, canvas)`
4. Create `ActivePointer` entry in `activePointers` map
5. Start long-press timer (500ms)
6. Existing hit-test and mode logic runs from `screenPos` — **no changes to downstream code**

`handlePointerMove(e: PointerEvent)`:
1. Update `activePointers.get(e.pointerId)` coordinates
2. If `activePointers.size === 1` and `isDragIntent(pointer)`:
   - Cancel long-press timer
   - Delegate to existing drag/knob/slider logic using `screenPos`
3. If `activePointers.size === 2`:
   - Compute centroid delta → `viewport.panBy`
   - Compute distance ratio → `viewport.zoomAt` at midpoint
   - Cancel any single-pointer drag state

`handlePointerUp(e: PointerEvent)`:
1. If distance ≤ 8px → treat as tap (route to existing click/port logic)
2. Clear pointer from map
3. If map now empty → reset `interactionMode` (existing logic)

**Key insight**: All world-coordinate computation (`viewport.screenToWorld`) and downstream dispatch (`handleControlMouseDown`, port detection, etc.) is unchanged. Only the *input normalisation layer* (extracting `screenX/Y` and deciding which mode to enter) changes.

#### Keyboard.ts — Per-Key Pointer Capture

Replace per-key `mousedown`/`mouseup` listeners:
```typescript
key.addEventListener('pointerdown', (e) => {
  key.setPointerCapture(e.pointerId);
  // existing note-on logic
});
key.addEventListener('pointerup', () => {
  // existing note-off logic
});
```
Multiple `pointerdown` events on different keys fire independently → chord support with no code change to note logic.

#### Sidebar.ts — Tap-to-Add

Add alongside existing `dragstart`:
```typescript
item.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') {
    e.preventDefault();
    this.emitAddRequest(data); // reuse existing add-component event
  }
});
```
`pointerType === 'touch'` guard ensures drag-and-drop still works on desktop.

#### ContextMenu.ts — New Class

```
class ContextMenu {
  show(componentId: string, x: number, y: number): void
  hide(): void
  private handleAction(action: ContextMenuAction): void
}
```
Rendered as a single `<div id="context-menu">` appended to `#app` on first show, positioned absolutely. Dismissed on `pointerdown` outside via a one-shot document listener.

#### Sidebar Collapse (CSS + main.ts)

```css
/* main.css */
body.touch-device .sidebar { transform: translateX(-100%); transition: transform 0.2s; }
body.touch-device .sidebar.sidebar--open { transform: translateX(0); }
body.touch-device #sidebar-toggle { display: block; }
#sidebar-toggle { display: none; }
```

`main.ts` on init:
```typescript
if (isCoarsePointerDevice()) {
  document.body.classList.add('touch-device');
}
document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
  document.querySelector('.sidebar')?.classList.toggle('sidebar--open');
});
```

### Artifacts

- [research.md](research.md)
- [data-model.md](data-model.md)
- [contracts/types.ts](contracts/types.ts)
- [contracts/validation.ts](contracts/validation.ts)
- [quickstart.md](quickstart.md)
