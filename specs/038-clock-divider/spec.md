# Feature Specification: Clock Divider

**Feature Branch**: `038-clock-divider`
**Created**: 2026-07-09
**Status**: Draft
**Input**: User description: "Add a Clock Divider component. It takes a clock/gate pulse input (or follows the global BPM) and outputs derived gate pulses at musically-related divisions and multiplications of that clock (e.g. /2, /4, /8, x2, x3), so other rhythmic components like the Step Sequencer, Collider, or Arpeggiator can be triggered at synchronized but different rates from a single clock source."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Derive Slower Rhythmic Variations from the Shared Tempo (Priority: P1)

A musician has a patch where the Step Sequencer plays a fast, busy pattern. They want a second rhythmic element — say, a Collider triggering a bass note — to happen only on every 4th beat, staying perfectly in time with the sequencer without manually calculating or typing a separate slower BPM. They add a Clock Divider, set one of its outputs to "/4", and connect that output's gate to the Collider's gate input.

**Why this priority**: Generating a slower, tempo-locked pulse from the shared tempo is the core value proposition of a clock divider — it's the single most common use case (a "half-time" or "every-Nth-beat" trigger) and delivers value even before multiplication or multiple simultaneous outputs are considered.

**Independent Test**: Add a Clock Divider to the canvas, set the global BPM, select a "/4" division on one output, connect that output to any gate-accepting component, and verify the connected component receives a pulse only once every 4 beats of the global tempo.

**Acceptance Scenarios**:

1. **Given** a Clock Divider is on the canvas and the global BPM is running, **When** the user selects a "/2" division for an output, **Then** that output emits a gate pulse once every 2 beats of the global tempo.
2. **Given** a Clock Divider output is set to "/4", **When** the global BPM changes, **Then** the output's pulse rate adjusts immediately to stay locked to the new tempo (still one pulse per 4 beats at the new speed).
3. **Given** a Clock Divider output is connected to a gate-accepting component (e.g. Collider, ADSR-driven voice), **When** the divided pulse fires, **Then** the connected component responds to it exactly as it would to any other gate signal (e.g. a Collider bounce is triggered, an envelope opens).

---

### User Story 2 - Derive Faster Rhythmic Variations (Multiplication) (Priority: P2)

A musician wants a fast hi-hat-like pattern that ticks twice or three times as often as the main beat, still perfectly locked to the shared tempo. They set a Clock Divider output to "x2" or "x3" instead of a division.

**Why this priority**: Multiplication is the natural complement to division and is commonly desired (double-time, triplet feels), but a working divider alone (User Story 1) already delivers standalone value — multiplication extends the same mechanism rather than introducing new capability.

**Independent Test**: Add a Clock Divider, set an output to "x2", connect it to a gate-accepting component, and verify it receives twice as many pulses per unit time as the raw global tempo.

**Acceptance Scenarios**:

1. **Given** a Clock Divider output is set to "x2", **When** the global tempo produces one beat, **Then** that output emits two evenly-spaced pulses within the same beat.
2. **Given** a Clock Divider output is set to "x3", **When** the global tempo produces one beat, **Then** that output emits three evenly-spaced pulses within the same beat (triplet feel).

---

### User Story 3 - Drive Several Independent Rates from One Shared Source (Priority: P2)

A musician wants several components in their patch — a fast hi-hat pattern, a mid-speed melodic sequence, and a slow bassline accent — all locked to the same tempo but ticking at different, simultaneously-active rates, without adding a separate Clock Divider (and thus a separate point of tempo drift) for each rate.

**Why this priority**: A single-output divider (implicitly covered by User Stories 1–2) already provides value for one derived rate; supporting several independent, simultaneously active outputs on one component is what makes the feature scale to real multi-part patches, which is the stated motivating use case ("Step Sequencer, Collider, or Arpeggiator... from a single clock source").

**Independent Test**: Add one Clock Divider, configure multiple of its outputs to different divisions/multiplications (e.g. one at "/2", one at "/8", one at "x2"), connect each to a different gate-accepting component, and verify all three fire pulses independently and correctly at their own configured rate, all derived from the same underlying tempo.

**Acceptance Scenarios**:

1. **Given** a Clock Divider has multiple outputs each configured to a different division/multiplication, **When** the global tempo runs, **Then** each output independently emits pulses at its own configured rate, with no interference between outputs.
2. **Given** two outputs are configured such that one rate is a multiple of another (e.g. "/2" and "/4"), **When** both fire, **Then** their pulses align on the beats where the two rates coincide (the "/4" pulse always lands on a beat where "/2" also pulses), consistent with both being derived from the same underlying clock.

---

### Edge Cases

