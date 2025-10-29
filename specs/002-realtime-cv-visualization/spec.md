# Feature Specification: Realtime CV Parameter Visualization

**Feature Branch**: `002-realtime-cv-visualization`
**Created**: 2025-10-29
**Status**: Draft
**Input**: User description: "parameter controls which parameters are changed by cv inputs should reflect the changes in realtime (example: oscillator detune button should rotate accordingly when detune is connected to an lfo output)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visual Feedback for CV-Controlled Parameters (Priority: P1)

When a user connects a CV source (such as an LFO) to a parameter (such as oscillator detune), they can see the parameter control element (such as a knob or button) move in realtime to reflect the current value being applied by the CV modulation.

**Why this priority**: This is the core feature that provides immediate visual feedback, helping users understand what modulation is doing to their sound. Without this, users cannot see the effect of CV modulation on parameters, making sound design less intuitive.

**Independent Test**: Can be fully tested by connecting any CV source to any parameter control and observing whether the control element visually updates in realtime and delivers immediate visual confirmation of modulation behavior.

**Acceptance Scenarios**:

1. **Given** an oscillator detune knob exists and an LFO output is available, **When** the user connects the LFO output to the detune parameter, **Then** the detune knob rotates continuously to reflect the LFO's current output value
2. **Given** a CV connection is active between an LFO and a filter cutoff parameter, **When** the LFO oscillates, **Then** the filter cutoff control moves smoothly to show the modulated value in realtime
3. **Given** multiple parameters are being modulated by different CV sources, **When** all sources are active, **Then** each parameter control updates independently to reflect its respective CV input

---

### User Story 2 - Smooth Visual Transitions (Priority: P2)

Parameter controls animate smoothly when being modulated by CV inputs, providing a fluid visual representation without jarring jumps or lag that could distract from the creative workflow.

**Why this priority**: Smooth animation enhances user experience and prevents visual distraction, but the feature is still functional with basic updates. This improves the polish and professional feel of the interface.

**Independent Test**: Can be tested by connecting a slow LFO to a parameter and verifying that the control animates smoothly without visible stuttering or frame drops, delivering a polished visual experience.

**Acceptance Scenarios**:

1. **Given** a parameter is being modulated by a slow LFO (0.5 Hz), **When** observing the parameter control, **Then** the control moves smoothly without visible jumps or stuttering
2. **Given** a parameter is being modulated by a fast LFO (10 Hz), **When** observing the parameter control, **Then** the control updates rapidly but maintains smooth visual motion
3. **Given** the system is under moderate load with multiple active voices, **When** CV modulation is active, **Then** parameter controls continue to update smoothly without performance degradation

---

### User Story 3 - Multiple CV Source Visualization (Priority: P3)

When a parameter receives modulation from multiple CV sources simultaneously (such as an LFO and an envelope), the parameter control reflects the combined effect of all modulation sources.

**Why this priority**: This handles advanced modulation scenarios and provides complete accuracy, but most basic use cases involve single CV sources. This adds completeness for power users.

**Independent Test**: Can be tested by connecting multiple CV sources to a single parameter and verifying the control shows the summed/combined result, delivering accurate visualization for complex modulation setups.

**Acceptance Scenarios**:

1. **Given** a filter frequency parameter is connected to both an LFO and an envelope generator, **When** both sources are active, **Then** the filter frequency control displays the combined modulation result
2. **Given** a parameter has three CV sources connected with different modulation amounts, **When** all sources output non-zero values, **Then** the control reflects the total modulated value accurately
3. **Given** CV sources are being added or removed from a parameter, **When** connections change, **Then** the control smoothly transitions to reflect the new modulation state

---

### Edge Cases

