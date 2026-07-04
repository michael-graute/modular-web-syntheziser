# Feature Specification: Karplus-Strong String Synthesizer

**Feature Branch**: `034-karplus-strong-oscillator`
**Created**: 2026-07-04
**Status**: Draft
**Input**: User description: "Karplus-Strong Physical Modeling synthesizer component. Algorithmic plucked-string / percussive synthesis using the classic Karplus-Strong delay-line-with-feedback-filter algorithm, implemented via an AudioWorkletNode. Should fit into the existing modular patching system as a new Generator-category component alongside Oscillator, FM Oscillator, LFO, and Noise. Core parameters: pitch/frequency (1V/octave CV input), damping/decay control, and a pluck/trigger input (gate signal). Should support pick-position or excitation-filtering for tonal variation, and ideally a 'stretched' mode for percussive/drum-like sustained variants. Must follow existing component conventions: CanvasComponent-based UI, patch persistence, MIDI-mappable parameters."

## Clarifications

### Session 2026-07-04

- Q: What supported pitch/frequency range should the module use? → A: A typical instrument range of approximately 40 Hz to 4 kHz, documented independently of the Oscillator's range (not simply inherited from it), since the Karplus-Strong algorithm's delay-line size and pluck onset latency are directly tied to the lowest supported frequency.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plucking a String by Triggering the Module (Priority: P1)

A musician patches a gate/trigger source (e.g., the Keyboard, Step Sequencer, or Collider) into the Karplus-Strong module's Trigger input, and patches its audio output into the Master Out (optionally through a Filter or VCA). Each time a trigger arrives, the module produces a plucked-string tone that decays naturally over time, without needing a separate ADSR Envelope to shape amplitude.

**Why this priority**: This is the fundamental behavior of the module — without trigger-driven excitation producing an audible, decaying plucked tone, the component has no purpose. Every other capability builds on this base behavior.

**Independent Test**: Can be fully tested by patching a Keyboard gate output into the Trigger input and the module's Audio output into Master Out, then pressing a key and confirming a plucked tone sounds and decays to silence on its own.

**Acceptance Scenarios**:

1. **Given** the Trigger input is connected to a gate source and the Audio output is patched to Master Out, **When** a trigger pulse arrives, **Then** the module produces an audible plucked-string tone that begins at its loudest and decays smoothly toward silence.
2. **Given** the module is idle (no trigger received yet), **When** no trigger has arrived, **Then** the Audio output is silent.
3. **Given** a decaying pluck is still sounding, **When** a new trigger pulse arrives before the previous pluck has fully decayed, **Then** the module re-excites the string immediately, replacing the decaying tail with a fresh pluck.

---

### User Story 2 - Setting Pitch via 1V/Octave CV (Priority: P1)

A musician patches a CV source (e.g., the Keyboard's pitch output, a Quantizer, or a Sequencer's CV lane) into the module's Pitch CV input. The resulting plucked tone's fundamental frequency follows the standard 1V/octave convention used by every other pitched module in the synthesizer, so the Karplus-Strong module can be played melodically alongside the Oscillator and FM Oscillator.

**Why this priority**: Without standard pitch tracking, the module cannot be integrated into existing melodic patches (keyboard-driven, sequenced, or quantized), which defeats the purpose of adding a new pitched Generator.

**Independent Test**: Patch the Keyboard's pitch CV output into the module's Pitch CV input, play different keys, and confirm the plucked tone's pitch rises and falls by the correct musical interval for each key (e.g., one octave up per 1V step), consistent with the Oscillator's pitch tracking.

**Acceptance Scenarios**:

1. **Given** the Pitch CV input is unconnected, **When** the module is triggered, **Then** it produces a plucked tone at a sensible default fundamental frequency (e.g., concert A, 440 Hz).
2. **Given** a CV source is patched to the Pitch CV input, **When** the CV level increases by the equivalent of one octave, **Then** the resulting pluck's fundamental frequency doubles.
3. **Given** the module also exposes a manual Frequency/Tune control, **When** no CV is connected, **Then** the control directly sets the fundamental pitch of subsequent plucks.

---

### User Story 3 - Shaping String Character with Damping and Excitation Tone (Priority: P2)

A musician adjusts the Damping (decay) control to make plucks ring out longer or die away quickly, and adjusts a Tone/Pick-Position control to change the brightness and character of the initial pluck — from bright and metallic to warm and muted — similar to plucking a real string near the bridge versus near the middle.

**Why this priority**: Raw Karplus-Strong output with fixed damping and a flat noise excitation quickly becomes monotonous. Damping and tone shaping are what make the module musically expressive and distinguish plucked timbres from each other, but the module is still usable (if limited) without them.

**Independent Test**: Trigger the module repeatedly while sweeping the Damping control from minimum to maximum and confirm the decay time audibly lengthens; separately sweep the Tone control and confirm the initial pluck brightness audibly changes from dull to bright (or vice versa).

**Acceptance Scenarios**:

1. **Given** Damping is set near its minimum, **When** the module is triggered, **Then** the plucked tone decays to silence quickly (short sustain).
2. **Given** Damping is set near its maximum, **When** the module is triggered, **Then** the plucked tone rings out for a noticeably longer duration.
3. **Given** the Tone/Pick-Position control is swept from one extreme to the other, **When** the module is triggered at each extreme, **Then** the resulting pluck's timbre audibly shifts between brighter/sharper and warmer/duller character.

---

### User Story 4 - Percussive "Stretched" Mode for Drum-Like Sounds (Priority: P3)

A musician enables a Mode switch that changes the string's decay behavior to the "stretched" variant, producing longer, more sustained, percussive/drum-like timbres (e.g., tom-tom or metallic percussion character) rather than a clean plucked-string decay. This gives the module a second, distinct sonic use case beyond melodic plucked strings.

**Why this priority**: This is a valuable but non-essential extension of the core algorithm — it broadens the module's usefulness into percussion/drum-sound design but the module delivers its primary value (melodic plucked strings) without it.

**Independent Test**: Trigger the module with Mode set to "String" versus "Stretched" at the same pitch and Damping settings, and confirm the two modes produce clearly distinguishable decay characters (clean tonal decay vs. sustained/noisy percussive decay).

**Acceptance Scenarios**:

1. **Given** Mode is set to "String" (default), **When** the module is triggered, **Then** it produces the standard clean plucked-string decay.
2. **Given** Mode is set to "Stretched", **When** the module is triggered at the same pitch and damping, **Then** it produces a noticeably different, more sustained/percussive decay character.
3. **Given** the Mode is changed while a pluck is actively decaying, **When** the change is applied, **Then** the currently decaying tone is not abruptly interrupted or produce audio glitches (clicks/pops); a new mode setting takes effect from the next trigger onward. *(Assumption — see Assumptions section.)*

---

### User Story 5 - Visual Feedback and Patch Persistence (Priority: P2)

A musician sees a live waveform or level indicator on the module's canvas panel confirming it is producing sound, consistent with how other Generator modules provide visual feedback. When they save their patch with specific Frequency, Damping, Tone, and Mode settings, reloading the patch restores every parameter and cable connection exactly.

**Why this priority**: Consistency with every other component in the synthesizer is expected by users; a module that resets on reload or gives no visual confirmation would feel broken relative to the rest of the system, even though it doesn't block the core synthesis functionality.

**Independent Test**: Trigger the module and confirm the canvas panel shows a visual response; then set non-default Frequency, Damping, Tone, and Mode values, save the patch, reload the page, and verify all parameter values and cable connections are restored.

**Acceptance Scenarios**:

1. **Given** the module is triggered and producing sound, **When** the musician looks at its canvas panel, **Then** a live visual indicator (e.g., waveform or level display) reflects the current output.
2. **Given** Frequency, Damping, Tone, and Mode are set to non-default values, **When** the patch is saved and reloaded, **Then** all four settings are restored exactly.
3. **Given** the Trigger input and Audio output are cabled to other modules, **When** the patch is reloaded, **Then** both cable connections are restored automatically.

---

### Edge Cases

