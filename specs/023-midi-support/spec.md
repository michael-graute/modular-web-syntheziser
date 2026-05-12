# Feature Specification: MIDI Support

**Feature Branch**: `023-midi-support`
**Created**: 2026-05-12
**Status**: Draft
**Input**: User description: "MIDI support. Connect a MIDI device (keyboard, sequencer, studio control) to the application so that the keyboard can be played by a MIDI keyboard. Additionally, enable 'MIDI Learn' so that any knob or button in any component can be assigned to a control change message by turning a knob or hitting a button on the MIDI device."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play Keyboard via MIDI Input (Priority: P1)

A musician connects a MIDI keyboard to their computer and opens the modular synthesizer. Without any special setup, the application detects the MIDI device and routes incoming MIDI note-on/note-off messages to the Keyboard component, allowing them to play the synthesizer in real time using physical keys.

**Why this priority**: This is the core use case — enabling real musical performance input. Without it, the MIDI feature has no practical value for performance.

**Independent Test**: Connect a MIDI keyboard, open the app, press keys on the MIDI keyboard — the synthesizer produces notes matching the played keys, with velocity reflected in loudness or brightness.

**Acceptance Scenarios**:

1. **Given** a MIDI keyboard is connected and detected, **When** the user presses a key on the MIDI keyboard, **Then** the synthesizer produces the corresponding note and the on-screen Keyboard component shows the key as pressed.
2. **Given** a MIDI keyboard is connected, **When** the user releases a key, **Then** the note stops (note-off is respected).
3. **Given** multiple MIDI devices are available, **When** the user opens the MIDI device selector, **Then** all connected MIDI input devices are listed and the user can select one.
4. **Given** no MIDI device is connected, **When** the app loads, **Then** the app functions normally without errors and shows a "No MIDI device connected" status.
5. **Given** a MIDI device is selected, **When** the device is disconnected, **Then** the app gracefully notifies the user and stops processing MIDI input without crashing.

---

### User Story 2 - MIDI Learn for Knobs, Sliders and Buttons (Priority: P2)

A producer using a studio controller (e.g., Arturia BeatStep, Korg nanoKONTROL) wants to map physical knobs, sliders and buttons to parameters in the modular synthesizer. They enable "MIDI Learn" mode, click on a knob in any component, then turn the corresponding physical knob — the mapping is established instantly and the physical control now drives that parameter in real time.

**Why this priority**: This unlocks hands-on physical control of the synthesizer, which dramatically improves workflow and expressiveness. It extends the P1 story from notes to full parameter control.

**Independent Test**: Enable MIDI Learn, click a filter cutoff knob, turn a physical CC knob — the filter cutoff responds to the physical knob from then on, both in real time and after page reload.

**Acceptance Scenarios**:

1. **Given** MIDI Learn mode is active, **When** the user clicks on a knob or button in any component, **Then** that control enters "waiting for MIDI" state with a visible highlight.
2. **Given** a control is waiting for MIDI assignment, **When** the user moves a physical knob or presses a button that sends a CC message, **Then** the control is assigned to that CC number/channel and the highlight resolves to show the assignment.
3. **Given** a CC mapping exists, **When** the physical knob is moved, **Then** the on-screen parameter updates in real time to reflect the incoming CC value.
4. **Given** a CC mapping exists, **When** the user saves the patch, **Then** the MIDI mappings are stored inside that patch file and are fully restored when that same patch is loaded again.
5. **Given** MIDI Learn mode is active, **When** the user presses Escape or clicks a "Cancel" button, **Then** no mapping is made and MIDI Learn mode exits cleanly.
6. **Given** a control already has a CC mapping, **When** the user reassigns it via MIDI Learn, **Then** the old mapping is replaced by the new one.

---

### User Story 3 - View and Manage MIDI Mappings (Priority: P3)

A user wants to review all active MIDI mappings, identify which physical controller is assigned to which parameter, and remove individual mappings or clear all at once.

**Why this priority**: Visibility and management of mappings is essential for complex setups; without it, users cannot clean up accidental assignments or share setups.

**Independent Test**: Open the MIDI mapping overview, see all current assignments listed, delete one — it is immediately removed and the physical control no longer affects that parameter.

**Acceptance Scenarios**:

1. **Given** mappings exist, **When** the user opens the MIDI mapping overview, **Then** each mapping shows the component name, parameter name, CC number, and MIDI channel.
2. **Given** the MIDI mapping overview is open, **When** the user clicks "Delete" on a mapping, **Then** that mapping is removed and the physical control no longer affects the parameter.
3. **Given** mappings exist, **When** the user clicks "Clear All Mappings", **Then** all CC assignments are removed after a confirmation prompt.
4. **Given** the mapping overview is open, **When** there are no mappings, **Then** an informational message indicates that no mappings have been created yet.

---

### Edge Cases

