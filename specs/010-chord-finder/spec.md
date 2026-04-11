# Feature Specification: Chord Finder Utility

**Feature Branch**: `010-chord-finder`  
**Created**: 2026-04-10  
**Status**: Draft  
**Input**: User description: "please help me to create the specification for a chord finder utility. The main goal of the utility is the display of all chords available for a specific, selectable key. A random but well sounding chord progression should be generated within the available chords. The available chord should be displayed as a circle around the key. The chords of the current progression should be highlighted in a different color. When a chord is clicked, the element should send out the chord as cv or midi, so that it can be plugged to an oscillator, just like the keyboard or sequencer utility."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select a Key and Explore Available Chords (Priority: P1)

A musician opens the Chord Finder utility and selects a musical key (e.g., C Major). The utility immediately displays all diatonic chords for that key arranged in a circular layout around the key name. The musician can visually understand which chords belong to the key at a glance.

**Why this priority**: This is the core value proposition — making chord discovery visual and immediate. Without this, no other feature can function.

**Independent Test**: Can be fully tested by opening the utility, selecting a key, and verifying that all expected diatonic chords appear in a circular arrangement. Delivers standalone value as a visual chord reference tool.

**Acceptance Scenarios**:

1. **Given** the Chord Finder is open with no key selected, **When** the musician selects "C Major" from the key selector, **Then** the seven diatonic chords (C, Dm, Em, F, G, Am, Bdim) are displayed in a circle around the "C" key label.
2. **Given** a key is already selected, **When** the musician changes the key to "A Minor", **Then** the displayed chords update immediately to reflect the new key's diatonic chords.
3. **Given** a key is selected, **When** the musician views the circle, **Then** chord names and their quality (major, minor, diminished) are clearly legible on each chord node.
4. **Given** any supported key is selected, **When** the chords are displayed, **Then** all 7 diatonic chords are shown with no missing or extra chords.

---

### User Story 2 - Generate a Random Chord Progression (Priority: P2)

A musician wants inspiration for a chord progression. They click a "Generate" button, and the utility automatically creates a musically coherent progression using chords from the selected key. The chords belonging to the current progression are visually highlighted in a distinct color on the circle, making it easy to see which chords are in use.

**Why this priority**: This is the primary creative feature. It transforms the utility from a reference tool into an interactive composition aid.

**Independent Test**: Can be tested independently by generating a progression and verifying that 4–8 chords are highlighted in a different color, and that all highlighted chords belong to the currently selected key.

**Acceptance Scenarios**:

1. **Given** a key is selected, **When** the musician clicks "Generate Progression", **Then** a sequence of 4–8 chords is selected from the available diatonic chords and highlighted in a distinct color on the circle.
2. **Given** a progression is displayed, **When** the musician clicks "Generate Progression" again, **Then** a new, different progression is generated (progressions should not repeat identically on consecutive generates).
3. **Given** a progression is displayed, **When** the key is changed, **Then** the progression clears and the circle updates to show the new key's chords.
4. **Given** a generated progression, **Then** it follows recognizable harmonic patterns (e.g., commonly starts or ends on the tonic chord, avoids random jumping between unrelated chords).

---

### User Story 3 - Play a Chord via CV Output (Priority: P3)

A musician clicks on any chord node in the circle — whether from the current progression or not — and the Chord Finder sends out the corresponding chord notes as CV signals (one per note in the chord), so the chord can be routed to oscillators or other modules in the synthesizer.

**Why this priority**: This connects the visual tool to the audio signal chain, making it a functional synthesizer module rather than just a reference display.

**Independent Test**: Can be tested independently by clicking a chord node and verifying that the correct CV output is produced for that chord's constituent notes, using the same output mechanism as the keyboard or sequencer utilities.

**Acceptance Scenarios**:

1. **Given** a chord is displayed on the circle, **When** the musician clicks the chord node, **Then** the Chord Finder emits the chord's notes as CV signals (1V/octave per note).
2. **Given** the chord C Major is clicked, **Then** three CV outputs are emitted corresponding to C, E, and G in the octave selected on the module's octave control.
3. **Given** a chord node is being clicked and held, **Then** the gate signal remains active; releasing ends the gate.
4. **Given** the output is connected to an oscillator, **When** a chord node is clicked, **Then** the oscillator produces the correct pitches corresponding to that chord.
5. **Given** a chord from the current progression is clicked, **When** the output is connected, **Then** the behavior is identical to clicking any other chord — the progression highlight is purely visual.

---

### User Story 4 - Persist Key and Progression State (Priority: P4)

A musician sets a key and generates a progression. When they save the patch and reload it, the Chord Finder restores the same key and the same chord progression, so they don't lose their work.

**Why this priority**: Consistent with the patch persistence behavior of other utilities in the synthesizer. Lower priority than core functionality but important for user workflow.

**Independent Test**: Can be tested by saving the patch with a key and progression selected, reloading the patch, and verifying that the key and progression are restored exactly.

**Acceptance Scenarios**:

1. **Given** a key is selected and a progression is generated, **When** the patch is saved and reloaded, **Then** the Chord Finder displays the same key and the same highlighted progression.
2. **Given** no progression has been generated, **When** the patch is saved and reloaded, **Then** the Chord Finder shows the saved key with no progression highlighted.

---

### Edge Cases

