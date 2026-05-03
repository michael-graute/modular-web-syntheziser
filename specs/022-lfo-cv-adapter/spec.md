# Feature Specification: LFO CV Adapter

**Feature Branch**: `022-lfo-cv-adapter`
**Created**: 2026-05-03
**Status**: Draft
**Input**: LFO CV adapter — context-aware output scaling

## Overview

When an LFO connects to a target port, it should automatically scale its output signal to match the expected range of that destination. Today the LFO outputs a fixed ±1 normalised signal, which requires manual scaling workarounds in each destination component. This leads to bugs, inconsistent behaviour, and hidden coupling between components that should be independent. The fix makes the LFO self-adapting: it reads the target parameter's range at connection time and produces the correct amplitude without any help from the destination.

A related problem — normalised sources (ADSR, 0..1 output) driving destination parameters that expect large ranges (e.g. filter cutoff in Hz) — is addressed by giving the Filter a dedicated "CV Amount" control that the user can set, rather than having the source guess the destination's scale.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — LFO drives filter cutoff correctly (Priority: P1)

A user connects an LFO to a Filter's Cutoff CV input. The filter cutoff sweeps through an audible frequency range in sync with the LFO rate, without any beeping, gating, or silent dead zones. The user does not need to configure any scaling manually.

**Why this priority**: This is the most common LFO use case and the direct cause of the bug being fixed. Everything else builds on this working correctly.

**Independent Test**: Connect LFO → Filter cutoff_cv with LFO rate 1 Hz, depth 50%, base cutoff 1200 Hz. Press and hold a key. The filter should sweep smoothly and audibly up and down at 1 Hz with no silence or gating artefacts.

**Acceptance Scenarios**:

1. **Given** a patch with Oscillator → Filter → Master Output and an LFO at 50% depth, **When** the user connects the LFO output to the Filter's Cutoff CV input, **Then** the filter cutoff oscillates continuously at the LFO rate and no silence or clipping occurs regardless of the base cutoff setting.
2. **Given** the above connection, **When** the user raises LFO depth to 100%, **Then** the sweep widens but the cutoff never reaches zero and the sound remains continuous.
3. **Given** the above connection, **When** the user changes LFO rate, **Then** the sweep speed changes immediately without reconnecting.

---

### User Story 2 — LFO drives multiple targets simultaneously, each scaled correctly (Priority: P1)

A user connects one LFO to both the Filter's Cutoff CV and the Oscillator's Detune CV at the same time. Each destination receives the correctly scaled signal for its own parameter range — the filter gets Hz-range modulation and the detune gets cents-range modulation — without either destination interfering with the other.

**Why this priority**: Multi-target LFO routing is a standard synthesis technique. If a single LFO cannot drive different parameter types simultaneously, it is not usable as a general modulation source.

**Independent Test**: Connect LFO → Filter cutoff_cv AND LFO → Oscillator detune. Both should modulate audibly and independently. Disconnecting one should not affect the other.

**Acceptance Scenarios**:

1. **Given** an LFO connected to both Filter cutoff_cv and Oscillator detune, **When** a note is played, **Then** both the timbre (filter sweep) and pitch (vibrato) modulate simultaneously at the LFO rate.
2. **Given** the above multi-target patch, **When** the user disconnects LFO from the filter, **Then** vibrato continues unaffected.
3. **Given** the above multi-target patch, **When** LFO depth is changed, **Then** both destinations update their modulation depth proportionally.

---

### User Story 3 — ADSR drives filter cutoff with user-controlled amount (Priority: P2)

A user connects an ADSR Envelope to a Filter's Cutoff CV input. A "CV Amount" knob on the Filter determines how far the filter opens in response to the envelope. At low CV Amount the effect is subtle; at high CV Amount the filter sweeps dramatically with each note.

**Why this priority**: The ADSR→filter sweep is a foundational synthesis technique taught in Module 3 of the guided lessons. It must work intuitively without the ADSR needing to know anything about the filter's frequency range.

**Independent Test**: Connect Keyboard gate → ADSR → Filter cutoff_cv. Set Filter CV Amount to 50%. Play a note. The filter cutoff should rise with the ADSR attack and fall during decay/release, with the sweep depth proportional to CV Amount.

**Acceptance Scenarios**:

1. **Given** ADSR connected to Filter cutoff_cv and CV Amount at 50%, **When** a note is triggered, **Then** the filter cutoff rises and falls with the ADSR shape, sweeping approximately half the available frequency range.
2. **Given** the above, **When** the user sets CV Amount to 0%, **Then** the ADSR has no effect on the filter cutoff.
3. **Given** the above, **When** the user sets CV Amount to 100%, **Then** the filter sweeps from its base cutoff up to the maximum audible frequency.
4. **Given** the above, **When** the user saves and reloads the patch, **Then** the CV Amount value is restored correctly.

---

### User Story 4 — LFO drives VCA gain for tremolo (Priority: P2)

A user connects an LFO to a VCA's CV input for tremolo (rhythmic volume variation). The depth of the tremolo is controlled by the LFO's Depth parameter. The volume modulates smoothly between silence and full level without clipping or asymmetric distortion.

**Why this priority**: Tremolo (LFO→VCA) is the other common LFO use case. It must work correctly after the LFO normalisation change, since the VCA gain AudioParam range (0..1) is different from the filter frequency range.

