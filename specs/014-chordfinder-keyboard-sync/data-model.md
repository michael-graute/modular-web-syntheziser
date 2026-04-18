# Data Model: ChordFinder–Keyboard Visual Sync (014)

## New Event Types (src/core/types.ts)

```
EventType
  + CHORD_NOTES_ON  = 'chord:notes-on'
  + CHORD_NOTES_OFF = 'chord:notes-off'
```

### ChordNotesOnPayload
| Field       | Type       | Description                                      |
|-------------|------------|--------------------------------------------------|
| `notes`     | `number[]` | Array of 3 MIDI note numbers (octave-shifted)    |
| `sourceId`  | `string`   | ChordFinder component ID (for multi-chord disambiguation) |

### ChordNotesOffPayload
| Field       | Type       | Description                                      |
|-------------|------------|--------------------------------------------------|
| `notes`     | `number[]` | The 3 MIDI note numbers being released           |
| `sourceId`  | `string`   | ChordFinder component ID                         |

---

## Modified: Key interface (src/keyboard/Keyboard.ts)

```
Key
  note:               number    // MIDI note number (unchanged)
  name:               string    // Note label e.g. "C4" (unchanged)
  isBlack:            boolean   // (unchanged)
  x:                  number    // (unchanged)
  width:              number    // (unchanged)
  isPressed:          boolean   // Manual keyboard press (unchanged)
+ pressedByChordFinder: boolean // ChordFinder-sourced highlight (new)
```

**Highlight rule**: a key renders highlighted when `isPressed || pressedByChordFinder`.

---

## New State in KeyboardController (src/keyboard/KeyboardController.ts)

```
KeyboardController
  ...existing fields...
+ currentChordNotes: number[]        // MIDI notes currently held by ChordFinder
+ unsubscribeChordOn: () => void      // EventBus cleanup handle
+ unsubscribeChordOff: () => void     // EventBus cleanup handle
```

**State transitions**:

| Event | Action |
|---|---|
| `CHORD_NOTES_ON` received | Clear all `pressedByChordFinder` flags for notes in `currentChordNotes`; set `pressedByChordFinder = true` for each note in new payload; store as `currentChordNotes`; call `keyboard.render()` |
| `CHORD_NOTES_OFF` received | Clear `pressedByChordFinder` for each note in payload; clear `currentChordNotes`; call `keyboard.render()` |
| `destroy()` called | Call `unsubscribeChordOn()` and `unsubscribeChordOff()` |

---

## Modified: ChordFinder (src/components/utilities/ChordFinder.ts)

No new stored state. Two emit calls added:

| Method | Change |
|---|---|
| `pressChord(scaleDegree)` | After existing CV/gate logic: compute shifted MIDI notes, emit `CHORD_NOTES_ON` |
| `releaseChord()` | After existing gate-off logic: emit `CHORD_NOTES_OFF` with last pressed notes |

ChordFinder stores the last-pressed shifted MIDI notes in a private field:

```
+ lastPressedNotes: number[]   // Set in pressChord(), used by releaseChord()
```

---

## No changes to

- `PatchData` / `PatchSerializer` / `PatchStorage` — no persistence needed
- `VoiceManager` — chord notes do not go through the voice allocator
- Audio routing — CV/gate outputs unchanged
- `SynthComponent` base class — no new abstract methods
