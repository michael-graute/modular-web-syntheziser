# Tasks: Touch Support for iPad & Large Touch Devices

**Input**: Design documents from `specs/017-touch-support/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- All paths relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: CSS foundations and gesture helper module that everything else depends on

- [x] T001 Add `touch-action: none` to `#synth-canvas` in `src/styles/canvas.css`
- [x] T002 [P] Add `touch-action: manipulation` to toolbar buttons and modal buttons in `src/styles/main.css`
- [x] T003 [P] Add `user-select: none` to `.main-content` in `src/styles/main.css`
- [x] T004 Create `src/canvas/GestureHelpers.ts` with `getEventPosition`, `isDragIntent`, `pointerDistance`, `pointerMidpoint`, `isCoarsePointerDevice` — using `GESTURE_CONFIG` constants from `specs/017-touch-support/contracts/types.ts` as reference
- [x] T005 [P] Write unit tests for all five functions in `tests/canvas/GestureHelpers.test.ts` (pure functions, 100% coverage target)

**Checkpoint**: CSS is touch-safe; gesture utilities are tested and ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Replace Canvas.ts mouse listeners with Pointer Events — this is the single change that unblocks all canvas interaction stories

**⚠️ CRITICAL**: Phases 3, 4, and 5 all depend on this phase

- [x] T006 Add `activePointers: Map<number, ActivePointer>` and `prevPinchDistance: number | null` fields to `Canvas` class in `src/canvas/Canvas.ts` (types defined inline matching `specs/017-touch-support/contracts/types.ts`)
- [x] T007 Replace the three `mousedown`/`mousemove`/`mouseup` `addEventListener` calls (lines 162–164) with `pointerdown`/`pointermove`/`pointerup`/`pointercancel` listeners in `src/canvas/Canvas.ts`; preserve the existing `handleMouseDown`/`handleMouseMove`/`handleMouseUp` method signatures by delegating from new pointer handlers — mouse path remains unchanged for now
- [x] T008 Implement `handlePointerDown` in `src/canvas/Canvas.ts`: extract screen position using `getEventPosition`, call `canvas.setPointerCapture(e.pointerId)`, store `ActivePointer` in map, call existing `handleMouseDown` logic with screen coords
- [x] T009 Implement `handlePointerMove` in `src/canvas/Canvas.ts`: update `activePointers` entry, delegate to existing single-pointer drag logic when `activePointers.size === 1` and `isDragIntent` passes
- [x] T010 Implement `handlePointerUp` / `handlePointerCancel` in `src/canvas/Canvas.ts`: remove pointer from map, delegate to existing `handleMouseUp` logic; treat lift with distance ≤ 8px as tap (route to existing click path)

**Checkpoint**: Canvas responds to mouse and single-finger touch identically — existing tests pass; manually verify knob drag and component drag on iPad or DevTools touch emulation

---

## Phase 3: User Story 1 — Interact with Canvas Controls (Priority: P1) 🎯 MVP

**Goal**: Knobs and sliders respond to single-finger vertical/axis drag on touch devices

**Independent Test**: Place any component with a knob (e.g., Oscillator) on the canvas, open in Chrome DevTools touch emulation, press-drag vertically on the knob — value changes continuously; lift finger — value commits

- [x] T011 [US1] Verify `handleControlMouseDown`/`handleControlMouseMove`/`handleControlMouseUp` in `src/canvas/CanvasComponent.ts` receive correct world coordinates from the pointer handler introduced in Phase 2 — no code change expected; manual verification task
- [x] T012 [US1] Test knob drag behaviour by running `vitest run` and confirming no regressions in `tests/canvas/` — fix any failures caused by pointer event listener changes in Phase 2
- [x] T013 [US1] Verify slider drag in `src/canvas/controls/Slider.ts` works via the same pointer → world-coord path; confirm `onMouseDown`/`onMouseMove`/`onMouseUp` in `Slider.ts` receive correct Y delta — no code change expected unless coordinate mapping is broken

**Checkpoint**: Knob and slider adjustment works on touch with same accuracy as mouse — User Story 1 independently validated

