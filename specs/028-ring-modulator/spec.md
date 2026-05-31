# Feature Specification: Ring Modulator

**Feature Branch**: `028-ring-modulator`  
**Created**: 2026-05-31  
**Status**: Draft  
**Input**: User description: "Ring Modulator as mentioned in docs/research/missing-features.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Create Metallic / Bell-Like Timbres (Priority: P1)

A musician connects an audio source (oscillator or other signal) and a modulator signal (a second oscillator or LFO) to the Ring Modulator to produce classic AM synthesis textures — metallic clangour, bell tones, robotic speech artefacts, and side-band-rich timbres unavailable from any single oscillator.

**Why this priority**: This is the core reason for the Ring Modulator's existence. Without it the component delivers zero value. All other user stories depend on this working first.

**Independent Test**: Connect Oscillator A (carrier, 440 Hz sine) → Ring Modulator Audio In. Connect Oscillator B (modulator, 220 Hz sine) → Ring Modulator Modulator In. Route output to Master Out. Play audio — the result must be audibly different from either input: it must contain the sum (660 Hz) and difference (220 Hz) frequencies, with neither the original 440 Hz nor 220 Hz dominant.

**Acceptance Scenarios**:

1. **Given** a carrier oscillator connected to Audio In and a modulator oscillator connected to Modulator In, **When** audio plays, **Then** the output contains audible sum and difference frequencies of the two inputs, producing a metallic or bell-like tone.
2. **Given** both inputs connected, **When** the modulator frequency is changed, **Then** the timbral character of the output changes in real time without audio glitches.
3. **Given** only one input connected (the other absent), **When** audio plays, **Then** the output is silence — ring modulation of any signal with zero produces zero.

---

### User Story 2 — Patch a Ring Modulator into a Signal Chain (Priority: P2)

A musician drops the Ring Modulator onto the canvas, connects it between two signals, saves the patch, and reloads the page to find the component in place with connections intact — exactly as any other component behaves.

**Why this priority**: Patch persistence is table-stakes for any component in this application. Without it the Ring Modulator can only be used in a single session, which severely limits its practical value.

**Independent Test**: Build a patch with a Ring Modulator, connect both inputs and the output, save the patch, reload the page, and confirm the component reappears at the same position with both connections restored and audio behaviour unchanged.

**Acceptance Scenarios**:

1. **Given** a Ring Modulator on canvas with both inputs and output connected, **When** the patch is saved and the page reloaded, **Then** the Ring Modulator reappears at the saved position with all connections restored.
2. **Given** a saved patch without a Ring Modulator, **When** it is loaded, **Then** no errors occur and the patch loads correctly.

---

### User Story 3 — Use an LFO as the Modulator for Tremolo-Like Effects (Priority: P3)

A musician connects a slow LFO (0.1–10 Hz range) as the modulator to create amplitude modulation effects — tremolo at low rates, ring modulation warble at higher rates — opening the component up to continuous modulation use rather than pitched doubling only.

**Why this priority**: Extends the component's usefulness beyond the pitched-doubling use case without any additional implementation cost, since the Ring Modulator treats its modulator input as a generic audio signal regardless of source. This is a verification story rather than a distinct implementation story.

**Independent Test**: Connect LFO (sine, 4 Hz) → Ring Modulator Modulator In, connect Oscillator → Ring Modulator Audio In, route to Master Out. The output must pulse rhythmically at a rate corresponding to the LFO frequency.

**Acceptance Scenarios**:

1. **Given** an LFO connected to Modulator In and an oscillator connected to Audio In, **When** audio plays, **Then** the output amplitude modulates at the LFO rate.
2. **Given** the LFO rate is changed, **When** audio plays, **Then** the modulation rate changes in real time to match.

---

### Edge Cases

