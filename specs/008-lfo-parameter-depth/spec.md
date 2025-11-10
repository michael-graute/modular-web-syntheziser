# Feature Specification: Parameter-Aware LFO Depth

**Feature Branch**: `008-lfo-parameter-depth`
**Created**: 2025-11-10
**Status**: Draft
**Input**: User description: "Calculate LFO depth on basis of connected target parameter. When an LFO is connected to a parameter, the depth should mirror the min and max values of the parameter. Example: If an LFO is connected to a frequency parameter with min=1000 and max=15000, the base value of the parameter is set to 7000 and the depth of the LFO is set to 50% the parameter should alternate between 3500 and 10500"

## Clarifications

### Session 2025-11-10

- Q: When base value is near a boundary, how should depth percentage be applied in asymmetric cases? → A: Apply depth as percentage of maximum available range in each direction independently (e.g., 50% depth at base=14000: down=50% of 13000=6500, up=50% of 1000=500, results in 7500-14500)
- Q: Can a single LFO modulate multiple parameters simultaneously, each with independent depth settings? → A: Yes but shared depth - one LFO can modulate multiple parameters but all use the same depth value
- Q: How does LFO modulation combine with the parameter's base value - is it additive or does it replace the base value? → A: Additive - LFO output is added to the base value (current = base + LFO_modulation_amount)
- Q: Where should the modulation range feedback be displayed? → A: Directly on the depth control UI element itself (tooltip, label, or adjacent display)
- Q: When multiple LFOs modulate the same parameter, how are their modulation amounts combined? → A: Prevent connections of multiple LFOs to one parameter

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Parameter-Aware Modulation (Priority: P1)

A sound designer connects an LFO to a frequency parameter and sets the depth to 50%. The system automatically calculates the modulation range based on the parameter's min/max bounds and the current base value, ensuring the output stays within valid limits. This story focuses on symmetric modulation where the base value is centered in the parameter range, allowing equal modulation in both directions.

**Why this priority**: This is the core functionality - without this, the feature doesn't exist. It delivers immediate value by making LFO depth intuitive and parameter-aware.

**Independent Test**: Can be fully tested by connecting an LFO to any parameter with defined min/max bounds, setting a depth percentage, and verifying the modulated output range matches expected values. Delivers value by preventing out-of-range modulation.

**Acceptance Scenarios**:

1. **Given** an LFO is connected to a frequency parameter (min=1000, max=15000), the parameter's base value is 7000, and the LFO depth is set to 50%, **When** the LFO oscillates, **Then** the parameter value alternates between 3500 (7000 - 3500) and 10500 (7000 + 3500)

2. **Given** an LFO is connected to a filter cutoff parameter (min=20, max=20000), the base value is 5000, and the depth is 100%, **When** the LFO reaches its minimum, **Then** the parameter value is 20 (not negative)

3. **Given** an LFO is connected to a volume parameter (min=0, max=1), the base value is 0.5, and the depth is 50%, **When** the LFO oscillates, **Then** the parameter value ranges from 0.25 to 0.75

---

### User Story 2 - Asymmetric Range Handling (Priority: P2)

A user sets a parameter's base value near one boundary (e.g., base=14000 on a 1000-15000 range) and applies 50% depth. The system adapts the modulation range asymmetrically to respect parameter bounds, applying the depth percentage independently to the available range in each direction (upward: base to max, downward: min to base) as clarified in Session 2025-11-10.

**Why this priority**: Handles real-world scenarios where users set base values near boundaries. Without this, modulation would be limited or produce unexpected results.

**Independent Test**: Can be tested by setting base values near min/max boundaries and verifying modulation uses maximum available range on each side. Delivers value by maximizing usable modulation range.

**Acceptance Scenarios**:

1. **Given** a parameter with min=1000 and max=15000, base value is 14000, and LFO depth is 50%, **When** the LFO oscillates, **Then** the parameter ranges from 7500 (14000 - 50% of 13000 downward range = 14000 - 6500) to 14500 (14000 + 50% of 1000 upward range = 14000 + 500)

2. **Given** a parameter with min=0 and max=1, base value is 0.1, and depth is 50%, **When** the LFO reaches minimum, **Then** the value is clamped to 0 (not negative)

---

### User Story 3 - Depth Adjustment Feedback (Priority: P3)

When a user adjusts the depth parameter on the LFO's depth control, they receive immediate visual or numerical feedback directly on or adjacent to the control showing the actual modulation range that will be applied to each connected parameter (e.g., "3500-10500" or "±3500").

**Why this priority**: Improves user experience by making the calculated range transparent at the point of interaction, but the core functionality works without it.

**Independent Test**: Can be tested by adjusting depth values on the depth control UI element and observing displayed range indicators appearing on or near the control. Delivers value by reducing trial-and-error experimentation.

**Acceptance Scenarios**:

1. **Given** an LFO is connected to a parameter with base value 7000 (range 1000-15000), **When** the user adjusts depth from 0% to 100%, **Then** the system displays the effective modulation range updating in real-time (0%: "7000-7000", 50%: "3500-10500", 100%: "1000-15000")

