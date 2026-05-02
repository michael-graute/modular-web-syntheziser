# Feature Specification: FM Oscillator Component

**Feature Branch**: `020-fm-oscillator`  
**Created**: 2026-05-02  
**Status**: Draft  
**Input**: User description: "New FMOscillator Component — a dedicated FM synthesis oscillator that extends the existing Oscillator class."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Hear an FM Patch (Priority: P1)

A musician opens the synthesizer, adds an FM Oscillator from the component palette, connects a second oscillator's audio output to the FM Oscillator's FM input, and immediately hears a richer, harmonically complex tone — typical of FM synthesis (bell-like, metallic, or organ-like timbres) — that is clearly distinct from the standard oscillator's output.

**Why this priority**: This is the core value of the feature. Without this working, no other FM capability is accessible. It also validates the end-to-end signal path (audio output → FM input → frequency modulation).

**Independent Test**: Can be fully tested by placing two oscillators, wiring one to the FM input of the other, and listening for the characteristic FM timbral change compared to a plain oscillator.

**Acceptance Scenarios**:

1. **Given** the component palette is open, **When** the user selects "FM Oscillator" under Generators, **Then** an FM Oscillator component appears on the canvas with a visible FM input port and an FM Depth parameter control.
2. **Given** an FM Oscillator and a standard Oscillator exist on the canvas, **When** the user connects the standard Oscillator's audio output to the FM Oscillator's FM input, **Then** the connection is accepted and the FM Oscillator's output audibly changes in timbre.
3. **Given** the FM connection is active, **When** the user adjusts the FM Depth parameter, **Then** the timbral complexity of the output changes in real time — more depth yields more harmonic richness, zero depth yields the plain carrier tone.

---

### User Story 2 - Control FM Depth Parameter (Priority: P2)

A sound designer uses the FM Depth knob on the FM Oscillator to sweep the modulation intensity from 0 Hz (no modulation, pure carrier) up to 1000 Hz (maximum modulation depth), shaping the timbre of the sound in real time.

**Why this priority**: FM Depth is the primary expressive control for FM synthesis. Without it the component has fixed, uncontrollable intensity, which severely limits usefulness.

**Independent Test**: Can be tested independently by activating an FM Oscillator with a modulator connected, then varying the FM Depth parameter and confirming the output spectrum changes proportionally.

**Acceptance Scenarios**:

1. **Given** an FM Oscillator with an active FM input connection, **When** FM Depth is set to 0, **Then** the output is indistinguishable from the same oscillator with no FM input connected.
2. **Given** an FM Oscillator with an active FM input connection, **When** FM Depth is gradually increased from 0 to 1000, **Then** the output progressively gains harmonic sidebands characteristic of FM synthesis.
3. **Given** an FM Depth value has been set, **When** the patch is saved and reloaded, **Then** the FM Depth value is restored exactly.

---

### User Story 3 - Use CV to Modulate FM Depth (Priority: P3)

An advanced user routes a CV signal (e.g., from an envelope or LFO) to the FM Depth parameter to dynamically animate the FM intensity over time — producing sounds like a plucked string (high initial FM depth decaying to zero) or a vibrato effect.

**Why this priority**: CV modulation of FM depth is a powerful expressive technique but is a secondary capability that builds on P1 and P2 being complete.

**Independent Test**: Can be tested independently by connecting an LFO's CV output to the FM Depth parameter and confirming the timbre cycles in sync with the LFO rate.

**Acceptance Scenarios**:

1. **Given** an FM Oscillator on the canvas, **When** a CV signal is connected to the FM Depth parameter port, **Then** the FM depth responds to the incoming CV values in real time.
2. **Given** a CV envelope is connected to FM Depth, **When** a gate signal triggers the envelope, **Then** the FM timbre evolves over the envelope's attack-decay shape.

---

### Edge Cases