**Independent Test**: Connect LFO (sine, 4 Hz, 50% depth) → VCA CV input. Play a note. The volume should pulse rhythmically at 4 Hz, reaching approximately half modulation depth, with no silence in the troughs unless depth is at 100%.

**Acceptance Scenarios**:

1. **Given** LFO connected to VCA CV at 50% depth, **When** a note is held, **Then** the volume oscillates smoothly, never going fully silent, and the modulation is symmetric.
2. **Given** the above, **When** depth is set to 100%, **Then** the volume oscillates from near-silence to full level.
3. **Given** the above, **When** depth is set to 0%, **Then** the volume is constant and the LFO has no effect.

---

### Edge Cases

- What happens when the LFO connects to a port with no associated parameter range (e.g. a gate input)? The adapter should fall back to a safe default scale and log a warning.
- What happens when the user changes the LFO Depth while it is connected to multiple targets? All active per-connection gain nodes must update simultaneously.
- What happens if a connection is made before audio nodes are initialised? The adapter must defer scaling until nodes are ready or reject the connection gracefully.
- What happens if the same LFO output is connected to the same target port twice? The second connection should be rejected or replace the first.
- What happens when a patch containing LFO connections is loaded from JSON? The per-connection gain nodes must be reconstructed with the correct scaling for each destination.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When an LFO output port is connected to any CV input port, the system MUST automatically compute an appropriate output amplitude for that connection based on the target parameter's minimum and maximum range.
- **FR-002**: The LFO MUST create one dedicated audio scaling node per active outgoing connection, so that different destinations receive independently scaled signals from the same LFO.
- **FR-003**: When an LFO connection is removed, the system MUST destroy the corresponding per-connection scaling node and release all associated audio resources.
- **FR-004**: When LFO Depth is changed while connections are active, ALL active per-connection scaling nodes MUST update their amplitude immediately without reconnecting.
- **FR-005**: The Filter component MUST expose a "CV Amount" parameter (range 0–100%) that scales all incoming CV signals before they reach the cutoff frequency AudioParam. This replaces the internal fixed-gain scaler introduced as a workaround.
- **FR-006**: The Filter component's `cutoff_cv` port MUST accept direct AudioParam connections (as it did before the workaround), with the CV Amount parameter controlling the modulation depth.
- **FR-007**: The ADSR Envelope output MUST remain a normalised 0..1 signal. Scaling to the destination's range is the responsibility of the destination component (via FR-005) or the connecting adapter.
- **FR-008**: Patch serialisation MUST preserve all LFO connection data such that loading a saved patch reconstructs the correct per-connection scaling without user intervention.
- **FR-009**: The LFO adapter mechanism MUST be encapsulated so that other future CV sources (e.g. Step Sequencer CV output) can adopt the same pattern with minimal changes.
- **FR-010**: The internal `cutoffCvScaler` GainNode workaround in `Filter.ts` MUST be removed. The `SynthComponent` base class fallback path (`getInputNodeByPort` for CV) introduced for this workaround MAY be retained if it has other valid uses, but MUST NOT be the primary path for Filter cutoff modulation.

### Key Entities

- **LFO (CV Source)**: Generates a periodic modulation signal. After this change, maintains a map of active outgoing connections to their per-connection scaling nodes.
- **CV Scaling Node**: A dedicated audio gain node created per LFO→destination connection. Its gain is computed as `(depth / 100) × targetRange / 2`, where `targetRange = paramMax − paramMin`.
- **Filter CV Amount**: A new user-facing parameter on the Filter component. Controls how much incoming CV modulates the cutoff. Range 0–100%, serialised with the patch.
- **Parameter Range**: The min/max values already defined on each `Parameter` object in `SynthComponent`. The adapter reads these at connection time to determine the correct scale.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An LFO connected to Filter cutoff_cv at any depth value produces a continuous, audible filter sweep with no silence, gating, or frequency clamping artefacts.
- **SC-002**: A single LFO can drive two or more targets simultaneously with each target receiving the correct modulation range for its parameter type — verified by independent audible modulation at each destination.
- **SC-003**: Changing LFO depth while connected to multiple targets updates all active modulation depths within one LFO cycle (i.e. no reconnection required).
- **SC-004**: All 19 existing guided lesson patches load and play correctly after the refactor, with no change to the lesson JSON files required.
- **SC-005**: The Filter CV Amount parameter persists across save/load cycles with no data loss.
- **SC-006**: The internal cutoffCvScaler workaround is fully removed from the Filter implementation — verifiable by code review with zero references to the old scaler in `Filter.ts`.

---

## Assumptions

- The `Parameter` class already exposes `getMin()` and `getMax()` (or equivalent) — if not, these will need to be added as part of this feature.
- The LFO's oscillator output is bipolar (−1..+1) before the depth gain stage. The per-connection scale will be computed as `(depth / 100) × (paramMax − paramMin) / 2` for bipolar sources, centred on the parameter's midpoint.
- For parameters where the centre of modulation should be the current knob value (e.g. filter cutoff), the base value stays on `filterNode.frequency.value` and the CV adds as an offset — this is the existing Web Audio model and does not change.
- Patch files for the guided lessons (L11 envelope-to-filter) will need the Filter's new CV Amount parameter added with a non-zero default value so the ADSR sweep remains audible after the workaround is removed.
- The Step Sequencer's CV output and other non-LFO CV sources are out of scope for this feature. They continue to connect as plain AudioParam additions.
