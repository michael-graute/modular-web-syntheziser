---

description: "Task list for Notes Component feature implementation"
---

# Tasks: Notes Component

**Input**: Design documents from `/specs/036-notes-component/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The project constitution mandates 100% coverage for utility/validation functions and comprehensive tests for all public APIs; every prior feature in this codebase ships tests alongside implementation.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact and follow this repo's existing conventions (`src/components/utilities/`, `tests/components/utilities/`, `tests/canvas/`)

## Path Conventions

Single project (`src/`, `tests/` at repository root), per plan.md's Project Structure section. New files:
- `src/components/utilities/Notes.ts`
- `src/canvas/displays/NotesDisplay.ts`
- `tests/components/utilities/Notes.test.ts` (includes the contracts/validation.ts helper tests, following the 035-xy-pad-controller convention of consolidating validation-helper coverage into the component's own test file rather than a separate `tests/contracts/` file)

## Notes carried over from feature 035's `/speckit-analyze` findings

- This project imports its spec `contracts/` files directly as source (e.g. `Looper.ts:25` imports from `specs/015-bpm-looper/contracts/validation`) — `Notes.ts` will import from `../../../specs/036-notes-component/contracts/validation` and `contracts/types`, NOT duplicate them under `src/`.
- `componentLayout.ts`'s two real switch functions are `getControlLayout` (line 25) and `getPortCounts` (line 235) — `calculateComponentDimensions` (line 587) is a pure consumer that derives `{width, height}` from them and needs no direct edit.

---

## Phase 1: Setup

**Purpose**: Register the new component type and schema field so they exist in the type system before any behavior is built.

- [X] T001 Add `NOTES = 'notes'` to the `ComponentType` enum in `src/core/types.ts`
- [X] T002 Add `text?: string` to the `ComponentData` interface in `src/core/types.ts`, with a comment mirroring the existing `audioBlob` comment style (e.g. "Free-text content — used by Notes; ignored by all other components")
- [X] T003 [P] Verify `specs/036-notes-component/contracts/types.ts` and `contracts/validation.ts` are ready to be imported directly as source (no changes needed if already correct) — `Notes.ts` will import `NOTES` constants and `clampText`/`shouldSerializeText` from `../../../specs/036-notes-component/contracts/`

**Checkpoint**: `ComponentType.NOTES` and `ComponentData.text` exist and compile; no behavior yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core component skeleton, registration, and layout wiring that the user story's UI depends on. Without this phase, nothing can be added to the canvas or tested interactively.

**⚠️ CRITICAL**: No user story work can be manually/visually verified until this phase is complete, though US1's core logic (T009-T010) has no hard dependency on T006-T008 and may be built in parallel.

- [X] T004 Create `Notes` class skeleton in `src/components/utilities/Notes.ts`: extends `SynthComponent`, constructor calls `super(id, ComponentType.NOTES, 'Notes', position)` with NO `addInput`/`addOutput`/`addParameter` calls (first zero-port, zero-parameter component), implements all abstract methods as no-ops per data-model.md (`createAudioNodes`/`destroyAudioNodes`/`updateAudioParameter` do nothing — critically, do NOT check `audioEngine.isReady()` or throw; `getInputNode`/`getOutputNode` return `null`)
- [X] T005 Register `NOTES` in `src/components/registerComponents.ts`: one `componentRegistry.register(ComponentType.NOTES, 'Notes', 'Free-text notes attached to the patch', 'Utilities', (id, position) => new Notes(id, position), calculateComponentDimensions(ComponentType.NOTES))` call
- [X] T006 [P] Add `ComponentType.NOTES` case to `getControlLayout` in `src/utils/componentLayout.ts` (line ~25) returning `{ hasDisplayArea: true, displayHeight: 180 }` (no knobs/dropdowns)
- [X] T007 [P] Add `ComponentType.NOTES` case to `getPortCounts` in `src/utils/componentLayout.ts` (line ~235) returning `{ inputs: 0, outputs: 0 }` — the first zero-port component; verify the height formula degrades gracefully with `maxPorts = 0` (port area shrinks to just `PORT_PADDING`, no crash)
- [X] T008 [P] Add a width override for `ComponentType.NOTES` in `calculateComponentWidth` in `src/utils/componentLayout.ts` (line ~490), e.g. `width = 240` for comfortable line length, following the pattern of existing per-type width overrides (Looper, XY Pad, etc.)
- [X] T009 [P] Add an icon glyph entry for `ComponentType.NOTES` in `getComponentIcon` in `src/ui/Sidebar.ts` (e.g. `'✎'`) — TypeScript's exhaustive `Record<ComponentType, string>` forces this or the build fails
- [X] T010 [P] Add a `[ComponentType.NOTES]: 'Notes'` entry to the `getDisplayName` exhaustive map in `src/canvas/CanvasComponent.ts` — TypeScript's exhaustive `Record<ComponentType, string>` forces this or the build fails (found as a real compile-time gate during feature 035's implementation)

**Checkpoint**: `NOTES` can be dragged onto the canvas from the sidebar and renders with correct dimensions (no visible textarea yet — that's added by the `NotesDisplay` work in US1).

---

## Phase 3: User Story 1 - Write Notes on the Patch Canvas (Priority: P1) 🎯 MVP

**Goal**: A user can add a Notes component, click into it, and type free-form plain text that appears immediately and stays editable.

**Independent Test**: Add a Notes component to the canvas, click into it, type a paragraph of text, click away, and verify the typed text remains visible on the component; click back in and verify it's still editable.

### Tests for User Story 1

- [X] T011 [P] [US1] Unit tests for `clampText` in `tests/components/utilities/Notes.test.ts` — verify text at/below `NOTES.MAX_TEXT_LENGTH` passes through unchanged, text above the limit is truncated to exactly `MAX_TEXT_LENGTH` characters, and empty string passes through (FR-002, FR-003)
- [X] T012 [P] [US1] Unit tests for `Notes` in `tests/components/utilities/Notes.test.ts` verifying `setText`/`getText` round-trip plain values, and that `activate()` (which calls `createAudioNodes()`) succeeds with NO audio engine mock configured, proving the no-throw no-op contract (research.md's "Audio lifecycle" decision)
- [X] T013 [P] [US1] Unit test in `tests/components/utilities/Notes.test.ts` verifying two independent `Notes` instances hold separate text — editing one does not affect the other (FR-012, edge case: "two Notes components exist in the same patch")

### Implementation for User Story 1

- [X] T014 [US1] Implement `_text` field, `setText(text)` (clamping via `clampText` from T011), and `getText()` in `src/components/utilities/Notes.ts` (depends on T004)
- [X] T015 [US1] Create `NotesDisplay` class in `src/canvas/displays/NotesDisplay.ts`: constructs a single `HTMLTextAreaElement` (absolute position, dark-theme inline styling matching the app's existing color scheme, `z-index: 100`, `transformOrigin: '0 0'`, `pointerEvents: 'auto'`, `placeholder` from `NOTES.PLACEHOLDER`, `maxLength` attribute from `NOTES.MAX_TEXT_LENGTH`), exposing `getElement()`, `updatePosition(x, y)`, `updateViewportTransform(zoom, panX, panY)` — copy `LooperDisplay`'s position/transform math (`src/canvas/displays/LooperDisplay.ts:71-92`) verbatim, with NO render loop and NO canvas 2D context (this display has no `render()` method)
- [X] T016 [US1] Add `setValue(text: string)` and `onInput(callback: (text: string) => void)` methods to `NotesDisplay` in `src/canvas/displays/NotesDisplay.ts` — `setValue` pushes text into the textarea (for initial load), `onInput` subscribes to the textarea's native `input` event
- [X] T017 [US1] Add a `destroy()` method to `NotesDisplay` in `src/canvas/displays/NotesDisplay.ts` that removes the textarea from the DOM (mirrors `LooperDisplay.destroy()`)
- [X] T018 [US1] Add the `ComponentType.NOTES` block to `createControls()` in `src/canvas/CanvasComponent.ts`: compute `displayX/Y` the same way the Looper/XY Pad blocks do, instantiate `NotesDisplay` once, append `getElement()` to `#synth-canvas`'s parent, call `setValue(notes.getText())` on creation, wire `onInput(text => notes.setText(text))` — on re-run (component moved), call only `updatePosition()`, do NOT recreate the element or re-wire listeners (depends on T015, T016)
- [X] T019 [US1] Add `notesDisplay` cleanup to `cleanup()` in `src/canvas/CanvasComponent.ts` (calls `destroy()`, mirrors the `looperDisplay`/`xyPadDisplay` cleanup blocks) (depends on T017)
- [X] T020 [US1] Add `notesDisplay.updateViewportTransform()` forwarding to `updateViewportTransform()` in `src/canvas/CanvasComponent.ts` (mirrors the `looperDisplay`/`xyPadDisplay` forwarding) (depends on T015)

