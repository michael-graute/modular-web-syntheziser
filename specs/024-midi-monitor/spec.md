# Feature Specification: MIDI Monitor

**Feature Branch**: `024-midi-monitor`
**Created**: 2026-05-14
**Status**: Draft
**Input**: User description: "MIDI monitor. There should be a button in the midi toolbar labelled 'MIDI Monitor'. When clicked, a window should open, that monitors and logs all midi events that are send to the app. The logs should be persisted in a list. the log list can be cleared with a clear log button."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open MIDI Monitor Window (Priority: P1)

As a user working with MIDI devices, I want to open a MIDI Monitor window from the MIDI toolbar so I can see all incoming MIDI events in real time.

**Why this priority**: This is the entry point to the entire feature. Without the ability to open the monitor window, nothing else is accessible.

**Independent Test**: Can be fully tested by clicking the "MIDI Monitor" button in the MIDI toolbar — a monitor window appears and displays incoming MIDI events as they occur.

**Acceptance Scenarios**:

1. **Given** the app is open and a MIDI toolbar is visible, **When** the user clicks the "MIDI Monitor" button, **Then** a MIDI Monitor window opens.
2. **Given** the MIDI Monitor window is already open, **When** the user clicks "MIDI Monitor" again, **Then** the window is brought to focus (not duplicated).
3. **Given** the MIDI Monitor window is open, **When** the user closes it, **Then** the window closes and MIDI events stop being logged to the display.

---

### User Story 2 - View Incoming MIDI Events in Real Time (Priority: P1)

As a user, I want the MIDI Monitor to display all MIDI messages received by the app in a scrollable log so I can inspect what my MIDI devices are sending.

**Why this priority**: Core value of the feature — seeing live MIDI data is the primary use case.

**Independent Test**: Connect a MIDI device, open the monitor, trigger notes/CCs — each event appears as a new row in the log list immediately.

**Acceptance Scenarios**:

1. **Given** the MIDI Monitor is open and a MIDI device sends a Note On message, **When** the message is received, **Then** a new log entry appears showing event type, channel, note/value, and timestamp.
2. **Given** the MIDI Monitor is open, **When** multiple MIDI events arrive in quick succession, **Then** all events are logged in order without dropping entries.
3. **Given** the log grows long, **When** new events arrive, **Then** the list scrolls automatically to show the latest entry.
4. **Given** the MIDI Monitor is open, **When** any MIDI message type is received (Note On, Note Off, Control Change, Pitch Bend, Program Change, Clock, etc.), **Then** the event type is correctly identified and displayed.

---

### User Story 3 - Clear the Event Log (Priority: P2)

As a user, I want to clear all logged MIDI events from the list so I can start fresh when diagnosing a new interaction.

**Why this priority**: Essential for usability during debugging sessions — stale log entries clutter the view.

**Independent Test**: Can be tested independently by opening the monitor, triggering some MIDI events, then clicking "Clear Log" — the list empties.

**Acceptance Scenarios**:

1. **Given** the MIDI Monitor contains logged events, **When** the user clicks the "Clear Log" button, **Then** all entries are removed from the log list immediately.
2. **Given** the log has been cleared, **When** new MIDI events arrive, **Then** new entries are logged normally from that point forward.
3. **Given** an empty log, **When** the user clicks "Clear Log", **Then** nothing happens and no error occurs.

---

### Edge Cases

- What happens when no MIDI device is connected? The log remains empty; the monitor window still opens without error.
- What happens when MIDI events arrive while the monitor window is closed? Events are not logged — monitoring is active only while the window is open.
- What happens when the log contains a very large number of entries? The list remains scrollable and performant; older entries may be capped at a reasonable maximum (e.g., 500 entries) to avoid memory issues.
- How does the system handle MIDI messages with unusual or manufacturer-specific status bytes? Status byte `0xF0` is labelled `"SysEx"`; all other unrecognised bytes are labelled `"Unknown"`. Raw byte values are displayed in the data columns.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The MIDI toolbar MUST include a button labelled "MIDI Monitor".
- **FR-002**: Clicking the "MIDI Monitor" button MUST open a dedicated MIDI Monitor as a floating overlay window that is draggable and sits above the canvas.
- **FR-003**: If the MIDI Monitor window is already open, clicking the button again MUST bring it to focus rather than opening a second instance.
- **FR-004**: The MIDI Monitor window MUST display a scrollable, chronological list of all MIDI events received by the app while the window is open.
- **FR-005**: Each log entry MUST display at minimum: wall-clock timestamp (e.g., `14:32:05.123`), MIDI event type, MIDI channel, and relevant data values (e.g., note number + velocity for Note On/Off, controller number + value for CC).
- **FR-006**: The log list MUST auto-scroll to the most recent entry as new events arrive.
- **FR-007**: The MIDI Monitor window MUST include a "Clear Log" button that removes all entries from the log list.
- **FR-008**: The log list MUST persist in memory for the duration the monitor window is open; clearing is only performed explicitly by the user.
- **FR-009**: MIDI monitoring MUST support all standard MIDI message types: Note On, Note Off, Control Change, Pitch Bend, Aftertouch (channel and polyphonic), Program Change, MIDI Clock, Start, Stop, Continue, and SysEx (displayed as raw bytes).
- **FR-010**: The log list MUST cap at a maximum of 500 entries; when the cap is reached, the oldest entries are removed as new ones are added (FIFO).

### Key Entities

- **MIDI Log Entry**: A single captured MIDI event with fields: wall-clock timestamp (HH:MM:SS.mmm format), event type label, channel number (1–16 for channel messages; "—" for system messages), primary data byte (e.g., note number or CC number), secondary data byte (e.g., velocity or CC value).
- **MIDI Monitor Window**: A draggable floating overlay window (sits above the canvas) that contains the log list, the "Clear Log" button, and any display controls.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open the MIDI Monitor window in one click from the MIDI toolbar.
- **SC-002**: All incoming MIDI events are displayed in the log within 100 ms of being received, ensuring real-time feedback.
- **SC-003**: The log remains responsive and scrollable with up to 500 entries without visible lag.
- **SC-004**: 100% of standard MIDI message types (Note On/Off, CC, Pitch Bend, Program Change, Clock) are correctly identified and labelled in log entries.
- **SC-005**: Clicking "Clear Log" empties the list instantly (within one animation frame).
- **SC-006**: No duplicate monitor windows can be opened; re-clicking the toolbar button focuses the existing window.

## Clarifications

### Session 2026-05-14

- Q: Should the MIDI Monitor open as a floating overlay window or a docked panel? → A: Floating overlay window (draggable, sits above canvas)
- Q: Should log entry timestamps show wall-clock time or elapsed time since monitor opened? → A: Wall-clock time (e.g., `14:32:05.123`)

## Assumptions

- The existing MIDI infrastructure (from feature 023-midi-support) already routes all incoming MIDI messages through a central dispatch point that the monitor can subscribe to.
- The MIDI toolbar is an existing UI element; this feature adds one button to it.
- Log persistence is in-memory only (no disk/localStorage persistence between sessions) — the log resets each time the window is closed or the app is reloaded.
- A "pause" toggle for the log stream is out of scope for this iteration.
