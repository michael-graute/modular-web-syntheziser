# Feature Specification: Audio Effects Pack (Bitcrusher, Flanger, Phaser, Tremolo)

**Feature Branch**: `018-audio-effects-pack`  
**Created**: 2026-04-29  
**Status**: Draft  
**Input**: User description: "specify a new feature that adds 4 new Effects: Bitcrusher, Flanger, Phaser and Tremolo"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Apply Bitcrusher to Audio Signal (Priority: P1)

A synthesizer user routes an audio signal through the Bitcrusher effect to add digital distortion and lo-fi grit. They adjust bit depth and sample rate reduction to achieve the desired level of degradation — from subtle vintage character to extreme digital destruction.

**Why this priority**: The Bitcrusher is a distinctive, widely-used effect that delivers immediately audible, high-impact sonic transformation. It is self-contained and delivers standalone value.

**Independent Test**: Can be fully tested by connecting an oscillator to a Bitcrusher module and adjusting bit depth and sample rate parameters independently of all other effects.

**Acceptance Scenarios**:

1. **Given** an audio signal is connected to the Bitcrusher input, **When** the user reduces the bit depth parameter, **Then** the output signal exhibits quantization distortion proportional to the reduction.
2. **Given** the Bitcrusher module is active, **When** the user reduces the sample rate parameter, **Then** the output exhibits aliasing artifacts characteristic of sample rate reduction.
3. **Given** the Bitcrusher is at maximum settings (full bit depth, full sample rate), **When** the audio passes through, **Then** the output is perceptually identical to the input (transparent/bypass-like).
4. **Given** the module is in the patch, **When** the user toggles bypass, **Then** the effect is removed from the signal path without audible glitches.

---

### User Story 2 - Apply Flanger to Audio Signal (Priority: P2)

A user patches an audio signal through the Flanger effect to create sweeping, jet-like modulation. They control rate, depth, and feedback to shape the character of the comb-filtering modulation from subtle shimmer to dramatic sweeps.

**Why this priority**: The Flanger is a classic modulation effect with broad musical applications. It requires an internal LFO and delay line but is independent of the other three effects.

**Independent Test**: Can be fully tested by connecting a signal source to the Flanger and adjusting rate, depth, and feedback parameters.

**Acceptance Scenarios**:

1. **Given** an audio signal enters the Flanger, **When** the effect is active with default settings, **Then** the output exhibits audible comb-filtering modulation that sweeps over time.
2. **Given** the Flanger is active, **When** the user increases the feedback parameter, **Then** the resonance of the flanging effect intensifies.
3. **Given** the Flanger is active, **When** the rate parameter is set to its minimum, **Then** the modulation sweep is very slow and gradual; at maximum, the sweep is fast.
4. **Given** the Flanger module is in a patch, **When** the patch is saved and reloaded, **Then** all parameter values are restored and the effect continues from the correct state.

---

### User Story 3 - Apply Phaser to Audio Signal (Priority: P3)

A user connects an audio signal to the Phaser effect to add a sweeping, phase-shifting character reminiscent of classic analog phasers. They adjust rate, depth, stages, and feedback to sculpt the all-pass filter sweep.

**Why this priority**: The Phaser provides a distinct tonal palette from the Flanger despite both being modulation effects. It is valued for its musical subtlety and can function independently.

**Independent Test**: Can be fully tested by connecting a signal source to the Phaser and adjusting rate, depth, and feedback parameters.

**Acceptance Scenarios**:

1. **Given** an audio signal enters the Phaser, **When** the effect is active, **Then** the output exhibits a sweeping phase-shift character distinct from flanging.
2. **Given** the Phaser is active, **When** the user adjusts the number of filter stages, **Then** the density and character of the phasing effect changes accordingly.
3. **Given** the Phaser is active with feedback enabled, **When** feedback is increased, **Then** the resonant peaks of the phase sweep become more pronounced.
4. **Given** the Phaser is in a patch, **When** the patch is saved and reloaded, **Then** all parameters are restored correctly.

---

### User Story 4 - Apply Tremolo to Audio Signal (Priority: P4)

A user routes an audio signal through the Tremolo effect to create rhythmic amplitude modulation. They set rate and depth to produce anything from gentle vibrato-like pulsing to hard gating effects synchronized with musical context.

**Why this priority**: Tremolo is the simplest of the four effects (amplitude-only modulation) and is highly accessible to new users. It is completely independent of the others.

**Independent Test**: Can be fully tested by connecting a signal source to the Tremolo and adjusting rate and depth parameters independently.

**Acceptance Scenarios**:

1. **Given** an audio signal enters the Tremolo, **When** the effect is active, **Then** the output volume oscillates rhythmically at the set rate.
2. **Given** the Tremolo is active, **When** depth is set to maximum, **Then** the signal is fully silenced at the trough of each modulation cycle.
3. **Given** the Tremolo is active, **When** depth is set to zero, **Then** the output is unmodulated (no volume change).
4. **Given** the Tremolo module is in a patch, **When** the patch is saved and reloaded, **Then** rate and depth values are restored correctly.

---

### User Story 5 - Bypass Any Effect (Priority: P2)

A user can toggle any of the four effects on or off at any time without removing the module from the patch or interrupting the signal flow.

**Why this priority**: Bypass is essential for A/B comparison during sound design and is a cross-cutting behavior applicable to all four effects.

**Independent Test**: Can be tested on any single effect module by toggling its bypass control and comparing the bypassed and active output.

