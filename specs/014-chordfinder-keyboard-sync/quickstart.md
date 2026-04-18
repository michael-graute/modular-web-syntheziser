# Quickstart: ChordFinder–Keyboard Visual Sync (014)

## What this feature does

When a chord is pressed in the ChordFinder module, the three notes of that chord are highlighted on the Keyboard canvas in the same blue style as manually-pressed keys. When the chord is released, the highlights are removed. Manual key presses and ChordFinder highlights are tracked independently and coexist without conflict.

## Files changed

| File | Change |
|---|---|
| `src/core/types.ts` | Add `CHORD_NOTES_ON` and `CHORD_NOTES_OFF` to `EventType` enum; add `ChordNotesOnPayload` and `ChordNotesOffPayload` interfaces |
| `src/components/utilities/ChordFinder.ts` | Emit `CHORD_NOTES_ON` in `pressChord()`; emit `CHORD_NOTES_OFF` in `releaseChord()` |
| `src/keyboard/Keyboard.ts` | Add `pressedByChordFinder: boolean` to `Key` interface; update render logic to highlight when either flag is set; add `pressKeyFromChordFinder()` and `releaseKeyFromChordFinder()` public methods |
| `src/keyboard/KeyboardController.ts` | Subscribe to `CHORD_NOTES_ON` / `CHORD_NOTES_OFF` on `eventBus`; add `destroy()` for cleanup; track `currentChordNotes` |

## No changes required

- `main.ts` — no new wiring needed (KeyboardController subscribes to eventBus internally)
- `PatchSerializer.ts` / `PatchStorage.ts` — no persistence changes
- Any audio routing code

## Local dev

```bash
npm run dev        # start Vite dev server
vitest run         # run tests
npm run lint       # lint check
```

## Testing the feature manually

1. Start the dev server (`npm run dev`)
2. Add a **ChordFinder** and a **Keyboard** module to the canvas
3. Click a chord button in ChordFinder → confirm the three notes light up blue on Keyboard
4. Release the chord button → confirm keys return to white/dark
5. Hold a key manually on the Keyboard, then press a ChordFinder chord that includes the same note → both highlights coexist
6. Release the ChordFinder chord → the manually-held key stays highlighted
7. Press a second chord while the first is still held → previous chord keys clear, new ones light up atomically
8. Remove the Keyboard module from the canvas, press chords in ChordFinder → no errors

## Key design decisions

- **EventBus decoupling**: ChordFinder emits events; KeyboardController listens. No direct reference between the two modules.
- **Separate flags on Key**: `isPressed` (manual) and `pressedByChordFinder` (ChordFinder). Cleared independently.
- **Atomic chord swap**: On `CHORD_NOTES_ON`, old flags are cleared and new ones set before a single `render()` call — no intermediate frame.
- **No persistence**: Chord highlight state resets on patch load. Keys always start unpressed.
