# Phase 1 Data Model: Notes Component

## Notes (SynthComponent subclass)

Extends `SynthComponent`, placed in `src/components/utilities/Notes.ts`, registered as `ComponentType.NOTES` (category `Utilities`). The first component in the project with no ports, no parameters, and no audio nodes.

### State

| Field | Type | Notes |
|---|---|---|
| `_text` | `string` | The note content. Defaults to `''` (empty). The single piece of state this component owns. |

No ports (constructor calls no `addInput`/`addOutput`), no parameters (no `addParameter`), no audio node fields.

### Methods (public API)

- `setText(text: string)`: Store new text, clamped via `clampText` to `NOTES.MAX_TEXT_LENGTH`. Called by `NotesDisplay` on every textarea `input` event (FR-005: updates immediately, no explicit save).
- `getText(): string`: Current text. Called by `NotesDisplay` on creation/patch-load to populate the textarea.
- Inherited abstract methods, all trivial:
  - `createAudioNodes(): void` — no-op (must NOT check/throw on audio engine readiness; see research.md)
  - `destroyAudioNodes(): void` — no-op
  - `updateAudioParameter(): void` — no-op (no parameters exist)
  - `getInputNode(): AudioNode | null` — returns `null`
  - `getOutputNode(): AudioNode | null` — returns `null`

### Serialization

`serialize()` extends `SynthComponent.serialize()`:
- Base fields (`id`, `type`, `position`, `parameters` — an empty record) handled by the base class
- `text` — set on the returned `ComponentData` only when `_text` is non-empty (mirrors the Looper's conditional `audioBlob` assignment; empty notes serialize without the field, per US3 acceptance scenario 3 spirit and to keep patch JSON minimal)

`deserialize(data)`:
- Calls `super.deserialize(data)` (restores position; parameter loop is a no-op with zero parameters)
- Restores `_text` from `data.text ?? ''` — a missing/absent field yields an empty note, so legacy patches and empty-note patches both load cleanly

## ComponentData schema change (src/core/types.ts)

One new optional field on the existing interface:

| Field | Type | Notes |
|---|---|---|
| `text?` | `string` | Free-text content — used by Notes; ignored by all other components. Sibling of the existing `audioBlob?: string` (Looper) precedent. |

Backward compatibility:
- **Old patch → new code**: field absent → `deserialize` defaults to `''`. No error.
- **New patch → old code**: field present but unread → ignored (validation checks only required generic fields). No error.
- JSON string round-trips preserve all characters (quotes, symbols, emoji, newlines) natively — spec edge case covered with no escaping code needed.

## NotesDisplay (overlay element wrapper, src/canvas/displays/NotesDisplay.ts)

Not a data entity — a DOM lifecycle wrapper mirroring `LooperDisplay`'s structure, but wrapping an `HTMLTextAreaElement` instead of an `HTMLCanvasElement`, and with **no render loop** (see research.md).

| Member | Purpose |
|---|---|
| `textarea: HTMLTextAreaElement` | The editable surface. Absolute-positioned, inline dark-theme styling, `z-index: 100`, `pointerEvents: 'auto'`, placeholder text, `maxLength` attribute set from `NOTES.MAX_TEXT_LENGTH`. |
| `baseX`, `baseY` | Unscaled canvas-space position (same convention as LooperDisplay). |
| `getElement()` | Returns the textarea for DOM attachment by `CanvasComponent`. |
| `updatePosition(x, y)` | Repositioning after component move (same convention as other displays). |
| `updateViewportTransform(zoom, panX, panY)` | Zoom/pan: sets `left/top` to screen coords and `transform: scale(zoom)` with `transformOrigin: '0 0'` — identical math to LooperDisplay:86-92. |
| `setValue(text)` / `onInput(callback)` | Push initial/loaded text into the textarea; subscribe to user edits. |
| `destroy()` | Remove the textarea from the DOM (wired into `CanvasComponent.cleanup()`). |

## Validation rules

- `_text.length` MUST NOT exceed `NOTES.MAX_TEXT_LENGTH` (10,000 characters — roughly 4 KB of patch JSON at typical content, generous for "a paragraph or two" while bounding patch growth per spec Assumptions). Enforced both by `clampText` in `setText()` (authoritative) and the textarea's `maxLength` attribute (UX nicety).
- All Unicode content is legal — no character filtering (spec edge case: quotes, symbols, emoji must round-trip exactly).
- Empty text is a valid state, not an error (US1 scenario 4, US2 scenario 3).

## State Transitions

None — Notes has no state machine. Text mutates freely via `setText`; there are no modes.
