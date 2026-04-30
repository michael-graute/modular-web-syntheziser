# Feature Specification: Mixer Channel Panning

**Feature Branch**: `019-mixer-channel-panning`
**Created**: 2026-05-01
**Status**: Draft
**Input**: User description: "please specify a new feature: Mixer Channel Panning. The 4 channels of the Mixer Component need a knob control for panning (left/right)"

## Overview

The Mixer component currently allows independent volume control for each of its four audio channels. However, all channels are fixed at the stereo center. This feature adds a pan knob to each channel so a musician can position individual sound sources anywhere across the stereo field — from hard left to hard right — giving them the spatial control expected from any mixing workflow.

## Clarifications

### Session 2026-05-01

- Q: How should the master volume fader be handled with the new pan knobs added? → A: Keep current layout unchanged — pan knobs appear as a separate row below the channel volume faders; master volume fader is retained.
- Q: Should panning be applied before or after the channel volume fader in the signal chain? → A: After the fader (signal → fader → pan → bus), matching standard mixing console convention.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Pan a Channel Left or Right (Priority: P1)

A musician has three oscillators feeding into a Mixer. They want the bass on center, a pad on the left, and a lead on the right to create a wide stereo image. They adjust the pan knob on each of the three active Mixer channels and immediately hear the audio shift to the desired position.

**Why this priority**: This is the entire purpose of the feature. Without the ability to move a channel in the stereo field, there is nothing to build on.

**Independent Test**: Connect one audio source to a Mixer channel. Adjust its pan knob fully left and confirm audio is heard only in the left output. Adjust fully right and confirm audio is heard only in the right output. Set to center and confirm equal levels on both sides.

**Acceptance Scenarios**:

1. **Given** a Mixer channel with an audio source connected, **When** the user moves the pan knob to the full-left position, **Then** the channel's audio is heard exclusively in the left output channel.
2. **Given** a Mixer channel with an audio source connected, **When** the user moves the pan knob to the full-right position, **Then** the channel's audio is heard exclusively in the right output channel.
3. **Given** a Mixer channel with the pan knob at center, **When** audio plays, **Then** the signal is distributed equally to both left and right output channels.
4. **Given** all four channels have audio sources, **When** each channel's pan knob is set to a different position, **Then** each channel pans independently without affecting the others.

---

### User Story 2 — Pan Position Persisted with Patch (Priority: P2)

A musician has spent time crafting a stereo mix with specific pan positions on all four channels. They save the patch and later reload it. All four pan knobs are restored exactly where they were left.

**Why this priority**: Without persistence, every session requires re-dialing the stereo image from scratch, breaking the workflow. This story is a natural extension of P1 and shares its implementation path.

**Independent Test**: Set unique pan positions on all four channels, save the patch, reload it, and verify each channel's pan knob restores to its saved value.

**Acceptance Scenarios**:

1. **Given** each Mixer channel has a distinct pan position, **When** the patch is saved and reloaded, **Then** all four pan knob positions are restored exactly.
2. **Given** an older patch saved before this feature existed (no pan data), **When** it is loaded, **Then** all four channels default to center pan without error.

---

### User Story 3 — Visual Pan Position Indicator (Priority: P3)

A musician glances at the Mixer component and can immediately read the pan position of each channel from the knob angle without having to move it. The knob at center points straight up; left of center leans left; right of center leans right.

**Why this priority**: Standard synthesizer ergonomics — the pan knob's visual angle should unambiguously communicate position. Useful for live performance and complex patches where reading state quickly matters. Lower priority because the feature still works correctly without it (the sound is accurate regardless of the indicator).

**Independent Test**: Set a channel pan to full-left, full-right, and center. Verify the knob indicator angle visually matches the described positions in each case.

**Acceptance Scenarios**:

1. **Given** a pan knob set to center (0), **When** rendered, **Then** the knob indicator points straight up (12 o'clock position).
2. **Given** a pan knob set to full-left, **When** rendered, **Then** the knob indicator points to the left-most stop (approximately 7 o'clock).
3. **Given** a pan knob set to full-right, **When** rendered, **Then** the knob indicator points to the right-most stop (approximately 5 o'clock).

---

### Edge Cases

- What happens when a Mixer channel has no audio source connected and its pan knob is moved? The knob position is stored and applied when a source is later connected — no error.
- What happens if the user sets pan while the master volume fader is at zero? Pan is stored and applied correctly; the silence is a volume issue, not a pan issue.
- What happens when a very large number of parameter changes happen rapidly (knob scrubbing)? Each change applies smoothly without clicks or dropouts.
- What happens when an exported patch JSON is imported on another browser? Pan values are preserved as numeric data and restore identically.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each of the four Mixer channels MUST have an independent pan knob that controls the stereo position of that channel's audio output.
- **FR-002**: Pan knob range MUST be from full-left (−1.0) to full-right (+1.0) with center (0.0) as the default value.
- **FR-003**: Moving a channel's pan knob MUST immediately update the perceived stereo position of that channel's audio without audible clicks or dropouts.
- **FR-004**: Pan controls for each channel MUST operate independently — adjusting one channel's pan MUST NOT affect any other channel.
- **FR-005**: Each channel's pan value MUST be saved as part of the patch and restored when the patch is loaded.
- **FR-006**: Patches saved before this feature existed MUST load without errors, with all four channels defaulting to center pan (0.0).
- **FR-007**: The pan knob for each channel MUST be visually present in the Mixer component's control area in a dedicated pan row rendered below the existing channel volume faders. The master volume fader and all existing fader controls remain unchanged.
- **FR-008**: Pan law MUST apply equal-power panning so that centered audio does not appear louder than panned audio (no center-panning boost).
- **FR-009**: The pan stage MUST be positioned after the channel volume fader in the signal chain (signal → fader → pan → stereo bus), matching standard mixing console convention.

### Key Entities

- **Channel Pan**: A per-channel numeric value in the range [−1.0, +1.0] representing stereo position. Default is 0.0 (center). Persisted with the patch as part of each channel's parameter set.
- **Stereo Panner**: The audio processing element applied to each channel that distributes signal between left and right outputs according to the pan value.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A musician can set all four channel pan positions in under 30 seconds — verified by timed task observation.
- **SC-002**: Panned audio reaches the expected output channel (left or right) with no audible bleed into the opposite channel at the full-left and full-right positions.
- **SC-003**: Pan positions for all four channels save and restore correctly in 100% of patch round-trip tests.
- **SC-004**: Older patches without pan data load without errors and default all channels to center pan in 100% of cases.
- **SC-005**: Rapid pan knob adjustments (≥ 20 value changes per second sustained over 2 seconds) produce no audible clicks or dropouts — verified by manual scrubbing test in the browser.

## Assumptions

- Pan is a stereo-only control; mono-to-stereo spreading is handled by the existing audio output pipeline.
- The Mixer component currently outputs a stereo signal via the Web Audio API's destination node; per-channel stereo panning slots into this existing architecture without requiring output-port changes.
- Pan law: equal-power (cosine) panning is preferred over linear panning to maintain consistent perceived loudness across the stereo field.
- The Mixer component UI has per-channel volume faders; pan knobs are added as a second row below the faders. The master volume fader is retained. Component canvas height will need to increase to accommodate the additional pan row.
- The default pan for all channels is center (0.0), matching the behavior before this feature was introduced.
