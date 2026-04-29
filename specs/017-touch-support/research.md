# Research: Touch Support for iPad & Large Touch Devices

## Decision 1: Touch Event Strategy — Pointer Events vs. Touch Events

**Decision**: Use the **Pointer Events API** (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) as the primary input abstraction for the canvas, with a thin compatibility shim for `touchstart`/`touchend` on HTML elements that don't support Pointer Events natively (e.g., sidebar items).

**Rationale**: The Pointer Events API is a W3C standard supported in all modern browsers including Safari on iPadOS 13.4+. It unifies mouse, touch, and stylus input into a single event model and provides `pointerId` for multi-touch tracking, `isPrimary` for filtering secondary fingers, and `setPointerCapture` for clean drag tracking outside the originating element. This is strictly better than maintaining parallel mouse + touch event listeners.

**Alternatives considered**:
- **Parallel touch + mouse handlers**: Would require duplicating all handler logic; also causes ghost-click issues (`click` fires ~300ms after `touchend` on some browsers).
- **Touch Events API directly**: Older API, requires `changedTouches[0]` extraction manually; no `setPointerCapture`. Still needed as fallback for Keyboard keys (SVG/HTML elements) in very old Safari.
- **Hammer.js or similar gesture library**: Would add a runtime dependency, violating the zero-dependency constraint.

---

## Decision 2: Coordinate Extraction — Unified Helper

**Decision**: Extract a `getEventPosition(e: PointerEvent | MouseEvent, canvas: HTMLCanvasElement): { screenX, screenY }` utility that uses `e.clientX - rect.left` / `e.clientY - rect.top`. This replaces the three inline `getBoundingClientRect()` calls currently in `handleMouseDown`, `handleMouseMove`, `handleMouseUp`.

**Rationale**: Canvas.ts already repeats `getBoundingClientRect()` extraction in every handler. A shared helper centralises DPR scaling and keeps handlers readable.

**Alternatives considered**: Keeping inline extraction — acceptable but becomes unwieldy with pointer event branching added alongside.

---

## Decision 3: Multi-Touch Disambiguation — Distance Threshold

**Decision**: On `pointerdown`, record `{ pointerId, startX, startY }`. On subsequent `pointermove` for the same `pointerId`, compute Euclidean distance. If distance > **8px** (CSS pixels, device-independent), set `interactionMode` to DRAGGING. If `pointerup` fires with distance ≤ 8px, treat as tap.

**Rationale**: 8px is the standard "slop" threshold used by iOS UIKit and Android ViewConfiguration. It fits within a typical canvas control hit target (~24px minimum) and avoids false drag triggers from finger placement jitter.

**Alternatives considered**:
- Time-based (200ms hold) — adds perceptible latency to all taps; bad for musical use.
- Target-zone only — misses cases where finger placement is ambiguous at zone boundaries.

---

## Decision 4: Two-Finger Gestures — Pan and Pinch

**Decision**: Track two simultaneous `pointerId` values in a `Map<number, PointerEvent>`. When exactly two pointers are active:
- **Pan**: compute centroid delta between `pointermove` frames → call `viewport.panBy(dx, dy)`.
- **Pinch-zoom**: compute distance between the two pointer positions; ratio of current distance to previous distance → call `viewport.zoomAt(scaleFactor, midpointX, midpointY)`.
Single-pointer panning (current middle-click/space-drag behaviour) remains unchanged.

**Rationale**: `Viewport` already exposes `panBy` and `zoomAt` methods. This adds no new viewport API surface; only Canvas.ts gains multi-pointer state.

**Alternatives considered**: CSS `touch-action: none` + Pointer Events — still needed to suppress browser scroll/zoom, but gesture computation must still be done manually as no higher-level API exists without a library.

---

## Decision 5: Long-Press Detection

**Decision**: On `pointerdown`, start a `setTimeout` of **500ms**. If `pointermove` distance remains ≤ 8px and `pointerup` has not fired by the timeout, cancel the timeout, cancel any drag-start, and emit a long-press event to show a context menu for the component under the pointer.

**Rationale**: 500ms matches iOS long-press threshold. The distance guard ensures that slow drags don't accidentally trigger long-press. Context menu is implemented as a small absolute-positioned `<div>` (DOM overlay, not canvas-drawn) for accessibility and ease of implementation.

**Alternatives considered**: Drawing context menu on canvas — harder to make accessible; requires hit-testing additional elements.

---

## Decision 6: Sidebar Toggle on Touch Devices

**Decision**: Detect touch capability via `window.matchMedia('(pointer: coarse)')` on app init. When coarse pointer is detected, add class `touch-device` to `<body>`. CSS applies `sidebar--collapsed` default state; a toggle button (`#sidebar-toggle`) is shown. JavaScript toggles `sidebar--open` class on the `.sidebar` element.

**Rationale**: `(pointer: coarse)` is the standard CSS media feature for touch-primary devices. Using a CSS class keeps the toggle stateless and avoids JavaScript-driven layout shifts. The sidebar toggle button is placed in the top bar alongside existing controls for consistency.

**Alternatives considered**:
- `'ontouchstart' in window` — fragile UA detection.
- Always collapsed on narrow viewports via `max-width` breakpoint — doesn't distinguish iPad landscape (wide enough but still touch-only).

---

## Decision 7: Keyboard Multi-Touch (on-screen piano)

**Decision**: Replace `mousedown`/`mouseup` event listeners on piano key elements in `Keyboard.ts` with `pointerdown`/`pointerup` + `setPointerCapture`. Each key element captures its pointer on `pointerdown`, enabling note-hold even when the finger slides slightly. Multiple simultaneous `pointerdown` events on different key elements are handled independently, giving chord support up to browser touch point limit (typically 10).

**Rationale**: `setPointerCapture` is the correct pattern for per-element pointer ownership. It also prevents ghost-click issues.

**Alternatives considered**: Global `touchstart` on the keyboard container with manual hit-testing — more complex, loses the per-element simplicity.

---

## Decision 8: Preventing Default Browser Behaviours

**Decision**: Add `touch-action: none` CSS to `#synth-canvas` and `.keyboard-container`. Add `touch-action: manipulation` to toolbar buttons (suppresses double-tap zoom while allowing tap). Call `e.preventDefault()` inside `pointerdown` handlers on the canvas (requires non-passive listener, which is the default for pointer events). Add `user-select: none` to `.main-content`.

**Rationale**: Without `touch-action: none` on the canvas, iOS Safari will scroll/zoom the page during canvas interactions regardless of `preventDefault()`. `touch-action: manipulation` on buttons removes the 300ms tap delay and double-tap zoom without blocking scrolling in modal overlays.

**Alternatives considered**: `e.preventDefault()` alone — insufficient on iOS Safari without the CSS property.
