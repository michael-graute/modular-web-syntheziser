# Implementation Plan: Resizable Notes Component

**Branch**: `037-notes-resizable` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/037-notes-resizable/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Adds drag-to-resize handles to the bottom corners of the Notes component (feature 036), with cursor feedback on hover. Dragging the bottom-left corner keeps the top-right corner fixed while width/height and `position.x` track the drag; dragging the bottom-right corner keeps the top-left corner fixed (position never moves) while width/height track the drag directly — both in canvas/world coordinates (zoom-aware), clamped to the project's existing minimum-size constants. The resulting custom size is persisted via two new optional `ComponentData` fields (`width?`/`height?`), following the same conditional-optional-field pattern already used for `Notes.text?`. Hit-testing, drag-interaction state, and cursor management all reuse existing patterns already present in `Canvas.ts`/`CanvasComponent.ts` for port hit-testing, component-move dragging, and ad hoc cursor updates — no new architectural mechanisms are introduced, and the new hit-test/resize code is gated to `ComponentType.NOTES` only, keeping this feature's surface area minimal.

**Post-implementation amendment (2026-07-08)**: The bottom-right corner was added after user feedback during manual verification of the bottom-left-only implementation. See spec.md's Amendments section. `getResizeHandleAt` now returns a `ResizeCorner | null` (`'bottom-left' | 'bottom-right'`) instead of a boolean, and `resizeBy`/`applyBottomLeftResize` gained a sibling `applyBottomRightResize` in `contracts/validation.ts` — the top-left-corner-fixed case, which needs no position adjustment since `position` is unaffected by a bottom-right drag.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**: DOM only — this feature touches no Web Audio API code (Notes has no audio role); reuses existing Canvas 2D hit-testing and DOM textarea overlay patterns
**Storage**: `localStorage` via existing `PatchSerializer` / `PatchStorage` pattern, extended with two new optional `ComponentData.width?: number` / `height?: number` fields
**Testing**: Vitest (run via `vitest run`)
**Target Platform**: Browser (Vite dev server / static build)
**Project Type**: Single-page modular synthesizer app (`src/` flat structure with `core/`, `components/`, `ui/`, `patch/`, `canvas/`, `timing/` directories)
**Performance Goals**: 60 FPS canvas rendering maintained during resize drag; resize visually tracks the cursor with no perceptible lag (SC-002)
**Constraints**:
- Zero new runtime dependencies — DOM only
- TypeScript strict mode enforced
- Patch format changes must be backward-compatible: `width?`/`height?` are optional, so legacy patches (no fields) load at the existing fixed default size (FR-009a), and new patches degrade gracefully in older code (fields ignored)
- Resize is scoped to the Notes component only (`ComponentType.NOTES`) — no other component type gains resize behavior in this feature
- Resize drag math must be interpreted in canvas/world coordinates (via the existing `viewport.screenToWorld` conversion), not raw screen pixels, so behavior is consistent across zoom levels (FR-012)
- Minimum size is enforced via the project's existing `COMPONENT.MIN_WIDTH`/`MIN_HEIGHT` constants (120×80); there is no maximum size (FR-005)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0

Verify feature compliance with project constitution principles:

- [x] **Readability & Maintainability**: New methods (`getResizeHandleAt`, `resizeBy`, `Notes.setSize`/`getSize`, `NotesDisplay.updateSize`) are small, single-purpose, and named after their exact behavior; the resize math itself lives in pure, independently-readable `contracts/validation.ts` functions rather than inline in `CanvasComponent`.
- [x] **Code Organization**: New code slots into the existing `components/utilities/` (`Notes.ts`), `canvas/` (`CanvasComponent.ts`, `Canvas.ts`), and `canvas/displays/` (`NotesDisplay.ts`) files/split — no new top-level directories or architectural layers.
- [x] **Code Standards**: Minimum size uses the existing named `COMPONENT.MIN_WIDTH`/`MIN_HEIGHT` constants (no new magic numbers); the resize-cursor value (`'sw-resize'`) is a standard CSS cursor keyword, not a magic string requiring further justification.
- [x] **Test Coverage**: `clampSize`/`applyBottomLeftResize` (pure functions, no DOM dependency) get 100% coverage per the Constitution's utility-function requirement; `Notes.setSize`/`getSize`/serialize/deserialize get full unit coverage extending the existing `Notes.test.ts`.
- [x] **Test Quality**: New tests extend `tests/components/utilities/Notes.test.ts` with isolated, AAA-pattern cases, consistent with the file's existing conventions from feature 036.
- [x] **UI Consistency**: Reuses the existing ad hoc cursor-management pattern in `Canvas.ts` (no new cursor-management system introduced) and the existing drag-interaction-mode pattern (`RESIZING` alongside `DRAGGING`/`CONNECTING`/`PANNING`) — no new design tokens beyond a standard resize cursor.
- [x] **User Feedback**: Cursor changes synchronously on hover (SC-003); resize tracks the drag in real time with no perceptible lag (SC-002), consistent with every other canvas drag interaction in this project.
- [x] **Performance**: Resize reuses the existing `updateControlPositions()`/`createControls()` recompute path already invoked on every component move — no new per-frame work beyond what moving a component already costs; no audio-thread involvement (Notes has no audio role).

