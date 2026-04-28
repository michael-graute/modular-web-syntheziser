# Feature Specification: BPM-Synced Looper

**Feature Branch**: `015-bpm-looper`  
**Created**: 2026-04-18  
**Status**: Draft  
**Input**: User description: "A single-track, BPM-synced audio looper component with a doughnut (ring) canvas UI in the style of Loopy Pro. The looper records audio input, loops it in sync with the global BPM, and displays a circular playhead on a doughnut-shaped canvas. States: idle, recording, playing, overdubbing. Loop length is set in bars (1/2/4/8) and snaps to the global BPM clock. Single track only. Uses AudioWorklet for recording and playback. The doughnut ring shows playhead position as a rotating indicator, record state in red, play state in green, overdub in orange, idle in grey. Integrates with existing GlobalBpmControl for tempo sync. Fits the existing SynthComponent / CanvasComponent / embedded canvas display architecture."

## Clarifications

### Session 2026-04-18

- Q: How should overdub layers accumulate in the buffer? → A: Full accumulation — overdubbed layers mix at full volume (Option B); output level is the musician's responsibility. No feedback decay, no automatic gain reduction.
- Q: How are keyboard shortcuts assigned, and what is the maximum key combination length? → A: Fixed defaults, no configuration UI. Single key only (no modifier). Keys: 1 = Record, 2 = Stop, 0 = Clear. Shortcuts are documented as tooltips on each button. The musical Keyboard module MUST treat Looper shortcut keys as reserved and never fire note events for them.
- Q: Should the recorded loop buffer be persisted when the patch is saved? → A: Yes — the full audio buffer is saved with the patch and restored on load so the loop plays immediately after reload (Option B).
- Q: What happens when Stop is pressed during overdub? → A: Stop from overdub exits overdub and returns to playing (loop preserved); a second Stop then transitions to idle (Option B).
- Q: Can overdub be entered during recording, or only from playing state? → A: Overdub is only accessible from the playing state — the loop must complete one full pass before layering begins (Option A).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record and Loop Audio (Priority: P1)

A musician adds the Looper module to the canvas, connects an audio source, and records a phrase. While playing into the Looper, the live audio is passed through to the output so the musician can monitor in real time without any dry/wet switching. At the end of the chosen bar count the loop automatically starts playing back. The doughnut ring shows a red sweep while recording and turns green during playback, with a rotating indicator showing the playhead position at all times.

**Why this priority**: This is the core function of a looper. Without record → playback, the component has no value.

**Independent Test**: Add a Looper module, connect a signal source, press Record (via button or keyboard shortcut), wait for the loop length to elapse, verify the loop plays back and the ring turns green with a moving playhead. Verify the input signal was audible throughout recording via the output.

**Acceptance Scenarios**:

1. **Given** the Looper is idle and a signal source is connected, **When** the user presses Record (via button or assigned keyboard shortcut), **Then** the ring turns red and audio capture begins on the next global clock beat.
2. **Given** recording is active and the chosen bar count elapses, **When** the loop boundary is reached, **Then** recording stops automatically, playback begins, and the ring turns green.
3. **Given** the loop is playing, **When** the user observes the doughnut ring, **Then** a playhead indicator rotates continuously, completing one full revolution per loop cycle.
4. **Given** the loop is playing, **When** the user presses Stop (via button or assigned keyboard shortcut), **Then** playback halts and the ring returns to grey (idle).
5. **Given** a signal source is connected and the Looper is in any state, **When** audio arrives at the input, **Then** that audio is immediately passed through to the output for real-time monitoring.

---

### User Story 2 - Choose Loop Length Before Recording (Priority: P2)

Before recording, the user selects how many bars the loop should span (1, 2, 4, or 8 bars). The looper uses the current global BPM to calculate the exact loop duration in seconds. Once set, the loop length is fixed for the lifetime of that recording.

**Why this priority**: Without length selection the loop has no deterministic end point and cannot sync to the rest of the patch.

**Independent Test**: Set global BPM to 120, choose 2 bars, record, verify the loop is exactly 4 seconds long and restarts in time with the global clock.

**Acceptance Scenarios**:

1. **Given** the Looper is idle, **When** the user selects a bar count (1/2/4/8), **Then** the selected length is displayed on the canvas and stored as the active loop length.
2. **Given** a bar count of 2 is selected and global BPM is 120, **When** recording starts, **Then** the loop ends and playback begins after exactly 4 seconds (2 bars × 4 beats × 0.5 s/beat).
3. **Given** the user changes global BPM after a loop is already recorded, **When** playback continues, **Then** the loop continues at its original recorded duration — tempo change does not stretch existing loops.

---

### User Story 3 - Overdub Additional Audio onto the Loop (Priority: P3)

While a loop is playing, the user presses Overdub to layer new audio on top of the existing recording. The new audio is mixed into the loop buffer. During overdub, both the looped audio and the live input are sent to the output simultaneously so the musician can hear the full mix in real time. The ring turns orange during overdub. Pressing the button again returns to regular playback.

