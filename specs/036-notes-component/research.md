# Phase 0 Research: Notes Component

No `[NEEDS CLARIFICATION]` markers remained after `/speckit-clarify` (see spec.md Clarifications — that session already resolved the two codebase-constraint questions: resize dropped, new `text` field for storage). This document records the remaining technical decisions, each grounded in verified codebase facts.

## Decision: Editable surface — native `<textarea>` overlay, not canvas-rendered text editing

**Decision**: `NotesDisplay` creates a native `<textarea>` element, absolutely positioned as a sibling of `#synth-canvas` (same DOM parent), with `pointerEvents: 'auto'`, inline dark-theme styling, and the same base-position + `updateViewportTransform(zoom, panX, panY)` handling that `LooperDisplay`/`XYPadDisplay` use for their overlay canvases.

**Rationale**: The spec's Assumptions require "the browser's native text input behavior (native text selection, copy/paste, undo/redo within the field) rather than a custom-built text editing engine." Canvas-rendered text editing would mean reimplementing cursors, selection, clipboard, IME, and scrolling — enormous scope for zero benefit. The overlay-element pattern is already proven twice in this codebase (LooperDisplay overlay canvas at `CanvasComponent.ts:1449-1499`, XYPadDisplay at `CanvasComponent.ts:1502+`); swapping the overlaid element type from `<canvas>` to `<textarea>` reuses the identical positioning/transform/cleanup machinery. The `.canvas-container canvas:not(#synth-canvas)` z-index CSS rule (`canvas.css:119-121`) only targets `<canvas>` elements, so the textarea sets its own inline `z-index: 100`, exactly as the display classes already do inline anyway.

**Alternatives considered**:
- *Canvas-rendered text with custom editing*: Rejected — violates the spec's native-editing assumption and would be by far the largest text-handling effort in the project for a strictly worse result.
- *`contentEditable` div*: Rejected — permits rich-text/HTML paste artifacts that then need sanitizing (spec FR-004 requires plain text only); a `<textarea>` is plain-text by construction. The existing keyboard guards do also cover `isContentEditable` (`KeyboardController.ts:137`), but textarea is the simpler, safer fit.

## Decision: Keyboard isolation — zero new code needed

**Decision**: Rely entirely on the existing global-handler guards; add no new keyboard-handling code.

**Rationale**: Verified in source: `Canvas.ts:269-276` (`handleKeyDown` — component-delete and canvas shortcuts) returns early when `e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement`. `KeyboardController.ts:130-140` (musical note keys AND Looper reserved-key shortcuts) returns early on the same check, additionally covering `document.activeElement` and `isContentEditable`. Since the Notes editing surface IS an `HTMLTextAreaElement`, every keystroke typed into it is automatically invisible to note triggering, Looper transport keys, and the delete-component shortcut. This was the biggest integration risk for this feature and it is already fully handled.

**Alternatives considered**:
- *stopPropagation on the textarea's keydown*: Unnecessary belt-and-braces; the guards are target-based, not propagation-based (handlers listen on `window`, so stopping propagation wouldn't even reach them differently). Not needed.

## Decision: Text persistence — new optional `ComponentData.text?: string` field

**Decision**: Add `text?: string` to the `ComponentData` interface (`core/types.ts:117-124`), set by `Notes.serialize()` only when text is non-empty, read by `Notes.deserialize()`.

**Rationale**: Decided in the spec's clarification session. `parameters` is strictly `Record<string, number>` (`types.ts:121`, validated numerically in `PatchSerializer.ts:111-112`) and `audioBlob` is documented as Base64 PCM audio. A dedicated optional field mirrors exactly how `audioBlob?: string` was added for the Looper: one component's special data, optional, ignored by everything else. Backward compatibility is automatic — `validatePatchData` checks only the required generic shape and does not reject or strip unknown fields, legacy patches simply lack the field, and JSON round-trips preserve all string content including quotes/emoji (spec edge case) natively.

**Alternatives considered** (from the clarification session):
- *Reusing `audioBlob` with Base64-encoded text*: Rejected — contradicts the field's documented meaning and type comment; saves nothing.
- *Encoding text as char codes in `parameters`*: Rejected — grotesque misuse of a numeric record and would bloat patch JSON.

## Decision: Audio lifecycle — true no-ops, no throw on missing audio engine

**Decision**: `Notes` implements the abstract `SynthComponent` methods as no-ops: `createAudioNodes()` and `destroyAudioNodes()` do nothing (no `audioEngine.isReady()` check, no throw), `updateAudioParameter()` does nothing, `getInputNode()`/`getOutputNode()` return `null`. The constructor registers no inputs, no outputs, and no parameters.

**Rationale**: Notes is the first component with no signal role (spec FR-011). Other components throw from `createAudioNodes()` when the engine isn't ready because they genuinely need a context; Notes needs nothing, and throwing would break `activate()` (called by `PatchManager.ts:306` on add/load) for a component that has no reason to care about audio state. Zero ports is also new: `getPortCounts` returns `{ inputs: 0, outputs: 0 }`, making `portAreaHeight` degrade to just `PORT_PADDING` — verified harmless in the height formula (`componentLayout.ts:424-427`, `maxPorts = 0`).

**Alternatives considered**:
- *Not extending `SynthComponent` at all (a separate "annotation" object type)*: Rejected — the component registry, `PatchManager` deserialization, canvas hit-testing/selection/deletion, and `ComponentData` serialization all operate on `SynthComponent`; a parallel type would require touching every one of those systems. A no-op subclass costs ~40 lines and inherits all of it.

## Decision: No render loop — event-driven text sync only

**Decision**: Unlike `LooperDisplay`/`XYPadDisplay`, `NotesDisplay` needs **no `requestAnimationFrame` loop**. The textarea repaints itself natively on input; the component syncs state via the textarea's `input` event (`textarea.value` → `notes.setText()`) and pushes state the other way only on patch load (`notes.getText()` → `textarea.value`).

**Rationale**: The rAF loops in existing displays exist to poll continuously-changing audio-side state (playhead position, pad position during playback) into canvas redraws. Notes has no continuously-changing state — text changes only on user input, which the DOM already delivers as an event. Skipping the loop avoids waste and matches the constitution's performance principle.

**Alternatives considered**: None seriously — a polling loop here would be strictly worse.
