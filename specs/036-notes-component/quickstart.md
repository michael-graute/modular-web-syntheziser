# Quickstart Guide: Notes Component

**Feature**: `036-notes-component`
**Created**: 2026-07-08
**Target Audience**: Developers implementing this feature
**Prerequisites**: Familiarity with TypeScript 5.6+, this project's `SynthComponent`/`CanvasComponent` architecture, and the overlay-display pattern (see `LooperDisplay`/`XYPadDisplay` as precedents)

---

## Architecture Overview

Notes is deliberately the simplest component in the project — and architecturally novel in two ways:

1. **No signal role**: no ports, no parameters, no audio nodes. All `SynthComponent` audio lifecycle methods are no-ops (and must not throw — see research.md).
2. **Native DOM editing surface**: the display overlay is an `HTMLTextAreaElement`, not a `<canvas>`. Same positioning/transform machinery as `LooperDisplay`, but with native text editing and **no rAF render loop**.

Keyboard isolation is free: `Canvas.ts:269-276` and `KeyboardController.ts:130-140` already ignore key events targeting a textarea, so typing in Notes cannot trigger musical notes, Looper shortcuts, or component deletion.

```typescript
import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position } from '../../core/types';
import { clampText, shouldSerializeText } from '../../../specs/036-notes-component/contracts/validation';

export class Notes extends SynthComponent {
  private _text: string = '';

  constructor(id: string, position: Position) {
    super(id, ComponentType.NOTES, 'Notes', position);
    // No addInput / addOutput / addParameter calls — Notes has none.
  }

  createAudioNodes(): void { /* no audio role */ }
  destroyAudioNodes(): void { /* no audio role */ }
  updateAudioParameter(): void { /* no parameters */ }
  getInputNode(): AudioNode | null { return null; }
  getOutputNode(): AudioNode | null { return null; }

  setText(text: string): void { this._text = clampText(text); }
  getText(): string { return this._text; }
  // serialize/deserialize: see data-model.md
}
```

## Component Setup

1. Add `NOTES = 'notes'` to `ComponentType` in `src/core/types.ts`, **and** add `text?: string` to the `ComponentData` interface (comment it like `audioBlob`: "Free-text content — used by Notes; ignored by all other components").
2. Create `src/components/utilities/Notes.ts` per data-model.md (imports `clampText`/`shouldSerializeText` and `NOTES` constants from this spec's `contracts/`).
3. Create `src/canvas/displays/NotesDisplay.ts`: constructs a styled `<textarea>` (absolute position, dark theme, `z-index: 100`, `transformOrigin: '0 0'`, placeholder from `NOTES.PLACEHOLDER`, `maxLength` from `NOTES.MAX_TEXT_LENGTH`), exposes `getElement()`, `updatePosition()`, `updateViewportTransform()`, `setValue()`, `onInput(cb)`, `destroy()` — copy `LooperDisplay`'s position/transform math verbatim, drop everything render-related.

## Module Integration

1. **`src/components/registerComponents.ts`**: one `componentRegistry.register(ComponentType.NOTES, 'Notes', 'Free-text notes attached to the patch', 'Utilities', (id, position) => new Notes(id, position), calculateComponentDimensions(ComponentType.NOTES))` call.
2. **`src/utils/componentLayout.ts`**: `getControlLayout` case returning `{ hasDisplayArea: true, displayHeight: 180 }` (no knobs/dropdowns); `getPortCounts` case returning `{ inputs: 0, outputs: 0 }` (first zero-port component — the height formula degrades gracefully, `maxPorts = 0`); width override in `calculateComponentWidth` (`width = 240` for comfortable line length).
3. **`src/canvas/CanvasComponent.ts`**:
   - `createControls()` block for `ComponentType.NOTES`: compute `displayX/Y` the same way the Looper block does, instantiate `NotesDisplay` once, append `getElement()` to `#synth-canvas`'s parent, call `setValue(notes.getText())`, wire `onInput(text => notes.setText(text))`. On re-run (component moved), call `updatePosition()` only. **No rAF loop.**
   - `cleanup()`: destroy the display (mirrors `looperDisplay` cleanup).
   - `updateViewportTransform()`: forward to the display (mirrors `looperDisplay`).
   - `getDisplayName` map: add `[ComponentType.NOTES]: 'Notes'` — **TypeScript's exhaustive `Record<ComponentType, string>` forces this**, the enum addition won't compile without it.
4. **`src/ui/Sidebar.ts`**: icon glyph in `getComponentIcon` (e.g. `'✎'`) — also compiler-forced.

Patch save/load works automatically: `PatchSerializer` is polymorphic over `component.serialize()`, and the new optional `text` field needs no validator changes.

## Interaction Lifecycle

```
Add Notes from sidebar → empty textarea with placeholder appears on canvas
Click into textarea → type freely (musical keys / shortcuts suppressed automatically)
Click canvas outside → textarea defocuses, text stays visible
Drag component header → component + textarea move together (updatePosition)
Zoom/pan canvas → textarea tracks via updateViewportTransform
Save patch → text lands in ComponentData.text (omitted when empty)
Load patch → deserialize restores text; setValue pushes it into the textarea
Delete component → cleanup() removes the textarea from the DOM
```

## Testing Strategy

- `clampText` / `shouldSerializeText` — 100% coverage, no mocks needed (boundary: exactly at, below, above `MAX_TEXT_LENGTH`; empty string; emoji/multibyte content).
- `Notes` unit tests (mock `audioEngine` NOT needed — verify `activate()` works without any audio mock, proving the no-throw no-op contract): `setText`/`getText`, clamping, serialize round-trip with special characters/emoji/newlines, empty-text serializes without a `text` field, missing-field deserialize yields `''`.
- Multi-instance independence: two `Notes` instances hold separate text (FR-012).

## Common Pitfalls & Debugging

- **Do not copy the `audioEngine.isReady()` throw** from other components' `createAudioNodes` — Notes must activate cleanly regardless of audio state.
- **Do not overwrite `base.parameters` in `serialize()`** (the Looper does; Notes shouldn't — the base handles it, and there's nothing to add).
- The textarea must be appended to `#synth-canvas`'s **parent** (`.canvas-container`), not the canvas itself — same as every overlay display.
- Remember the exhaustive maps: adding the enum member breaks compilation until `getDisplayName` (CanvasComponent.ts) and `getComponentIcon` (Sidebar.ts) both get entries — this is by design and catches forgotten registrations.
