# Quickstart: Implementing MIDI Monitor (024)

## Overview of changes

| File | Action | What to do |
|------|--------|-----------|
| `src/core/types.ts` | Modify | Add `MIDI_MESSAGE_RECEIVED` to `EventType` enum; add `MidiRawMessagePayload` interface |
| `src/midi/MidiEngine.ts` | Modify | Emit `MIDI_MESSAGE_RECEIVED` at top of `handleMidiMessage()` |
| `src/ui/MidiMonitorWindow.ts` | Create | New floating window class |
| `src/ui/MidiToolbar.ts` | Modify | Instantiate `MidiMonitorWindow`; add "MIDI Monitor" button |
| `src/styles/components.css` | Modify | Add `.midi-monitor-*` CSS rules |
| `tests/ui/MidiMonitorWindow.test.ts` | Create | Unit tests for formatting + window logic |

---

## Step 1 — Add EventType and payload type (`src/core/types.ts`)

Add to the `EventType` enum:
```ts
MIDI_MESSAGE_RECEIVED = 'midi:message-received',
```

Add the payload interface (after `MidiLearnSession`):
```ts
export interface MidiRawMessagePayload {
  status: number;
  byte1: number;
  byte2: number;
  timestamp: number;
}
```

---

## Step 2 — Emit the event in MidiEngine (`src/midi/MidiEngine.ts`)

At the very top of `handleMidiMessage()`, before any parsing:
```ts
eventBus.emit(EventType.MIDI_MESSAGE_RECEIVED, {
  status: data[0]!,
  byte1: data.length > 1 ? data[1]! : 0,
  byte2: data.length > 2 ? data[2]! : 0,
  timestamp: performance.now(),
} satisfies MidiRawMessagePayload);
```

Import `MidiRawMessagePayload` at the top of the file.

---

## Step 3 — Create MidiMonitorWindow (`src/ui/MidiMonitorWindow.ts`)

Key responsibilities:
1. Build the floating window DOM (title bar + log container + footer with Clear button)
2. Implement pointer-based drag on the title bar
3. On `open()`: append to `document.body`, subscribe to `MIDI_MESSAGE_RECEIVED`
4. On `close()`: hide window, unsubscribe from event
5. On each event: call `formatMidiLogEntry()`, append DOM row, enforce 500-entry FIFO cap, auto-scroll
6. Guard against duplicate open: if already open, focus the window instead

See `contracts/types.ts` and `contracts/validation.ts` for the formatting logic to inline or import.

---

## Step 4 — Wire into MidiToolbar (`src/ui/MidiToolbar.ts`)

In the constructor:
1. Create `this.monitorWindow = new MidiMonitorWindow();`
2. Create `this.monitorBtn = document.createElement('button')` with text `'MIDI Monitor'` and class `'midi-monitor-open-btn'`
3. Append `this.monitorBtn` to `this.container` after the existing `this.mappingsBtn`
4. Add click listener: `this.monitorBtn.addEventListener('click', () => this.monitorWindow.open())`

---

## Step 5 — Add CSS (`src/styles/components.css`)

Required classes:
- `.midi-monitor-window` — the floating container (`position: fixed`, `z-index: var(--z-index-popover)`, `min-width: 480px`, `max-height: 400px`, `display: flex`, `flex-direction: column`)
- `.midi-monitor-window__header` — drag handle row (cursor: grab, flex row with title + close button)
- `.midi-monitor-window__log` — scrollable log area (`overflow-y: auto`, `flex: 1`, `font-family: monospace`, `font-size: 11px`)
- `.midi-monitor-entry` — single log row (grid layout: `time | type | ch | data1 | data2`)
- `.midi-monitor-window__footer` — bottom bar with Clear Log button

---

## Step 6 — Tests (`tests/ui/MidiMonitorWindow.test.ts`)

Required test cases:
- `formatMidiLogEntry` correctly labels Note On, Note Off (vel=0), CC, Pitch Bend, Clock
- `formatWallClock` outputs `HH:MM:SS.mmm` format
- `midiNoteToName(60)` returns `"C4 (60)"`
- `parseMidiChannel` returns `"—"` for status >= 0xF0
- Log caps at 500 entries (FIFO: oldest entry removed)
- `clearLog()` empties the entries array
- `open()` called twice does not create duplicate DOM nodes

Run with: `vitest run tests/ui/MidiMonitorWindow.test.ts`

---

## Key design decisions (see research.md for full rationale)

- **Event approach**: `eventBus.emit(MIDI_MESSAGE_RECEIVED)` — no API changes to `MidiEngine` beyond one emit call
- **Drag**: pointer events on title bar only; `setPointerCapture` ensures drag continues outside the window
- **FIFO**: DOM `removeChild(firstChild)` + array `shift()` kept in sync
- **Auto-scroll**: paused when user scrolls up; resumes when back at bottom
- **Singleton**: `MidiToolbar` holds one `MidiMonitorWindow` instance; `open()` is idempotent
