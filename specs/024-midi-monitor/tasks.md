# Tasks: MIDI Monitor

**Input**: Design documents from `specs/024-midi-monitor/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the new EventType and payload type that all subsequent work depends on.

- [ ] T001 Add `MIDI_MESSAGE_RECEIVED` to `EventType` enum in `src/core/types.ts`
- [ ] T002 Add `MidiRawMessagePayload` interface to `src/core/types.ts` (after `MidiLearnSession`)

**Checkpoint**: Types compile — `EventType.MIDI_MESSAGE_RECEIVED` and `MidiRawMessagePayload` are importable across the codebase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire the raw MIDI event emission into `MidiEngine` so all user stories can subscribe to it.

**⚠️ CRITICAL**: US1 and US2 both depend on this phase being complete before work begins.

- [ ] T003 Emit `EventType.MIDI_MESSAGE_RECEIVED` at the top of `handleMidiMessage()` in `src/midi/MidiEngine.ts`, carrying a `MidiRawMessagePayload` with `status`, `byte1`, `byte2`, and `performance.now()` timestamp

**Checkpoint**: Foundation ready — any subscriber calling `eventBus.on(EventType.MIDI_MESSAGE_RECEIVED, ...)` will now receive all raw MIDI messages.

---

## Phase 3: User Story 1 — Open MIDI Monitor Window (Priority: P1) 🎯 MVP

**Goal**: A "MIDI Monitor" button appears in the MIDI toolbar; clicking it opens a draggable floating window.

**Independent Test**: With no MIDI device connected, click "MIDI Monitor" in the toolbar — the window opens above the canvas. Click it again — no second window is created; the existing window is brought to focus. Close the window — it disappears.

### Implementation

- [ ] T004 [US1] Create `src/ui/MidiMonitorWindow.ts` — class skeleton with constructor, `open()`, `close()`, and `isOpen` flag; build the floating window DOM structure (title bar, empty log container, footer with "Clear Log" button); append to `document.body` on first `open()` call
- [ ] T005 [US1] Implement pointer-based drag on the title bar in `src/ui/MidiMonitorWindow.ts`: `pointerdown` sets capture + stores offset, `pointermove` updates `style.left` / `style.top`, `pointerup` releases capture
- [ ] T006 [US1] Add idempotent guard to `open()` in `src/ui/MidiMonitorWindow.ts`: if `isOpen` is true, focus/scroll the window into view instead of re-opening
- [ ] T007 [US1] Add "MIDI Monitor" button (`monitorBtn`) to `MidiToolbar` constructor in `src/ui/MidiToolbar.ts`: create button, append after `mappingsBtn`, wire click to `this.monitorWindow.open()`; instantiate `MidiMonitorWindow` as `this.monitorWindow`
- [ ] T008 [P] [US1] Add `.midi-monitor-window`, `.midi-monitor-window__header`, `.midi-monitor-window__log`, `.midi-monitor-window__footer`, and `.midi-monitor-open-btn` CSS rules to `src/styles/components.css` (floating layout: `position: fixed`, `z-index: var(--z-index-popover)`, `min-width: 480px`, `max-height: 400px`, flex column)

**Checkpoint**: US1 fully functional — button visible in toolbar, window opens/focuses/closes correctly, drag works, no duplicate windows.

---

## Phase 4: User Story 2 — View Incoming MIDI Events in Real Time (Priority: P1)

**Goal**: The open MIDI Monitor window displays all incoming MIDI events as formatted log rows, auto-scrolling to the latest entry, capped at 500 entries (FIFO).

**Independent Test**: Open the monitor, trigger Note On/CC/Pitch Bend events from a MIDI device — each appears as a new row with wall-clock time, type label, channel, and data values. Trigger 501 events — only 500 rows are present, oldest gone. Scroll up manually — auto-scroll pauses. Scroll back to bottom — auto-scroll resumes.

### Implementation

- [ ] T009 [P] [US2] Add pure formatting helpers to `src/ui/MidiMonitorWindow.ts` (inline from `contracts/validation.ts`): `formatWallClock(date)`, `parseMidiType(status)`, `parseMidiChannel(status)`, `formatData1(status, byte1)`, `formatData2(status, byte2)`, `formatMidiLogEntry(payload)`; add `MIDI_TYPE_LABELS` constant and `midiNoteToName()` helper; add `MAX_LOG_ENTRIES = 500` constant
- [ ] T010 [US2] Implement `appendEntry(payload: MidiRawMessagePayload)` in `src/ui/MidiMonitorWindow.ts`: call `formatMidiLogEntry()`, create a `<div class="midi-monitor-entry">` row with 5 columns (wallTime, type, channel, data1, data2), append to log container; if `entries.length >= MAX_LOG_ENTRIES` remove `container.firstChild` and `entries.shift()` before appending; push to `entries` array
- [ ] T011 [US2] Subscribe to `EventType.MIDI_MESSAGE_RECEIVED` inside `open()` in `src/ui/MidiMonitorWindow.ts`: store unsubscribe handle in `this.unsubscribe`; call `this.appendEntry(payload)` on each event; unsubscribe in `close()`
- [ ] T012 [US2] Implement auto-scroll in `src/ui/MidiMonitorWindow.ts`: after each `appendEntry()` call, if `this.autoScroll` is true set `logContainer.scrollTop = logContainer.scrollHeight`; add `scroll` event listener on `logContainer` to set `autoScroll = false` when user scrolls up (threshold: `scrollTop + clientHeight < scrollHeight - 2`), and `autoScroll = true` when back at bottom
- [ ] T013 [P] [US2] Add `.midi-monitor-entry` CSS grid rule to `src/styles/components.css`: 5-column grid (`time | type | ch | data1 | data2`), monospace font, `font-size: 11px`, alternating row background, truncate overflow

**Checkpoint**: US2 fully functional — live MIDI events appear in real time, all standard message types correctly labelled, FIFO cap enforced at 500, auto-scroll works with manual override.

---

## Phase 5: User Story 3 — Clear the Event Log (Priority: P2)

**Goal**: Clicking "Clear Log" in the MIDI Monitor footer empties the entire log list instantly.

**Independent Test**: Open the monitor, trigger several MIDI events (log not empty), click "Clear Log" — all rows disappear instantly. Send a new MIDI event — it appears as the first and only row.

### Implementation

- [ ] T014 [US3] Implement `clearLog()` in `src/ui/MidiMonitorWindow.ts`: set `this.entries = []`, set `this.logContainer.innerHTML = ''`, reset `this.autoScroll = true`; wire the footer "Clear Log" button's click listener to call `this.clearLog()`

**Checkpoint**: US3 fully functional — Clear Log button empties list instantly; new events log normally afterwards.

---

## Phase 6: Tests

**Purpose**: Unit test coverage for pure formatting logic and window behaviour.

- [ ] T015 [P] Create `tests/ui/MidiMonitorWindow.test.ts` — test `formatWallClock` outputs `HH:MM:SS.mmm` format
- [ ] T016 [P] Add test in `tests/ui/MidiMonitorWindow.test.ts` — `parseMidiType(0x90)` returns `"Note On"`, `parseMidiType(0xF8)` returns `"Clock"`, unknown byte returns `"Unknown"`
- [ ] T017 [P] Add test in `tests/ui/MidiMonitorWindow.test.ts` — `parseMidiChannel(0x90)` returns `"1"`, `parseMidiChannel(0xF8)` returns `"—"`
- [ ] T018 [P] Add test in `tests/ui/MidiMonitorWindow.test.ts` — `midiNoteToName(60)` returns `"C4 (60)"`, `midiNoteToName(69)` returns `"A4 (69)"`
- [ ] T019 [P] Add test in `tests/ui/MidiMonitorWindow.test.ts` — `formatData1(0x90, 60)` returns note name; `formatData1(0xB0, 7)` returns `"CC 7"`; `formatData2(0xC0, 0)` returns `""`
- [ ] T020 [P] Add test in `tests/ui/MidiMonitorWindow.test.ts` — FIFO cap: after 501 calls to `appendEntry()`, `entries.length === 500` and oldest entry is gone
- [ ] T021 [P] Add test in `tests/ui/MidiMonitorWindow.test.ts` — `clearLog()` sets `entries` to `[]`

**Checkpoint**: `vitest run tests/ui/MidiMonitorWindow.test.ts` passes with ≥ 80% coverage of formatting helpers.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, keyboard close, and final integration check.

- [ ] T022 Add `aria-label="Close MIDI Monitor"` to the close button and `role="log"` + `aria-live="polite"` to the log container in `src/ui/MidiMonitorWindow.ts`
- [ ] T023 Add `keydown` listener in `src/ui/MidiMonitorWindow.ts`: close window when `Escape` is pressed and `isOpen` is true (consistent with `MidiMappingsModal` behaviour)
- [ ] T024 Verify linting passes with `npm run lint`; fix any strict-mode TypeScript errors introduced across all modified files
- [ ] T025 Manual smoke-test per `quickstart.md`: open monitor with no device connected, connect device, trigger all MIDI message types, verify labels, trigger 501+ events, verify cap, clear log, close and reopen

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (needs `EventType.MIDI_MESSAGE_RECEIVED`)
- **Phase 3 (US1)**: Depends on Phase 2 — window can open/close without MIDI data
- **Phase 4 (US2)**: Depends on Phase 2 and Phase 3 (appending entries requires the window DOM)
- **Phase 5 (US3)**: Depends on Phase 4 (clearing requires the log container to exist)
- **Phase 6 (Tests)**: Depends on Phase 5 (tests cover complete formatting logic)
- **Phase 7 (Polish)**: Depends on Phases 3–5 (applies to complete implementation)

### User Story Dependencies

- **US1 (Phase 3)**: Can start after Phase 2 — independent of US2 and US3
- **US2 (Phase 4)**: Depends on US1 (needs the window DOM) — NOT independently startable
- **US3 (Phase 5)**: Depends on US2 (needs the log container) — NOT independently startable

### Within Each Phase

- Tasks marked `[P]` within a phase can run in parallel (different files)
- T004–T006 must complete before T007 (toolbar needs a working window instance)
- T009 must complete before T010 (formatting helpers used by appendEntry)
- T010 must complete before T011 (appendEntry used by subscription)

---

## Parallel Opportunities

```bash
# Phase 3 — T008 (CSS) can run in parallel with T004–T007 (TypeScript):
Task: "T008 — add .midi-monitor-* CSS rules to src/styles/components.css"
Task: "T004 — create MidiMonitorWindow.ts skeleton"

