# Feature Specification: Quantizer

**Feature Branch**: `025-quantizer`  
**Created**: 2026-05-29  
**Status**: Draft  
**Input**: User description: "A Quantizer module for the modular web synthesizer. The Quantizer takes a continuously varying CV (control voltage) input signal and snaps it to the nearest note in a user-selected musical scale and root key. Key parameters: root note (C through B), scale type (Major, Natural Minor, Harmonic Minor, Pentatonic Major, Pentatonic Minor, Chromatic, and others), octave range, and an optional trigger input that only updates the output pitch when a gate signal fires. Inputs: CV in, optional Gate/Trigger in. Output: quantized CV out. Should integrate with existing CV signal conventions (1V/octave), use the existing MusicalScale system if applicable, and follow the same component patterns as other utilities like ChordFinder and Collider."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - LFO Melody Generator (Priority: P1)

A user connects an LFO (or any smoothly varying CV source) to the Quantizer's CV input, then connects the Quantizer's CV output to an Oscillator's pitch input. Without the Quantizer, the LFO produces a continuous gliding sweep through all frequencies. With the Quantizer set to C Major, the pitch snaps to only the notes of C Major across the sweep — producing a recognizable, in-tune melodic pattern automatically.

**Why this priority**: This is the core use case that defines the module's value. It is the simplest patch to build and immediately demonstrates musical usefulness with no additional modules.

**Independent Test**: Can be fully tested by connecting LFO → Quantizer → Oscillator → Master Output and verifying that the audible pitch only lands on notes of the selected scale.

**Acceptance Scenarios**:

1. **Given** a Quantizer with root=C, scale=Major, **When** a slowly sweeping LFO CV signal is connected to the CV input, **Then** the output CV only produces pitches corresponding to C D E F G A B (in any octave).
2. **Given** a Quantizer with root=D, scale=Natural Minor, **When** a CV signal spans 2 octaves, **Then** all output pitches fall within the D Natural Minor scale.
3. **Given** a Quantizer with scale=Chromatic, **When** any CV is connected, **Then** the output snaps to the nearest semitone (standard 12-tone equal temperament).

---

### User Story 2 - Trigger-Locked Pitch Steps (Priority: P2)

