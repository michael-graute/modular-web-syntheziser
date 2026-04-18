# Feature Specification: ChordFinder–Keyboard Visual Sync

**Feature Branch**: `014-chordfinder-keyboard-sync`  
**Created**: 2026-04-18  
**Status**: Draft  
**Input**: User description: "We need to update the ChordFinder and the Keyboard, so that everytime a chord is played in the ChordFinder the played notes are visualized on the keyboard the same way as they were played through the keyboard."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chord Playback Highlights Keys (Priority: P1)

A musician plays chords in the ChordFinder module. They glance at the Keyboard module and immediately see which piano keys are highlighted — the same blue highlight that would appear if they had pressed those notes manually on the keyboard.

**Why this priority**: This is the core deliverable. All other stories build on this behavior.

**Independent Test**: Can be fully tested by pressing a chord button in ChordFinder and verifying that the corresponding keys light up on the Keyboard canvas, delivering clear visual feedback of chord voicing.

**Acceptance Scenarios**:

1. **Given** a ChordFinder and a Keyboard module are both present on the canvas, **When** the user presses a chord button in the ChordFinder, **Then** the three notes of that chord are highlighted on the Keyboard in the same visual style (blue) as manually pressed keys.
2. **Given** a chord is highlighted on the Keyboard via ChordFinder, **When** the chord is released (gate turns off), **Then** the highlighted keys return to their unpressed appearance.
3. **Given** a chord is playing, **When** the user changes the octave setting in the ChordFinder, **Then** the highlighted keys move to reflect the new octave's notes on the Keyboard.

---

### User Story 2 - No Keyboard Module Required (Priority: P2)

The synthesizer patch does not include a Keyboard module. The ChordFinder operates normally — it plays chords and emits CV/gate signals — without errors or missing functionality caused by the absence of a Keyboard.

**Why this priority**: The Keyboard is an optional module; ChordFinder must not depend on it.

**Independent Test**: Can be fully tested by removing the Keyboard module from a patch and verifying ChordFinder still plays chords without errors.

**Acceptance Scenarios**:

1. **Given** no Keyboard module is present on the canvas, **When** the user presses a chord in ChordFinder, **Then** audio/CV output behaves identically to the current behavior and no errors occur.

---

### User Story 3 - Multiple Keyboard Modules Sync (Priority: P3)

A patch contains more than one Keyboard module. When a chord is played in ChordFinder, all Keyboard modules display the highlighted notes simultaneously.

**Why this priority**: Edge case consistency — the system should not break or behave unpredictably with multiple keyboards.

**Independent Test**: Add two Keyboard modules to a patch and verify both highlight the chord notes when ChordFinder plays.

**Acceptance Scenarios**:

1. **Given** two Keyboard modules are present, **When** a chord is played in ChordFinder, **Then** both keyboards highlight the same notes.

---

### Edge Cases

- What happens when a chord note falls outside the Keyboard's visible octave range? The key is not highlighted (out of range), and no error occurs.
- What if ChordFinder and Keyboard are in the same patch but not connected by a cable? Highlighting still occurs — it is a visual coupling, not a signal-cable coupling.
- What happens when a chord is held and the user also presses a key manually on the Keyboard? Both sources of highlights coexist; the manual key press adds its highlight on top.
- What happens when the patch is loaded from storage with a chord already in a pressed state? On load, all keys start unpressed regardless of saved chord state.
- What happens when a new chord is pressed in ChordFinder while a previous chord is still held? The previous chord's highlights are cleared immediately and replaced by the new chord's highlights, consistent with ChordFinder's single-chord-at-a-time audio behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a chord is pressed in the ChordFinder, all Keyboard modules in the current patch MUST visually highlight each note of that chord using the same pressed-key visual style as manual key input.
- **FR-002**: When a chord is released in the ChordFinder, all Keyboard modules MUST remove the ChordFinder-sourced highlights from those keys.
- **FR-003**: The Keyboard's visual state for ChordFinder-sourced notes MUST be indistinguishable from manually-pressed key highlights (same color, same rendering).
- **FR-004**: ChordFinder highlight requests MUST respect the octave setting configured in the ChordFinder, mapping chord notes to the correct octave position on the Keyboard.
- **FR-005**: If no Keyboard module is present in the patch, ChordFinder MUST continue to function without errors.
- **FR-006**: Highlighting MUST be additive: if the user manually presses keys while a ChordFinder chord is active, both sets of highlights MUST coexist without conflict.
- **FR-007**: Key highlights sourced from ChordFinder MUST be cleared independently from manually-pressed keys (releasing a ChordFinder chord does not clear manually-held keys, and vice versa). Specifically, if a key is active from both sources and only the ChordFinder source is released, the key MUST remain highlighted due to the active manual press.
- **FR-008**: The highlight synchronization MUST occur within the same animation frame as the chord press/release event, with no perceptible delay.
- **FR-009**: When a new chord is pressed in ChordFinder while a previous chord is still held, the Keyboard MUST atomically clear the previous chord's ChordFinder-sourced highlights and apply the new chord's highlights in the same frame (no intermediate state where both chords are highlighted simultaneously).

### Key Entities

- **DiatonicChord**: A set of up to three MIDI note numbers (root, third, fifth) with an associated octave offset, representing a chord voiced by the ChordFinder.
- **KeyboardHighlightSource**: A logical distinction between highlight origins (manual input vs. ChordFinder) used to support additive, conflict-free visual state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a chord is pressed in ChordFinder, the corresponding keyboard keys are highlighted within one display frame (no perceptible lag).
- **SC-002**: 100% of the chord's notes that fall within the Keyboard's visible range are highlighted; notes outside the range produce no error or visual artifact.
- **SC-003**: Releasing a chord in ChordFinder removes only ChordFinder-sourced highlights; any manually-held keys remain highlighted.
- **SC-004**: The feature introduces no regression to existing ChordFinder CV/gate audio output or Keyboard manual-input behavior.
- **SC-005**: The feature works correctly whether zero, one, or multiple Keyboard modules are present in the patch.

## Clarifications

### Session 2026-04-18

- Q: When a key is pressed both manually and by ChordFinder simultaneously, and the ChordFinder chord is released, what happens to that key's highlight? → A: Key stays highlighted (manual press still active).
- Q: When a new chord is pressed in ChordFinder while a previous chord is still held, what happens to the previous chord's highlights? → A: Previous chord highlights are cleared and replaced by the new chord.

## Assumptions

- The Keyboard module displays a fixed two-octave range; notes outside this range are silently ignored for highlighting purposes.
- A Keyboard module and ChordFinder module in the same patch are considered visually coupled without requiring an explicit patch cable between them — this is a UI-layer concern, not a signal-routing concern.
- The chord note MIDI numbers used for visualization are the same values already computed by ChordFinder for CV output (root, third, fifth at the configured octave).
- Chord highlight state does not need to be persisted across patch save/load; on load all keys start unpressed.