**Acceptance Scenarios**:

1. **Given** any effect module is active in a patch, **When** the user engages bypass, **Then** the signal passes through unmodified.
2. **Given** any effect module is bypassed, **When** the user disengages bypass, **Then** the effect resumes processing with its current parameter settings.
3. **Given** bypass is toggled, **When** transition occurs, **Then** there are no audible clicks or artifacts in the output signal.

---

### Edge Cases

- What happens when an effect receives no input signal? The module remains active but produces silence or passes silence through without errors.
- What happens when a parameter is set to an extreme value (minimum or maximum)? The effect must remain stable and not produce runaway feedback, infinite gain, or crashes.
- What happens when multiple effects are chained in series? Each effect processes the output of the previous without mutual interference.
- What happens when a patch containing these effects is loaded on a device that previously saved it? All parameters are restored to their saved state.
- What happens when feedback parameter (Flanger, Phaser) is at maximum (95%)? The system must remain stable — output must not clip or run away beyond safe amplitude bounds.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a Bitcrusher effect module with adjustable bit depth (range: 1–16 bits), sample rate reduction, and wet/dry mix parameters.
- **FR-002**: The system MUST provide a Flanger effect module with adjustable rate (0.1–20 Hz), depth (0–100%), feedback (0–95%), and wet/dry mix parameters.
- **FR-003**: The system MUST provide a Phaser effect module with adjustable rate (0.1–20 Hz), depth (0–100%), feedback (0–95%), filter stage count (selectable: 2, 4, 6, or 8 stages), and wet/dry mix parameters.
- **FR-004**: The system MUST provide a Tremolo effect module with adjustable rate (0.1–20 Hz), depth (0–100%), and wet/dry mix parameters.
- **FR-005**: Each effect module MUST support bypass (on/off toggle) that removes the effect from the signal path without audible discontinuities.
- **FR-006**: Each effect module MUST accept a mono audio signal input and produce a mono audio signal output.
- **FR-007**: Each effect module MUST use a knob/slider control panel layout (no custom canvas visualization). The panel MUST visually indicate the module's active/bypassed state.
- **FR-008**: All parameter values for each effect (including wet/dry mix) MUST be persisted as part of the patch save/load system.
- **FR-009**: The Flanger and Phaser MUST prevent signal runaway by clamping feedback-driven output within safe amplitude bounds.
- **FR-010**: Each effect module MUST be placeable on the modular synthesizer canvas alongside existing modules.
- **FR-011**: All four effect modules MUST be accessible from the module browser/palette.

### Key Entities

- **Bitcrusher**: An effect module that quantizes and down-samples an audio signal; has bit depth, sample rate reduction, and wet/dry mix controls.
- **Flanger**: A modulation effect module that mixes a signal with a short, LFO-modulated delay copy; has rate, depth, feedback, and wet/dry mix controls.
- **Phaser**: A modulation effect module that applies sweeping all-pass filters to a signal; has rate, depth, feedback, stage count, and wet/dry mix controls.
- **Tremolo**: An amplitude modulation effect module that rhythmically varies signal volume; has rate, depth, and wet/dry mix controls.
- **Effect Parameter**: A named, bounded numerical value associated with a module that can be adjusted by the user and persisted in a patch. Includes effect-specific controls plus a wet/dry mix (0–100%) present on all four modules.
- **Bypass State**: A boolean property of each effect module indicating whether signal processing is active or transparent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four effect modules are available in the module browser and can be added to a patch without errors.
- **SC-002**: Each effect produces an audibly distinct and correct transformation of the input signal when active (verifiable by ear and waveform comparison).
- **SC-003**: Bypass toggles on all four effects operate without audible clicks or artifacts in 100% of test cases.
- **SC-004**: All parameter values for all four effects survive a save/load cycle with no data loss.
- **SC-005**: Feedback-driven effects (Flanger, Phaser) remain stable at maximum feedback — no runaway or clipping beyond defined safe levels.
- **SC-006**: Each effect module can be added, configured, connected, and removed from a patch independently of the other three effects.

## Clarifications

### Session 2026-04-29

- Q: Should all four effects include a wet/dry mix parameter, or remain 100% wet? → A: All four effects include a wet/dry mix parameter.
- Q: What are the parameter ranges for rate, depth, and feedback on Flanger, Phaser, and Tremolo? → A: Rate 0.1–20 Hz; Depth 0–100%; Feedback 0–95%.
- Q: Should Tremolo rate sync to the global BPM/transport, or run free in Hz? → A: Free-running Hz only — no BPM sync in this feature.
- Q: What discrete stage count options does the Phaser support? → A: 2, 4, 6, 8 stages.
- Q: How are the effect modules visually displayed on the canvas — custom visualization or knob/slider panel? → A: Knob/slider control panel only; no custom canvas visualization.

## Assumptions

- All four effects process mono audio signals, consistent with existing effect modules in the project.
- The Flanger and Phaser use internal LFOs for modulation (not externally patched CV), consistent with the existing LFO component design.
- Tremolo uses a sine wave LFO shape by default; waveform selection is out of scope for this feature.
- The Phaser stage count is a discrete selector with four options: 2, 4, 6, or 8 stages.
- All effects follow the existing module architecture (knob/slider panel UI, PatchSerializer integration, bypass interface). No custom canvas visualization is included for any of the four effects.
- Tremolo rate is free-running in Hz (0.1–20 Hz); BPM sync with the global transport is out of scope for this feature.
