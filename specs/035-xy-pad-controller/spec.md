# Feature Specification: X-Y Pad Controller

**Feature Branch**: `035-xy-pad-controller`
**Created**: 2026-07-07
**Status**: Draft
**Input**: User description: "specify a new controller component: X-Y pad. The controlle should have two outputs (for x and y) that can be connected to parameters of other components. It also should have a record function that records the movement of the x-y axises."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Modulate Two Parameters by Dragging the Pad (Priority: P1)

A musician adds an X-Y Pad component to the canvas and connects its X output to one parameter (e.g. filter cutoff on another component) and its Y output to a different parameter (e.g. resonance). As the musician drags a finger or the mouse across the 2D pad surface, the horizontal position drives the X output value in real time and the vertical position drives the Y output value in real time, letting one gesture control two parameters simultaneously.

**Why this priority**: Live two-parameter control from a single gesture is the entire reason this component exists. Without independently useful X and Y outputs, nothing else in this spec matters.

**Independent Test**: Add an X-Y Pad to the canvas, connect X and Y outputs to two different target parameters, drag the pointer to each corner and the center of the pad, and verify both target parameters track the pointer position smoothly and independently.

**Acceptance Scenarios**:

1. **Given** an X-Y Pad is on the canvas with its X output connected to a target parameter, **When** the user drags the pointer horizontally across the pad, **Then** the connected parameter's value changes proportionally to the horizontal position.
2. **Given** an X-Y Pad is on the canvas with its Y output connected to a target parameter, **When** the user drags the pointer vertically across the pad, **Then** the connected parameter's value changes proportionally to the vertical position, independently of the X output.
3. **Given** the pointer is released after dragging, **When** the user checks the pad, **Then** the X and Y outputs hold their last position's values (no automatic reset) until the user moves the pointer again.
4. **Given** the pad has no active pointer interaction, **When** another component is connected to its X or Y output, **Then** the output immediately reflects the pad's current resting position.

---

### User Story 2 - Record and Play Back a Movement Gesture (Priority: P2)

A musician performs an expressive gesture across the pad (e.g. a sweep or circular motion) while recording is active. The pad captures the X and Y position over time. Afterward, the musician plays back the recorded movement so the same gesture repeats automatically and in a loop, freeing their hands for other controls while the captured motion continues to drive the connected parameters.

**Why this priority**: Recording turns the pad from a purely manual controller into an automation source, which is a distinct and high-value use case, but depends on the live control from User Story 1 already working.

**Independent Test**: Start a recording, perform a distinct movement pattern across the pad for a few seconds, stop recording, press play, and verify the X/Y outputs reproduce the same movement pattern over the same duration, looping continuously until stopped.

**Acceptance Scenarios**:

1. **Given** the X-Y Pad is idle, **When** the user presses Record, **Then** the pad enters recording state and begins capturing the pointer's X/Y position from the moment recording starts.
2. **Given** the pad is recording, **When** the user drags the pointer across the pad, **Then** the movement path (position over time) is captured continuously until the user presses Stop.
3. **Given** a recording exists and the pad is idle, **When** the user presses Play, **Then** the pad replays the captured X/Y movement over time, driving the X and Y outputs exactly as they were during recording, and loops back to the start when the recording ends.
4. **Given** a recording is currently playing back, **When** the user presses Stop, **Then** playback halts, the outputs hold their last replayed values, and the pad returns to idle.
5. **Given** a recording is currently playing back, **When** the user drags the pointer on the pad, **Then** manual control immediately takes over from the recorded playback and playback stops.
6. **Given** a recording already exists, **When** the user presses Record again, **Then** the previous recording is discarded and a new capture begins from the current pointer release point.

---

### User Story 3 - Recording Persists With the Patch (Priority: P3)

A musician saves their patch after recording a movement gesture on the X-Y Pad. When they reload the patch later, the recorded gesture is still available to play back without needing to be re-performed.

**Why this priority**: Persistence protects the musician's performance work across sessions, consistent with how other components in this project save their state, but the feature is usable within a single session even without it.

**Independent Test**: Record a movement gesture, save the patch, reload the page (or load the saved patch), press Play, and verify the same recorded gesture plays back.

**Acceptance Scenarios**:

1. **Given** a recording exists on an X-Y Pad, **When** the patch is saved, **Then** the recorded movement data is included in the saved patch.
2. **Given** a saved patch containing an X-Y Pad with a recording, **When** the patch is loaded, **Then** the pad restores its recorded movement and can immediately play it back.
3. **Given** an X-Y Pad with no recording, **When** the patch is saved and reloaded, **Then** the pad loads in its idle state with the Play control unavailable, as expected for a component with no captured data.

### Edge Cases