**Checkpoint**: User Story 1 is fully functional — a Notes component can be added, typed into, defocused, and re-edited; this is independently testable/demoable without persistence or repositioning verification.

---

## Phase 4: User Story 2 - Notes Persist With the Patch (Priority: P2)

**Goal**: Text typed into a Notes component survives patch save and reload exactly as written.

**Independent Test**: Add a Notes component, type text into it, save the patch, reload the page (or load the saved patch), and verify the same text is displayed.

### Tests for User Story 2

- [X] T021 [P] [US2] Unit test for `shouldSerializeText` in `tests/components/utilities/Notes.test.ts` — verify it returns `false` for an empty string and `true` for any non-empty string
- [X] T022 [P] [US2] Unit test in `tests/components/utilities/Notes.test.ts` verifying `serialize()` round-trips text exactly through a new `Notes` instance's `deserialize()`, including special characters, quotes, newlines, and emoji (spec edge case, SC-003)
- [X] T023 [P] [US2] Unit test in `tests/components/utilities/Notes.test.ts` verifying a `Notes` instance with empty text serializes WITHOUT a `text` field on the returned `ComponentData` (US2 acceptance scenario 3), and that `deserialize()` on data with no `text` field yields an empty string (legacy-patch compatibility)

### Implementation for User Story 2