---

## Phase 4: User Story 2 — Move Components on the Canvas (Priority: P2)

**Goal**: Components can be repositioned by single-finger press-and-drag on their header

**Independent Test**: Add two components, drag one by its header on iPad emulation — it follows the finger and settles at release position; drag state clears

- [x] T014 [US2] Verify component-drag path in `src/canvas/Canvas.ts` (`handlePointerMove` → DRAGGING mode → position update) works for single-finger touch; confirm `draggedComponents` and `dragStartPos` update correctly from pointer coords
- [x] T015 [US2] Verify multi-component drag (multiple selected) works via the same pointer path — no additional changes expected; manual verification on DevTools emulation

**Checkpoint**: Components move correctly on touch — User Story 2 independently validated alongside User Story 1

---

## Phase 5: User Story 3 — Pan and Zoom the Canvas (Priority: P2)

**Goal**: Two-finger pan and pinch-zoom navigate the canvas viewport

**Independent Test**: Open a large patch, use two-finger drag on DevTools emulation to pan; use pinch (two-finger spread/squeeze) to zoom — viewport changes; no component accidentally moves

- [x] T016 [US3] Implement two-pointer pan in `handlePointerMove` in `src/canvas/Canvas.ts`: when `activePointers.size === 2`, compute centroid delta between current and previous frame positions, call `this.viewport.panBy(dx, dy)`; cancel any single-pointer drag state when second finger lands
- [x] T017 [US3] Implement pinch-zoom in `handlePointerMove` in `src/canvas/Canvas.ts`: when `activePointers.size === 2`, compute distance ratio (`currentDist / prevPinchDistance`), call `this.viewport.zoomAt(ratio, midpoint.screenX, midpoint.screenY)`; store `prevPinchDistance` on each frame; clear on `pointerup`
- [x] T018 [US3] Ensure `prevPinchDistance` is reset to `null` when pointer count drops below 2 in `handlePointerUp` / `handlePointerCancel` in `src/canvas/Canvas.ts`
- [x] T019 [US3] Write unit tests for `pointerDistance` and `pointerMidpoint` helpers used by pan/pinch in `tests/canvas/GestureHelpers.test.ts` (already created in T005; add pinch-specific cases)

**Checkpoint**: Two-finger pan and pinch-zoom work without triggering accidental component moves — User Story 3 independently validated

---

## Phase 6: User Story 4 — Connect and Disconnect Cables (Priority: P3)

**Goal**: Cable patching works via tap on ports; tapping a connected port disconnects the cable

**Independent Test**: On DevTools touch emulation, tap an oscillator output port (short press, ≤8px movement) — cable preview starts; tap a compatible input port — cable connects; tap either connected port again — cable disconnects

- [x] T020 [US4] Verify tap detection in `handlePointerUp` in `src/canvas/Canvas.ts` correctly routes to the existing port-click path (the `connectingFromPort` logic) when distance ≤ 8px — confirm port hit-test works with pointer-derived coords
- [x] T021 [US4] Implement disconnect-on-tap for already-connected ports in `src/canvas/Canvas.ts`: in the tap branch of `handlePointerUp`, look up the connection ID via `connectionManager.getConnectionAt(worldPos.x, worldPos.y)` and call `connectionManager.removeConnection(connectionId)` (matching FR-007: tapping connected port disconnects it — same method used by Shift+Click at line ~308)

**Checkpoint**: Cable connect and disconnect work via tap — User Story 4 independently validated

---

## Phase 7: User Story 5 — Add Components from Sidebar (Priority: P3)

**Goal**: Sidebar is collapsible on touch devices; tapping a component item adds it to the canvas

**Independent Test**: Open app on iPad (or DevTools touch emulation) — sidebar is hidden, toggle button visible; tap toggle — sidebar opens; tap "Oscillator" — component appears at canvas centre; tap toggle again — sidebar closes