No violations identified. Complexity Tracking section below is not applicable.

## Project Structure

### Documentation (this feature)

```text
specs/037-notes-resizable/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── types.ts         # TypeScript type contracts
│   └── validation.ts    # Validation helpers
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── core/                    # App-wide singletons and types
│   ├── types.ts             # EventType enum, PatchData, ComponentData, etc.
│   ├── EventBus.ts          # Publish-subscribe event system (singleton: eventBus)
│   └── AudioEngine.ts       # Web Audio context wrapper (singleton: audioEngine)
├── components/
│   ├── base/
│   │   └── SynthComponent.ts  # Abstract base class for all components
│   ├── generators/          # Oscillator, LFO, NoiseGenerator, etc.
│   ├── effects/             # Delay, Reverb, Distortion, Chorus
│   ├── processors/          # Filter, VCA, ADSR, etc.
│   ├── utilities/           # StepSequencer, Collider, ChordFinder, etc.
│   └── analyzers/           # Oscilloscope, etc.
├── ui/                      # Non-canvas UI widgets (Sidebar, modals, toolbar controls)
├── patch/
│   ├── PatchSerializer.ts   # Serialize/deserialize PatchData ↔ JSON
│   ├── PatchStorage.ts      # localStorage read/write
│   └── PatchManager.ts      # Patch lifecycle (new/save/load/export) — singleton: patchManager
├── canvas/                  # Canvas rendering and CanvasComponent wrapper
├── timing/                  # TimingCalculator (BPM ↔ ms conversions)
├── music/                   # MusicalScale, WeightedRandomSelector, ScaleTypes
├── physics/                 # PhysicsEngine, CollisionResolver, Vector2D
├── storage/                 # AcceptanceStorage (localStorage wrappers)
├── visualization/           # ModulationVisualizer, visual update scheduler
├── styles/                  # main.css, components.css, canvas.css
└── main.ts                  # App entry point — wires singletons and UI

tests/                       # Vitest test files mirroring src/ structure
index.html                   # Single HTML page; .top-bar + .main-content layout
```

**Structure Decision**: Single-page browser app with no build-time server. This feature modifies four existing files and adds no new `src/` files — it is a behavioral extension of the existing Notes component (feature 036), not a new component. `ComponentData` gets exactly one schema addition — `width?: number; height?: number` in `src/core/types.ts` — no `PatchSerializer`/`PatchStorage` changes needed (the serializer is polymorphic over `component.serialize()`).

**Files requiring changes** (no new files in `src/`; new files only in `specs/037-notes-resizable/contracts/`):
- `src/core/types.ts` — add `width?`/`height?` to `ComponentData`
- `src/components/utilities/Notes.ts` — add `_width`/`_height` state, `setSize`/`getSize`, extend `serialize()`/`deserialize()`
- `src/canvas/displays/NotesDisplay.ts` — add `updateSize(width, height)`
- `src/canvas/CanvasComponent.ts` — add `getResizeHandleAt(x, y)` and `resizeBy(dx, dy)` (both gated to `ComponentType.NOTES`); update the existing Notes block in `createControls()` to stop hardcoding textarea height as `180` and to call the new `updateSize()` in its `else` branch
- `src/canvas/Canvas.ts` — add `RESIZING` interaction mode, `resizingComponentId`/`resizeStartPos` state, wire into `handleMouseDown`/`handleMouseMove`/`handleMouseUp`/`handlePointerCancel`, and add the resize-cursor check to the existing hover branch
- `src/patch/PatchManager.ts` — in `recreateComponent`, prefer a Notes component's `getSize()` over `calculateComponentDimensions()` when present

New files:
- `specs/037-notes-resizable/contracts/types.ts` — `ComponentSize` type, `RESIZE.MIN_WIDTH`/`MIN_HEIGHT` constants
- `specs/037-notes-resizable/contracts/validation.ts` — `clampSize`, `applyBottomLeftResize` (pure, 100%-covered resize math)
- `tests/components/utilities/Notes.test.ts` — extended (not created; this file already exists from feature 036) with resize-related cases

No changes needed to `PatchSerializer.ts`, `PatchStorage.ts`, or any component type other than Notes.

## Complexity Tracking

No constitution violations — this section is not applicable.