- What happens when the user presses Play but no recording has ever been made? The Play control MUST be disabled/unavailable until a recording exists.
- What happens when the pointer leaves the bounds of the pad while dragging (mouse dragged outside the component, or a touch sliding off the pad)? Position MUST clamp to the nearest edge of the pad rather than jumping or becoming undefined.
- What happens when recording is started but the user never moves the pointer? The recording MUST still capture the static resting position for its duration, producing a "flat" recording that outputs a constant value on playback.
- What happens if the user starts a new recording while a previous recording is still playing back? Starting Record MUST stop playback first, then begin the new capture.
- What happens when the X or Y output is left unconnected? The pad continues to track and, if applicable, record/play position normally; an unconnected output simply has no downstream effect.
- What happens when two different target parameters have very different value ranges? Each connection independently scales the pad's normalized position to the target parameter's own range, the same way other CV-style outputs in this project behave.
- What is the maximum recording length? Recording MUST have a bounded maximum duration (see Assumptions) after which it stops automatically to prevent unbounded memory growth.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an X-Y Pad component that can be added to the canvas like other modular components.
- **FR-002**: The X-Y Pad MUST render a 2D touch/pointer-draggable surface representing the X (horizontal) and Y (vertical) axes.
- **FR-003**: The X-Y Pad MUST expose two independent outputs, X and Y, each connectable to a parameter on another component using the project's existing connection mechanism.
- **FR-004**: The X output MUST reflect the horizontal position of the last pointer interaction (or the current playback position when replaying a recording); the Y output MUST reflect the vertical position, independently of the X output.
- **FR-005**: The X-Y Pad MUST update both outputs continuously (in real time) while the pointer is actively dragging on the pad surface.
- **FR-006**: The X-Y Pad MUST hold its last X/Y position at its outputs when pointer interaction stops, rather than resetting to a default position.
- **FR-007**: The X-Y Pad MUST provide a visible pointer/handle indicator on the pad showing the current X/Y position.
- **FR-008**: The X-Y Pad MUST provide a Record control that, when activated, captures the X/Y position over time as the user drags the pointer.
- **FR-009**: The X-Y Pad MUST provide a Stop control that ends an active recording or an active playback.
- **FR-010**: The X-Y Pad MUST provide a Play control that replays a previously captured recording, driving the X and Y outputs to match the recorded movement over the same relative timing as it was captured.
- **FR-011**: Playback of a recording MUST loop continuously (replay from the start again) until the user presses Stop or begins a new manual drag.
- **FR-012**: The Play control MUST be unavailable (disabled) when no recording exists.
- **FR-013**: Starting a new recording MUST discard any previously captured recording for that pad.
- **FR-014**: Manually dragging the pad during playback MUST immediately stop playback and hand control back to the live pointer position.
- **FR-015**: The X-Y Pad's configuration, including any recorded movement data, MUST be persisted and restored using the project's existing patch save/load mechanism.
- **FR-016**: The X-Y Pad MUST clamp reported X/Y position to the pad's bounds (0-1 normalized range per axis) even if pointer movement occurs outside the visible pad area during a drag.
- **FR-017**: Recording duration MUST be capped at a maximum length; recording MUST stop automatically if this maximum is reached.

### Key Entities

- **X-Y Pad Component**: A canvas component with a 2D interactive surface, two CV-style outputs (X, Y), and a recording/playback subsystem. Attributes: current X position, current Y position, current state (idle, recording, playing), the active recording (if any).
- **Movement Recording**: The captured sequence of X/Y positions over time produced by a Record session. Attributes: ordered list of (time offset, X position, Y position) samples, total duration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can connect the X-Y Pad's outputs to two different target parameters and hear/see both respond independently within one interaction, with no setup steps beyond the standard connection gesture used elsewhere in the app.
- **SC-002**: Dragging the pointer across the pad updates connected parameters with no perceptible lag (position updates track pointer movement at normal interaction speeds without visible stepping or delay).
- **SC-003**: A recorded gesture of up to the maximum supported duration plays back with the same relative timing and shape as it was performed, verified by ear/eye comparison of live vs. replayed parameter movement.
- **SC-004**: A saved patch containing an X-Y Pad recording, once reloaded, reproduces the exact same recorded playback as before saving, with no loss of captured movement.
- **SC-005**: A first-time user can understand how to record and play back a gesture without external documentation, using only the Record/Stop/Play controls visible on the component.

## Assumptions

- The X-Y Pad's outputs behave as CV-style modulation sources, consistent with existing components (e.g. LFO, Collider) — normalized position is scaled to whatever range the connected target parameter expects, using the project's existing connection/scaling mechanism.
- Position range is normalized per axis (0 to 1, left-to-right and bottom-to-top, matching the visual layout of the pad), consistent with how other CV outputs in this project are defined.
- Maximum recording length is capped at 60 seconds, consistent with the project's general pattern of bounding captured-gesture/audio buffers (see Looper) to avoid unbounded memory growth; this can be adjusted during planning if a different bound is more appropriate.
- Recorded movement data is stored and restored via the existing `PatchSerializer` / `PatchStorage` pattern used by all other stateful components in this project.
- Only one recording can be stored per X-Y Pad instance at a time (recording again overwrites the previous one), matching the single-buffer behavior of the existing Looper component.
- The component supports both mouse and touch pointer input, consistent with other interactive canvas components in this project.
