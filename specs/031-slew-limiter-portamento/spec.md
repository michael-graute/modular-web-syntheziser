# Feature Specification: Slew Limiter / Portamento

**Feature Branch**: `031-slew-limiter-portamento`
**Created**: 2026-06-03
**Status**: Draft
**Input**: User description: "Slew Limiter / Portamento — smooths abrupt CV jumps; produces glide between pitches. The Keyboard has no detached portamento module, so CV glide can't be applied to sequencer or Collider output."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Smooth Sequencer Pitch Glide (Priority: P1)

A musician patches the Step Sequencer's CV output through the Slew Limiter into an Oscillator's pitch CV input. Abrupt note-to-note transitions become smooth glides whose duration is controlled by a single Rise/Fall knob. This is the primary use case: portamento for clock-driven melodic sequences.

**Why this priority**: The core gap identified in the research doc — CV glide cannot currently be applied to sequencer output. Delivering this alone constitutes a complete, demonstrable MVP.

**Independent Test**: Patch Step Sequencer → Slew Limiter → Oscillator pitch input. Adjust the Rise time knob from minimum to maximum and verify the transition between notes audibly glides rather than steps.

**Acceptance Scenarios**:

1. **Given** a Step Sequencer is outputting a repeating melodic pattern, **When** its CV output is routed through a Slew Limiter with Rise > 0 ms, **Then** each pitch change glides smoothly over the configured duration instead of jumping instantaneously.
2. **Given** Rise and Fall are both set to 0, **When** the CV input changes, **Then** the output changes instantaneously with no audible glide (pass-through behaviour).
3. **Given** a Rise time is set to a long value, **When** a new CV value arrives, **Then** the output ramps up gradually over the Rise duration before reaching the target value.

---

### User Story 2 — Independent Rise and Fall Control (Priority: P2)

A musician wants asymmetric glide: fast attack (quick rise to the new pitch) but a slow, trailing release (slow fall back). They set Rise and Fall independently, enabling expressive shapes not possible with a single-knob portamento.

**Why this priority**: Single-knob portamento covers 80% of use cases; independent Rise/Fall is the natural extension that unlocks expressive playing styles and is standard on professional slew limiters.

**Independent Test**: Set Rise to minimum and Fall to maximum. Feed a square-wave gate CV that alternates high/low. Verify the output rises instantly but falls slowly.

**Acceptance Scenarios**:

1. **Given** Rise is set low and Fall is set high, **When** the incoming CV rises sharply, **Then** the output follows almost immediately, but **When** the incoming CV drops, **Then** the output falls slowly over the configured Fall duration.
2. **Given** Rise and Fall are set to different values, **When** patch settings are saved and reloaded, **Then** both values are restored exactly.

---

### User Story 3 — Collider and LFO CV Smoothing (Priority: P3)

A musician patches the Collider's or LFO's raw CV output through the Slew Limiter to reduce jitter or add organic glide to modulation signals — not just pitch. Any CV source in the system can feed the module.

**Why this priority**: Extends usefulness beyond pitch glide to general CV conditioning; demonstrates the module is a universal utility, not a single-purpose effect.

**Independent Test**: Patch an LFO (square wave) → Slew Limiter → Oscillator detune CV. Verify the sharp LFO edges are rounded into smooth ramps at the output.

**Acceptance Scenarios**:

1. **Given** an LFO running a square wave is patched to the Slew Limiter input, **When** Rise and Fall are set above 0, **Then** the output shows smoothed ramps rather than hard steps.
2. **Given** any CV-outputting module is connected, **When** it is patched to the Slew Limiter input, **Then** the module accepts and processes the signal without errors.

---

### Edge Cases

- What happens when the Rise/Fall time is set to the maximum and a very rapid stream of CV changes arrives? The output should continuously ramp toward the most recent target without resetting mid-glide.
- What happens when the module is added to a patch with no input connected? Output should remain at 0 V (silence / no modulation) without error.
- What happens when the incoming CV value is identical to the current output value? No glide is applied; output remains stable.
- What happens when the module is bypassed (if bypass is supported)? Input CV passes to output unchanged, with no smoothing applied.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The module MUST accept one CV input signal from any CV-outputting module in the system.
- **FR-002**: The module MUST produce one CV output signal that is a time-smoothed version of the input.
- **FR-003**: The module MUST provide a Rise time control adjustable from 0 ms (instantaneous) to 5000 ms, with an exponential (logarithmic) knob scale to give fine resolution at short times.
- **FR-004**: The module MUST provide a Fall time control adjustable from 0 ms (instantaneous) to 5000 ms, with an exponential (logarithmic) knob scale to give fine resolution at short times.
- **FR-005**: Rise and Fall controls MUST operate independently so asymmetric glide shapes are possible.
- **FR-006**: When both Rise and Fall are set to 0, the module MUST pass CV through without any smoothing.
- **FR-007**: The module MUST display the current output level visually as a vertical bar meter, where 0 = no signal and 1 = full scale (normalised 0–1 CV range), updating in real time so the user can observe the glide in progress.
- **FR-008**: All control values (Rise, Fall) MUST persist when the patch is saved and restored when the patch is reloaded.
- **FR-009**: The module MUST be patchable as an intermediary between any CV source and any CV-accepting input (oscillator pitch, filter cutoff, VCA gain, etc.).
- **FR-010**: The module MUST support bypass, causing input CV to pass to output unaltered when bypass is active.

### Key Entities

- **Slew Limiter Module**: The component itself — holds Rise time, Fall time, current output value, and bypass state.
- **CV Input Port**: Accepts incoming CV from any CV-outputting source module.
- **CV Output Port**: Emits the smoothed CV signal to any CV-accepting destination module.
- **Rise Time**: The duration over which the output ramps upward to match a higher incoming CV value.
- **Fall Time**: The duration over which the output ramps downward to match a lower incoming CV value.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A musician can route any CV source through the Slew Limiter and hear audible portamento on pitch-targeted outputs within one patch connection.
- **SC-002**: Rise and Fall times of 0 ms produce no perceptible difference from a direct patch cable connection (pass-through).
- **SC-003**: Rise and Fall times at maximum (5000 ms) produce clearly audible glide of at least 5 seconds on pitch changes spanning one octave or more.
- **SC-004**: Patch save/reload restores Rise and Fall values with no drift — the saved value equals the restored value exactly.
- **SC-005**: The visual output meter updates in real time and reflects the smoothed CV level, visually confirming the glide is active.
- **SC-006**: The module integrates into an existing patch without disrupting signal flow to other connected modules.

## Clarifications

### Session 2026-06-03

- Q: What scale/taper should the Rise and Fall knobs use? → A: Exponential (logarithmic) — fine resolution at short times, coarser at long times (standard audio taper).
- Q: What is the maximum Rise/Fall time? → A: 5000 ms (5 seconds) — covers extreme portamento and slow CV smoothing.
- Q: What CV range does the visual bar meter display? → A: 0 to 1 normalised — matches Envelope Follower and standard modulation CV range in this project.

## Assumptions

- Rise and Fall time ranges of 0–5000 ms cover the primary musical use cases (portamento, CV smoothing). A future enhancement could extend the upper bound.
- The visual display is a simple vertical bar meter showing the current output level on a normalised 0–1 scale, consistent with the Envelope Follower display pattern in this project.
- Bypass behaviour follows the existing convention in this project (same as LFO bypass toggle).
- The module does not need a separate "link Rise/Fall" mode; users who want symmetric glide simply set both knobs to the same value.
- No internal clock or BPM sync is needed for this module; glide time is always specified in milliseconds.