- [X] T024 [US2] Implement `serialize()` override in `src/components/utilities/Notes.ts`: call `super.serialize()`, then set `text` on the returned `ComponentData` only when `shouldSerializeText(this._text)` is true (depends on T014)
- [X] T025 [US2] Implement `deserialize(data)` override in `src/components/utilities/Notes.ts`: call `super.deserialize(data)`, then set `this._text = data.text ?? ''` (depends on T024)
- [X] T026 [US2] Wire `NotesDisplay.setValue(notes.getText())` into the load path in `src/canvas/CanvasComponent.ts`'s `ComponentType.NOTES` block so a freshly-deserialized component's textarea is populated on canvas render, not just on first creation (depends on T018, T025)

**Checkpoint**: User Stories 1 AND 2 both work independently — typed notes survive save/reload on top of the working live-editing from US1.

---

## Phase 5: User Story 3 - Position Notes Like Any Other Component (Priority: P3)

**Goal**: A Notes component can be dragged to a new canvas position, and that position survives save/reload — using the exact same mechanism every other component already has, with no new code.

**Independent Test**: Add a Notes component, drag it to a new position on the canvas, save the patch, reload it, and verify the component stays at its new position.

### Tests for User Story 3

- [X] T027 [P] [US3] Unit test in `tests/components/utilities/Notes.test.ts` verifying `serialize()` includes the component's current `position` (inherited from `SynthComponent.serialize()`) and `deserialize()` restores it, confirming no Notes-specific position handling is needed (US3 acceptance scenarios 1-2)

### Implementation for User Story 3