- What happens when an FM Oscillator is connected to its own audio output (feedback)? The connection should be accepted; self-FM is musically valid. Volume may increase rapidly — user is responsible for gain staging.
- What happens when FM Depth is set to maximum (1000 Hz) with a high-frequency modulator? Output may produce very high-frequency sidebands or aliasing. This is expected FM behavior and does not need to be prevented.
- What happens if the FM input is connected but the modulator is silent (amplitude 0)? The FM Oscillator should behave exactly as if no FM input were connected.
- What happens when an existing non-FM patch containing standard oscillators is loaded? No change — the standard Oscillator component is unaffected by this feature. Backward compatibility must be preserved.
- What happens when multiple signals are connected to the FM input simultaneously? Signals should sum at the FM input (standard audio mixing behavior).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a new "FM Oscillator" component accessible from the component palette under the Generators category.
- **FR-002**: The FM Oscillator MUST expose all controls and ports of the existing standard Oscillator (frequency, waveform, detune, audio output, etc.) in addition to FM-specific additions.
- **FR-003**: The FM Oscillator MUST expose an audio input port labeled "FM Input" that accepts audio-rate signals for frequency modulation.
- **FR-004**: The FM Oscillator MUST expose a parameter control labeled "FM Depth" with a range of 0 to 1000 Hz and a default value of 100 Hz.
- **FR-005**: When an audio signal is connected to the FM Input port, the FM Oscillator MUST modulate its output frequency at audio rate in proportion to the incoming signal amplitude, scaled by the FM Depth value.
- **FR-006**: Setting FM Depth to 0 MUST produce output identical to an unmodulated carrier oscillator regardless of any signal present at the FM input.
- **FR-007**: The FM Depth parameter MUST be modulatable by CV signals.
- **FR-008**: The existing standard Oscillator component MUST remain unchanged — no new ports, parameters, or behavioral changes.
- **FR-009**: The connection system MUST accept audio-type signals connected to the FM Input port (an audio-to-audio-param routing path).
- **FR-010**: FM Oscillator state (frequency, waveform, FM Depth value, and connection topology) MUST be persisted when a patch is saved and fully restored when it is loaded.
- **FR-011**: The FM Oscillator MUST be registered as a distinct component type in the component registry, separate from the standard Oscillator.

### Key Entities

- **FM Oscillator**: A synthesizer component that generates an audio signal whose instantaneous frequency is the sum of its base frequency and a modulation signal scaled by the FM Depth parameter. Has all standard oscillator attributes plus an FM input port and FM Depth parameter.
- **FM Input Port**: An audio-type input port on the FM Oscillator whose connected signal is routed internally to scale the carrier's frequency in real time.
- **FM Depth Parameter**: A numeric parameter (0–1000 Hz) that controls the maximum frequency deviation applied by the modulation signal. Acts as the gain/intensity of the FM effect.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with no prior FM synthesis experience can create an audible FM patch (two oscillators connected for FM) within 2 minutes of discovering the FM Oscillator in the palette.
- **SC-002**: Changing the FM Depth parameter produces an audible and continuously variable timbral change with no audio glitches or dropouts.
- **SC-003**: All existing patches that contain standard Oscillator components load and play back identically after the FM Oscillator feature is introduced — zero regressions.
- **SC-004**: The FM Oscillator adds no more than 1% additional CPU load per instance compared to a standard Oscillator under equivalent conditions.
- **SC-005**: FM Oscillator patches (including FM Depth values and FM connections) survive a full save-and-reload cycle with no data loss.

## Assumptions

- The FM Oscillator is modelled as **linear FM** (audio signal added to the frequency AudioParam), not exponential FM. This matches standard Web Audio API behavior and the research recommendation.
- No FM feedback parameter is included in this specification (Phase 1 scope). FM feedback (routing the oscillator's own output to its FM input) is achievable by the user manually and is therefore out of scope for built-in controls.
- No FM ratio parameter is included in this specification (Phase 1 scope). Users control the modulator-to-carrier frequency ratio by setting each oscillator's frequency independently.
- The FM Input port uses the same audio signal type as all other audio connections in the system. No new signal type is introduced.
- No connection validation changes are required. The FM Input port is typed `AUDIO`, and the existing validator already permits `AUDIO → AUDIO` connections. The internal routing to the frequency AudioParam is an implementation detail invisible to the connection system.