- What happens when the module is triggered but no Pitch CV is connected and the manual Frequency control is set to its minimum (~40 Hz)? The module must still produce a stable tone without clicks, underruns, or silence (very low pitches require longer internal delay-line buffers).
- What happens when the module is triggered but no Pitch CV is connected and Frequency is set to its maximum (~4 kHz)? The module must still produce a stable tone without aliasing artifacts or instability (very short delay lines are more prone to numerical edge cases).
- What happens when Damping is set to its absolute maximum? The pluck must still eventually decay to silence rather than sustaining indefinitely or self-oscillating.
- How does the module behave if it receives two trigger pulses in extremely rapid succession (faster than the pluck's natural attack)? Each trigger must re-excite the string cleanly without producing runaway amplitude, digital clipping, or instability.
- What happens if the Pitch CV input receives an extreme or out-of-range voltage? The resulting frequency must be clamped to the module's supported pitch range rather than producing undefined or unstable behavior.
- What happens when the Audio output is left unpatched? The module continues to compute internally without error; no sound reaches Master Out.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The module MUST expose a Trigger (gate) input that re-excites the string each time a gate/trigger pulse is received, consistent with the trigger-driven pattern used by the ADSR Envelope and other trigger-driven components.
- **FR-002**: The module MUST expose a Pitch CV input that follows the 1V/octave convention used by all other pitched modules (Oscillator, FM Oscillator) in the synthesizer.
- **FR-003**: The module MUST provide a manual Frequency/Tune control that sets the fundamental pitch when no Pitch CV is connected, and acts as a base/offset pitch when CV is connected.
- **FR-004**: The module MUST provide a Damping (decay) control governing how quickly the excited string's amplitude decays toward silence, ranging from a short percussive pluck to a long, sustained ring.
- **FR-005**: The module MUST provide a Tone/Pick-Position control that shapes the timbral brightness of the initial excitation, producing audibly different pluck character across its range.
- **FR-006**: The module MUST provide a Mode selector offering at least two options: a standard "String" (clean plucked-string decay) mode and a "Stretched" (percussive/sustained, drum-like) mode.
- **FR-007**: The module MUST expose a single Audio output carrying the synthesized plucked-string signal, patchable to any Audio-accepting input in the synthesizer (Filter, VCA, Effects, Mixer, Master Out).
- **FR-008**: The module MUST produce no audible output until it first receives a trigger pulse.
- **FR-009**: The module MUST display real-time visual feedback (e.g., a waveform or level indicator) on its canvas panel while producing sound, consistent with other Generator/Analyzer modules.
- **FR-010**: The module MUST persist all of its parameter values (Frequency, Damping, Tone, Mode) and its cable connections as part of the existing patch save/load (PatchSerializer/PatchStorage) cycle.
- **FR-011**: The module's Frequency, Damping, and Tone controls MUST be mappable to external MIDI controllers, consistent with other components' MIDI-mappable parameters.
- **FR-012**: The module MUST clamp Pitch CV input and manual Frequency settings to a supported frequency range of approximately 40 Hz to 4 kHz, producing stable output at both range extremes without artifacts or instability.
- **FR-013**: The module MUST handle rapid re-triggering (a new trigger arriving before the prior pluck has decayed) by cleanly re-exciting the string without runaway amplitude or clipping.
- **FR-014**: The module MUST be presented in the Generators category in the component palette, alongside Oscillator, FM Oscillator, LFO, and Noise.

### Key Entities

- **Karplus-Strong Module**: The component itself; characterized by its Frequency, Damping, Tone, and Mode settings, its Trigger and Pitch CV inputs, and its Audio output.
- **Trigger/Pluck Event**: A discrete gate pulse that causes the module to re-initialize its internal excitation and begin a new decaying tone.
- **Pitch CV Signal**: A continuously variable control voltage, following the 1V/octave standard, that determines the fundamental frequency of the next (or currently sounding) pluck.
- **Damping**: A parameter controlling the rate of energy loss per cycle of the simulated string, determining how long a pluck sustains before decaying to silence.
- **Tone/Pick-Position**: A parameter shaping the spectral brightness of the initial excitation, analogous to where a real string is physically plucked.
- **Mode**: A discrete setting selecting between "String" (plucked-string decay) and "Stretched" (percussive/sustained decay) algorithmic variants.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A musician can produce an audible, naturally decaying plucked tone within one trigger pulse, with no additional configuration required beyond connecting Trigger and Audio.
- **SC-002**: Pitch tracks the 1V/octave standard accurately enough that playing a scale via the Keyboard or a Quantizer produces recognizably correct musical intervals, matching the behavior of the existing Oscillator module.
- **SC-003**: Sweeping Damping from minimum to maximum produces a continuously perceivable change in decay time, spanning from a short percussive pluck (well under one second) to a long sustained ring (several seconds or more).
- **SC-004**: Sweeping the Tone control produces a clearly audible timbral change across its range, distinguishable in an A/B listening comparison at the two extremes.
- **SC-005**: Switching between "String" and "Stretched" Mode at identical pitch and damping settings produces two clearly distinguishable decay characters in an A/B listening comparison.
- **SC-006**: All parameter values and cable connections are restored exactly after a patch save-and-reload cycle, with no audible or visual difference from the pre-save state.
- **SC-007**: The module produces stable, glitch-free output (no clicks, pops, or instability) across its full supported pitch range and at rapid re-trigger rates of at least 10 triggers per second.
- **SC-008**: The module introduces no perceptible additional audio latency or UI responsiveness degradation relative to existing Generator modules when active in a patch.

## Assumptions

- The module will follow the existing canvas-based component pattern used by all other modules (CanvasComponent + dedicated renderer/display), matching the visual and interaction conventions of Oscillator, FM Oscillator, LFO, and Noise.
- Pitch CV follows the 1V/octave convention already used by the Oscillator and FM Oscillator, rather than the synthesizer's separate 0–1 normalized CV convention used for modulation signals (e.g., Envelope Follower, LFO CV output) — consistent with how pitch is handled elsewhere in the system.
- The Trigger input follows the same gate/trigger signal convention already used by the ADSR Envelope and Step Sequencer (a rising edge or high level initiates re-excitation).
- Default fundamental frequency when no Pitch CV is connected is concert A (440 Hz), consistent with the Oscillator's default tuning behavior.
- "Stretched mode" switching mid-decay does not need to retroactively affect an already-decaying pluck; the new mode takes effect on the next trigger. This avoids abrupt algorithm swaps that could produce clicks or instability in a currently-sounding voice.
- The module produces monophonic (single-voice) output — one string simulation per module instance, consistent with how Oscillator and FM Oscillator each represent a single voice; polyphonic use is achieved by patching multiple module instances, matching the existing system's approach to polyphony (per `032-polyphony`).
- Visual feedback uses a live waveform display (consistent with Oscilloscope-style rendering) or a simpler level meter; the exact display choice is a design decision left to the planning phase, not a scope-defining product decision.
- The supported pitch range (approximately 40 Hz–4 kHz) is defined independently of the Oscillator's range, reflecting the Karplus-Strong algorithm's own delay-line size and pluck onset latency constraints rather than assuming parity with the Oscillator.
