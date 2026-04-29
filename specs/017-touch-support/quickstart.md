# Quickstart: Touch Support (017)

## What this feature does

Adds iPad and touch-device support to the modular synthesizer. After implementation, users on iPads can:
- Adjust knobs and sliders by dragging
- Move components by dragging their headers
- Pan the canvas with two fingers, pinch to zoom
- Connect/disconnect cables by tapping ports
- Delete components via long-press context menu
- Add components from a collapsible sidebar via tap

## Key files to read before implementing

| File | Why |
|------|-----|
| [src/canvas/Canvas.ts](../../../src/canvas/Canvas.ts) | Core of the change — replace mouse listeners with pointer listeners |
| [src/keyboard/Keyboard.ts](../../../src/keyboard/Keyboard.ts) | Replace mouse listeners with pointer + `setPointerCapture` |
| [src/ui/Sidebar.ts](../../../src/ui/Sidebar.ts) | Add touch tap-to-add alongside HTML5 drag-and-drop |
| [src/styles/canvas.css](../../../src/styles/canvas.css) | Add `touch-action: none` |
| [src/styles/main.css](../../../src/styles/main.css) | Add sidebar collapse CSS |
| [index.html](../../../index.html) | Add `#sidebar-toggle` button |

## Implementation order

1. **`src/canvas/GestureHelpers.ts`** (new) — pure helper functions; write tests first
2. **`src/styles/canvas.css` + `src/styles/main.css`** — CSS-only changes, no logic risk
3. **`index.html`** — add sidebar toggle button
4. **`src/ui/ContextMenu.ts`** (new) — context menu class
5. **`src/canvas/Canvas.ts`** — replace mouse listeners; wire long-press + two-finger gestures
6. **`src/keyboard/Keyboard.ts`** — replace per-key mouse listeners
7. **`src/ui/Sidebar.ts`** — add touch tap-to-add guard
8. **`src/main.ts`** — touch detection init + sidebar toggle wiring

## Gesture constants

Defined in `contracts/types.ts` and mirrored in `src/canvas/GestureHelpers.ts`:

```typescript
DRAG_THRESHOLD_PX = 8   // distance before tap → drag
LONG_PRESS_MS     = 500 // hold time before long-press fires
```

## Testing on iPad

Use Safari Web Inspector via macOS to attach to an iPadOS Safari tab. Alternatively, use Chrome DevTools device emulation with "iPad" preset for basic gesture testing (note: pinch simulation requires two-finger trackpad gestures in DevTools).

## Running tests

```bash
vitest run
```