- When a CV input drives a parameter beyond its minimum or maximum range, both the visual representation and actual parameter value are clamped at the valid range limits
- For extremely fast modulation rates (audio-rate modulation above 20 Hz), the system reduces update rate to maximum perceptible refresh while showing the control as moving/active
- When a parameter control is manually adjusted by the user while CV modulation is active, the manual adjustment updates the base value and CV modulation continues relative to the new base
- When a parameter control is outside the visible UI viewport, visual updates are paused and resume when the control is scrolled back into view
- When CV connections are created or destroyed while modulation is actively occurring, the system smoothly transitions both visually and sonically using a short fade in/out to prevent abrupt changes

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display realtime visual updates to parameter controls when those parameters receive CV input
- **FR-002**: System MUST update parameter control positions to accurately reflect the current modulated value being applied
- **FR-003**: System MUST support visual updates for all parameter types that can receive CV modulation (knobs, sliders, buttons, etc.)
- **FR-004**: System MUST handle multiple simultaneous CV connections to different parameters, updating each control independently
- **FR-005**: System MUST reflect the combined effect when multiple CV sources modulate a single parameter
- **FR-006**: System MUST clamp both visual representation and actual parameter values to valid parameter ranges when CV input exceeds bounds
- **FR-007**: System MUST maintain visual update rate of at least 20 updates per second for modulation below audio rate; for audio-rate modulation (above 20 Hz), system should reduce update rate to maximum perceptible refresh while showing control as moving/active
- **FR-008**: System MUST show only the current modulated result on parameter controls, with the control position directly reflecting the audible output value
- **FR-009**: System MUST continue visual updates when multiple parameters are being modulated simultaneously without visible performance degradation
- **FR-010**: System MUST allow manual parameter adjustment during active CV modulation, where manual changes update the base value and CV modulation continues relative to the new base
- **FR-011**: System MUST pause visual updates for parameter controls that are outside the visible UI viewport and resume updates when controls are scrolled back into view
- **FR-012**: System MUST smoothly transition both visual and sonic behavior when CV connections are created or destroyed, using a short fade in/out to prevent abrupt changes

### Key Entities

- **Parameter Control**: Visual UI element (knob, slider, button) representing a modulatable parameter with a defined range and current value
- **CV Connection**: Link between a CV source output and a parameter input, with optional modulation depth/amount
- **CV Source**: Output that generates control voltage values over time (LFO, envelope, sequencer, etc.)
- **Modulation State**: Current combined value of all CV sources affecting a parameter, used to drive visual representation

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Parameter controls update within 50 milliseconds of CV value changes for smooth visual feedback
- **SC-002**: System maintains visual update performance with at least 10 simultaneously modulated parameters without visible lag
- **SC-003**: Users can visually identify which parameters are being actively modulated within 1 second of observation
- **SC-004**: 95% of modulation visualization updates occur without visible stuttering or frame drops during normal operation
- **SC-005**: Visual representation accuracy remains within 2% of actual modulated parameter value
- **SC-006**: CV connection state changes complete their fade transitions within 100 milliseconds without producing audible clicks or pops

## Clarifications

### Session 2025-10-29

- Q: When a user manually adjusts a parameter control while CV modulation is actively affecting that parameter, what should happen? → A: Manual adjustment changes the base value; CV modulation continues relative to new base
- Q: When CV modulation drives a parameter beyond its minimum or maximum range, how should the system handle this? → A: Clamp visually at min/max; parameter value also clamped at valid range limits
- Q: When CV modulation occurs at extremely fast rates (audio-rate, above 20 Hz), how should visual updates be handled? → A: Reduce update rate to maximum perceptible refresh; show control moving/active
- Q: When a parameter control that is receiving CV modulation is currently outside the visible UI viewport, how should the system handle visual updates? → A: Pause visual updates when off-screen; resume when scrolled into view
- Q: When CV connections are created or destroyed while modulation is actively occurring on other parameters, how should the system behave? → A: Smoothly transition visually and sonically (fade in/out over short time)

## Assumptions

- The system already has a working CV routing infrastructure that can notify when parameter values change due to CV inputs
- Parameter controls have a programmatic interface to update their visual state
- The audio processing and CV calculation happens independently of UI updates
- Standard UI refresh rates (30-60 FPS) are sufficient for visual feedback
- Users expect visual feedback primarily for slow-to-medium modulation rates (0.1 Hz - 20 Hz); audio-rate modulation may not require visual updates

## Out of Scope

- Displaying modulation waveforms or history graphs (only current value is shown)
- Recording or playback of parameter automation
- MIDI CC visualization or mapping
- Custom visual themes or animation styles for different modulation types
- Performance optimization for more than 20 simultaneous modulated parameters
