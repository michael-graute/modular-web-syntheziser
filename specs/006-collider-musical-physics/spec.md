# Feature Specification: Collider Musical Physics Utility

**Feature Branch**: `006-collider-musical-physics`
**Created**: 2025-11-07
**Status**: Draft
**Input**: User description: "New feature: A "Collider" utility. This utility should work as follows: After a user dropped the component to the canvas he can choose a scale type from a list (major, harmonic minor, natural minor, lydian, mixolydia, ...) as well as a root note. He can also choose the number of available colliders. As soon as he clicks the start button, the colliders appear at random points inside a defined area in the component and start moving in random directions. Each collider has a random note of the selected scale assigned and as soon as the collider hits a wall or another collider the note will be outputted as a cv frequency. The collider will then rebound the same way a pool ball would do."

## Clarifications

### Session 2025-11-07

- Q: When a collider triggers a note output on collision, how long should the CV frequency be held? → A: The duration should be set by the user by setting a BPM (default 120) and a gate size (1, 1/2, 1/4, 1/8, 1/16 note)
- Q: Should collisions have visual feedback (e.g., color flash, size pulse) when they occur and trigger a note? → A: Visual feedback on collision - brief flash/pulse effect when note triggers
- Q: How should notes be assigned to colliders from the selected scale? → A: Weighted random - certain scale degrees (tonic, fifth) appear more frequently for tonal center emphasis
- Q: Should the collider configuration (scale, root note, count, speed, BPM, gate size) be saved and restored when the user closes and reopens the project? → A: Save configuration - restore all settings when project reopens, following existing persistence pattern
- Q: What should be the minimum and maximum allowed BPM values? → A: 30 BPM min, 300 BPM max

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Collider Setup and Playback (Priority: P1)

A user wants to create a musical physics simulation by placing a Collider component on their canvas, configuring the scale and number of colliders, then starting the simulation to hear notes triggered by collisions.

**Why this priority**: This is the core functionality - without the ability to configure and run a basic collider simulation, the feature has no value. This represents the minimum viable product.

**Independent Test**: Can be fully tested by placing the component, selecting any scale (e.g., C Major), setting collider count to 3, clicking start, and verifying that notes are output as CV voltages when collisions occur. Delivers immediate musical value.

**Acceptance Scenarios**:

1. **Given** the Collider component has been placed on the canvas, **When** the user opens the configuration panel, **Then** they see options for scale type selection, root note selection, collider count input, speed preset selection (slow/medium/fast), BPM setting, and gate size selection (1, 1/2, 1/4, 1/8, 1/16 note)
2. **Given** the user has selected "Major" scale, "C" as root note, and "5" colliders, **When** they click the start button, **Then** 5 colliders appear at random positions within the component area
3. **Given** the simulation is running, **When** a collider hits a wall boundary, **Then** the collider's assigned note is output as a CV frequency and the collider rebounds at the correct angle
4. **Given** the simulation is running, **When** two colliders collide with each other, **Then** both colliders output their assigned notes as CV frequencies and both rebound appropriately

---

### User Story 2 - Scale and Root Note Configuration (Priority: P2)

A user wants to experiment with different musical scales and root notes to create varied melodic patterns from the collision physics.

**Why this priority**: This enhances the musical versatility of the feature but the simulation can work with a single scale. Adding multiple scale options significantly increases creative possibilities.

**Independent Test**: Can be tested by configuring the component with different scales (Major, Harmonic Minor, Natural Minor, Lydian, Mixolydian) and different root notes (C, D, E, F, G, A, B), then verifying that the output CV voltages match the expected notes for each scale.

**Acceptance Scenarios**:

1. **Given** the configuration panel is open, **When** the user clicks the scale type dropdown, **Then** they see a list including at minimum: Major, Harmonic Minor, Natural Minor, Lydian, and Mixolydian
2. **Given** the configuration panel is open, **When** the user clicks the root note selector, **Then** they see all 12 chromatic notes (C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
3. **Given** the user has selected "Lydian" scale with root note "D", **When** they start the simulation, **Then** all collider notes are from the D Lydian scale (D, E, F#, G#, A, B, C#)
4. **Given** the simulation is running, **When** the user attempts to change the scale or root note, **Then** the system prevents the change and requires the user to stop the simulation first

---

### User Story 3 - Collider Count Control (Priority: P3)

A user wants to adjust the density and complexity of the collision patterns by controlling the number of active colliders.

**Why this priority**: Variable collider count affects the complexity and frequency of collisions, but a fixed default number would still provide value. This is an enhancement for fine-tuning the experience.

**Independent Test**: Can be tested by setting different collider counts (1, 5, 10, 20) and verifying that the correct number appears and all colliders function properly regardless of density.

**Acceptance Scenarios**:

1. **Given** the configuration panel is open, **When** the user inputs a collider count, **Then** the system accepts values between 1 and 20 (inclusive) and rejects values outside this range
2. **Given** the user has set collider count to 10, **When** they start the simulation, **Then** exactly 10 colliders appear, each with a randomly assigned note from the selected scale
3. **Given** the simulation is running with many colliders, **When** multiple collisions happen simultaneously, **Then** all collision events output their respective CV frequencies without missing any events

---

### User Story 4 - Visual Physics Simulation (Priority: P1)

A user wants to see the colliders moving and bouncing visually to understand the physics driving the musical output.

**Why this priority**: Visual feedback is essential for understanding and controlling the musical patterns. Without it, users cannot meaningfully interact with the system.

**Independent Test**: Can be tested by starting a simulation and observing that colliders are visible, move continuously, and their bounce behavior matches expectations (angle of incidence equals angle of reflection).

**Acceptance Scenarios**:

1. **Given** the simulation has started, **When** colliders are initialized, **Then** each collider is visually represented within the component boundary
2. **Given** colliders are moving, **When** a collider approaches a wall, **Then** the visual representation shows smooth continuous motion until impact
3. **Given** a collider hits a wall at an angle, **When** the collision occurs, **Then** the collider visually rebounds with angle of reflection equal to angle of incidence (pool ball physics) and displays a brief visual feedback effect (flash/pulse)
4. **Given** two colliders collide, **When** the collision occurs, **Then** both colliders visually rebound according to elastic collision physics and both display a brief visual feedback effect (flash/pulse)

---

### User Story 5 - Speed Preset Control (Priority: P3)

A user wants to control the tempo and pacing of the musical output by adjusting the speed at which colliders move.

**Why this priority**: Speed control affects the rate of collisions and thus the tempo of the musical output, but a sensible default speed would still provide value. This is an enhancement for fine-tuning the musical character.

**Independent Test**: Can be tested by setting the speed to slow, medium, and fast presets and verifying that colliders move at noticeably different speeds and that collision frequency changes accordingly.

**Acceptance Scenarios**:

1. **Given** the configuration panel is open, **When** the user views the speed preset selector, **Then** they see three options: Slow, Medium, and Fast
2. **Given** the user has selected "Slow" speed preset, **When** they start the simulation, **Then** colliders move at a leisurely pace suitable for sparse, meditative musical patterns
3. **Given** the user has selected "Fast" speed preset, **When** they start the simulation, **Then** colliders move rapidly, creating frequent collisions and dense musical output
4. **Given** the simulation is running, **When** the user attempts to change the speed preset, **Then** the system prevents the change and requires the user to stop the simulation first

---

### User Story 6 - Timing and Note Duration Control (Priority: P2)

A user wants to control the rhythmic character of the musical output by setting the tempo (BPM) and note duration (gate size) for collision-triggered notes.

**Why this priority**: Timing control is essential for musical integration with other components and for creating rhythmically coherent patterns. This elevates the feature from random note generation to musically useful output.

**Independent Test**: Can be tested by configuring different BPM values (60, 120, 180) and gate sizes (1/16, 1/4, 1 note), triggering collisions, and measuring that output gate durations match the calculated values based on BPM and gate size.

**Acceptance Scenarios**:

1. **Given** the configuration panel is open, **When** the user views the timing controls, **Then** they see a BPM input field (default 120) and a gate size selector with options: 1, 1/2, 1/4, 1/8, 1/16 note
2. **Given** the user has set BPM to 120 and gate size to 1/4 note, **When** a collision occurs, **Then** the CV output gate is held for 500ms (duration of a quarter note at 120 BPM)
3. **Given** the user has set BPM to 60 and gate size to 1/16 note, **When** a collision occurs, **Then** the CV output gate is held for 62.5ms (duration of a sixteenth note at 60 BPM)
4. **Given** the simulation is running, **When** the user attempts to change BPM or gate size, **Then** the system prevents the change and requires the user to stop the simulation first

---

### User Story 7 - Configuration Persistence (Priority: P2)

A user wants their Collider component configuration to be automatically saved and restored when they save and reopen their project, so they don't have to reconfigure settings every time.

**Why this priority**: Configuration persistence is essential for professional workflow and consistent with other components in the system. Without it, users lose their work and must recreate settings, which is frustrating and time-consuming.

**Independent Test**: Can be tested by configuring a Collider component with specific settings (e.g., Lydian scale, F# root, 15 colliders, fast speed, 140 BPM, 1/8 gate), saving the project, closing and reopening it, then verifying all settings are restored exactly as configured.

**Acceptance Scenarios**:

1. **Given** a Collider component has been configured with custom settings, **When** the user saves the project, **Then** all configuration values (scale type, root note, collider count, speed preset, BPM, gate size) are persisted to storage
2. **Given** a project with a configured Collider component has been saved, **When** the user closes and reopens the project, **Then** all configuration settings are restored to their saved values
3. **Given** a Collider component is newly placed on the canvas, **When** no saved configuration exists, **Then** the component initializes with default values (Major scale, C root, 5 colliders, Medium speed, 120 BPM, 1/4 gate)

---

### Edge Cases

- What happens when the collider count is set to 1 (minimum density)?
- What happens when many colliders are configured and they all initialize in close proximity, causing immediate multiple collisions?
- How does the system handle rapid successive collisions of the same collider (bouncing in a corner)? **ANSWER**: Position correction with epsilon (0.01 pixels) prevents stuck colliders. Each collision is resolved independently per frame. Collision events are queued and processed sequentially within the same animation frame, with all audio triggers scheduled at the same timestamp to maintain temporal accuracy.
- What happens when the user tries to change configuration while the simulation is running?
- How does the simulation behave if the component is resized while running?
- What happens when a collider collides with another collider at exactly the same moment it hits a wall?
- How does the system ensure colliders don't get stuck overlapping after a collision?
- What happens if the user selects an invalid collider count (0, negative, or extremely large)?
- What happens if the user enters an invalid BPM value (below 30 or above 300)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a configuration interface accessible after the Collider component is placed on the canvas
- **FR-002**: System MUST support scale type selection from at minimum: Major, Harmonic Minor, Natural Minor, Lydian, and Mixolydian scales
- **FR-003**: System MUST allow root note selection from all 12 chromatic notes (C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
- **FR-004**: System MUST allow users to specify the number of colliders via numerical input
- **FR-004a**: System MUST provide a speed preset selector with three options: Slow, Medium, and Fast
- **FR-004b**: System MUST provide a BPM (beats per minute) setting with a default value of 120 and valid range of 30-300 BPM
- **FR-004c**: System MUST provide a gate size selector with options: 1 (whole note), 1/2 (half note), 1/4 (quarter note), 1/8 (eighth note), and 1/16 (sixteenth note)
- **FR-005**: System MUST initialize all colliders at random non-overlapping positions within the component boundary when simulation starts
- **FR-005a**: System MUST handle position generation failure when collision boundary is too small for the requested collider count, attempting up to 100 position placements before displaying error message: "Cannot fit {count} colliders in current boundary. Reduce collider count or increase component size."
- **FR-006**: System MUST assign each collider a note from the selected scale using weighted random distribution, where the tonic (root note) and fifth scale degree appear more frequently to emphasize tonal center
- **FR-007**: System MUST move colliders continuously in their assigned directions at a velocity determined by a user-selected speed preset (slow, medium, or fast)
- **FR-008**: System MUST detect collisions between colliders and the boundary walls
- **FR-009**: System MUST detect collisions between pairs of colliders
- **FR-010**: System MUST output the collider's assigned note as a CV voltage value whenever that collider collides with a wall, with gate duration calculated from BPM and gate size settings
- **FR-011**: System MUST output the collider's assigned note as a CV voltage value whenever that collider collides with another collider, with gate duration calculated from BPM and gate size settings
- **FR-012**: System MUST calculate reflection angles for wall collisions using the principle that angle of incidence equals angle of reflection
- **FR-013**: System MUST calculate collision responses between colliders using elastic collision physics (momentum and energy conservation)
- **FR-014**: System MUST provide visual representation of all active colliders
- **FR-014a**: System MUST display a visual feedback effect (flash or pulse) on a collider when it collides with a wall or another collider, with initial opacity of 0.3 and linear decay over 300ms duration
- **FR-015**: System MUST provide visual representation of the collision boundary area
- **FR-016**: System MUST provide a start button to initiate the simulation
- **FR-017**: System MUST provide a way to stop the simulation
- **FR-018**: System MUST prevent configuration changes (scale type, root note, collider count, speed preset, BPM, gate size) during an active simulation (require stop first)
- **FR-019**: System MUST maintain collision boundary proportional to component size
- **FR-020**: System MUST validate collider count input and reject invalid values (zero, negative, or exceeding maximum)
- **FR-020a**: System MUST validate BPM input and reject values outside the range of 30-300 BPM
- **FR-021**: System MUST persist all configuration settings (scale type, root note, collider count, speed preset, BPM, gate size) using the existing PatchSerializer mechanism
- **FR-022**: System MUST restore all persisted configuration settings when a project is reopened

### Key Entities

- **Collider**: A moving object within the simulation that represents a musical note. Key attributes include: position (x, y coordinates), velocity (direction and speed), assigned musical note (from selected scale using weighted random distribution favoring tonic and fifth), visual representation (size, appearance).

- **Musical Scale**: A set of notes defined by the scale type and root note. Contains the available notes that can be assigned to colliders (e.g., C Major contains C, D, E, F, G, A, B).

- **Collision Boundary**: The rectangular area within the component where colliders can move. Has defined walls (top, bottom, left, right) that colliders bounce off.

- **CV Output**: A control voltage value representing a musical note, output when a collision occurs. Relates to the collider's assigned note. Gate duration is determined by the BPM setting and gate size (note length) selection.

- **Timing Configuration**: Controls the rhythmic properties of note outputs. Key attributes include: BPM (beats per minute, default 120), gate size (note length: 1, 1/2, 1/4, 1/8, or 1/16 note duration).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure and start a basic collider simulation in under 30 seconds
- **SC-002**: System accurately outputs CV voltages corresponding to the correct musical notes from the selected scale 100% of the time
- **SC-003**: Collision detection triggers note output with average latency <8ms and 95th percentile <16ms from collision event to AudioParam scheduling (measured via performance.now() timestamps in collision handler and audio trigger method)
- **SC-004**: Physics simulation maintains stable performance with up to the maximum supported number of colliders without frame drops below 30fps
- **SC-005**: Collision reflection angles are physically accurate within 2 degrees of the mathematically correct angle
- **SC-006**: Visual representation updates smoothly with collider positions at minimum 30 frames per second
- **SC-007**: Users can successfully change between different scales and root notes and hear the resulting melodic differences within 5 seconds of making the change
- **SC-008**: Zero colliders get stuck or exhibit non-physical behavior (overlap without collision, pass through walls, etc.) during normal operation
- **SC-009**: All configuration settings are successfully persisted and restored with 100% accuracy when a project is saved and reopened

## Assumptions

- The component follows the existing canvas component pattern used in the codebase (similar to LFO and other utilities)
- CV voltage output follows the existing voltage standards used in the application (1V/octave)
- Speed presets correspond to approximate velocities: Slow (~30-50 px/s), Medium (~70-100 px/s), Fast (~120-150 px/s)
- The maximum number of colliders is 20 (balance between musical complexity and performance)
- The minimum number of colliders is 1
- Collider visualization will use the existing CanvasComponent rendering capabilities
- The simulation runs in real-time using requestAnimationFrame or similar timing mechanism
- Configuration changes require stopping the simulation first (not real-time parameter changes)
- Colliders are treated as circles for collision detection (simplest collision geometry)
- All colliders have the same size and mass (simplified physics model)
- The component includes start/stop buttons following existing UI patterns in the application
- Default configuration values: Major scale, C root note, 5 colliders, Medium speed, 120 BPM, 1/4 gate size
- Weighted note distribution uses approximately 2x frequency for tonic and fifth compared to other scale degrees
- Configuration persistence uses the existing PatchSerializer/PatchStorage pattern established in the codebase
