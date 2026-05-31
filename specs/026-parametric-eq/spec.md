# Feature Specification: 3-Band Parametric EQ

**Feature Branch**: `026-parametric-eq`  
**Created**: 2026-05-31  
**Status**: Draft  
**Input**: User description: "3 Band Parametric Equalizer Component. The EQ should have low shelf, mid peak and high shelf parameters."

## Clarifications

### Session 2026-05-31

- Q: How should the CV gain inputs be scaled? → A: 1V = 1 dB — direct mapping; ±18V CV gives full ±18 dB range.
- Q: What are the exact default frequencies and Q for each band? → A: Low shelf 80 Hz, mid peak 1000 Hz Q=1.0, high shelf 8000 Hz.
- Q: What are the frequency ranges for the three bands? → A: Low shelf 20–800 Hz, mid peak 200–8000 Hz, high shelf 1000–20000 Hz.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Shape an Oscillator's Tone (Priority: P1)

A user adds a Parametric EQ between an oscillator and the master output to sculpt the sound. They boost the low shelf to add warmth, cut the mid peak to remove harshness, and roll off the high shelf to soften brightness. The result is a richer, more musical tone without changing the oscillator's waveform.

**Why this priority**: Tone shaping is the primary use case for any EQ. Without working band controls, the component has no value.

**Independent Test**: Connect Oscillator → Parametric EQ → Master Output. Adjust each band's gain independently and verify the audible character of the sound changes as expected.

**Acceptance Scenarios**:

1. **Given** an oscillator connected to the EQ input, **When** the low shelf gain is increased, **Then** the output sounds noticeably fuller/warmer with more bass energy.
2. **Given** a mid peak band centered on a harsh frequency, **When** the gain is reduced, **Then** the harshness is audibly reduced without affecting other frequency areas.
3. **Given** the high shelf gain is decreased, **When** listening to the output, **Then** the high-frequency content is attenuated and the sound becomes less bright.
4. **Given** all three bands set to 0 dB gain, **When** audio passes through, **Then** the output is identical to the input (flat/bypass state).

---

### User Story 2 — Set Mid Peak Frequency and Bandwidth (Priority: P2)

A user wants to surgically target a specific resonance in a filter or oscillator. They set the mid peak band's center frequency and Q (bandwidth) to isolate and cut the problem frequency precisely.

**Why this priority**: A fixed mid frequency makes the EQ useful only in predictable scenarios. Adjustable frequency and Q are what make it "parametric" — this is essential for targeted tone shaping but requires the basic band gains (US1) to work first.

**Independent Test**: Set mid peak frequency to 500 Hz, Q to 5.0, gain to −12 dB. Connect a broadband noise source and verify the output has a narrow notch centered near 500 Hz.

**Acceptance Scenarios**:

1. **Given** the mid peak band, **When** the center frequency is changed, **Then** the frequency area affected by the gain boost/cut shifts accordingly.
2. **Given** a mid peak cut of −10 dB, **When** the Q is increased (narrower bandwidth), **Then** the cut affects a smaller range of frequencies.
3. **Given** a mid peak cut of −10 dB, **When** the Q is decreased (wider bandwidth), **Then** the cut affects a broader range of frequencies.

---

### User Story 3 — Set Shelf Frequencies (Priority: P2)

A user adjusts the corner frequency of the low shelf and high shelf bands to define where the shelving effect starts — e.g., moving the low shelf corner higher to affect more of the midrange, or lowering the high shelf corner to protect more treble.

**Why this priority**: Fixed shelf frequencies limit flexibility. Adjustable corners give the EQ utility across many sound types, but are secondary to having working gain controls (US1) and the parametric mid (US2).

**Independent Test**: Set low shelf corner to 200 Hz and boost +6 dB; verify the boost starts affecting frequencies below 200 Hz. Move corner to 800 Hz; verify the affected range expands to include more midrange.

**Acceptance Scenarios**:

1. **Given** the low shelf band, **When** the corner frequency is raised, **Then** the shelving boost/cut begins affecting a higher range of frequencies.
2. **Given** the high shelf band, **When** the corner frequency is lowered, **Then** the shelving effect begins at a lower frequency.

---

### User Story 4 — Modulate EQ Bands with an LFO (Priority: P2)

A user connects an LFO to one or more of the EQ's gain CV inputs to create dynamic, animated timbres. For example, an LFO sweeping the low shelf gain produces a rhythmic pumping effect, while a slow LFO on the mid peak gain adds a subtle wah-like movement.

**Why this priority**: LFO modulation transforms the EQ from a static tone-shaping tool into a live performance and sound-design component. It is independent of patch persistence (US5) and does not require it, but depends on working band controls (US1–US3).

**Independent Test**: Connect a slow LFO output → EQ Low Gain CV In. Set the LFO to a 0.5 Hz sine. Verify the bass content audibly rises and falls in sync with the LFO cycle.

**Acceptance Scenarios**:

1. **Given** an LFO connected to the Low Gain CV input, **When** the LFO oscillates, **Then** the low shelf gain changes in real time and the output timbre changes audibly in sync.
2. **Given** an LFO connected to the Mid Gain CV input, **When** the LFO oscillates, **Then** the mid peak gain rises and falls without audio interruption.
3. **Given** an LFO connected to the High Gain CV input, **When** the LFO oscillates, **Then** the high shelf gain modulates audibly in sync with the LFO.
4. **Given** an LFO connected to a gain CV input and the band's gain knob set to +6 dB, **When** the LFO modulates, **Then** the CV modulation is added to the knob value (additive modulation).
5. **Given** a CV signal that would push gain beyond ±18 dB, **When** applied, **Then** the gain clamps at the limit without distortion or error.
6. **Given** the CV input disconnected, **When** the EQ runs, **Then** the band behaves as if the CV contribution is zero (knob value only).

---

### User Story 5 — Save and Restore EQ Settings in a Patch (Priority: P3)

A user saves a patch containing a configured Parametric EQ (e.g., low shelf +4 dB at 120 Hz, mid peak −6 dB at 1 kHz Q=2, high shelf −3 dB at 8 kHz) with an LFO connected to the low gain CV input. On reloading the patch, all band settings and connections are restored exactly.

**Why this priority**: Patch persistence is required for the component to be production-useful but does not affect real-time usability.

**Independent Test**: Configure all bands, save the patch, reload the page, verify all parameter values match.

**Acceptance Scenarios**:

1. **Given** a patch saved with non-default EQ settings, **When** the patch is reloaded, **Then** all three bands restore their gain, frequency, and Q values exactly.
2. **Given** a patch saved with a legacy EQ (missing some parameters), **When** loaded, **Then** missing parameters default gracefully without error.

---

### Edge Cases