2. **Given** a parameter with base value near a boundary, **When** depth is adjusted, **Then** the displayed range shows asymmetric values that respect parameter bounds

---

### Edge Cases

- What happens when the parameter's base value equals its minimum or maximum (no room to modulate in one direction)?
- How does the system handle parameters with very small ranges (e.g., min=0.001, max=0.002)?
- What occurs when the parameter's min equals max (zero range)?
- How does the system behave if the base value is somehow set outside the parameter's valid range?
- What happens when the user changes the parameter's base value while modulation is active?
- How does the system handle negative parameter ranges (e.g., min=-100, max=100)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST calculate LFO modulation range based on the target parameter's minimum and maximum bounds
- **FR-002**: System MUST use the parameter's current base value as the center point for modulation calculations
- **FR-003**: System MUST scale the modulation amount according to the LFO's depth setting (0-100%)
- **FR-004**: System MUST clamp modulated values to never exceed the parameter's defined min/max bounds
- **FR-005**: System MUST support symmetric modulation when the base value allows equal range in both directions
- **FR-006**: System MUST support asymmetric modulation when the base value is near a boundary, applying depth percentage independently to the available range in each direction (upward: base to max, downward: min to base)
- **FR-007**: System MUST recalculate modulation range dynamically when the parameter's base value changes
- **FR-008**: System MUST handle edge cases where base value equals min or max (unidirectional modulation)
- **FR-009**: System MUST handle parameters with negative ranges (e.g., min=-10, max=10)
- **FR-010**: System MUST prevent modulation when parameter min equals max (zero range)
- **FR-011**: System MUST allow a single LFO to modulate multiple parameters simultaneously, applying the same depth percentage to all connections
- **FR-012**: System MUST apply LFO modulation additively to the parameter's base value (currentValue = baseValue + modulationAmount)
- **FR-013**: System MUST enforce that each parameter can only be modulated by at most one LFO at a time (attempting to connect a second LFO should either replace the existing connection or be rejected)

### Key Entities *(include if feature involves data)*

- **Parameter**: Represents a controllable value with defined minimum and maximum bounds, a current base value, and the ability to receive modulation from external sources
  - Attributes: min, max, baseValue (user-set center point), currentValue (baseValue + modulation)
  - Relationships: Can be modulated by at most one LFO at a time
  - Cardinality: 1 parameter : 0..1 LFO (1:0..1), exclusive modulation connection
  - Behavior: currentValue is recalculated each processing cycle by adding the single LFO's modulation to baseValue, then clamping to [min, max]

- **LFO (Low Frequency Oscillator)**: A modulation source that generates periodic waveforms
  - Attributes: frequency, waveform shape, depth (percentage), output value (-1 to +1)
  - Relationships: Can modulate one or more parameters simultaneously using a single shared depth value
  - Cardinality: 1 LFO : N parameters (1:N), all connections share the LFO's depth setting

- **ModulationConnection** (Interface/Type): Links an LFO to a parameter
  - Attributes: sourceID (LFO), targetID (Parameter), optional modulationMetadata
  - Behavior: Extends base Connection interface with modulation-specific metadata
  - Implementation: Managed by ModulationConnectionManager class (see plan.md)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When an LFO is connected to any parameter, the modulated output values never exceed the parameter's min/max bounds in 100% of test cases
- **SC-002**: Users can predict the modulation range by viewing depth percentage and parameter bounds without trial-and-error experimentation (90% success rate in usability testing)
- **SC-003**: System calculates and applies modulation range in real-time with no perceptible latency (under 1ms for calculation)
- **SC-004**: The feature works consistently across all parameter types (frequency, amplitude, filter cutoff, etc.) without special-case handling
- **SC-005**: Users report increased confidence in setting modulation depth, with 80% agreeing the behavior is intuitive and predictable

## Assumptions

1. Parameters always have well-defined, immutable min/max bounds
2. LFO output is normalized to a bipolar range (e.g., -1 to +1)
3. Depth is expressed as a percentage (0-100%) representing the proportion of available range to use
4. Base value changes are infrequent compared to LFO oscillation rate (no need to optimize for rapid base value changes)
5. The system supports real-time audio processing requirements (low latency)
6. Negative parameter ranges are valid and should be supported (no assumption that min >= 0)
7. When base value is at a boundary, modulation uses the full available range in the allowed direction

## Dependencies

1. Existing LFO component implementation (from feature 005-lfo-runtime-toggle)
2. Parameter system with defined min/max bounds
3. Modulation routing system to connect LFOs to parameters
4. Audio processing infrastructure for real-time calculation

## Out of Scope

- Changing the fundamental shape or frequency response of the LFO waveform
- Adding new waveform types or modulation sources
- Implementing modulation recording or automation
- Creating preset systems for modulation settings
- Visual waveform display or modulation visualization (except basic range feedback per User Story 3)
- Multi-LFO modulation matrix or complex routing
- Sample-accurate modulation (block-based processing is acceptable if it meets SC-003)