- [X] T028 [US3] No implementation needed — component repositioning (drag-to-move) and position persistence are handled entirely by the existing `SynthComponent`/`CanvasComponent`/`PatchSerializer` machinery already exercised by every other component; this task is a manual confirmation step: drag a Notes component in the running dev server and verify `updatePosition()` (T018) keeps the textarea visually attached during the drag (depends on T018)

**Checkpoint**: All three user stories are independently functional; a saved patch with a repositioned, text-filled Notes component reloads with both the text and position intact.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup after all user stories are complete.

- [X] T029 [P] Run `vitest run` for the full suite and confirm no regressions in existing component/canvas/contract tests
- [X] T030 [P] Run `tsc --noEmit` (this project has no separate `lint` npm script — confirmed during feature 035) and fix any type errors introduced by the new files
- [X] T031 Manually walk through quickstart.md's Interaction Lifecycle end-to-end in the running dev server (add, type, defocus, re-edit, drag, save, reload, delete) per this project's verification convention
- [X] T032 [P] Add a Notes documentation entry to the Help sidebar in `src/ui/HelpSidebar.ts`, following the pattern used for prior features (e.g. the X-Y Pad entry added in `035-xy-pad-controller`, placed in the Utilities section)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (needs `ComponentType.NOTES` and `ComponentData.text` to exist) — BLOCKS visual/interactive verification of all user stories
- **User Story 1 (Phase 3)**: Core logic (T014) only depends on Phase 1 (T004); UI (T015-T020) depends on Phase 2 registration being in place to render controls at all
- **User Story 2 (Phase 4)**: Depends on US1's `Notes`/`NotesDisplay` skeleton (T014, T018) existing, since persistence builds on the same text field and display wiring
- **User Story 3 (Phase 5)**: Depends on US1's `updatePosition()` wiring (T018) — but otherwise requires no new code, since position handling is inherited
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — fully independent MVP
- **User Story 2 (P2)**: Builds on US1's text field and display, but is a separable, independently testable increment (live editing still works with zero saves made)
- **User Story 3 (P3)**: Requires no new implementation — confirms inherited behavior already works; technically could be verified before US2, but is sequenced last to match spec.md's priority order

### Parallel Opportunities

- T002, T003 (Setup) can run in parallel after T001
- T006, T007, T008, T009, T010 (Foundational) can run in parallel after T005
- T011, T012, T013 (US1 tests) can run in parallel
- T021, T022, T023 (US2 tests) can run in parallel
- T029, T030, T032 (Polish) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit tests for clampText in tests/components/utilities/Notes.test.ts"
Task: "Unit tests for Notes setText/getText and no-throw activation in tests/components/utilities/Notes.test.ts"
Task: "Unit test verifying two Notes instances hold independent text in tests/components/utilities/Notes.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T010)
3. Complete Phase 3: User Story 1 (T011-T020)
4. **STOP and VALIDATE**: Add a Notes component, type into it, click away, click back in — verify text persists within the session
5. Demo if ready — the component is already useful as a live scratch-pad even without save/reload verified

### Incremental Delivery

1. Setup + Foundational → component exists on canvas
2. Add User Story 1 → live text editing works → demo (MVP!)
3. Add User Story 2 → text survives save/reload → demo
4. Add User Story 3 → confirm repositioning works (no new code) → demo
5. Each story adds value without breaking the previous one

---

## Notes

- [P] tasks touch different files or independent test cases with no shared state
- [Story] label maps every user-story-phase task to its spec.md story for traceability
- Tests are written before their corresponding implementation tasks within each story, per this project's established convention
- Commit after each phase checkpoint, consistent with how prior features (e.g. `035-xy-pad-controller`) were delivered in incremental commits
- No task modifies `PatchSerializer.ts` or `PatchManager.ts` — confirmed in research.md/plan.md, the serializer is polymorphic over `component.serialize()` and the new `text` field needs no validator changes
- Unlike every other component in this project, `Notes` requires NO `requestAnimationFrame` render loop (research.md) — do not add one
