# Feature Specification: Step Sequencer Refactor

**Feature Branch**: `012-step-sequencer-refactor`
**Created**: 2026-04-12
**Status**: Draft
**Input**: Refactor the existing StepSequencer component to match the design in specs/step-sequencer-plan.md and the layout in specs/step-sequencer-layout-example.png.

---

## Clarifications

### Session 2026-04-12

- Q: How does the user select a note in the per-step controls? → A: Clicking the note label within a step opens a canvas-drawn popup with two selectors — one for note name (C–B) and one for octave (0–8). Fully canvas-native, no HTML overlay. Clicking the step cell itself only toggles active/inactive.
- Q: How is the per-step editor revealed — on click, or always visible? → A: The per-step controls (note/offset, velocity, gate length) are always visible for every step in the grid. A click on a step cell only toggles it active/inactive.
- Q: What control type is used for per-step velocity? → A: Draggable knob, matching the layout example and the existing knob control style used elsewhere in the application.
- Q: What control type is used for per-step gate length? → A: Canvas-drawn dropdown showing the discrete values: tied, 1/1, 1/2, 1/4, 1/8, 1/16 — matching the style of the global note division dropdown.
- Q: What control type is used for global BPM? → A: Draggable knob, matching the layout example and the existing BPM knob in the current implementation.
- Q: What is the precise audio behavior of "tied" gate length? → A: Gate stays high continuously from the tied step's trigger point through to the next step's trigger point — no gate-off event is emitted for the tied step. The following active step retriggers normally.
- Q: What method signature does StepSequencerDisplay expose for the per-frame draw call? → A: `draw(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void` — identical to ChordFinderDisplay and OscilloscopeDisplay.
- Q: Does the 5 ms drift criterion (SC-002) apply in arpeggiator mode? → A: No. Arpeggiator timing is externally driven by the keyboard gate signal; SC-002 applies to standalone sequencer mode only. No separate drift target exists for arpeggiator mode.
- Q: How does the canvas-drawn note picker work? → A: Two separate canvas-drawn selectors within the popup: one for note name (C, C#, D, D#, E, F, F#, G, G#, A, A#, B) and one for octave (0–8, default 4). No scrolling list.
- Q: What is the hit-test priority order within a step cell? → A: Specific controls take priority — note label, velocity knob, and gate dropdown each consume the click event. The step cell toggle fires only when the click hits none of these named controls.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Basic Pattern Sequencing (Priority: P1)

A musician adds a Step Sequencer to the canvas, connects it to an oscillator and envelope, programs a melody by setting notes and velocities on up to 16 steps, sets BPM and note division, and presses Play. The sequencer cycles through the active steps, triggering the connected instruments on each active step in order.

**Why this priority**: This is the core value of the component. Without working standalone sequencing, no other story is useful.

**Independent Test**: Add a Step Sequencer, connect its frequency and gate outputs to an oscillator and ADSR, set steps 1–4 to different notes, press Play — audio plays the programmed pattern in a loop.

**Acceptance Scenarios**:

1. **Given** a Step Sequencer with outputs connected, **When** the user sets steps 1–4 to different notes and presses Play, **Then** the oscillator plays those notes in order at the configured BPM.
2. **Given** a playing sequencer, **When** the user toggles a step inactive, **Then** that step is silently skipped in subsequent cycles.
3. **Given** a playing sequencer, **When** the user changes BPM, **Then** the tempo changes immediately without restarting the pattern.
4. **Given** a playing sequencer, **When** the user presses Stop, **Then** playback halts and the gate output goes low.
5. **Given** a stopped sequencer, **When** the user presses Reset, **Then** the step cursor returns to step 1.
6. **Given** a sequencer with length set to 8, **When** the sequencer is playing, **Then** only steps 1–8 are played in the loop.

---

### User Story 2 — Per-Step Parameter Editing (Priority: P2)

A musician edits individual steps directly in the grid. Each step permanently shows its note (or semitone offset), a velocity indicator, and a gate length control — no click is needed to reveal them. Clicking a step cell only toggles it active or inactive. To change a note, the user clicks the note label within the step, which opens a canvas-drawn popup with two selectors: one for note name (C–B) and one for octave (0–8).

**Why this priority**: The step grid is the primary editing surface. Without per-step control the sequencer produces only monotone patterns.

**Independent Test**: Without any special interaction, every step in the grid shows its note, velocity, and gate length. Click the note label on a step — a popup appears with a note-name selector (C–B) and an octave selector (0–8). Change the note name and octave, then change velocity and gate length on several steps, press Play — the pattern reflects all edited values.

**Acceptance Scenarios**:

1. **Given** the sequencer is on the canvas, **When** the user looks at the step grid, **Then** every step displays its current note, velocity level, and gate length without any prior interaction.
2. **Given** a step cell, **When** the user clicks the note label, **Then** a canvas-drawn popup opens showing a note-name selector (C–B) and an octave selector (0–8).
3. **Given** the note picker open, **When** the user selects a note name and octave, **Then** the picker closes and that step plays the resulting pitch on the next cycle.
4. **Given** a step's velocity control, **When** the user adjusts it to 50%, **Then** the velocity CV output reflects 0.5 when that step triggers.
5. **Given** a step's gate length control, **When** the user sets it to 1/8, **Then** the gate closes after 1/8-note duration on that step.
6. **Given** a step cell, **When** the user clicks an area that is not the note label, velocity knob, or gate dropdown, **Then** the step toggles between active and inactive; clicking a named control does not trigger the toggle.

---

### User Story 3 — Arpeggiator Mode (Priority: P3)

A musician connects a KeyboardInput to the sequencer's arpeggiator inputs, switches to Arpeggiator mode, and holds a chord. The sequencer cycles through its steps, applying each step's semitone offset to the held keyboard frequency, creating an arpeggiated pattern that stops when the key is released.

**Why this priority**: Extends the component significantly but is not required for basic melody sequencing.

**Independent Test**: Connect a KeyboardInput to the sequencer's arpeggiator inputs, switch to Arpeggiator mode, hold a key — the sequencer plays a rhythmic arpeggiation. Release the key — the sequencer stops and resets.

**Acceptance Scenarios**:

1. **Given** arpeggiator mode active and a key held, **When** the sequencer cycles, **Then** each step's output frequency is the keyboard base frequency transposed by the step's semitone offset.
2. **Given** arpeggiator mode active, **When** the keyboard gate goes low, **Then** the sequencer stops and resets to step 1.
3. **Given** arpeggiator mode active and playing, **When** the user holds a different key, **Then** the arpeggio base pitch shifts to the new note without interrupting the rhythm.
4. **Given** arpeggiator mode, **When** the user clicks a step to edit it, **Then** the step editor shows a semitone offset control (−12 to +12) instead of an absolute note selector.

---

### User Story 4 — Crisp Rendering at Any Zoom Level (Priority: P4)

The Step Sequencer display (step grid, velocity bars, playback cursor, inline editor) must be as sharp and correctly scaled as any other component on the canvas at all zoom levels. The current implementation uses a separate overlay HTML canvas element with CSS transform-based scaling, which causes pixel interpolation blur and z-index conflicts with dropdown menus — the same class of problem that was fixed for the Oscilloscope in feature 011. The display must be migrated to draw directly on the main canvas context, following the same pattern already established by ChordFinderDisplay and OscilloscopeDisplay.

**Why this priority**: The overlay canvas causes the same visual defects documented for the Oscilloscope (blur at non-100% zoom, dropdowns obscured, orphaned DOM elements on delete). This must be addressed in the same refactor so the sequencer doesn't launch with known visual regressions.

**Independent Test**: Add a Step Sequencer, zoom to 50% and 200% — the step grid, velocity bars, and cursor are pixel-crisp and correctly positioned at all zoom levels, matching the visual quality of other components. Open any dropdown on the sequencer — it renders fully on top of the display area. Delete the sequencer — no orphaned canvas element in the DOM.

**Acceptance Scenarios**:

1. **Given** a Step Sequencer on the canvas, **When** the user zooms to 50% or 200%, **Then** the step grid and all display elements are pixel-crisp with no interpolation blur.
2. **Given** the sequencer display is visible, **When** the user opens a dropdown on the sequencer component, **Then** the dropdown renders fully on top of the step grid with no clipping.
3. **Given** a Step Sequencer on the canvas, **When** the user deletes it, **Then** no orphaned HTML canvas element remains in the DOM.
4. **Given** two Step Sequencers on the canvas simultaneously, **When** both are rendered, **Then** each draws into its own region with no cross-contamination.

---

### User Story 5 — Pattern Persistence (Priority: P5)

A musician programs a Step Sequencer pattern, saves the patch, and later reloads it. The sequencer is restored with exactly the same steps, BPM, note division, length, and mode as when saved.

**Why this priority**: Without persistence every session starts from scratch, making the component impractical for serious use.

**Independent Test**: Program a full pattern with varied notes, velocities, and gate lengths. Save the patch, reload it — all step values, global settings, and mode are identical.

**Acceptance Scenarios**:

1. **Given** a programmed pattern, **When** the user saves and reloads the patch, **Then** all steps are restored with their exact note, velocity, gate length, and active state.
2. **Given** a reloaded patch, **When** the user presses Play, **Then** the pattern plays identically to before saving.

---

### Edge Cases

- What happens when all steps are inactive? → The sequencer cycles silently; the gate output stays low; no audio plays and no error occurs.
- What happens at minimum BPM (30) or maximum BPM (300)? → Timing remains audibly accurate at both extremes.
- What happens when the sequencer is playing and the user deletes it from the canvas? → Playback stops cleanly, all audio nodes are released, and no stuck gate or CV value remains.
- What happens in arpeggiator mode with no keyboard connected? → The mode can be toggled, but the sequencer does not start; the display indicates that a keyboard input connection is required.
- What happens when sequence length is set to 1? → The single step loops continuously.
- What happens when gate length exceeds the step interval (e.g., tied gate at very high BPM)? → For non-tied gates: gate is clipped to the step interval; no overlapping gates. For "tied" gate: the gate-off is suppressed entirely and the gate remains high into the next step — this is correct by definition and does not require clipping.
- What happens when the note selector popup is open and the sequencer is playing? → Playback continues uninterrupted; the popup remains open and interactive.

---

## Requirements *(mandatory)*

### Functional Requirements

**Transport & Global Controls**

- **FR-001**: The sequencer MUST provide Play, Stop, and Reset controls visible in the component display at all times.
- **FR-002**: BPM MUST be adjustable between 30 and 300 via a draggable knob; changes MUST take effect immediately during playback.
- **FR-003**: Note division MUST be selectable from: whole note, 1/2, 1/4, 1/8, 1/16, 1/32.
- **FR-004**: Sequence length MUST be configurable from 2 to 16 steps; only steps within the active length play.
- **FR-005**: The sequencer MUST provide a mode toggle between Sequencer mode and Arpeggiator mode.

**Step Grid**

- **FR-006**: The sequencer MUST display all configured steps in a grid, each showing its active/inactive state and a visual velocity indicator.
- **FR-007**: Each step MUST be individually togglable between active and inactive by clicking.
- **FR-008**: The currently playing step MUST be visually highlighted in the grid during playback, updating in real time.

**Per-Step Editing**

- **FR-009**: Every step in the grid MUST permanently display its note (or semitone offset in arpeggiator mode), a velocity indicator, and a gate length control — no interaction is required to reveal these controls. All controls MUST be drawn on the main canvas — no HTML overlay elements.
- **FR-010**: Clicking a step cell MUST toggle that step between active and inactive only when the click does not land on a named control (note label, velocity knob, or gate dropdown). Named controls consume the click event and suppress the toggle.
- **FR-010a**: Clicking the note label within a step MUST open a canvas-drawn popup containing two separate selectors: a note-name selector (C, C#, D, D#, E, F, F#, G, G#, A, A#, B) and an octave selector (0–8, default 4). Together they address the full MIDI note range (C0–B8). The popup closes on completing a selection in either selector or on clicking outside it.
- **FR-011**: Gate length per step MUST be selectable via a canvas-drawn dropdown showing the discrete values: tied, 1/1, 1/2, 1/4, 1/8, 1/16 — consistent with the global note division dropdown style. A "tied" gate MUST hold the gate output high continuously from the step's trigger point through to the next step's trigger point, emitting no gate-off event for that step; the following active step retriggles normally.
- **FR-012**: Velocity per step MUST be adjustable from 0% to 100% via a draggable knob rendered within each step cell, consistent with the knob control style used throughout the application.
- **FR-013**: In arpeggiator mode, the per-step pitch control MUST be a semitone offset from −12 to +12.

**Outputs**

- **FR-014**: The sequencer MUST output a frequency CV signal in Hz, compatible with the oscillator frequency input used by the rest of the application.
- **FR-015**: The sequencer MUST output a gate signal that goes high when a step triggers and low at the step's gate-off time.
- **FR-016**: The sequencer MUST output a velocity CV signal proportional to the active step's velocity (0.0–1.0).

**Arpeggiator Mode**

- **FR-017**: In arpeggiator mode, the sequencer MUST accept frequency, gate, and velocity inputs from an external keyboard source.
- **FR-018**: In arpeggiator mode, the sequencer MUST start cycling when the keyboard gate goes high and stop and reset when it goes low.
- **FR-019**: In arpeggiator mode, each step's output frequency MUST equal the incoming base frequency transposed by the step's semitone offset using equal-temperament scaling.

**Display Rendering**

- **FR-020**: The sequencer display MUST be drawn directly onto the main canvas context as part of the normal per-frame component render pass, with no separate HTML canvas element created or managed. The display class MUST expose `draw(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void`, matching the contract of `ChordFinderDisplay` and `OscilloscopeDisplay` exactly so the main render loop requires no changes.
- **FR-021**: The display MUST render at the correct world-coordinate position so it scales correctly at all zoom levels, consistent with how all other component controls are drawn.
- **FR-022**: The display MUST always appear beneath dropdown menus, which are drawn in a subsequent pass on the main canvas (matching the render ordering used by ChordFinderDisplay and OscilloscopeDisplay).
- **FR-023**: Cleanup on component destruction MUST require no DOM element removal — only releasing internal references.

**Persistence**

- **FR-024**: All step parameters (note or semitone offset, velocity, gate length, active state), BPM, note division, sequence length, and mode MUST be saved and fully restored with the patch.

### Key Entities

- **Step**: One programmable unit in the sequence. Attributes: active state, note (MIDI note number in standalone mode) or semitone offset (−12 to +12 in arpeggiator mode), velocity (0–1), gate length (enum: tied/1/1/1/2/1/4/1/8/1/16).
- **Pattern**: The complete set of steps plus global settings (BPM, note division, length, mode). Saved and restored as part of a patch.
- **Transport**: The play/stop/reset state controlling step advancement and output triggering.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A musician can program a complete 8-step melody (notes, velocities, gate lengths) and hear it play back correctly within 2 minutes of adding the component to the canvas.
- **SC-002**: Timing drift at 120 BPM over 60 seconds of continuous playback in standalone sequencer mode is imperceptible (less than 5 ms cumulative drift). In arpeggiator mode, step timing is externally driven by the keyboard gate signal; no internal drift criterion applies.
- **SC-003**: Changing BPM during playback takes effect within one step cycle with no audible glitch or missed step.
- **SC-004**: Saving and reloading a patch restores the pattern with 100% fidelity — no step data is lost or corrupted.
- **SC-005**: The step grid and inline editor remain visually responsive during active playback at all BPM values from 30 to 300.
- **SC-006**: All existing patches that do not contain a Step Sequencer continue to load and play correctly after the refactor (no regressions).
- **SC-007**: The step grid is visually indistinguishable in sharpness from other component controls at all zoom levels between 25% and 400%.
- **SC-008**: Zero HTML canvas overlay elements exist in the DOM for the Step Sequencer at any point; zero orphaned elements remain after deletion.

---

## Assumptions

- The frequency CV convention in this application is Hz (not 1V/oct volts), matching the existing KeyboardInput and ChordFinder output convention.
- Semitone offsets in arpeggiator mode are computed as `baseHz × 2^(semitones / 12)`, consistent with standard equal temperament.
- The component display is drawn directly on the main canvas context, following the same pattern as ChordFinderDisplay (010) and OscilloscopeDisplay (011). The existing overlay HTML canvas element and all CSS transform-based viewport synchronisation are removed as part of this refactor.
- Default values on a fresh component: all 16 steps active, note = C4, velocity = 80%, gate length = 1/4 note, BPM = 120, note division = 1/4, length = 16, mode = Sequencer.
- This refactor fully replaces the existing StepSequencer implementation. No backward-compatibility shim for the old API is required.

---

## Out of Scope

- Swing / shuffle timing offset
- Per-step probability (chance to trigger)
- Per-step micro-timing offset
- Multiple pattern banks (A/B/C/D) or pattern chaining
- MIDI file export
- Step copy/paste or pattern randomization
- Direction modes (reverse, ping-pong, random)
- Migration of the Collider display to the main canvas (separate future feature)