# Phase 4 — T009 (formatters) and T013 (entry CSS) can run in parallel:
Task: "T009 — add formatting helpers to MidiMonitorWindow.ts"
Task: "T013 — add .midi-monitor-entry CSS rule"

# Phase 6 — all test tasks T015–T021 are independent:
Task: "T015 — formatWallClock test"
Task: "T016 — parseMidiType test"
Task: "T017 — parseMidiChannel test"
Task: "T018 — midiNoteToName test"
Task: "T019 — formatData1/formatData2 tests"
Task: "T020 — FIFO cap test"
Task: "T021 — clearLog test"
```

---

## Implementation Strategy

### MVP (US1 only — opens window)

1. Phase 1: T001–T002
2. Phase 2: T003
3. Phase 3: T004–T008
4. **STOP and VALIDATE**: Button appears, window opens/closes/drags correctly

### Full Feature

1. MVP above
2. Phase 4 (US2): T009–T013 — live MIDI log
3. Phase 5 (US3): T014 — clear log
4. Phase 6: T015–T021 — tests
5. Phase 7: T022–T025 — polish

---

## Notes

- All formatting helpers (`formatMidiLogEntry`, etc.) are defined in `contracts/validation.ts` — inline them directly into `MidiMonitorWindow.ts` rather than importing from the specs directory
- `[P]` tasks operate on different files or independent sections with no shared state
- The `MidiMonitorWindow` instance is owned by `MidiToolbar`; it is never exported as a singleton
- Run tests with: `vitest run tests/ui/MidiMonitorWindow.test.ts`