- What happens when two different physical knobs are mapped to the same on-screen control? The most recent mapping wins; the previous one is replaced.
- What happens if the browser does not support Web MIDI API? A clear, non-blocking warning is shown and all other synthesizer functionality continues normally.
- What happens when a MIDI device sends note messages on a channel other than channel 1? All MIDI channels are accepted by default (omni mode), with an option to filter by channel.
- What happens when the user rapidly turns a physical knob and sends many CC messages per second? The interface updates smoothly without audio glitches or dropped frames.
- What happens if a mapped CC number conflicts with an existing MIDI standard (e.g., CC 64 = sustain pedal)? No special handling — all CC numbers are treated equally; the user's mapping takes precedence.
- What happens when the page is reloaded mid-MIDI-Learn session? The pending (unconfirmed) mapping is discarded; confirmed mappings remain persisted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST detect and list all connected MIDI input devices without requiring page reload.
- **FR-002**: The application MUST route incoming MIDI note-on and note-off messages to the Keyboard component to trigger notes, supporting polyphonic input — multiple simultaneous notes MUST all be passed through and trigger independent voices.
- **FR-003**: The application MUST reflect MIDI-triggered key presses visually on the on-screen Keyboard component.
- **FR-004**: The application MUST support MIDI velocity — louder/harder key presses should result in higher velocity values passed to the audio engine.
- **FR-005**: Users MUST be able to select which MIDI input device is active from a device picker located in a dedicated MIDI toolbar displayed at the top or bottom of the canvas, always visible.
- **FR-006**: The application MUST provide a global "MIDI Learn" toggle located in the same MIDI toolbar, always accessible without opening any additional panel or menu.
- **FR-007**: While MIDI Learn is active, clicking any assignable control (knob, button, toggle) MUST place it in a "waiting for assignment" state with clear visual feedback.
- **FR-008**: When a control is waiting for assignment and an incoming CC message is received, the control MUST be permanently assigned to that CC number and MIDI channel.
- **FR-009**: Assigned CC messages MUST drive the target control's value in real time, converting the 0–127 CC range to the control's native value range.
- **FR-010**: All MIDI mappings MUST be saved as part of the patch file — when a patch is saved, its MIDI mappings are saved with it; when a patch is loaded, its MIDI mappings replace the current mappings; when a new empty patch is created, all MIDI mappings are cleared.
- **FR-011**: The application MUST provide a way to view all active MIDI mappings (component, parameter, CC number, channel).
- **FR-012**: Users MUST be able to delete individual MIDI mappings or clear all mappings at once.
- **FR-013**: The application MUST handle MIDI device connect and disconnect events gracefully without crashing.
- **FR-014**: On startup, the application MUST proactively request MIDI access from the browser and display a clear in-app guidance prompt explaining why the permission is needed. If the user denies the permission or the browser does not support MIDI input, the application MUST enter a "MIDI unavailable" state — showing a non-blocking informational message — and continue to function normally without MIDI features.
- **FR-015**: MIDI Learn mode MUST be cancellable (via Escape key or UI button) without creating unintended mappings.

### Key Entities

- **MIDI Device**: A physical or virtual MIDI input source identified by name and ID; has connection state (connected/disconnected).
- **MIDI Mapping**: A persistent association between a MIDI channel + CC number and a specific component parameter; includes the parameter's value range for scaling.
- **MIDI Learn Session**: A transient state during which a single control awaits CC assignment; discarded if cancelled or on page reload before confirmation.
- **Assignable Control**: Any knob, button, slider or toggle within any component that can receive a MIDI CC mapping.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with a connected MIDI keyboard can play notes on the synthesizer within 5 seconds of opening the app, with no manual configuration required beyond device selection.
- **SC-002**: MIDI Learn mapping is completed in under 10 seconds: toggle MIDI Learn → click control → move physical knob → mapping confirmed.
- **SC-003**: All MIDI CC mappings survive a page reload and are fully functional within 3 seconds of the page becoming interactive.
- **SC-004**: The synthesizer continues to respond to on-screen mouse/touch interaction at the same level of performance while MIDI input is active (no measurable latency regression).
- **SC-007**: End-to-end MIDI input latency — from key press on the MIDI device to audible sound from the synthesizer — MUST be under 10 milliseconds under normal operating conditions.
- **SC-005**: 100% of knobs and buttons across all existing components are reachable by MIDI Learn — no component is excluded from mapping.
- **SC-006**: On browsers without MIDI support, 100% of non-MIDI features remain fully functional with no degradation.

## Clarifications

### Session 2026-05-12

- Q: How should the app handle the browser MIDI permission request flow? → A: App requests permission on load; shows in-app guidance prompt; enters a "MIDI unavailable" state if denied or unsupported.
- Q: What is the acceptable end-to-end MIDI input latency? → A: Under 10 milliseconds.
- Q: Where should the MIDI device picker and MIDI Learn toggle live in the UI? → A: Dedicated MIDI toolbar at the top or bottom of the canvas, always visible.
- Q: Should there be a maximum limit on simultaneous CC mappings? → A: No hard limit; mappings are bounded naturally by the number of assignable controls in the patch.
- Q: Should MIDI note input be polyphonic or monophonic? → A: Polyphonic — multiple simultaneous notes all trigger independent voices.

## Assumptions

- The browser's native MIDI access capability is available in the user's environment (Chrome/Edge on desktop). Safari and Firefox do not support this natively as of the spec date; the fallback message covers these cases.
- MIDI channel filtering defaults to "all channels" (omni mode); per-channel filtering is out of scope for this feature but the data model should not preclude it.
- Velocity is passed to the audio engine but how it is used (volume, filter, etc.) depends on the existing Keyboard component's capabilities — no changes to the Keyboard's audio routing are required by this spec.
- The MIDI mapping overview is a modal or panel within the existing UI; no new route or page is needed.
- There is no hard limit on the number of CC mappings a patch can hold; the practical maximum is the total number of assignable controls present in the patch.
- Patch serialization format will be extended to include a `midiMappings` field; backward compatibility with patches saved before this feature is maintained (missing field treated as empty mapping set). Loading a patch that contains no MIDI mappings silently clears any currently active mappings.