A user adds a Gate/Trigger signal (e.g., from the Step Sequencer's clock output) to the Quantizer's trigger input. The Quantizer now only updates its output pitch when a trigger fires — not continuously. This causes the pitch to lock to a new note on each clock beat, creating rhythmically regular, scale-quantized melodic steps rather than a constantly sliding pitch.

**Why this priority**: The trigger input transforms the Quantizer from a pitch-correction tool into a rhythmic melodic generator — a distinct and highly creative use case that pairs naturally with the existing Step Sequencer and Global BPM system.

**Independent Test**: Can be tested independently by connecting a clock source (Step Sequencer gate out) to the Trigger input, a slow LFO to CV in, and verifying that pitch changes only occur on clock pulses.

**Acceptance Scenarios**:

1. **Given** a trigger input connected, **When** the CV input changes continuously between trigger pulses, **Then** the output pitch does NOT change — it holds the last quantized value.
2. **Given** a trigger input connected, **When** a trigger pulse fires, **Then** the output pitch updates immediately to the quantized value of the current CV input.
3. **Given** no trigger input connected, **When** the CV input changes, **Then** the output pitch updates continuously in real time (trigger-free mode).

---

### User Story 3 - Scale & Root Exploration (Priority: P2)

A user patches a working Quantizer and then changes the root note and scale type in real time while audio is playing. The output pitch immediately reflects the new scale, allowing the user to shift between tonalities live — for example moving from C Major to A Natural Minor, or switching to Pentatonic for a simpler sound.

**Why this priority**: Real-time parameter changes are fundamental to the live, exploratory nature of this synthesizer. A Quantizer that requires re-patching to change key or scale would be frustrating to use.

**Acceptance Scenarios**:

1. **Given** a playing patch with Quantizer set to C Major, **When** the root is changed to F, **Then** the output immediately produces only F Major scale pitches.
2. **Given** a playing patch, **When** the scale type is changed from Major to Pentatonic Minor, **Then** the output immediately restricts to the 5-note pentatonic pattern.
3. **Given** any active patch, **When** scale parameters change, **Then** there is no audio glitch, click, or dropout during the transition.

---

### User Story 4 - Save and Restore in Patches (Priority: P3)

A user saves a patch containing a Quantizer module with specific root, scale, and trigger settings. When the patch is reloaded, the Quantizer restores exactly the same configuration and continues to function correctly.

**Why this priority**: Patch persistence is table-stakes for all modules in this synth. Without it, any carefully crafted patch is lost on page reload.

**Independent Test**: Can be tested by saving a patch with a configured Quantizer, reloading the page, and verifying all parameters are restored correctly.

**Acceptance Scenarios**:

1. **Given** a saved patch with Quantizer root=G, scale=Harmonic Minor, **When** the patch is loaded, **Then** the Quantizer opens with root=G and scale=Harmonic Minor.
2. **Given** a patch where the Quantizer had a trigger input connected, **When** the patch is loaded, **Then** the trigger connection is restored and the module behaves identically to before saving.

---

### Edge Cases

- What happens when the incoming CV is outside the defined octave range? — The Quantizer clamps the CV: values below C0 output C0, values above C8 output C8. No wrapping or folding occurs.
- What happens when two CV inputs arrive simultaneously at very high rate? — Output should update at audio rate without causing audible artifacts or performance degradation.
- What happens if a scale with only 1 note were theoretically constructed? — The output should always produce a valid pitch; degenerate scales are not exposed in the UI but the system should be robust.
- What happens when the CV input is disconnected while a trigger is holding the last pitch? — The output should hold the last valid quantized pitch until a new CV is connected and a trigger fires.
- What happens when the root is changed to a note not present in a currently active scale output? — The scale recalculates immediately; any in-progress held pitch updates at the next trigger or immediately in trigger-free mode.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Quantizer MUST accept a CV input signal and produce a CV output signal containing only pitches belonging to the selected musical scale and root note.
- **FR-002**: The Quantizer MUST support the following scale types: Major, Natural Minor, Harmonic Minor, Lydian, Mixolydian, Pentatonic Major, Pentatonic Minor, Chromatic.
- **FR-003**: The Quantizer MUST support all 12 chromatic root notes (C, C#, D, D#, E, F, F#, G, G#, A, A#, B).
- **FR-004**: The Quantizer MUST snap incoming CV to the nearest pitch in the active scale, using standard 1V/octave convention.
- **FR-005**: The Quantizer MUST accept an optional Gate/Trigger input; when connected, the output pitch MUST only update on a rising edge of the trigger signal.
- **FR-006**: When no trigger input is connected, the Quantizer MUST update the output pitch continuously in real time as the CV input changes.
- **FR-007**: All Quantizer parameters (root note, scale type) MUST be changeable in real time while audio is playing, taking effect immediately without audio dropout.
- **FR-008**: The Quantizer MUST persist its configuration (root note, scale type, connections) as part of the patch save/load system.
- **FR-009**: The Quantizer MUST follow the same visual component conventions (canvas-rendered controls, color-coded ports) as existing utility modules such as ChordFinder and Collider.
- **FR-010**: The CV output MUST remain within C0–C8; input CV below C0 MUST clamp to C0 and input CV above C8 MUST clamp to C8 — no wrapping or folding.
- **FR-011**: The Quantizer MUST display a real-time note label (e.g. "A4") showing the currently active quantized output pitch, updating whenever the output pitch changes.

### Key Entities

- **Quantizer Component**: The module itself — holds root note, scale type, and trigger mode state; has one CV input port, one optional Gate/Trigger input port, and one CV output port.
- **Scale Definition**: The set of pitch intervals that define a scale (e.g., Major = [0, 2, 4, 5, 7, 9, 11]); used to build the full lookup table across all octaves.
- **Quantized Pitch Table**: A pre-computed sorted list of all valid pitches in the selected scale across the full operating octave range; used at runtime to find the nearest valid pitch for any incoming CV value.
- **Trigger State**: A boolean flag that tracks whether a trigger input is connected and the last trigger edge time, used to gate pitch updates.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can build an LFO → Quantizer → Oscillator patch and hear in-scale pitches within 60 seconds of adding the module, with no prior instruction needed beyond the existing UI conventions.
- **SC-002**: The Quantizer produces correctly quantized output for all 8 scale types and all 12 root notes — 96 combinations — with zero incorrect pitch outputs verifiable by automated test.
- **SC-003**: Changing root note or scale type takes effect in under one audio buffer cycle (imperceptible to the listener, no audible glitch).
- **SC-004**: With trigger input connected, pitch changes occur only on trigger rising edges — 100% of pitch updates are trigger-gated with no spurious updates in between.
- **SC-005**: A patch containing a fully configured Quantizer saves and restores correctly 100% of the time, with all parameters and connections intact.
- **SC-006**: The module processes CV at control rate (~60–128 times/sec) with no measurable CPU overhead increase compared to existing CV utility modules (LFO, ADSR).

## Clarifications

### Session 2026-05-30

- Q: When input CV falls outside the C0–C8 range, should the Quantizer clamp, wrap, or transpose? → A: Clamp — CV below C0 outputs C0; CV above C8 outputs C8.
- Q: Should the Quantizer show real-time visual feedback of the active quantized note? → A: Yes — a small note label readout (e.g. "A4") updating live whenever the output pitch changes.
- Q: Should the Quantizer process CV at audio rate or control rate? → A: Control rate — quantize at render-block/frame rate (~60–128 times/sec); audio-rate processing is not required.

## Assumptions

- The scale interval data from the existing `ScaleTypes.ts` / `MusicalScale` system informed the Quantizer's own `QUANTIZER_SCALE_INTERVALS` definition, but the `MusicalScale` class itself is not used. The Quantizer maintains its own `QuantizerScaleType` enum (a superset of the Collider's `ScaleType`) and builds a multi-octave pitch lookup table independently, keeping the two components decoupled.
- CV convention follows the project standard: 1V/octave, with middle C (C4) at approximately 1.0 (arbitrary units consistent with the rest of the system).
- "Nearest pitch" is defined as the minimum absolute distance in semitones; ties resolve upward (to the higher of the two equidistant notes).
- The octave range of the quantizer covers at minimum C0 through C8, matching the range already used by Oscillator and ChordFinder components.
- A real-time note label readout (e.g. "A4") is the only visual feedback required — no LED, step indicator, or keyboard diagram is needed for the MVP.
- The Quantizer processes CV at control rate (render-block/frame rate, ~60–128 times/sec), not at audio sample rate. Audio-rate CV sources (e.g. FM Oscillator) are valid inputs but will be sampled at control rate.
- Additional scale types (Dorian, Phrygian, Lydian, Mixolydian, Blues, etc.) can be added in a future iteration; the architecture should allow new scale definitions without code changes to the Quantizer component itself.
