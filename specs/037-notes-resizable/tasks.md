---

description: "Task list for Resizable Notes Component feature implementation"
---

# Tasks: Resizable Notes Component

**Input**: Design documents from `/specs/037-notes-resizable/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The project constitution mandates 100% coverage for utility/validation functions and comprehensive tests for all public APIs; every prior feature in this codebase ships tests alongside implementation (see feature 036's `tests/components/utilities/Notes.test.ts`, which this feature extends).

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- File paths are exact and follow this repo's existing conventions (`src/`, `tests/`, `specs/037-notes-resizable/contracts/`)

## Path Conventions

Single project (`src/`, `tests/` at repository root), per plan.md's Project Structure section. No new `src/` files — this feature extends four existing files (`Notes.ts`, `NotesDisplay.ts`, `CanvasComponent.ts`, `Canvas.ts`) plus one existing test file (`tests/components/utilities/Notes.test.ts`). New files exist only under `specs/037-notes-resizable/contracts/`.

## Notes carried over from `/speckit-plan`'s research

- Size must live on `Notes` (not just `CanvasComponent`), because only `SynthComponent.serialize()` reaches persisted `ComponentData` — this mirrors the existing `text?` field pattern exactly (see feature 036).
- All new hit-test/resize methods on `CanvasComponent` are gated to `this.type === ComponentType.NOTES` — no other component type gains resize behavior in this feature.
- Resize math (`clampSize`, `applyBottomLeftResize`) is pure and DOM-free, living in this feature's own `contracts/validation.ts`, imported directly as source (this project's established convention — see `Notes.ts` importing from `specs/036-notes-component/contracts/`).
- `NotesDisplay.updatePosition()` today only updates `left`/`top`; a new `updateSize()` method is required since nothing currently updates the textarea's `width`/`height` after construction.
- `PatchManager.recreateComponent()` currently unconditionally computes dimensions via `calculateComponentDimensions(type)` — it must prefer a Notes component's `getSize()` when present (data-model.md, FR-009a).

---

## Phase 1: Setup

**Purpose**: Register the new persisted fields and verify the pure-math contracts are ready to import, before any behavior is built.

- [X] T001 Add `width?: number` and `height?: number` to the `ComponentData` interface in `src/core/types.ts`, with comments mirroring the existing `text?` comment style (e.g. "Custom component width in canvas units — used by Notes; ignored by all other components")
- [X] T002 [P] Verify `specs/037-notes-resizable/contracts/types.ts` and `contracts/validation.ts` are ready to be imported directly as source (no changes needed if already correct) — `Notes.ts` will import `RESIZE`/`ComponentSize` from `contracts/types` and `CanvasComponent.ts` will import `clampSize`/`applyBottomLeftResize` from `../../specs/037-notes-resizable/contracts/validation`

**Checkpoint**: `ComponentData.width`/`height` exist and compile; contracts confirmed importable; no behavior yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared size state on `Notes` and the pure resize-math contracts that both user stories depend on.

**⚠️ CRITICAL**: No user story work can be manually/visually verified until this phase is complete.

### Tests for Foundational contracts

- [X] T003 [P] Unit tests for `clampSize` in `tests/components/utilities/Notes.test.ts` — verify width/height at/above `RESIZE.MIN_WIDTH`/`MIN_HEIGHT` pass through unchanged, and values below the minimum are clamped up to exactly the minimum (FR-004)
- [X] T004 [P] Unit tests for `applyBottomLeftResize` in `tests/components/utilities/Notes.test.ts` — verify: (a) a purely negative `dx` (drag left) increases width and decreases `position.x` by the same amount, leaving `position.y`/height untouched; (b) a purely positive `dy` (drag down) increases height, leaving `position.x`/`position.y`/width untouched; (c) combined `dx`/`dy` updates both axes independently in one call; (d) shrinking below the minimum clamps width/height to `RESIZE.MIN_WIDTH`/`MIN_HEIGHT` and clamps `position.x`'s shift accordingly (no negative-size collapse) (FR-002, FR-003, FR-004, edge case: purely horizontal/vertical drag)

### Implementation for Foundational contracts

- [X] T005 [US1] Implement `_width`/`_height` fields, `setSize(width, height)`, and `getSize()` in `src/components/utilities/Notes.ts` (depends on T001; returns `null` from `getSize()` until `setSize` has been called at least once, per data-model.md)
- [X] T006 [US1] Extend `serialize()` in `src/components/utilities/Notes.ts` to set `width`/`height` on the returned `ComponentData` only when both `_width` and `_height` are defined, alongside (not replacing) the existing `text` handling (depends on T005)
- [X] T007 [US1] Extend `deserialize(data)` in `src/components/utilities/Notes.ts` to call `this.setSize(data.width, data.height)` when both `data.width` and `data.height` are present, alongside (not replacing) the existing `text` restoration (depends on T005, T006)

**Checkpoint**: `Notes` can hold, serialize, and deserialize a custom size; pure resize math is unit-tested. No visible/interactive behavior yet — that's User Story 1.

---

## Phase 3: User Story 1 - Resize the Notes Component by Dragging Its Corner (Priority: P1) 🎯 MVP

**Goal**: A user can grab the bottom-left corner of a Notes component and drag to resize it in real time, with the top-right corner staying fixed, clamped to a minimum size, with no maximum.

**Independent Test**: Add a Notes component to the canvas, drag its bottom-left corner outward, and verify the component becomes wider and taller; drag it back inward and verify the component shrinks accordingly, stopping at a minimum size.

### Implementation for User Story 1

- [X] T008 [US1] Add `getResizeHandleAt(x: number, y: number): boolean` to `CanvasComponent` in `src/canvas/CanvasComponent.ts` — small hit-area AABB check around the bottom-left corner (`this.position.x`, `this.position.y + this.height`), gated by `this.type === ComponentType.NOTES` (returns `false` for all other types) (FR-001, FR-013)
- [X] T009 [US1] Add `resizeBy(dx: number, dy: number): void` to `CanvasComponent` in `src/canvas/CanvasComponent.ts` — calls `applyBottomLeftResize` (from `specs/037-notes-resizable/contracts/validation`) with the component's current `position`/`width`/`height`, applies the returned position/size to `this.position`/`this.width`/`this.height`, calls the existing `updateControlPositions()`, and calls `(this.synthComponent as Notes).setSize(this.width, this.height)` (depends on T005, T008; FR-002, FR-003, FR-004, FR-005, FR-010)
- [X] T010 [US1] Add `updateSize(width: number, height: number): void` to `NotesDisplay` in `src/canvas/displays/NotesDisplay.ts` — updates the textarea's `style.width`/`style.height` (currently only set once in the constructor; `updatePosition` never touches size) (FR-011)
- [X] T011 [US1] In `CanvasComponent.createControls()`'s existing `ComponentType.NOTES` block in `src/canvas/CanvasComponent.ts`: stop hardcoding the textarea height as the literal `180` (derive it from `this.height` the same way `displayWidth` already derives from `this.width`), and call `notesDisplay.updateSize(...)` in the existing `else` branch alongside the existing `updatePosition(...)` call (depends on T010; FR-011)
- [X] T012 [US1] Add `RESIZING` to the interaction-mode enum/state in `src/canvas/Canvas.ts`, plus `resizingComponentId: string | null` and `resizeStartPos: Position | null` fields, mirroring the existing `draggedComponents`/`dragStartPos` pattern (depends on T008, T009)
- [X] T013 [US1] In `handleMouseDown` in `src/canvas/Canvas.ts`: after the existing `getPortAt` check and before the generic drag-start fallback, call `clickedComponent.getResizeHandleAt(worldPos.x, worldPos.y)`; if hit, set `interactionMode = RESIZING`, `resizingComponentId = clickedComponent.id`, `resizeStartPos = { ...worldPos }`, and return early without falling through to normal component-body dragging (depends on T012; FR-001, FR-013)
- [X] T014 [US1] In `handleMouseMove` in `src/canvas/Canvas.ts`: add a `RESIZING` branch parallel to the existing `DRAGGING` branch — compute `dx = worldPos.x - resizeStartPos.x`, `dy = worldPos.y - resizeStartPos.y`, call `component.resizeBy(dx, dy)`, then re-snapshot `resizeStartPos = { ...worldPos }` (same frame-to-frame delta pattern as `dragStartPos`), then call the existing `updateComponentViewportTransforms()` so the Notes textarea overlay stays visually attached during the drag (depends on T009, T012, T013; FR-002, FR-012)
- [X] T015 [US1] In `handleMouseUp` and `handlePointerCancel` in `src/canvas/Canvas.ts`: clear `resizingComponentId`/`resizeStartPos` and reset `interactionMode` to `NONE` when a resize was in progress, mirroring how drag-to-move state is already cleared there (depends on T012, T013; FR-008)
- [X] T016 [US1] In `PatchManager.recreateComponent` in `src/patch/PatchManager.ts`: after `synthComponent.deserialize(componentData)`, if `synthComponent` is a `Notes` instance, call `getSize()` — if non-null, use that width/height when constructing `CanvasComponent` instead of `calculateComponentDimensions(componentData.type)`'s output; otherwise keep the existing fallback (depends on T005, T007; FR-009, FR-009a)

**Checkpoint**: User Story 1 is fully functional — a Notes component can be resized by dragging its bottom-left corner, the drag is zoom-aware, size is clamped to a minimum with no maximum, text is preserved, and resized dimensions save/reload correctly.

---

## Phase 4: User Story 2 - Visual Feedback When Hovering Over the Resize Handle (Priority: P2)

**Goal**: The mouse cursor changes to a resize cursor when hovering the bottom-left corner (without clicking), and reverts when the cursor moves away, so the resize handle is discoverable.

**Independent Test**: Add a Notes component, move the mouse cursor over its bottom-left corner without clicking, and verify the cursor icon changes to a resize indicator; move the cursor away and verify it reverts to normal.

### Implementation for User Story 2

- [X] T017 [US2] In `handleMouseMove` in `src/canvas/Canvas.ts`'s existing hover branch (active when `interactionMode === NONE`): add a `getResizeHandleAt` check before the existing `getPortAt` check; set the cursor to the corner-appropriate resize cursor when hit (implemented as `resizeCursorFor(corner)`, covering both bottom-left `'sw-resize'` and bottom-right `'se-resize'` per the spec's Amendments), otherwise fall through to the existing `getPortAt`/`'pointer'`/`'grab'` logic unchanged (depends on T008; FR-006, FR-007)
- [X] T018 [US2] In the `RESIZING` branch added to `handleMouseMove` in `src/canvas/Canvas.ts` (T014): explicitly keep the corner-appropriate resize cursor set for the duration of the drag via `resizeCursorFor(this.resizingCorner)`, so a fast drag that briefly leaves the corner's hit area doesn't lose the resize cursor mid-gesture (depends on T014; spec Acceptance Scenario US2-4)

**Checkpoint**: Both user stories are independently functional — resizing works (US1) and is discoverable via cursor feedback (US2).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup after both user stories are complete.

- [X] T019 [P] Run `vitest run` for the full suite and confirm no regressions in existing component/canvas/contract tests
- [X] T020 [P] Run `tsc --noEmit` (this project has no separate `lint` npm script — confirmed during feature 035) and fix any type errors introduced by the changed files
- [X] T021 Manually walk through quickstart.md's Interaction Lifecycle end-to-end in the running dev server (hover corner → cursor changes, drag down-left → grows, drag up-right → shrinks to minimum, release → locks size, type in resized text area → text preserved, save/reload → size persists, zoom/pan mid-resize → stays consistent) per this project's verification convention — confirmed by user for both bottom corners

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (needs `ComponentData.width`/`height` to exist) — BLOCKS both user stories, since US1's `resizeBy` needs `Notes.setSize` (T005) and US2's cursor logic depends on US1's `getResizeHandleAt` (T008)
- **User Story 1 (Phase 3)**: Depends on Phase 2 (T005-T007) for `Notes` size state; delivers the full resize interaction end-to-end including persistence
- **User Story 2 (Phase 4)**: Depends on US1's `getResizeHandleAt` (T008) and `RESIZING` mode/branch (T012, T014) already existing — cursor feedback layers on top of an already-working resize interaction rather than being independently buildable from Phase 2 alone
- **Polish (Phase 5)**: Depends on both user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — resizing works correctly (with the default browser cursor) even without US2's cursor feedback, so it is independently testable and deployable as the MVP
- **User Story 2 (P2)**: Builds on US1's hit-testing and interaction-mode plumbing (cursor feedback has no meaning without a resize interaction to preview), but is a separable, independently testable increment — US1 remains fully functional if US2 is never implemented

### Parallel Opportunities

- T001, T002 (Setup) can run in parallel
- T003, T004 (Foundational tests) can run in parallel
- T019, T020 (Polish) can run in parallel
- Within User Story 1, T008 and T010 (different files: `CanvasComponent.ts` vs `NotesDisplay.ts`) can run in parallel before T009/T011 depend on them

---

## Parallel Example: Foundational Contracts

```bash
# Launch both pure-math test suites together:
Task: "Unit tests for clampSize in tests/components/utilities/Notes.test.ts"
Task: "Unit tests for applyBottomLeftResize in tests/components/utilities/Notes.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T007)
3. Complete Phase 3: User Story 1 (T008-T016)
4. **STOP and VALIDATE**: Drag a Notes component's bottom-left corner in the running dev server — verify it grows/shrinks correctly, clamps at the minimum, preserves text, and the resized size survives a save/reload
5. Demo if ready — resizing is fully functional even with the plain default cursor over the corner (US2 only adds a visual hint, not new capability)

### Incremental Delivery

1. Setup + Foundational → `Notes` can hold/serialize/deserialize a custom size; resize math is unit-tested
2. Add User Story 1 → drag-to-resize works end-to-end, including persistence → demo (MVP!)
3. Add User Story 2 → cursor feedback makes the resize handle discoverable → demo
4. Each story adds value without breaking the previous one

---

## Notes

- [P] tasks touch different files or independent test cases with no shared state
- [Story] label maps every user-story-phase task to its spec.md story for traceability
- Tests are written before their corresponding implementation tasks within the Foundational phase, per this project's established convention
- Commit after each phase checkpoint, consistent with how prior features (e.g. `036-notes-component`) were delivered in incremental commits
- No task modifies `PatchSerializer.ts` or `PatchStorage.ts` — confirmed in research.md/plan.md, the serializer is polymorphic over `component.serialize()` and the new `width`/`height` fields need no validator changes
- All new hit-test/resize code on `CanvasComponent` is gated to `ComponentType.NOTES` — no other component type gains resize behavior in this feature