- What happens when gain is set to 0 dB on all bands? → Audio passes through unchanged (flat response).
- What happens when Q is set to an extreme value (very high)? → The band becomes a very narrow notch/peak; no crash or distortion artifact.
- What happens when the mid peak frequency overlaps with the shelf corner frequencies? → Each band operates independently; combined effect is the sum of all three bands.
- What happens when the EQ is bypassed? → Audio passes through unmodified, identical to all bands at 0 dB gain.
- What happens when no input is connected? → No output signal; component remains idle without error.
- What happens when a CV signal drives gain beyond ±18 dB? → Gain clamps at the limit; no distortion, crash, or runaway behaviour.
- What happens when an LFO is disconnected mid-patch? → The band's gain immediately reverts to its knob value with no audible pop.
- What happens when two LFOs are connected to the same gain CV input? → Only one CV source can be connected at a time per port (standard patch routing rule).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The EQ MUST provide three independent frequency bands: a low shelf, a parametric mid peak, and a high shelf.
- **FR-002**: Each band MUST have an adjustable gain in the range −18 dB to +18 dB, with 0 dB representing no change.
- **FR-003**: The low shelf band MUST have an adjustable corner frequency in the range 20–800 Hz.
- **FR-004**: The mid peak band MUST have an adjustable center frequency in the range 200–8000 Hz and an adjustable Q (bandwidth) parameter.
- **FR-005**: The high shelf band MUST have an adjustable corner frequency in the range 1000–20000 Hz.
- **FR-006**: The EQ MUST accept a mono audio signal as input and produce a processed mono audio signal as output.
- **FR-007**: With all band gains set to 0 dB, the output MUST be perceptually identical to the input (flat response).
- **FR-008**: Each band's parameters MUST be adjustable in real time without audio dropout or interruption.
- **FR-009**: The EQ MUST support bypass (on/off) to allow direct A/B comparison. Bypass is toggled via the standard bypass button rendered by `CanvasComponent` (the same mechanism used by Filter, LFO, and other bypassable components — `isBypassable()` returns `true`). When bypassed, audio passes through unmodified; EQ parameter values are preserved.
- **FR-010**: All band parameters (gain, frequency, Q) MUST be saved and restored as part of patch persistence.
- **FR-011**: The component MUST degrade gracefully when loaded from a patch with missing parameters, applying documented defaults.
- **FR-012**: The EQ MUST provide three CV input ports — one per band gain (Low Gain CV, Mid Gain CV, High Gain CV) — accepting modulation signals from LFOs or other CV sources.
- **FR-013**: CV modulation on a gain input MUST be additive with the band's knob value (total gain = knob value + CV contribution), scaled at 1V = 1 dB.
- **FR-014**: The total gain for any band MUST be clamped to ±18 dB regardless of the CV contribution.
- **FR-015**: When a CV input is disconnected, the band MUST revert immediately to its knob value without audio interruption.

### Key Entities

- **Low Shelf Band**: Boosts or cuts all frequencies below the corner frequency. Parameters: gain (−18 to +18 dB), corner frequency (20–800 Hz). Accepts a CV input for gain modulation.
- **Mid Peak Band**: Boosts or cuts a band of frequencies centred on the peak frequency. Parameters: gain (−18 to +18 dB), center frequency (200–8000 Hz), Q (dimensionless bandwidth factor). Accepts a CV input for gain modulation.
- **High Shelf Band**: Boosts or cuts all frequencies above the corner frequency. Parameters: gain (−18 to +18 dB), corner frequency (1000–20000 Hz). Accepts a CV input for gain modulation.
- **Gain CV Input**: A per-band modulation input that adds a CV signal to the band's gain knob value at a 1V = 1 dB scaling. Clamped to the band's ±18 dB limit.

### Assumptions

- Gain range of ±18 dB covers musical use cases; ±24 dB would also be reasonable but ±18 dB is the standard for parametric EQ bands.
- Default state for all bands: 0 dB gain (flat). Default frequencies: low shelf corner 80 Hz, mid peak center 1000 Hz Q=1.0, high shelf corner 8000 Hz.
- Mono audio only; stereo processing is out of scope.
- The component takes one audio input and produces one audio output, plus three CV gain inputs (one per band). CV modulation applies only to gain, not to frequency or Q parameters.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can achieve a perceptibly different sound character by adjusting any single band within 10 seconds of adding the component.
- **SC-002**: All parameter changes take effect immediately with no audible dropout, click, or interruption.
- **SC-003**: With all bands at 0 dB, A/B comparison between bypassed and active EQ reveals no audible difference.
- **SC-004**: A patch saved with non-default EQ settings restores all values exactly after a page reload — zero parameter loss.
- **SC-005**: The component introduces no audible distortion or noise when all bands are at 0 dB gain.
- **SC-006**: LFO modulation on any gain CV input produces a smooth, continuous timbral change with no audible stepping or zipper noise at any LFO rate up to 20 Hz.