- What happens when the global BPM changes while a division/multiplication is actively counting mid-cycle? The output MUST re-lock to the new tempo without producing a spurious extra or missing pulse at the moment of the change, so downstream components don't receive a glitched trigger.
- What happens when a Clock Divider is added to the canvas mid-session, after the global transport has already been running? Its outputs MUST begin counting from that point forward and align to the ongoing beat grid, not restart the global tempo or introduce an offset relative to other tempo-following components.
- What happens when no output is connected to anything? The component MUST continue running internally (so that later connections immediately receive correctly-phased pulses) without error, consistent with how other unconnected components behave in this project.
- What happens when the same division (e.g. two outputs both set to "/4") is configured on multiple outputs of the same Clock Divider? Both MUST pulse identically and simultaneously — this is a valid way to fan out the same derived rate to multiple destinations.
- What happens when the global transport is stopped? Divided/multiplied outputs MUST also stop emitting pulses, consistent with how existing tempo-following components (Step Sequencer, Looper) already respond to global transport stop.
- What happens when the patch containing a Clock Divider is saved and reloaded? Each output's configured division/multiplication setting MUST be restored exactly, so the patch's rhythmic relationships are unchanged after reload.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Clock Divider component that can be added to the canvas like other modular components.
- **FR-002**: The Clock Divider MUST derive its timing from the patch's shared global tempo (the same BPM value other tempo-following components already use), so its outputs stay musically locked to the rest of the patch without manual tempo entry.
- **FR-003**: The Clock Divider MUST provide multiple independent outputs, each individually configurable to its own division or multiplication rate, so a single component can drive several differently-timed destinations at once.
- **FR-004**: Each output MUST support common division rates relative to the shared tempo, at minimum: /2, /4, /8, and /16.
- **FR-005**: Each output MUST support common multiplication rates relative to the shared tempo, at minimum: x2 and x3.
- **FR-006**: Each output MUST emit a gate-style pulse signal, matching the pulse format already used by other trigger-emitting components in this project (e.g. the Step Sequencer's gate output), so it can be connected to any gate-accepting input without special handling.
- **FR-007**: All outputs on a single Clock Divider MUST be derived from the same underlying tempo reference, so that outputs with a mathematical relationship to each other (e.g. /2 and /4) always align on shared beats.
- **FR-008**: Users MUST be able to change an output's division/multiplication setting directly on the component, with the change taking effect on the next natural pulse boundary (not retroactively altering pulses already emitted).
- **FR-009**: The Clock Divider's per-output settings (which division or multiplication each output is set to) MUST be persisted and restored using the project's existing patch save/load mechanism.
- **FR-010**: A change to the shared global tempo MUST immediately re-time all of a Clock Divider's outputs to the new tempo, without requiring the user to reconfigure anything.
- **FR-011**: The Clock Divider MUST NOT require any output to be connected in order to function correctly — its internal timing runs regardless of whether anything is listening.

### Key Entities

- **Clock Divider Component**: A canvas component with no audio-signal role, holding a shared tempo reference and a set of independent outputs. Attributes: canvas position, and per-output configuration (a division or multiplication rate).
- **Clock Divider Output**: One of several gate-signal outputs on a Clock Divider. Attributes: an assigned rate (e.g. "/2", "/4", "x3"), and its own independent pulse timing derived from the shared tempo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can connect a Clock Divider output to a rhythmic component (Step Sequencer, Collider, Arpeggiator, or any gate-accepting input) and hear it trigger at the correct derived rate within one bar of connecting it — no manual tempo calculation required.
- **SC-002**: Pulses from two related divisions/multiplications on the same Clock Divider (e.g. /2 and /4) remain sample-accurately aligned on their shared beats over an extended playback session (no audible or measurable drift after several minutes of continuous playback).
- **SC-003**: A patch containing a Clock Divider with custom per-output settings, once saved and reloaded, reproduces the exact same division/multiplication configuration on every output.
- **SC-004**: A first-time user can identify what rate each output is producing directly from the component's on-canvas display, without needing external documentation.
- **SC-005**: Changing the global tempo while a patch is playing does not produce any audibly incorrect ("glitched") extra or dropped pulse on any Clock Divider output.

## Assumptions

- The Clock Divider follows the shared global tempo, the same way the Step Sequencer and Collider already do (both support a "Global vs. local tempo" mode) — it is not driven by an external incoming clock/gate signal wired into it. No component in this project currently exposes a "Clock In" port pattern, so treating an external gate as an alternative clock source would be new, unproven territory; anchoring exclusively to the shared global tempo delivers the described use case ("synchronized... from a single clock source") with a pattern this project already has and users already understand. Accepting an external gate/clock input instead of (or in addition to) the global tempo is out of scope for this feature and may be considered as a future enhancement.
- Division/multiplication values are expressed using this project's existing short-form note-value vocabulary (e.g. "1/4", "1/8", "1/16"), consistent with how the Step Sequencer and Arpeggiator already label their own tempo-subdivision controls, rather than introducing new terminology.
- The number of simultaneous outputs on one Clock Divider is a small, fixed set (not user-extendable) sufficient to cover typical patch needs (e.g. driving a handful of differently-timed destinations at once); exact output count is a reasonable implementation default not mandated by this spec.
- The Clock Divider has no audio-signal role and therefore no audio input/output ports — only gate outputs, consistent with other pure-timing/CV utility components in this project.
- Like other tempo-following components in this project (Step Sequencer, Looper), the Clock Divider responds to the shared transport's play/stop state — its outputs only pulse while the transport is running.