**Why this priority**: Overdubbing is what makes a looper musically useful beyond a single phrase, but the core record/play flow (US1/US2) must work first.

**Independent Test**: Record a loop, press Overdub (via button or keyboard shortcut), play a new phrase, press Overdub again to exit, verify both layers play back together, the ring colour transitions correctly, and both audio sources were audible at the output during the overdub pass.

**Acceptance Scenarios**:

1. **Given** the loop is playing, **When** the user presses Overdub (via button or assigned keyboard shortcut), **Then** new incoming audio is mixed into the loop buffer and the ring turns orange.
2. **Given** overdub is active, **When** the user presses Overdub again, **Then** overdubbing stops, the mixed audio is retained, playback continues, and the ring returns to green.
3. **Given** overdub has been applied, **When** the loop plays back, **Then** both the original recording and the overdubbed layer are audible together.
4. **Given** overdub is active, **When** audio arrives at the input, **Then** both the looped playback audio and the live input audio are present at the output simultaneously.

---

### User Story 4 - Clear the Loop (Priority: P4)

The user presses a Clear button (or assigned keyboard shortcut) to erase the recorded loop and return the looper to idle state, ready for a new recording.

**Why this priority**: Without a clear function the looper is single-use per session, which is musically limiting.

**Independent Test**: Record a loop, press Clear (via button or keyboard shortcut), verify the ring returns to grey, loop audio output goes silent, and a fresh recording can be started.

**Acceptance Scenarios**:

1. **Given** a loop is recorded (playing or paused), **When** the user presses Clear (via button or assigned keyboard shortcut), **Then** the buffer is erased, the ring turns grey, and the Looper enters idle state.
2. **Given** the Looper is idle after a clear, **When** the user presses Record, **Then** a fresh recording begins as if the component was freshly added.

---

### User Story 5 - Trigger Actions via Keyboard Shortcuts (Priority: P2)

The user controls the looper hands-free using fixed single-key shortcuts: 1 (Record), 2 (Stop), 0 (Clear). These keys are reserved globally — the musical Keyboard module skips note processing for them so there is no conflict.

**Why this priority**: A performer needs both hands free to play an instrument; mouse-only control is impractical on stage. Single-key shortcuts are the fastest possible trigger and must be safe alongside the musical keyboard.

**Independent Test**: While the musical Keyboard module is visible and active, press 1 — verify the Looper starts recording and no note event fires on the musical keyboard. Press 2 to stop, 0 to clear. Verify tooltips on each button show the assigned key.

**Acceptance Scenarios**:

1. **Given** the Looper is idle, **When** the user presses 1, **Then** the Looper starts recording as if the Record button was clicked.
2. **Given** the loop is playing, **When** the user presses 2, **Then** the Looper stops as if the Stop button was clicked.
3. **Given** a loop exists, **When** the user presses 0, **Then** the loop buffer is cleared as if the Clear button was clicked.
4. **Given** the musical Keyboard module is present and active, **When** the user presses 1, 2, or 0, **Then** no musical note event is fired on the Keyboard module.
5. **Given** the user hovers over the Record, Stop, or Clear button, **When** the tooltip appears, **Then** it displays the assigned shortcut key.

---

### Edge Cases