- [x] T022 [US5] Add `#sidebar-toggle` button to `.top-bar` in `index.html`, adjacent to existing toolbar buttons; hidden by default via CSS
- [x] T023 [US5] Add sidebar collapse CSS to `src/styles/main.css`: `body.touch-device .sidebar { transform: translateX(-100%); transition: transform 0.2s ease; }`, `body.touch-device .sidebar.sidebar--open { transform: translateX(0); }`, `body.touch-device #sidebar-toggle { display: block; }`, `#sidebar-toggle { display: none; }`
- [x] T024 [US5] Add touch device detection and sidebar toggle wiring in `src/main.ts`: call `isCoarsePointerDevice()` from `GestureHelpers.ts` on init; if true, add `touch-device` class to `document.body`; wire `#sidebar-toggle` click to toggle `sidebar--open` class on `.sidebar`
- [x] T025 [US5] Add touch tap-to-add in `src/ui/Sidebar.ts`: alongside existing `dragstart` listener on each item, add `pointerdown` listener guarded by `e.pointerType === 'touch'`; on touch, call `e.preventDefault()` and dispatch the existing add-component request (same event used by drag-and-drop drop handler in `Canvas.ts`)

**Checkpoint**: Collapsible sidebar and tap-to-add work on touch — User Story 5 independently validated

---

## Phase 8: User Story — Multi-Touch Keyboard Chords

**Goal**: On-screen piano keyboard supports simultaneous multi-touch for chord playing

**Independent Test**: On DevTools touch emulation, press and hold one piano key with one simulated finger, press a second key with another — both notes sound simultaneously; release one — that note stops; release other — silence

- [x] T026 Replace `mousedown`/`mouseup`/`mousemove`/`mouseleave` listeners on piano key elements in `src/keyboard/Keyboard.ts` with `pointerdown`/`pointerup` listeners; call `key.setPointerCapture(e.pointerId)` on `pointerdown` so each key owns its touch point independently

**Checkpoint**: Chords play correctly on touch — keyboard story independently validated

---

## Phase 9: Long-Press Context Menu

**Goal**: Long-pressing a component shows a Delete context menu

**Independent Test**: On DevTools touch emulation, press-hold a component header for 500ms without moving — a small context menu with "Delete" appears; tap Delete — component is removed; tap outside menu — menu dismisses without action

- [x] T027 Create `src/ui/ContextMenu.ts` with `show(componentId: string, x: number, y: number): void` and `hide(): void` methods; renders a `<div id="context-menu">` appended to `#app`; positioned absolutely at `(x, y)`; "Delete" action dispatches existing component-deletion logic; dismissed by one-shot `pointerdown` listener on `document`
- [x] T028 Style context menu in `src/styles/main.css`: dark background matching existing modal tokens, `border-radius`, `z-index` above canvas, `touch-action: manipulation`
- [x] T029 Wire long-press detection in `handlePointerDown` in `src/canvas/Canvas.ts`: start `setTimeout(500ms)` stored on the `ActivePointer`; if `pointermove` crosses 8px threshold, cancel timer; if `pointerup` fires before timeout, cancel timer; if timeout fires, call `contextMenu.show(componentId, screenX, screenY)` and cancel drag state

**Checkpoint**: Long-press context menu works and does not interfere with normal drag or tap interactions

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, regression check, and documentation

- [ ] T030 [P] Run full test suite with `vitest run` and fix any regressions introduced by pointer event changes
- [ ] T031 [P] Add automated Vitest tests in `tests/canvas/Canvas.pointer.test.ts` that dispatch synthetic `PointerEvent` objects with `pointerType: 'mouse'` through the Canvas pointer handlers and assert that knob drag, component move, and cable connect produce the same results as the pre-refactor mouse path — covers FR-009 / SC-005 regression risk
- [ ] T031b [P] Manually verify all mouse interactions still work correctly on desktop (zero regression): knob drag, component move, cable connect/disconnect, zoom wheel, keyboard shortcuts
- [ ] T032 [P] Add `user-select: none` and `touch-action: none` to `.keyboard-container` in `src/styles/components.css` to prevent text selection and browser zoom during keyboard touch interaction
- [ ] T033 Verify `meta name="viewport"` in `index.html` has `user-scalable=no` or that `touch-action: none` on canvas is sufficient to prevent browser pinch-zoom interfering with app pinch-zoom (test on real iPad or Xcode Simulator)
- [ ] T034 [P] Update `specs/017-touch-support/checklists/requirements.md` — mark all checklist items completed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (CSS + helpers must exist) — **blocks Phases 3–9**
- **Phases 3–9 (User Stories)**: All depend on Phase 2 completion; can then proceed in priority order or in parallel
- **Phase 10 (Polish)**: Depends on all desired user story phases

