# Feature Specification: VU Meter

**Feature Branch**: `027-vu-meter`  
**Created**: 2026-05-31  
**Status**: Draft  
**Input**: User description: "VU Meter as mentioned in docs/research/missing-features.md — visual feedback for signal levels independent of the Oscilloscope. Useful for monitoring mixer channels or checking CV ranges without interrupting the audio path."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Monitor a Mixer Channel Level (Priority: P1)

A user adds a VU Meter after a Mixer channel output to check whether a signal is too quiet, too loud, or clipping. They glance at the meter while adjusting the Mixer channel gain knob to find a healthy level without stopping playback.

**Why this priority**: Real-time level monitoring is the core purpose of the component. Without a working meter display, the component has no value.

**Independent Test**: Connect any audio source → VU Meter. Play audio and verify the meter reacts to the signal level in real time. Disconnect the source and verify the meter falls to silence.

**Acceptance Scenarios**:

1. **Given** an audio source connected to the VU Meter input, **When** audio plays, **Then** the meter display rises and falls continuously in sync with the signal amplitude.
2. **Given** a loud signal approaching clipping, **When** it reaches the meter, **Then** the display clearly indicates a near-clip or clip condition (distinct visual state at the top of the scale).
3. **Given** no input connected, **When** the meter is on the canvas, **Then** the display shows silence (minimum/zero level) without error.
4. **Given** a signal connected, **When** the signal is disconnected, **Then** the meter falls gracefully to silence (no frozen display or crash).

---

### User Story 2 — Monitor a CV Signal Range (Priority: P2)

A user connects an LFO or Collider CV output to the VU Meter to verify the CV signal is active and to get a rough sense of its amplitude range before routing it to a target parameter. This lets them confirm the signal is present without interrupting the audio path.

**Why this priority**: CV monitoring is a secondary but distinct use case — the meter must handle both audio-rate and CV-rate signals. It extends the core meter display (US1) without requiring extra user controls.

**Independent Test**: Connect an LFO output → VU Meter. Set the LFO to a slow rate (0.5 Hz). Verify the meter slowly sweeps up and down in sync with the LFO waveform.

**Acceptance Scenarios**:

1. **Given** an LFO connected to the VU Meter input, **When** the LFO oscillates, **Then** the meter reflects the LFO's amplitude with smooth, continuous movement.
2. **Given** a CV signal with a narrow range (e.g., 0–0.1), **When** it arrives at the meter, **Then** the display shows a low-level reading rather than staying at zero.

---

### User Story 3 — Save and Restore the Meter in a Patch (Priority: P3)

A user saves a patch that includes a VU Meter positioned between the Mixer and Master Output. On reloading the patch, the VU Meter reappears in its saved position and reconnects automatically — ready to monitor the same signal without any manual rewiring.

**Why this priority**: Patch persistence is required for the component to be production-useful. It does not affect real-time monitoring (US1/US2) but is necessary for the component to integrate seamlessly with the rest of the application.

**Independent Test**: Place a VU Meter, connect it, save the patch, reload the page, verify the meter reappears connected and begins monitoring immediately.

**Acceptance Scenarios**:

1. **Given** a patch saved with a VU Meter, **When** the patch is reloaded, **Then** the VU Meter appears at its saved position with its connections restored.
2. **Given** a legacy patch without a VU Meter, **When** loaded, **Then** no error occurs and the patch loads normally.

---

### Edge Cases

- What happens when the input signal is exactly 0 (digital silence)? → The meter displays the minimum/floor level, not frozen mid-scale.
- What happens when the input signal clips (exceeds full scale)? → The meter holds a clip indicator briefly (peak hold) before falling, giving the user a chance to see the event.
- What happens when two sources are connected to the same input? → Standard patch routing: only one source can connect at a time per port.
- What happens when the meter is bypassed? → The component has no processing effect on the audio path (it is a passive tap), so bypass is not applicable; the meter simply stops displaying when removed from the canvas.
- What happens when the audio context is suspended? → The meter displays silence and resumes automatically when the audio context resumes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The VU Meter MUST accept one audio/CV input signal and display its level in real time.
- **FR-002**: The meter display MUST update continuously while a signal is connected, reflecting the current amplitude with a visual bar or column.
- **FR-003**: The meter MUST visually distinguish at least three level zones: low (safe), moderate (nominal), and high/clip (danger).
- **FR-004**: The meter MUST include a peak-hold indicator that briefly retains the highest recent level before falling, so transient peaks are visible to the user.
- **FR-005**: The meter MUST display a silence/floor state (no movement) when no signal is connected or the signal is zero.
- **FR-006**: The meter MUST NOT alter the audio signal in any way — it is a passive monitoring tap only. No audio output port is required.
- **FR-007**: The meter component MUST be saveable and restorable as part of patch persistence with no required configuration parameters.
- **FR-008**: The meter MUST work with both audio-rate signals (e.g., oscillator output) and CV-rate signals (e.g., LFO output) without requiring the user to switch modes.

### Key Entities

- **VU Meter**: A passive monitoring component with one signal input, no outputs, and a real-time level display embedded in the component canvas tile.
- **Level Display**: A vertical bar or segmented column rendered inside the component that reflects the current signal amplitude. Divided into colour zones (low / mid / high-clip).
- **Peak Hold Indicator**: A brief horizontal marker at the highest recently seen level, visible for a short hold time before falling back down.

### Assumptions

- The meter measures signal amplitude (RMS or peak) sampled from the Web Audio API's analysis capabilities — no user-facing "measurement mode" toggle is needed.
- Display update rate follows the canvas render loop (60 FPS target); no separate refresh rate knob is required.
- The meter has no output port — it is purely for monitoring and does not pass the signal through.
- A single input port accepts any signal type (Audio or CV); no type restriction needed since the display is amplitude-agnostic.
- Peak hold duration defaults to approximately 1.5 seconds — long enough to catch transients, short enough to stay responsive.
- No numeric dBFS readout is required for the initial version; the visual bar alone is sufficient.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The meter display begins reacting to a connected signal within one canvas render frame of the signal becoming active — no perceptible lag.
- **SC-002**: A user can immediately identify whether a signal is present, at a healthy level, or clipping by glancing at the meter — no interpretation required.
- **SC-003**: The peak-hold indicator is visible for at least 1 second after a transient peak, giving the user sufficient time to notice it.
- **SC-004**: The meter display falls to the silence state within 2 seconds of a signal being disconnected — no frozen or stuck readings.
- **SC-005**: A patch containing a VU Meter saves and reloads with the meter in its correct position and reconnected — zero manual rewiring required.
- **SC-006**: The component introduces no audible change to any signal passing through adjacent components — the meter is purely observational.
