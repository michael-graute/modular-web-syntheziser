# Feature Specification: Global Transport Controller

**Feature Branch**: `016-global-transport`
**Created**: 2026-04-28
**Status**: Draft

## Clarifications

### Session 2026-04-28

- Q: What does Transport Play do to the Looper when a loop is already recorded? → A: Transport Play automatically resumes Looper playback if a loop is recorded.
- Q: How is the Play/Stop control presented in the controls bar? → A: Single toggle button showing ▶ when stopped and ■ when playing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Play / Stop Transport (Priority: P1)

A user wants to start and stop all transport-aware components in their patch with a single button press. They press **Play** in the global controls bar and the patch begins running — the Step Sequencer starts its sequence, the Looper continues any existing loop. They press **Stop** and everything halts together.

**Why this priority**: The core value of the feature. Without play/stop, nothing else is useful. Enables coordinated multi-component patches for the first time.

**Independent Test**: Add a Step Sequencer and a Looper to a patch. Press Play — Sequencer starts. Press Stop — both halt. Fully testable with only these two components and the transport button.

**Acceptance Scenarios**:

1. **Given** transport is stopped, **When** the user presses Play, **Then** transport state changes to Playing and all subscribed components receive a start signal.
2. **Given** transport is playing, **When** the user presses Stop, **Then** transport state changes to Stopped, the Step Sequencer stops its sequence, and the Looper stops playback.
3. **Given** transport is stopped and the Looper has no recorded loop, **When** the user presses Play, **Then** the Looper remains idle (transport Play does not auto-start Looper recording).
4. **Given** transport is stopped and the Looper has a recorded loop, **When** the user presses Play, **Then** the Looper automatically resumes loop playback.
5. **Given** transport is playing and the Looper has a recorded loop, **When** the user presses Stop, **Then** the Looper does not clear its recorded buffer — the loop is preserved for the next Play.

---

### User Story 2 — Beat Clock & Position Display (Priority: P2)

A user wants to know where they are in the timeline. The global controls bar shows the current bar and beat number while transport is running (e.g. "3.2" = bar 3, beat 2). The beat clock also fires an event on every beat so future components (metronome, count-in) can subscribe without polling.

**Why this priority**: The position display gives essential feedback when working with time-locked components. The beat clock event is the hook that metronome and count-in features depend on — establishing it now avoids a later refactor.

**Independent Test**: Start transport and observe the bar/beat counter incrementing in the controls bar at the correct rate for the current BPM. Verify it resets to "1.1" on Stop.

**Acceptance Scenarios**:

1. **Given** BPM is 120 and transport is playing, **When** 0.5 seconds elapse, **Then** the beat counter has advanced by 1 beat and the display shows the updated position.
2. **Given** transport is stopped, **When** the user presses Play, **Then** position resets to bar 1, beat 1 and begins counting from there.
3. **Given** transport is playing, **When** the user presses Stop and then Play again, **Then** position resets to bar 1, beat 1 (no resume from mid-position in this version).
4. **Given** BPM changes while transport is playing, **When** the new BPM takes effect, **Then** the beat clock rate adjusts immediately and the position counter continues from the current position.

---

### User Story 3 — BPM Change While Playing (Priority: P3)

A user adjusts the global BPM while transport is running. The beat clock adapts to the new tempo immediately — no click, no restart required.

**Why this priority**: Expected behaviour for any BPM-synced system; important for live use. Lower priority because the core transport is already useful without it, but the interaction must be defined.

**Independent Test**: Start transport at 120 BPM. While running, change BPM to 90. Verify beat interval changes without restarting the transport.

**Acceptance Scenarios**:

1. **Given** transport is playing at 120 BPM, **When** BPM is changed to 60, **Then** the beat interval doubles immediately without a transport restart.
2. **Given** transport is stopped, **When** BPM is changed, **Then** transport state remains stopped and position remains at "1.1".

---

### Edge Cases

