# Research: MIDI Monitor

**Branch**: `024-midi-monitor` | **Date**: 2026-05-14

## 1. MIDI Event Interception Strategy

**Decision**: Add a new `EventType.MIDI_MESSAGE_RECEIVED` event emitted by `MidiEngine.handleMidiMessage()` after parsing the raw bytes, carrying a structured `MidiRawMessagePayload`.

**Rationale**: The existing `eventBus` is already the app's pub/sub backbone. Emitting a typed event keeps `MidiEngine` free of monitor-specific logic, allows the monitor to be garbage-collected cleanly (unsubscribe on close), and follows the exact same pattern as `MIDI_LEARN_STARTED` / `MIDI_LEARN_COMPLETED`.

**Alternatives considered**:
- Direct observer registration on `MidiEngine` (add `addRawListener(fn)` method) — adds API surface to `MidiEngine`; rejected in favour of the existing `eventBus` pattern.
- Intercepting `input.onmidimessage` directly in the monitor — breaks if `MidiEngine` re-assigns the handler; brittle coupling rejected.

## 2. Floating Draggable Window Implementation

**Decision**: Implement drag via `pointerdown` / `pointermove` / `pointerup` on the window's title bar (no external library). Position stored as `{ top, left }` inline style on the container element.

**Rationale**: The project has zero runtime dependencies; the Web Audio API + DOM constraint is firm. Pointer events (not mouse events) handle both mouse and touch. A minimal drag implementation is ~30 lines and well within the 50-line function limit.

**Alternatives considered**:
- CSS `resize` + `draggable` HTML attribute — `draggable` fires `dragstart`/`drag` which use a ghost image by default and cannot be suppressed cleanly on all browsers; rejected.
- Dedicated drag utility class — overkill for a single window; deferred to future if more draggable windows are needed.

## 3. Log Entry Rendering Strategy

**Decision**: Render each log entry as a `<div class="midi-monitor-entry">` appended to a scroll container. When the 500-entry cap is reached, call `container.removeChild(container.firstChild)` before appending the new entry (FIFO DOM trim).

**Rationale**: Direct DOM mutation is simpler than maintaining a JS array + full re-render cycle. `firstChild` removal is O(1). The scroll container uses `overflow-y: auto` with `scroll-behavior: auto` (not `smooth`) so auto-scroll to bottom is instant and never fights manual scroll position.

**Alternatives considered**:
- Virtual list / windowed rendering — unnecessary at 500 entries; adds complexity; rejected.
- `innerHTML` batch replace on each event — causes full re-parse and loses scroll position; rejected.

## 4. Auto-Scroll Behaviour

**Decision**: Auto-scroll is active by default. If the user manually scrolls up (detected via `scroll` event: `scrollTop + clientHeight < scrollHeight - threshold`), auto-scroll is paused. It resumes automatically when the user scrolls back to the bottom.

**Rationale**: Standard pattern for live log UIs (terminal emulators, browser devtools). Allows inspection of past entries without fighting the scroll position.

**Alternatives considered**:
- Always force-scroll regardless of user position — frustrating when reviewing entries; rejected.
- Explicit pause/resume toggle button — spec notes this is out of scope for this iteration.

## 5. Singleton / No-Duplicate Window Guard

**Decision**: `MidiToolbar` holds a single `MidiMonitorWindow` instance. The `open()` method checks `this.isOpen`; if true, it calls `this.container.focus()` (or scrolls it into view). The toolbar button does not call `new MidiMonitorWindow()` on each click.

**Rationale**: Matches the `MidiMappingsModal` pattern already in `MidiToolbar`; construction happens once in the constructor, `open()` / `close()` manage visibility.

## 6. Timestamp Format

**Decision**: `new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })` plus `.` + milliseconds padded to 3 digits. Result: `14:32:05.123`.

**Rationale**: `en-GB` locale gives `HH:MM:SS` format without AM/PM on all supported browsers. Milliseconds are appended manually for sub-second precision. This is purely display formatting — no external library needed.

## 7. MIDI Message Type Labels

**Decision**: Decode `status & 0xF0` for channel messages (0x80–0xEF) and the full status byte for system messages (0xF0–0xFF). Map to human-readable labels (see contracts/types.ts).

| Status | Label |
|--------|-------|
| 0x80 | Note Off |
| 0x90 (vel > 0) | Note On |
| 0x90 (vel = 0) | Note Off |
| 0xA0 | Aftertouch (Poly) |
| 0xB0 | Control Change |
| 0xC0 | Program Change |
| 0xD0 | Aftertouch (Ch) |
| 0xE0 | Pitch Bend |
| 0xF0 | SysEx |
| 0xF2 | Song Position |
| 0xF3 | Song Select |
| 0xF8 | Clock |
| 0xFA | Start |
| 0xFB | Continue |
| 0xFC | Stop |
| 0xFF | Reset |
| other | Unknown |
