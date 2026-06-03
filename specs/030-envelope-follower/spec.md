# Feature Specification: Envelope Follower

**Feature Branch**: `030-envelope-follower`  
**Created**: 2026-06-03  
**Status**: Draft  
**Input**: User description: "Envelope Follower as described in docs/research/missing-features.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Amplitude-to-CV Conversion (Priority: P1)

A musician patches an audio signal (e.g., from a Distortion or Oscillator) into the Envelope Follower. The module continuously tracks the amplitude of that incoming audio and outputs a corresponding CV signal — louder audio produces a higher CV, silence produces CV near zero. They can then route that CV output into another module (e.g., a Filter's cutoff) so the filter opens and closes in response to the loudness of the input.

**Why this priority**: This is the core capability of the module. Without amplitude-to-CV conversion, the feature has no value. All other stories depend on this working correctly.

**Independent Test**: Can be fully tested by routing any audio source into the Envelope Follower, patching the CV output to a VCA's gain input, and confirming the VCA attenuates signal in sync with the input's amplitude envelope.

**Acceptance Scenarios**:

1. **Given** an audio signal is connected to the Envelope Follower input, **When** the input amplitude increases, **Then** the CV output level rises proportionally in real time.
2. **Given** an audio signal is connected, **When** the input goes silent, **Then** the CV output falls smoothly toward zero.
3. **Given** no audio signal is connected (or a silent source), **When** the module is active, **Then** the CV output stays at or near zero.

---

### User Story 2 - Attack and Release Time Control (Priority: P1)

A musician adjusts the Attack and Release knobs on the Envelope Follower. A fast attack snaps the CV up immediately when a loud transient hits; a slow release lets the CV tail off gradually after the audio quietens. They use these controls to shape how quickly the follower tracks the audio's dynamic contour.

**Why this priority**: Without independent attack and release shaping, the follower output is too raw for musical use — percussive transients and sustained pads require very different tracking speeds.

**Independent Test**: Patch a drum loop into the input and a VCA's gain into the CV output. Short attack / long release creates pumping sidechain compression-style behaviour; long attack / short release smooths transients. Both extremes must produce audibly distinct results.

**Acceptance Scenarios**:

1. **Given** a percussive audio source, **When** attack is set to minimum, **Then** the CV output rises nearly instantaneously on each transient.
2. **Given** a percussive audio source, **When** release is set to maximum, **Then** the CV output decays slowly after each transient rather than dropping immediately.
3. **Given** attack and release are both set to intermediate values, **When** audio plays, **Then** the follower output follows the audio amplitude with corresponding smoothing on both the rise and fall.

---

### User Story 3 - Gain/Sensitivity Control (Priority: P2)

A musician uses the Gain (or Sensitivity) knob to scale the incoming signal level before envelope detection. A quiet microphone or subtly modulated oscillator may only drive the follower output to a fraction of its range; increasing gain brings the CV output to a useful range. Conversely, a very loud source can be attenuated so the CV doesn't rail at its maximum.

**Why this priority**: Different audio sources arrive at vastly different amplitude levels. Without a gain control, many real-world sources will produce CV that is either too small to be musically effective or permanently clipped at maximum.

**Independent Test**: Connect a low-amplitude oscillator (e.g., LFO output used as audio). Without gain adjustment, CV output barely moves. Increasing gain brings CV into the full 0–1 range, confirming the control is effective.

**Acceptance Scenarios**:

1. **Given** a low-amplitude audio input, **When** gain is increased, **Then** the CV output range expands proportionally.
2. **Given** a high-amplitude audio input, **When** gain is decreased, **Then** the CV output range compresses, preventing the output from remaining at maximum.
3. **Given** gain is at its default (unity) position, **When** a standard full-range audio signal is connected, **Then** the CV output uses the full output range.

---

### User Story 4 - Real-Time Visual Feedback (Priority: P2)

The Envelope Follower displays a live vertical bar meter showing its current CV output level (0–1) on its canvas panel — the bar fills upward proportionally to the current CV value, consistent with the VU Meter visual style. A musician can glance at the module to confirm it is receiving and tracking signal without needing to patch the CV output to a VU Meter or Oscilloscope first.

**Why this priority**: Invisible CV is extremely hard to debug. Visual feedback dramatically reduces the time to diagnose patching errors and helps musicians understand how their settings affect the follower's tracking behaviour.

**Independent Test**: Connect an audio source, observe the display with audio playing versus muted. The visual level must move clearly with audio amplitude and settle toward zero when audio stops.

**Acceptance Scenarios**:

1. **Given** audio is playing into the input, **When** the module is visible on the canvas, **Then** a dynamic visual indicator shows the current CV output level in real time.
2. **Given** audio is muted, **When** the musician observes the display, **Then** the indicator falls to its minimum position.
3. **Given** the musician adjusts the Release knob during audio playback, **When** the audio stops, **Then** the visual indicator's decay speed visibly changes to match the new release setting.

---

### User Story 5 - Patch Persistence (Priority: P3)

A musician saves their patch while the Envelope Follower is configured with specific Attack, Release, and Gain values. When they reload the patch, the module re-appears with exactly the same settings and connections intact.

**Why this priority**: Every existing component in the synthesizer persists its settings; the Envelope Follower must be consistent with that behaviour or it will surprise users and break saved compositions.

**Independent Test**: Configure the module, save the patch, reload the page, and verify all three knob values and cable connections are restored exactly as saved.

**Acceptance Scenarios**:

1. **Given** Attack, Release, and Gain are set to non-default values, **When** the patch is saved and reloaded, **Then** all three parameters are restored to their saved values.
2. **Given** an audio source is cabled to the Envelope Follower input and its CV output is cabled to another module, **When** the patch is reloaded, **Then** both cable connections are restored automatically.

---

### Edge Cases

- What happens when the input audio signal clips or is extremely loud? The CV output should clamp at its maximum rather than producing undefined values.
- How does the module behave when the audio source is disconnected mid-playback? The follower should decay naturally through its release time rather than snapping to zero.
- What happens when Attack is at its minimum (1 ms) or Release is at its minimum (5 ms)? The transition should be nearly instantaneous with no artefacts; these are the effective "zero-time" limits enforced by the parameter minimums. A boundary test must verify that coefficients at 1 ms / 5 ms produce a fast but stable (non-NaN, non-infinite) IIR step.
- What happens when both Attack and Release are set to their maximum (very slow) values on a transient-heavy source? The CV should integrate the envelope slowly, producing a nearly static DC-like output.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The module MUST accept any Audio-typed signal as its input, including oscillators, effects outputs, and external audio.
- **FR-002**: The module MUST produce a continuous CV output that tracks the amplitude envelope of the input signal using periodic RMS analysis (consistent with the AnalyserNode pattern used by the Oscilloscope and VU Meter); analysis frames are updated at display refresh rate.
- **FR-003**: The module MUST provide an Attack parameter (minimum ~1 ms, maximum ~500 ms) controlling how quickly the CV output rises in response to an increase in input amplitude.
- **FR-004**: The module MUST provide a Release parameter (minimum ~5 ms, maximum ~2000 ms) controlling how quickly the CV output falls after the input amplitude decreases.
- **FR-005**: The module MUST provide a Gain/Sensitivity parameter that scales the input signal level before envelope detection, allowing both amplification and attenuation.
- **FR-006**: The module MUST display a real-time vertical bar meter on its canvas panel showing the current CV output level (0–1), filling upward proportionally, consistent with the VU Meter visual style.
- **FR-007**: The CV output range MUST be 0–1 normalised float (matching the VCA, Filter, and all other CV-accepting inputs in the synthesizer); output MUST clamp at 0.0 (minimum) and 1.0 (maximum).
- **FR-008**: The module MUST persist its Attack, Release, and Gain parameter values as part of the patch serialisation/deserialisation cycle.
- **FR-009**: The module analyses the input audio signal without exposing an audio output — it is an audio sink with a CV source. The input audio is consumed for analysis only; the module has no audio output port. Users wishing to chain audio downstream must patch separately from the original source.
- **FR-010**: The module MUST be patchable to any CV-accepting input on other modules (e.g., filter cutoff, VCA gain, LFO rate).

### Key Entities

- **Envelope Follower Module**: The component itself, characterised by its Attack, Release, and Gain parameters and its current CV output level.
- **CV Output Signal**: A continuously varying 0–1 normalised float derived from the detected amplitude envelope of the input audio; 0.0 represents silence, 1.0 represents full-scale amplitude.
- **Attack Time**: The duration parameter governing how fast the CV rises when input amplitude increases.
- **Release Time**: The duration parameter governing how fast the CV falls when input amplitude decreases.
- **Gain**: A scalar applied to the input before detection; shifts the effective input sensitivity range.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The CV output visibly tracks amplitude changes in the input audio with no perceptible lag at the fastest attack setting.
- **SC-002**: At maximum release time, the CV output takes at least 1.5 seconds to fall from full scale to zero after the input is silenced.
- **SC-003**: The visual indicator on the module's canvas panel updates continuously during audio playback and reaches its minimum position within one release-time period after audio stops.
- **SC-004**: All three parameters (Attack, Release, Gain) are restored exactly after a patch save-and-reload cycle, with no drift or rounding visible in the controls.
- **SC-005**: The module introduces no audible artefacts or changes to the input audio signal — a before/after listening test on the input source produces identical results.
- **SC-006**: The CV output clamps cleanly at its maximum value for any input amplitude at or above full scale, with no undefined or oscillating behaviour.

## Clarifications

### Session 2026-06-03

- Q: Which CV output format should the Envelope Follower use? → A: 0–1 normalised float (matches VCA, Filter, LFO CV inputs)
- Q: Which display type should the Envelope Follower use on its canvas panel? → A: Vertical bar meter — fills upward from 0 to 1, consistent with VU Meter visual style
- Q: How should the envelope detection be performed? → A: Periodic RMS analysis using the existing AnalyserNode pattern (consistent with Oscilloscope and VU Meter)

## Assumptions

- The module will follow the existing canvas-based component pattern used by all other modules in the synthesizer (CanvasComponent + dedicated renderer/display).
- Envelope detection uses periodic RMS analysis via AnalyserNode (same pattern as Oscilloscope and VU Meter), not sample-accurate audio-rate processing; this gives musically acceptable latency (~10–20 ms) at lower CPU cost.
- CV output range is 0–1 normalised float, matching the VCA, Filter, and all other CV-accepting inputs in the synthesizer (not the hardware 0–5V convention).
- The Gain control will have a range of approximately 0.1× to 4× (roughly −20 dB to +12 dB), sufficient for all practical audio sources in the synthesizer.
- Attack and Release parameters will use logarithmic scaling on their controls to give finer control at low values (where musical differences are most perceptible).
- The module will not implement a gate output (a separate gate/trigger output when CV crosses a threshold) in this initial version; that may be added in a future iteration.
- The module will not implement a side-chain routing concept — it analyses whatever is connected directly to its input.