- What happens when Play is pressed while already playing? Transport ignores the redundant press — no restart, no state change.
- What happens when Stop is pressed while already stopped? No-op.
- What happens if a component subscribes to transport events after transport is already playing? It receives the current transport state on subscription so it can self-initialize correctly.
- What happens to the Looper's recorded buffer when transport stops? Buffer is preserved; only playback stops.
- What happens when BPM is set to an extreme value (e.g. 300 BPM) while transport is running? Beat clock adjusts; no crash or stuck state.
- What happens when a transport-aware component is added to the canvas while transport is already playing? The component initialises to its default stopped state — it does not auto-start mid-session.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The global controls bar MUST display a single toggle button at all times: it shows ▶ (Play) when transport is stopped and ■ (Stop) when transport is playing.
- **FR-002**: Pressing Play MUST transition transport state from Stopped to Playing and broadcast a Transport Started event to all subscribers.
- **FR-003**: Pressing Stop MUST transition transport state from Playing to Stopped and broadcast a Transport Stopped event to all subscribers.
- **FR-004**: Transport MUST broadcast a Beat Tick event on every beat while playing, derived from the current global BPM.
- **FR-005**: Each Beat Tick event MUST carry the current bar number and beat number so subscribers can act on position without maintaining their own counter.
- **FR-006**: Transport MUST track and display the current bar and beat position in the global controls bar while playing, resetting to bar 1 beat 1 on every Stop.
- **FR-007**: The Step Sequencer MUST start its sequence on Transport Started and stop on Transport Stopped.
- **FR-008**: The Looper MUST stop playback on Transport Stopped. On Transport Started, if a loop is recorded the Looper MUST resume playback automatically; if no loop is recorded the Looper MUST remain idle. Transport Started MUST NOT trigger Looper recording.
- **FR-009**: Transport MUST adapt its beat clock rate immediately when global BPM changes while playing, without restarting.
- **FR-010**: Pressing Play while already playing MUST be a no-op. Pressing Stop while already stopped MUST be a no-op.
- **FR-011**: The transport controller MUST be a single shared instance across the entire application.
- **FR-012**: Components MUST subscribe to and unsubscribe from transport events without direct coupling to the transport controller.

### Key Entities

- **Transport State**: Running or Stopped. Single source of truth for whether the patch is playing.
- **Transport Position**: Current bar (integer ≥ 1) and beat (integer 1–4, assuming 4/4). Resets to 1.1 on every Stop.
- **Beat Tick**: A periodic pulse emitted once per beat while transport is playing, carrying the current position (bar, beat).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can start and stop all transport-aware components with a single button press — verified by observing coordinated start/stop behaviour in a patch containing both a Step Sequencer and a Looper.
- **SC-002**: The beat position display updates in step with the actual tempo with no visible drift at BPMs from 60 to 240.
- **SC-003**: BPM changes while transport is playing take effect within one beat period with no transport restart.
- **SC-004**: All existing patches load and function correctly after this feature is introduced — zero regressions in non-transport components.
- **SC-005**: Pressing Stop halts Step Sequencer output within one beat period.
- **SC-006**: The Play/Stop button is reachable and operable without scrolling or resizing the controls bar on a standard 1280×800 viewport.

## Assumptions

- Time signature is fixed at 4/4 for this version. Variable time signatures are out of scope.
- Transport does not support pause/resume from position — Stop always resets to bar 1, beat 1.
- The Looper's record trigger remains independent of transport; users must manually initiate recording.
- MIDI clock output is explicitly out of scope for this version.
- The transport controller is a browser-global singleton (one per app instance), not per-patch.
- Existing components that are not transport-aware (oscillators, filters, VCAs, etc.) are unaffected by transport events.
- A new component added to the canvas while transport is already playing initialises to its stopped state.

## Out of Scope

- MIDI clock input or output
- Pause / resume from mid-position
- Variable time signatures (only 4/4)
- Loop punch-in / punch-out
- Transport automation or recording
- Per-component transport override (mute/solo per transport event)
- Count-in before record (planned for a future feature that depends on this one)