### User Story Dependencies

| Story | Phase | Depends on | Notes |
|-------|-------|-----------|-------|
| US1 — Controls | 3 | Phase 2 | Pure delegation — no new canvas code |
| US2 — Move | 4 | Phase 2 | Pure delegation — no new canvas code |
| US3 — Pan/Zoom | 5 | Phase 2 | New two-pointer logic in Canvas.ts |
| US4 — Cables | 6 | Phase 2 | Tap-path verification + disconnect rule |
| US5 — Sidebar | 7 | Phase 1 (helpers) | Fully independent of canvas changes |
| Keyboard chords | 8 | Phase 1 (CSS) | Independent of Canvas.ts changes |
| Long-press menu | 9 | Phase 2 | Adds to `handlePointerDown` |

### Parallel Opportunities

- T001, T002, T003, T004, T005 can all start in parallel (Phase 1)
- T006–T010 must be sequential within Phase 2 (each builds on previous)
- After Phase 2: T011–T013 (US1), T016–T019 (US3), T022–T025 (US5), T026 (keyboard) can all run in parallel
- T027–T029 (long-press) can run in parallel with US1–US5 since `ContextMenu.ts` is a new file

---

## Parallel Example: Phase 1

```bash
# All Phase 1 tasks touch different files — launch together:
Task: "T001 Add touch-action: none to #synth-canvas in src/styles/canvas.css"
Task: "T002 Add touch-action: manipulation to buttons in src/styles/main.css"
Task: "T003 Add user-select: none to .main-content in src/styles/main.css"
Task: "T004 Create src/canvas/GestureHelpers.ts"
Task: "T005 Write tests/canvas/GestureHelpers.test.ts"
```

## Parallel Example: After Phase 2

```bash
# US1/US2 verification, US5 sidebar, keyboard chords touch independent files:
Task: "T011–T013 Verify controls work (US1)"
Task: "T022–T025 Implement collapsible sidebar (US5)"
Task: "T026 Replace keyboard mouse listeners"
Task: "T027–T029 Build ContextMenu.ts (long-press)"
```

---

## Implementation Strategy

### MVP First (User Story 1 — Controls)

1. Complete Phase 1: Setup (CSS + GestureHelpers)
2. Complete Phase 2: Foundational (pointer event replacement in Canvas.ts)
3. Complete Phase 3: Verify knob/slider touch works
4. **STOP and VALIDATE** on real iPad or DevTools touch emulation
5. All subsequent phases add capability without breaking this baseline

### Incremental Delivery

1. Phase 1 + 2 → Mouse still works, touch now works for controls and move
2. Phase 3 (US1) + Phase 4 (US2) → Knobs, sliders, and component move validated
3. Phase 5 (US3) → Pan and pinch-zoom validated
4. Phase 6 (US4) + Phase 7 (US5) → Cable patching and sidebar validated
5. Phase 8 → Chord keyboard validated
6. Phase 9 → Long-press menu validated
7. Phase 10 → Full regression pass

---

## Notes

- `[P]` tasks touch different files and have no shared state — safe to run concurrently
- Phase 2 is the highest-risk change (modifying Canvas.ts event listeners) — run existing tests immediately after T010
- No changes to `PatchSerializer`, `PatchStorage`, or any audio component are needed
- `setPointerCapture` is essential for knob/slider drag — without it, `pointermove` stops firing if the finger briefly leaves the element
- `touch-action: none` in CSS is required in addition to `e.preventDefault()` — iOS Safari ignores `preventDefault` for scroll/zoom without it
