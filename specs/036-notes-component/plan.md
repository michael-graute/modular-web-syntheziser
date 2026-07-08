# Implementation Plan: Notes Component

**Branch**: `036-notes-component` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/036-notes-component/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

A new `NOTES` component provides a plain-text editing area on the patch canvas for documentation — the first component in this project with **no audio/CV/gate ports and no audio nodes at all**. The editable surface is a native `<textarea>` overlay element positioned over the component's display area, following the established sibling-overlay-element pattern (`LooperDisplay`/`XYPadDisplay` overlay canvases) but holding a DOM text input instead of a `<canvas>` — this gives native text editing (cursor, selection, copy/paste, undo, scrolling, IME) for free. Keyboard isolation requires **zero new code**: the app's global keydown handlers (`Canvas.ts:269-276` for shortcuts/delete, `KeyboardController.ts:133-139` for musical keys and Looper shortcuts) already ignore events targeting an `HTMLTextAreaElement`. Text persists via a new optional `ComponentData.text?: string` field (per the spec's Clarifications), mirroring how `audioBlob?: string` was added for the Looper — backward-compatible in both directions since the field is optional and `PatchSerializer`'s validation checks only the generic required shape.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**: DOM only — this component uses no Web Audio API at all (no audio nodes, no ports)
**Storage**: `localStorage` via existing `PatchSerializer` / `PatchStorage` pattern, extended with one new optional `ComponentData.text?: string` field
**Testing**: Vitest (run via `vitest run`)
**Target Platform**: Browser (Vite dev server / static build)
**Project Type**: Single-page modular synthesizer app (`src/` flat structure with `core/`, `components/`, `ui/`, `patch/`, `canvas/`, `timing/` directories)
**Performance Goals**: 60 FPS canvas rendering; typing latency imperceptible (native textarea input path, not canvas-rendered text)
**Constraints**:
- Zero new runtime dependencies — DOM only
- TypeScript strict mode enforced
- Patch format changes must be backward-compatible: `text?: string` is optional, so legacy patches (no field) load unchanged and new patches degrade gracefully in older code (field ignored)
- The component extends `SynthComponent` (required by the registry, serializer, and canvas integration) but implements all audio lifecycle methods (`createAudioNodes`, `destroyAudioNodes`, `updateAudioParameter`, `getInputNode`, `getOutputNode`) as no-ops/null — it must NOT throw when the audio engine state is irrelevant to it
- No runtime resizing (per spec Clarifications) — fixed dimensions from `getControlLayout`, like every other component
- Editable surface is a native `<textarea>` overlay, NOT canvas-rendered text editing — existing keyboard guards depend on the event target being a real `HTMLTextAreaElement`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0

Verify feature compliance with project constitution principles:

- [x] **Readability & Maintainability**: `Notes.ts` is a minimal `SynthComponent` subclass (text state + serialize/deserialize); `NotesDisplay.ts` owns the overlay `<textarea>` lifecycle, matching the `Looper`/`LooperDisplay` and `XYPad`/`XYPadDisplay` split.
- [x] **Code Organization**: New files land in `src/components/utilities/` (`Notes.ts`) and `src/canvas/displays/` (`NotesDisplay.ts`), matching existing placement for utility components and their overlay displays.
- [x] **Code Standards**: Default dimensions, max text length, and placeholder text are named constants (in `NotesDisplay.ts`/contracts), not inline magic values.
- [x] **Test Coverage**: Text state get/set, serialize/deserialize round-trip (including special characters/emoji), max-length clamping, and empty-state handling are pure-logic and unit-testable without DOM or AudioContext; validation helpers in `contracts/validation.ts` get 100% coverage.
- [x] **Test Quality**: New tests live under `tests/components/utilities/Notes.test.ts`, isolated per-test instances, AAA pattern, consistent with `XYPad.test.ts` conventions.
- [x] **UI Consistency**: Reuses the overlay-element pattern (absolute-positioned sibling of `#synth-canvas`, viewport-transform-aware, `z-index: 100`) and standard component header/selection behavior — no new design tokens beyond textarea styling matched to the existing dark theme.
- [x] **User Feedback**: Typed text appears via the native input path (synchronous); placeholder text guides first use; no operations exceed 300ms (text is stored in memory and serialized with the patch like any other component state).
- [x] **Performance**: No audio-thread involvement whatsoever; the textarea is a static DOM element updated only by user input — no per-frame rendering loop is needed for the text itself (unlike Looper/XYPad displays, no rAF loop required).

No violations identified. Complexity Tracking section below is not applicable.

## Project Structure

### Documentation (this feature)

```text
specs/036-notes-component/
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
│   ├── types.ts             # ComponentType enum, PatchData, ComponentData (gets the new text?: string field)
│   ├── EventBus.ts          # Publish-subscribe event system (singleton: eventBus)
│   └── AudioEngine.ts       # Web Audio context wrapper (NOT used by Notes)
├── components/
│   ├── base/
│   │   └── SynthComponent.ts  # Abstract base class — Notes implements audio methods as no-ops
│   └── utilities/           # Notes.ts lands here
├── ui/                      # Sidebar (icon entry), HelpSidebar (docs entry)
├── patch/
│   ├── PatchSerializer.ts   # No changes — polymorphic over component.serialize()
│   ├── PatchStorage.ts      # No changes
│   └── PatchManager.ts      # No changes — registry-driven deserialization
├── canvas/
│   ├── CanvasComponent.ts   # New NOTES block in createControls() + cleanup() + updateViewportTransform() + getDisplayName map
│   └── displays/            # NotesDisplay.ts lands here (overlay <textarea>, not a canvas)
└── utils/
    └── componentLayout.ts   # New cases in getControlLayout and getPortCounts

tests/                       # Vitest test files
```

**Structure Decision**: Single-page browser app. New files: `src/components/utilities/Notes.ts` (SynthComponent subclass holding text state and serialization) and `src/canvas/displays/NotesDisplay.ts` (overlay `<textarea>` lifecycle: creation, positioning, viewport transform, value sync, destruction). Patch persistence needs exactly one schema addition — `text?: string` on `ComponentData` in `src/core/types.ts` — and no serializer/storage changes.

**Files requiring a new case/entry for `ComponentType.NOTES`** (same registration surface as feature 035, confirmed then):
- `src/core/types.ts` — add `NOTES` to the `ComponentType` enum AND add `text?: string` to `ComponentData`
- `src/components/registerComponents.ts` — one `componentRegistry.register(...)` call (category `'Utilities'`)
- `src/utils/componentLayout.ts` — new case in `getControlLayout` (display area only, no knobs) and `getPortCounts` (`{ inputs: 0, outputs: 0 }` — the first zero-port component; port-area height degrades to just padding, which is fine) plus a width override in `calculateComponentWidth`
- `src/canvas/CanvasComponent.ts` — new `if (this.type === ComponentType.NOTES)` block in `createControls()` (instantiate `NotesDisplay`, append to `#synth-canvas`'s parent, wire input events to `notes.setText()`), plus entries in `cleanup()`, `updateViewportTransform()`, and the `getDisplayName` exhaustive map (TypeScript forces this one)
- `src/ui/Sidebar.ts` — icon glyph entry in the exhaustive `getComponentIcon` map (TypeScript forces this one too)

No changes needed to `PatchSerializer.ts`, `PatchManager.ts`, keyboard handling (`Canvas.ts` / `KeyboardController.ts` guards already cover `HTMLTextAreaElement` targets), or the bypass allowlist (Notes is not bypassable).

## Complexity Tracking

No constitution violations — this section is not applicable.