- What happens when the carrier signal clips (amplitude > 1.0)? The output must not distort beyond the expected ring-modulated result — any clipping must occur at the output stage, not inside the modulator.
- What happens when the modulator input is silent (nothing connected)? The output must be silence, not a pass-through of the carrier.
- What happens when both inputs are the same signal source? The component must still process correctly (this produces a frequency-doubled signal with a DC offset, which is expected AM behaviour).
- What happens when the component is placed on canvas but neither input is connected? The output must be silence; no error should occur.
- How does the component behave when the audio context is suspended? Processing stops silently and resumes correctly when the context resumes.
- When bypassed, the carrier (Audio In) signal passes through to output unchanged. If Audio In is also absent, the output is silence even in bypass mode.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Ring Modulator MUST accept two audio-rate input signals: a carrier (Audio In) and a modulator (Modulator In).
- **FR-002**: The Ring Modulator MUST multiply the carrier and modulator signals sample-by-sample, producing the sum and difference frequencies of the two inputs.
- **FR-003**: The Ring Modulator MUST provide one audio output carrying the ring-modulated result.
- **FR-004**: When either input is absent (no connection), the output MUST be silence.
- **FR-005**: When active (not bypassed), the Ring Modulator MUST NOT pass the original carrier or modulator signal through to the output — only the product of the two signals is heard.
- **FR-006**: The Ring Modulator MUST accept any Audio-typed signal as either input, including oscillators, LFOs, noise generators, and other audio-rate sources.
- **FR-007**: The Ring Modulator MUST have no user-adjustable parameters beyond a bypass toggle — it is a pure signal multiplier with no dry/wet mix or gain controls.
- **FR-007a**: When bypassed, the Ring Modulator MUST pass the carrier (Audio In) signal through to the output unchanged, silencing the modulation effect.
- **FR-008**: The component MUST persist its position in saved patches and reload without error.
- **FR-009**: The component MUST appear in the **Effects** category of the component menu.

### Key Entities

- **Carrier signal**: The primary audio input whose timbral character is transformed by the modulator.
- **Modulator signal**: The audio-rate signal that multiplies the carrier; its frequency determines the pitch of the side bands introduced.
- **Ring-modulated output**: The product of carrier × modulator, containing sum and difference frequencies of the two inputs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When carrier (440 Hz) and modulator (220 Hz) sine waves are connected, the output spectrum contains peaks at 220 Hz and 660 Hz with the original 440 Hz attenuated to below −40 dB relative to the output peaks.
- **SC-002**: Changing the modulator frequency is reflected in the output spectrum within one render frame (≤ 16 ms) with no audible artefacts or clicks.
- **SC-003**: A patch containing a Ring Modulator saves and reloads correctly in under 2 seconds, with both connections restored and audio behaviour unchanged.
- **SC-004**: When either input is disconnected while audio is playing, the output reaches silence within 50 ms with no audible pop.
- **SC-005**: The component can be added, connected, and producing audible output in under 30 seconds of user interaction from the moment it appears in the component menu.

## Assumptions

- The Ring Modulator uses Web Audio API multiplication natively — no manual sample-by-sample computation required. The exact API primitive is an implementation choice.
- Both inputs are Audio-typed ports to allow connection from any audio-rate source (oscillators, LFOs, noise). CV-typed sources are not directly connectable; this is consistent with how all other audio-chain components work in this application.
- No wet/dry mix control is provided — the component is a pure multiplier. A dry/wet knob would turn it into an AM modulator, which is a different effect. If the user wants to blend dry and wet, they can use the Mixer component.
- The component is stateless with respect to patches — no parameters means no parameter serialisation is needed beyond position and connection data.
- The component belongs in the **Effects** category alongside Distortion, Chorus, etc., as it transforms audio rather than generating or routing it.

## Clarifications

### Session 2026-05-31

- Q: Which exact category should the Ring Modulator appear in — Effects or Processors? → A: Effects
- Q: Should the Ring Modulator support a bypass toggle, and if so what is the bypassed behaviour? → A: Bypass supported; when bypassed, carrier (Audio In) passes through to output unchanged
