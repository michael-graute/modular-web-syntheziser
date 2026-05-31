# Feature Specification: Arpeggiator

**Feature Branch**: `029-arpeggiator`  
**Created**: 2026-05-31  
**Status**: Draft  
**Input**: User description: "Arpeggiator as mentioned and described in docs/research/missing-features.md"

## Clarifications

### Session 2026-05-31

- Q: How does the Arpeggiator build its multi-note step cycle from a single CV input? → A: Latch queue — each gate-high event latches the current CV pitch into an internal sequence (up to 8 notes); active notes form the step cycle.
- Q: When a new note arrives (gate-high) while already cycling, what happens? → A: Add to sequence immediately; new note included from the next step.
- Q: US3 mentioned a free-running Hz rate mode but Assumptions ruled it out — which is correct? → A: BPM subdivisions only; Hz reference removed from US3.
- Q: When does a latched note get removed from the sequence? → A: Gate-low immediately removes the note from the sequence.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Generate Arpeggios from CV Input (Priority: P1)

A musician connects a CV source (Keyboard, Step Sequencer, or Chord Finder) to the Arpeggiator's CV input and Gate input. Each time a gate-high signal arrives, the current CV pitch is latched into an internal sequence (up to 8 notes). When gate-low is received, that note is removed. The Arpeggiator continuously cycles through all currently latched pitches in the selected direction at the configured rate, emitting one CV pitch and one gate pulse per step. The Gate output drives a downstream ADSR envelope to shape each note's amplitude.

**Why this priority**: This is the core function of an arpeggiator — without it the module has no value. Every other user story builds on this working note-stepping loop.

**Independent Test**: Connect a Keyboard to CV In and Gate In, set direction to Up and rate to a clearly audible tempo. Hold multiple notes on the keyboard and route Gate Out to an ADSR → VCA → Master Out. The output must play individual notes of the held chord stepping upward in pitch at the configured rate. Releasing a note must remove it from the cycle within one step.

**Acceptance Scenarios**:

1. **Given** the Arpeggiator is connected to a Keyboard CV/Gate output and the rate is set, **When** a note is held on the keyboard, **Then** the Arpeggiator latches the pitch and emits a repeating CV pitch and gate pulse at each step.
2. **Given** direction is set to "Up", **When** multiple notes are held, **Then** pitches cycle from lowest to highest and repeat.
3. **Given** direction is set to "Down", **When** multiple notes are held, **Then** pitches cycle from highest to lowest and repeat.
4. **Given** direction is set to "Up-Down", **When** multiple notes are held, **Then** pitches ascend then descend continuously without repeating the top and bottom notes.
5. **Given** direction is set to "Random", **When** multiple notes are held, **Then** each step plays a randomly chosen pitch from the latched notes.
6. **Given** no notes are held (all gates low), **When** the Arpeggiator is running, **Then** no gate pulses are emitted and CV output holds its last value.
7. **Given** a note is already cycling, **When** a new gate-high arrives with a different pitch, **Then** the new pitch is added to the sequence and appears from the next step onward.
8. **Given** a note is held, **When** its gate goes low, **Then** that pitch is removed from the sequence immediately and the cycle continues without it.

---

### User Story 2 — Octave Range Control (Priority: P2)

The musician sets an octave range (1, 2, 3, or 4 octaves). The Arpeggiator automatically extends the note cycle across the chosen number of octaves above the latched notes before looping back.

**Why this priority**: Octave range is what distinguishes an arpeggiator from a simple note sequencer. It dramatically expands the musical possibilities without adding UI complexity.

**Independent Test**: Connect a Keyboard, hold a three-note chord, set octave range to 2 and direction to Up. The output must play all three notes in the first octave then all three notes an octave higher before repeating.

**Acceptance Scenarios**:

1. **Given** octave range is 1, **When** notes are held, **Then** only the source octave is played.
2. **Given** octave range is 2, **When** notes are held, **Then** the cycle plays through source notes then the same notes transposed up one octave.
3. **Given** octave range is 4, **When** a single note is held, **Then** the same note plays in four consecutive octaves before repeating.

---

### User Story 3 — Rate and Global BPM Sync (Priority: P2)

The musician controls how fast the Arpeggiator steps through notes. The rate is set as a musical subdivision of the global BPM (1/4, 1/8, 1/16, 1/32 notes) so the arpeggio stays in rhythmic sync with the rest of the patch.

**Why this priority**: Rhythmic sync is fundamental to musical usability. An arpeggiator that drifts out of time with the Step Sequencer and other BPM-locked components is not musically useful.

**Independent Test**: Set the global BPM to 120 and the Arpeggiator rate to 1/8 note. Tap-count the gate pulses over 4 beats — there must be exactly 8 pulses (240 per minute at 120 BPM).

**Acceptance Scenarios**:

1. **Given** the Arpeggiator rate is set to 1/8 note and BPM is 120, **When** playing, **Then** 240 gate pulses fire per minute.
2. **Given** the global BPM changes while playing, **When** the BPM event fires, **Then** the Arpeggiator immediately adjusts its step rate.

---

### User Story 4 — Patch Persistence (Priority: P3)

The musician saves a patch containing an Arpeggiator with specific settings (direction, octave range, rate, gate length, connections). On reload, the Arpeggiator reappears with its position, connections, and all parameter values restored.

**Why this priority**: Every component in the app supports save/restore. The Arpeggiator must meet the same baseline.

**Independent Test**: Build a patch with an Arpeggiator, configure all parameters, save, reload the page. Confirm the Arpeggiator reappears at the same position with the same parameter values and all connections intact.

