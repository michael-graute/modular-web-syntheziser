# Research: ChordFinder–Keyboard Visual Sync (014)

## Question 1: How should ChordFinder communicate chord press/release to the Keyboard?

**Decision**: ChordFinder emits `EventType.CHORD_NOTES_ON` / `EventType.CHORD_NOTES_OFF` events on the shared `eventBus` singleton. The `KeyboardController` subscribes to these events and calls `keyboard.pressKey()` / `keyboard.releaseKey()` for each note.

**Rationale**:
- The EventBus is already the canonical pub/sub channel in this app (`eventBus` singleton exported from `EventBus.ts`). Using it avoids direct cross-module coupling between ChordFinder and KeyboardController.
- Alternative A (ChordFinder directly calling `keyboard.pressKey()`): Rejected because ChordFinder would need a reference to the Keyboard, which is a UI module outside the `components/` domain. This violates the existing separation of concerns.
- Alternative B (extending the gateTargets system): Rejected because gate targets are SynthComponents (audio domain). The Keyboard is not a SynthComponent and should not be.
- Alternative C (polling from Keyboard side): Rejected — polling ChordFinder's pressed state would add latency and waste CPU cycles in the render loop.

**Alternatives Considered**: Direct reference injection, gateTargets extension, polling, existing NOTE_ON/NOTE_OFF events.

---

## Question 2: Should ChordFinder reuse existing `EventType.NOTE_ON` / `NOTE_OFF` events?

**Decision**: No. Two new event types will be added to `EventType`:
- `CHORD_NOTES_ON = 'chord:notes-on'`
- `CHORD_NOTES_OFF = 'chord:notes-off'`

**Rationale**:
- Existing `NOTE_ON` / `NOTE_OFF` events carry a single `{frequency, velocity}` payload (see `NoteEvent` in `types.ts`). ChordFinder presses 3 notes simultaneously as a set; conflating them with single-note events would require three sequential NOTE_ON emissions and make subscriber filtering ambiguous.
- A chord event carries an array of MIDI note numbers (not frequencies), which is the natural unit for keyboard key look-up. Frequency conversion is a concern of the audio layer, not the visual layer.
- Reusing NOTE_ON would also cause KEYBOARD_INPUT components to retrigger their oscillators for each chord note, which is not desired (ChordFinder has its own CV outputs).

**Alternatives Considered**: Reuse NOTE_ON ×3, add a `source` discriminator to NoteEvent, use a new chord-specific event.

---

## Question 3: What MIDI note numbers does ChordFinder produce for a given chord?

**Decision**: ChordFinder's `diatonicChords[scaleDegree].notes` holds base MIDI numbers at octave 4. The octave shift `(this.config.octave - 4) * 12` is added before publishing to the event, producing the actual pressed MIDI note numbers.

**Rationale**: The Keyboard renders notes by MIDI note number, and its visible range is two octaves from `startOctave` (default octave 4 = MIDI 60–83). Publishing shifted MIDI numbers ensures the highlighted keys match the voicing the listener hears.

**Formula**:
```
shiftedNote = baseNote + (octave - 4) * 12
```
where `baseNote` is from `diatonicChords[scaleDegree].notes[i]` (i = 0,1,2).

---

## Question 4: How does the Keyboard track multiple highlight sources (manual vs. ChordFinder)?

**Decision**: Extend the `Key` interface in `Keyboard.ts` with a `pressedByChordFinder: boolean` flag alongside the existing `isPressed: boolean`. A key renders as highlighted when `isPressed || pressedByChordFinder` is true. The two flags are cleared independently.

**Rationale**:
- The additive highlight requirement (FR-006, FR-007) and the chord-swap atomicity requirement (FR-009) require knowing which source is responsible for each key's highlight.
- A single `pressCount` integer was considered but rejected — it would make chord-swap logic complex (need to decrement the right number). Separate booleans per source are simpler and directly model the two sources.
- A `Set<string>` of source IDs was considered for extensibility but is over-engineered for two known sources.

**Alternatives Considered**: Single `isPressed` (union, no source tracking), reference count integer, Set of source strings.

---

## Question 5: Where does KeyboardController subscribe to chord events?

**Decision**: Inside `KeyboardController`'s constructor, after the keyboard canvas and voice manager are wired up. The subscription is stored as an unsubscribe function and torn down in a new `destroy()` method.

**Rationale**: Keeps the subscription lifecycle tied to the `KeyboardController` instance lifetime, consistent with how other event listeners are managed in this codebase (class-scoped setup/teardown pattern).

---

## Question 6: What is the chord-swap atomicity mechanism?

**Decision**: When `CHORD_NOTES_ON` is received and `KeyboardController` already has tracked ChordFinder-pressed notes (stored in a `currentChordNotes: number[]` field), it first clears all of them (`key.pressedByChordFinder = false`), then applies the new set atomically before calling `render()` once. This satisfies FR-009 (no intermediate frame with both chords visible).

**Rationale**: Because both clear and apply happen synchronously before `render()`, the canvas sees only the final state. A two-event approach (CHORD_NOTES_OFF then CHORD_NOTES_ON) would risk a one-frame gap if render occurred between them.
