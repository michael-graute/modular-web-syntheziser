# Data Model: MIDI Monitor

**Branch**: `024-midi-monitor` | **Date**: 2026-05-14

## Entities

### MidiRawMessagePayload

Emitted on `EventType.MIDI_MESSAGE_RECEIVED` by `MidiEngine` for every incoming MIDI message.

| Field | Type | Description |
|-------|------|-------------|
| `status` | `number` | Raw status byte (0x00–0xFF) |
| `byte1` | `number` | First data byte (0–127), 0 if absent |
| `byte2` | `number` | Second data byte (0–127), 0 if absent |
| `timestamp` | `number` | `performance.now()` at point of receipt |

This is a transient, never-persisted payload. It is emitted before any CC mapping or note dispatch occurs, so the monitor sees all messages regardless of mapping state.

### MidiLogEntry

Derived from `MidiRawMessagePayload` by `MidiMonitorWindow` at display time. Never serialised.

| Field | Type | Description |
|-------|------|-------------|
| `wallTime` | `string` | `HH:MM:SS.mmm` wall-clock string |
| `type` | `string` | Human-readable message type label (e.g., `"Note On"`) |
| `channel` | `string` | `"1"–"16"` for channel messages; `"—"` for system messages |
| `data1` | `string` | Formatted primary data byte (e.g., `"C4 (60)"` for note, `"7"` for CC number) |
| `data2` | `string` | Formatted secondary data byte (e.g., `"100"` for velocity), `""` if unused |

### MidiMonitorWindow (runtime object)

| Property | Type | Description |
|----------|------|-------------|
| `isOpen` | `boolean` | Whether the window is currently visible |
| `entries` | `MidiLogEntry[]` | In-memory log; max 500 entries (FIFO) |
| `autoScroll` | `boolean` | Whether new entries force-scroll to bottom |
| `container` | `HTMLElement` | Root DOM node of the floating window |
| `unsubscribe` | `(() => void) \| null` | EventBus unsubscribe handle; set on open, cleared on close |

## State Transitions

```
[closed] --open()--> [open, listening]
[open, listening] --close()--> [closed, unsubscribed]
[open, listening] --clearLog()--> [open, entries=[]]
[open, listening] --MIDI_MESSAGE_RECEIVED--> [open, entries.length++] (with FIFO trim if > 500)
```

## Constraints & Validation Rules

- `entries` array is never persisted; it is reset to `[]` when the window is closed.
- Maximum entries: `MAX_LOG_ENTRIES = 500`. When this limit is reached, `entries.shift()` removes the oldest before `entries.push()` adds the new one. DOM children mirror this exactly.
- `MIDI_MESSAGE_RECEIVED` is only subscribed while the window is open. Events emitted while closed are silently dropped.
- Wall-clock timestamp is captured at render time (inside the event handler), not from `MidiRawMessagePayload.timestamp`, to keep the display format simple.