**Acceptance Scenarios**:

1. **Given** a patch with a configured Arpeggiator is saved, **When** the page reloads and the patch is loaded, **Then** all parameter values and connections are restored identically.
2. **Given** a patch saved without an Arpeggiator is loaded, **When** the patch loads, **Then** no errors occur.

---

### Edge Cases

- What happens when only one note is latched? The Arpeggiator plays that single note repeatedly at the configured rate.
- What happens when all notes are released (all gates go low)? Gate output stops immediately; CV holds its last emitted value.
- What happens when the sequence is full (8 notes latched) and a new gate-high arrives? The oldest note in the sequence is evicted to make room for the new one.
- What happens when the CV input is disconnected mid-arpeggio? Gate output stops; CV holds its last emitted value.
- What happens with an octave range of 1 and direction "Up-Down" with two notes? The pattern is: low, high, low, high… (no duplication at boundary since there is no middle note).
- What happens when the Arpeggiator is bypassed? CV and Gate outputs go silent — the module is a CV/Gate generator, not an effect in the signal chain.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Arpeggiator MUST accept one CV pitch input and one Gate/Trigger input to receive notes from any CV/Gate source.
- **FR-002**: The Arpeggiator MUST emit one CV pitch output and one Gate output to drive downstream envelope generators and oscillators.
- **FR-003**: On each gate-high event, the Arpeggiator MUST latch the current CV pitch into an internal note sequence (maximum 8 notes). When the sequence is full, the oldest note MUST be evicted.
- **FR-004**: On each gate-low event, the Arpeggiator MUST immediately remove the corresponding pitch from the note sequence.
- **FR-005**: A newly latched note MUST be included in the step cycle from the next step onward, without restarting the cycle.
- **FR-006**: The Arpeggiator MUST support four step directions: Up, Down, Up-Down, and Random.
- **FR-007**: The Arpeggiator MUST support octave ranges of 1, 2, 3, and 4 octaves.
- **FR-008**: The Arpeggiator MUST support step rates as musical subdivisions of the global BPM: 1/4, 1/8, 1/16, and 1/32 notes.
- **FR-009**: The Arpeggiator MUST automatically adjust its step rate when the global BPM changes.
- **FR-010**: The Arpeggiator MUST emit no gate pulses when the note sequence is empty.
- **FR-011**: Each gate pulse emitted by the Arpeggiator MUST have a configurable duty cycle relative to the step length (gate length: short / medium / long, corresponding to 25% / 50% / 75% of the step interval).
- **FR-012**: The Arpeggiator MUST persist all parameter values (direction, octave range, rate, gate length) and connections via the existing patch save/load mechanism.
- **FR-013**: The Arpeggiator MUST appear in the "Utilities" category of the component sidebar.

### Key Entities

- **Arpeggiator Component**: Accepts CV pitch and Gate inputs; maintains a latched note sequence; internally schedules a repeating step cycle; emits CV pitch and Gate outputs. Configurable parameters: direction, octave range, rate subdivision, gate length.
- **Note Sequence**: The ordered list of currently latched pitches (max 8). Notes are added on gate-high and removed on gate-low. The step cycle is derived from this sequence × octave range, ordered by the selected direction.
- **Step Cycle**: The expanded, direction-ordered sequence of pitches the Arpeggiator steps through, derived from the Note Sequence multiplied across the configured octave range.
- **Rate**: The interval between steps, expressed as a BPM subdivision (1/4, 1/8, 1/16, 1/32).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Connecting a Keyboard → Arpeggiator → ADSR → VCA → Master Out produces an audible stepping arpeggio within 5 seconds of holding a note, with no additional configuration required.
- **SC-002**: At a global BPM of 120 and 1/8-note rate, gate pulses are within ±2 ms of the correct interval (62.5 ms) measured over 16 consecutive steps.
- **SC-003**: Changing direction, octave range, or rate takes effect within one step (no restart required).
- **SC-004**: Adding or releasing a note takes effect within one step of the gate transition.
- **SC-005**: All parameter values and connections survive a full save/reload cycle with zero data loss.
- **SC-006**: Loading a patch that contains no Arpeggiator produces no console errors or broken UI state.

## Assumptions

- Each gate-high/gate-low pair corresponds to exactly one pitch (the CV value present at gate-high time). The app does not support polyphonic CV — each port carries one pitch at a time.
- Gate length (short/medium/long) is expressed as a fixed fraction of the step interval (25% / 50% / 75%) rather than an absolute millisecond value.
- All rates are BPM subdivisions only (1/4, 1/8, 1/16, 1/32). No free-running Hz mode. This keeps the UI consistent with the Step Sequencer and other BPM-locked components.
- The Arpeggiator is not a bypass-capable effect — it is a CV/Gate generator. There is no bypass toggle.
- "Up-Down" direction does not repeat the top or bottom note (e.g., with notes A B C: A B C B A B C B…).
- The component does not require a canvas display area (no visualization), keeping it compact in the UI.
- When the note sequence becomes empty mid-cycle (all gates released), the cycle stops immediately rather than completing its current pass.

## Scope

**In scope**: Step direction (Up/Down/Up-Down/Random), octave range (1–4), BPM-synced rate (1/4 / 1/8 / 1/16 / 1/32), gate length (short/medium/long), gate-high latch / gate-low unlatch note sequence (max 8 notes), CV+Gate input and output ports, patch persistence, sidebar registration.

**Out of scope**: Polyphonic input (chord detection), MIDI note input, swing/groove, per-step velocity, free-running Hz rate, step skip/mute per note, standalone chord memory, visual step display.