- What happens when no key is selected and the user clicks "Generate Progression"? The button should be disabled or prompt the user to select a key first.
- What happens if the user clicks a chord node before any key is selected? No output should be emitted; the chord node should appear inactive.
- How does the circle display handle enharmonic keys (e.g., C# vs Db)? Both should produce equivalent chord sets; displaying the simpler spelling is preferred.
- What happens when the output is not connected to anything? Clicking a chord should still behave normally (outputs emit signals even if unpatched).
- What happens if the user rapidly clicks multiple chord nodes? Each click should trigger its own output event without errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The utility MUST allow the user to select a root note and scale type (at minimum: all 12 chromatic roots with Major and Natural Minor scales).
- **FR-002**: The utility MUST display all diatonic chords for the selected key arranged visually in a circular layout around the key label, ordered clockwise by scale degree (I, ii, iii, IV, V, vi, vii°).
- **FR-003**: Each chord node in the circle MUST display the chord name and quality (e.g., "Am", "Bdim").
- **FR-004**: The utility MUST provide a "Generate Progression" action that selects a musically coherent sequence of chords from the diatonic set. The vii° (diminished) chord MUST be assigned lower selection weight than other diatonic chords, so it appears rarely in generated progressions while remaining available on the circle.
- **FR-005**: Generated progressions MUST be highlighted in a visually distinct color on the chord circle, clearly differentiating progression chords from non-progression chords. The circle is the sole display of the progression — no separate ordered sequence strip or list is shown.
- **FR-006**: The user MUST be able to click any chord node to trigger CV output for that chord's notes. Every chord node MUST display a visually distinct pressed/active state for the duration the gate is open, and return to its default or progression-highlighted state on release.
- **FR-007**: CV output MUST follow the 1V/octave standard consistent with other utilities (keyboard, sequencer).
- **FR-013**: The utility MUST provide a user-selectable octave control (range C2–C6) on the module itself. All CV chord output notes are transposed to the selected octave. This control is independent of any global setting.
- **FR-008**: Gate signals MUST be active while the chord node is pressed and end on release.
- **FR-009**: ~~REMOVED~~ MIDI output is out of scope. All signal output uses CV/Gate only, consistent with the rest of the synthesizer utilities.
- **FR-010**: The utility MUST persist the selected key, scale type, and current progression as part of the patch state, consistent with existing patch serialization.
- **FR-011**: Changing the key or scale MUST update the chord circle immediately without requiring a page reload.
- **FR-012**: The "Generate Progression" action MUST produce varied results across consecutive invocations (not repeat identically).

### Key Entities

- **Key**: A combination of a root note (C, C#/Db, D, … B) and a scale type (Major, Natural Minor, etc.), defining the tonal center.
- **Diatonic Chord**: One of the seven chords that naturally occur within a given key, each associated with a scale degree (I, ii, iii, IV, V, vi, vii°) and quality (major, minor, diminished).
- **Chord Circle**: The visual display component showing all diatonic chords arranged in a circle around the key label.
- **Chord Progression**: An ordered sequence of diatonic chords selected from the current key, intended to form a musically coherent pattern.
- **Chord Output**: The set of CV/Gate signals emitted when a chord node is activated, representing the individual notes of that chord.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A musician can select a key and view all available diatonic chords within 1 second of their selection.
- **SC-002**: Generated chord progressions are visually distinguishable from non-progression chords at a glance — all reviewers can identify progression chords without instruction.
- **SC-003**: Clicking a chord node produces correct CV output with no perceptible latency.
- **SC-004**: At least 80% of generated progressions are judged as "musically coherent" by users familiar with basic music theory (avoids random, jarring sequences).
- **SC-005**: Patch save and reload restores the key, scale, and progression with 100% fidelity.
- **SC-006**: The utility supports all 12 chromatic roots and at least 2 scale types (Major and Natural Minor) at launch.
- **SC-007**: The chord output is compatible with existing oscillator and sequencer connections — a musician can route chord output to an oscillator using the same patching workflow as the keyboard or sequencer utilities.

## Clarifications

### Session 2026-04-10

- Q: Is the generated progression's order displayed separately (e.g., a numbered strip), or only as highlights on the circle? → A: Circle only — progression is shown exclusively through highlighted chord nodes on the circle; no separate ordered sequence display.
- Q: In what order are the 7 diatonic chords arranged clockwise on the circle? → A: Scale degree order clockwise — I, ii, iii, IV, V, vi, vii°.
- Q: What determines the octave for CV chord output — fixed, user-selectable on the module, or global setting? → A: User-selectable octave on the module (range C2–C6), self-contained with no dependency on a global setting.
- Q: Should the vii° (diminished) chord be treated equally, weighted low, or excluded from progression generation? → A: Weighted low — vii° appears on the circle but is selected with lower probability by the progression generator.
- Q: Should clicking a chord node show a visual pressed/active state while the gate is open? → A: Yes — all chord nodes show a pressed/active state while the gate is open, consistent with keyboard utility behavior.

## Assumptions

- **Scale support at launch**: Only Major and Natural Minor scales are supported initially. Additional scales (Dorian, Phrygian, etc.) can be added in future iterations.
- **Chord voicing**: Chords are voiced in root position within a single octave by default. Inversions and extended chords (7ths, 9ths) are out of scope for this specification.
- **Progression length**: Generated progressions contain between 4 and 8 chords. The exact length may vary per generation.
- **Progression algorithm**: The generation algorithm uses standard tonal harmony rules (e.g., tonic–subdominant–dominant motion) rather than purely random selection. The vii° chord is weighted lower than other diatonic chords. The specific algorithm is an implementation detail.
- **Output channels**: The utility provides one CV output per chord note (typically 3 for triads) plus a shared gate output, mirroring the approach of other utilities. The octave for all CV outputs is set via a dedicated octave control on the module (range C2–C6).
- **No real-time playback**: The utility does not automatically play through the progression in sequence; output is triggered only by user clicks. Sequenced playback of the progression is out of scope.