- What happens when the user presses Record but no audio source is connected? The looper records silence — no error is thrown, the state machine progresses normally.
- What happens when BPM changes while recording is in progress? Loop duration is computed at the moment recording starts; a mid-recording BPM change does not alter the end point.
- What happens if the user presses Record while the loop is already playing? Record is a no-op from any state other than idle — the state machine only allows `idle → recording` (FR-001). To start a new recording the user must press Clear first.
- What happens when bar count is changed while a loop is already recorded? The new bar count applies only to the next recording; the current loop is unaffected.
- What happens if the Looper is in overdub state when the user presses Stop (2)? Stop exits overdub and returns to playing (loop preserved); a second Stop then transitions to idle.
- What happens if the Looper is in overdub state when the user presses Clear? Clear is always honoured from any state — overdub is interrupted and the buffer is erased.
- What happens at very slow BPM (30 BPM)? The quantised record start may delay up to 2 seconds; this is acceptable and matches standard looper behaviour.
- What happens to the input passthrough when the Looper is in idle state (no loop recorded)? Live input is still passed through to the output — the Looper always acts as a transparent passthrough for the input signal.
- What happens if a Looper shortcut key (1, 2, 0) conflicts with a browser default? Digit keys have no default browser bindings in a canvas context, so no conflict is expected. If a future browser version claims one of these keys, the reserved-key list in the musical Keyboard module can be updated without user-facing changes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Looper MUST provide four distinct states: idle, recording, playing, and overdubbing. Valid state transitions: idle → recording → playing → overdubbing → playing → idle. Stop pressed during overdub transitions to playing (loop preserved); Stop pressed during playing transitions to idle.
- **FR-002**: The Looper MUST accept an audio signal as input and produce an audio signal as output.
- **FR-003**: The user MUST be able to select a loop length of 1, 2, 4, or 8 bars before recording begins.
- **FR-004**: The Looper MUST calculate loop duration in seconds from the global BPM and selected bar count at the moment recording starts (formula: `bar_count × 4 × 60 / BPM`).
- **FR-005**: Recording MUST start on the next beat boundary of the global clock to ensure alignment with the patch tempo.
- **FR-006**: When the computed loop duration elapses, recording MUST stop automatically and playback MUST begin without user interaction.
- **FR-007**: During playback, the loop MUST repeat seamlessly with no audible gap at the loop boundary.
- **FR-008**: The user MUST be able to enter overdub mode while the loop is playing, mixing new incoming audio into the existing buffer.
- **FR-009**: The user MUST be able to exit overdub mode, returning to playback with all overdubbed audio retained permanently. Overdub layers accumulate at full volume with no automatic feedback decay — mix level is the musician's responsibility.
- **FR-010**: The user MUST be able to clear the loop buffer at any time from any state, returning the Looper to idle.
- **FR-011**: The Looper MUST display a doughnut (ring) canvas with a rotating playhead indicator showing the current position within the loop cycle.
- **FR-012**: The doughnut ring colour MUST reflect the current state: grey (idle), red (recording), green (playing), orange (overdubbing).
- **FR-013**: The selected bar count MUST be legible on the canvas display.
- **FR-014**: The Looper MUST integrate with the global BPM control so that loop duration is always derived from the active patch tempo at record time.
- **FR-015**: The Looper's state, bar count selection, and full recorded audio buffer MUST be persisted when the patch is saved. On load, the buffer is restored and the loop resumes playback immediately without re-recording.
- **FR-016**: The Record, Stop, and Clear actions MUST each be triggerable by both an on-canvas button and a fixed single-key keyboard shortcut (no modifier keys). Default shortcuts are: 1 = Record, 2 = Stop, 0 = Clear. Shortcuts are shown as tooltips on each button.
- **FR-017**: The musical Keyboard module MUST maintain a reserved-key list containing all Looper shortcut keys (1, 2, 0). When a keydown event matches a reserved key, the Keyboard module MUST skip note-on processing for that key.
- **FR-018**: There is no shortcut configuration UI — shortcuts are fixed defaults. Future remapping capability is explicitly out of scope for this feature.
- **FR-019**: The Looper MUST continuously pass its audio input through to its output in all states (idle, recording, playing, overdubbing), enabling real-time monitoring without any additional routing by the user.
- **FR-020**: During overdub, both the looped playback audio and the live input audio MUST be present at the output simultaneously.

### Key Entities

- **Loop Buffer**: The recorded audio content. Has a fixed duration (set at record time), and a playhead position (0.0–1.0 normalised through the cycle).
- **Looper State**: One of `idle | recording | playing | overdubbing`. Drives ring colour and permitted user actions. Transitions: idle →(Record)→ recording →(auto)→ playing →(Overdub)→ overdubbing →(Overdub/Stop)→ playing →(Stop)→ idle. Clear returns to idle from any state.
- **Bar Count**: User-selected loop length in bars (1 | 2 | 4 | 8). Combined with global BPM to compute buffer duration in seconds.
- **Loop Duration**: Derived at record start — `bar_count × 4 beats × (60 / BPM)` seconds. Fixed for the lifetime of the current recording.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from idle → recording → playing in two interactions (select bar count + press Record) within 5 seconds.
- **SC-002**: The loop boundary is seamless — no audible click or gap is detectable at the start/end junction during playback.
- **SC-003**: The playhead indicator completes exactly one revolution per loop cycle, remaining visually in sync with the audio at all supported BPM values.
- **SC-004**: Loop start is quantised — recording begins no later than one beat after the user presses Record, ensuring alignment with the global clock.
- **SC-005**: Ring colour changes are instantaneous (within one animation frame) when the user performs a state-changing action.
- **SC-006**: Patch save and reload preserves the bar count selection, Looper state, and recorded audio buffer — the loop plays immediately after reload with no re-recording required.
- **SC-007**: The Looper operates correctly across the full supported BPM range (30–300 BPM) without timing drift over at least 10 consecutive loop cycles.
- **SC-008**: The live input signal is audible at the output within one audio processing block of arriving at the input, in all Looper states, with no user configuration required.
- **SC-009**: Pressing 1, 2, or 0 while the musical Keyboard module is active triggers zero unintended note events on the Keyboard module.

## Assumptions

- **Beats per bar**: 4/4 time is assumed throughout.
- **Mono audio**: The loop buffer stores a single mono channel. Stereo input is mixed to mono before recording.
- **No pitch/time stretching**: BPM changes after recording do not alter the loop's pitch or duration.
- **No per-layer undo for overdub**: Once an overdub pass is committed it cannot be undone independently. Clear is the only full reset.
- **Single instance support**: Multiple Looper modules may exist on the canvas simultaneously and operate independently.
- **Quantised record start**: If BPM is slow, the user may wait up to one beat before recording begins — this is standard looper behaviour.
