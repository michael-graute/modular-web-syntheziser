# Feature Specification: LFO Runtime Toggle

**Feature Branch**: `005-lfo-runtime-toggle`
**Created**: 2025-11-07
**Status**: Draft
**Input**: User description: "new feature that allows the user to turn LFOs on and of during runtime: The LFO component should have a on/off button in the header (similar to effects) that enables the user to switch the LFO modulation on and off"

## Clarifications

### Session 2025-11-07

- Q: When a new LFO is created, what should its initial on/off state be? → A: Enabled by default (LFO starts modulating immediately upon creation)
- Q: When an LFO is toggled off while actively modulating mid-cycle, what should happen to the modulated parameter value? → A: Hold at current value (parameter stays at whatever value it had when toggle occurred)
- Q: How should the system handle rapid toggling (clicking on/off repeatedly in quick succession)? → A: Process all toggle events (each click is honored, state changes for every click)
- Q: When an LFO is toggled back on after being disabled, should its phase/cycle position reset or continue from where it would have been? → A: Continue phase (LFO internal clock keeps running, resumes from current phase position)
- Q: When an LFO is disabled, should the entire LFO component UI have a distinct visual treatment beyond just the on/off button? → A: Entire component dimmed/reduced opacity when disabled (visually de-emphasized while still readable)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Toggle LFO Modulation (Priority: P1)

A user is working with a synthesizer or audio effect that has LFO modulation applied to one or more parameters. During playback or while adjusting sounds, they want to quickly enable or disable the LFO's modulation effect without removing or reconfiguring the LFO settings. This allows them to compare the sound with and without modulation, or to temporarily disable modulation during certain parts of their performance or composition.

**Why this priority**: This is the core functionality - the ability to toggle LFO on/off at runtime. Without this, the feature has no value. It enables immediate A/B comparison and performance control.

**Independent Test**: Can be fully tested by clicking the on/off button in the LFO component header and observing that modulation starts/stops while preserving all LFO settings (rate, depth, waveform, etc.).

**Acceptance Scenarios**:

1. **Given** an LFO component with modulation currently active, **When** the user clicks the off button in the LFO header, **Then** the LFO modulation stops affecting the target parameter(s) immediately
2. **Given** an LFO component with modulation currently disabled, **When** the user clicks the on button in the LFO header, **Then** the LFO modulation resumes affecting the target parameter(s) immediately
3. **Given** an LFO with specific settings (rate, depth, waveform), **When** the user toggles it off and then on again, **Then** all LFO settings remain unchanged and modulation resumes with the same configuration
4. **Given** an LFO component is toggled off, **When** the user adjusts LFO parameters (rate, depth, etc.), **Then** the changes are stored but not applied until the LFO is toggled back on

---

### User Story 2 - Visual State Indication (Priority: P2)

A user needs to quickly understand whether an LFO is currently active or disabled by looking at the interface. The on/off button and potentially the LFO component itself should provide clear visual feedback about the current state.

**Why this priority**: Clear visual feedback is essential for usability, especially when working with multiple LFOs or during live performance. However, the feature can function without enhanced visuals, making this secondary to the core toggle functionality.

**Independent Test**: Can be tested by observing the visual state of the on/off button and LFO component in both enabled and disabled states, verifying that the difference is immediately apparent.

**Acceptance Scenarios**:

1. **Given** an LFO is active, **When** the user views the LFO component, **Then** the on/off button displays a clear "on" state and the component appears at full visibility
2. **Given** an LFO is disabled, **When** the user views the LFO component, **Then** the on/off button displays a clear "off" state and the entire component is dimmed/reduced opacity while remaining readable
3. **Given** multiple LFO components are visible, **When** some are enabled and some disabled, **Then** each component's state is independently and clearly indicated through both button state and component opacity

---

### User Story 3 - State Persistence (Priority: P3)

A user toggles an LFO off during their work session, closes the application or switches projects, and then returns. The LFO's on/off state should be preserved along with all other settings.

**Why this priority**: State persistence improves workflow continuity, but users can manually toggle LFOs again after reopening a project if needed. This is a quality-of-life enhancement rather than core functionality.

**Independent Test**: Can be tested by toggling an LFO off, saving/closing the project, reopening it, and verifying the LFO remains in the off state.

**Acceptance Scenarios**:

1. **Given** an LFO is toggled off, **When** the user saves their project and reopens it, **Then** the LFO remains in the off state
2. **Given** multiple LFOs with different on/off states, **When** the user saves and reopens the project, **Then** each LFO's individual on/off state is preserved

---

### Edge Cases

- When an LFO is toggled off while actively modulating a parameter mid-cycle, the modulated parameter holds at its current value (no abrupt jumps or returns to base value)
- Rapid toggling (clicking on/off repeatedly in quick succession) processes all toggle events, with each click honored and state changing for every click
- What happens when an LFO component is toggled off while the user is editing its parameters?
- If multiple LFOs are routed to the same parameter, what happens when some are on and some are off?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an on/off button in the LFO component header
- **FR-002**: The on/off button MUST allow users to enable or disable LFO modulation during runtime without removing the LFO configuration
- **FR-012**: System MUST process all toggle events independently, honoring each user click even during rapid successive toggling
- **FR-011**: Newly created LFOs MUST start in the enabled state by default
- **FR-003**: System MUST immediately stop applying LFO modulation to target parameter(s) when the LFO is toggled off, holding the parameter at its current value
- **FR-004**: System MUST immediately resume applying LFO modulation to target parameter(s) when the LFO is toggled on, continuing from the current phase position as if the LFO internal clock never stopped
- **FR-005**: System MUST preserve all LFO settings (rate, depth, waveform, targets, etc.) when toggling between on and off states
- **FR-013**: System MUST maintain the LFO's internal phase clock continuously, even when toggled off, so re-enabling continues from the current phase position
- **FR-006**: System MUST provide clear visual indication of whether an LFO is currently enabled or disabled
- **FR-014**: System MUST dim or reduce opacity of the entire LFO component when disabled, while keeping all controls readable and accessible
- **FR-007**: The on/off button design and behavior MUST be consistent with the existing effects on/off toggle pattern
- **FR-008**: System MUST persist the on/off state when saving and loading projects
- **FR-009**: System MUST allow parameter adjustments to disabled LFOs, with changes taking effect when the LFO is re-enabled
- **FR-010**: System MUST handle smooth transition when toggling LFO state to prevent audio clicks or pops

### Key Entities

- **LFO Component**: Represents a Low Frequency Oscillator with configurable parameters (rate, depth, waveform, etc.) and a runtime on/off state
  - Attributes: enabled/disabled state, rate, depth, waveform, phase, target parameter routing
  - Relationships: routes to one or more modulation targets (audio parameters)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can toggle LFO modulation on/off with a single click, with the change taking effect within 10 milliseconds
- **SC-002**: Users can distinguish between enabled and disabled LFO states within 1 second of viewing the interface
- **SC-003**: 100% of LFO settings are preserved across on/off state changes
- **SC-004**: Project files correctly save and restore LFO on/off states with 100% accuracy
- **SC-005**: No audible clicks, pops, or artifacts occur when toggling LFO state during audio playback

## Assumptions

- The application already has an LFO component with a header section
- The application has an existing effects on/off toggle pattern that can be referenced for consistent design
- The application has a project save/load system that can accommodate additional state information
- LFO modulation targets are audio parameters that can have their modulation dynamically enabled/disabled
- The audio engine supports graceful handling of modulation state changes to prevent artifacts
